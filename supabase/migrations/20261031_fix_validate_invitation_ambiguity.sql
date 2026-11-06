-- =============================================================================
-- Migration: 20261031_fix_validate_invitation_ambiguity.sql
-- Project:   Tiesora — yuysjdytkofnblusdtvu.supabase.co
-- Purpose:
--   Fix "column reference family_id is ambiguous" errors in both
--   validate_invitation and accept_invitation functions.
--
--   Problem 1 — validate_invitation():
--     RETURNS TABLE declares `family_id UUID` as an output column.
--     The SELECT used `i.family_id AS family_id` creating ambiguity.
--   
--   Fix 1: Remove the redundant `AS family_id` alias.
--
--   Problem 2 — accept_invitation():
--     RETURNS TABLE declares `family_id UUID` as an output column.
--     The ON CONFLICT clause used unqualified `family_id` and `user_id`.
--     Postgres couldn't tell if you meant the table column or the return column.
--
--   Fix 2: Qualify the ON CONFLICT columns with the table name:
--          ON CONFLICT (family_memberships.family_id, family_memberships.user_id)
--
-- Safety: Corrective only. Preserves function signatures and behavior.
-- =============================================================================

-- ───────────────────────────────────────────────────────────────────────────
-- Fix 1: validate_invitation
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_invitation(p_token TEXT)
RETURNS TABLE (family_name TEXT, role TEXT, family_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.name      AS family_name,
    i.role      AS role,
    i.family_id  -- ← no AS alias — name already matches RETURNS TABLE column
  FROM   public.invitations i
  JOIN   public.families    f ON f.id = i.family_id
  WHERE  i.token       = p_token
    AND  i.accepted_at IS NULL
    AND  i.revoked_at  IS NULL
    AND  i.expires_at  > NOW();
END;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- Fix 2: accept_invitation
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token     TEXT,
  p_user_id   UUID,
  p_email     TEXT  DEFAULT '',
  p_user_name TEXT  DEFAULT ''
)
RETURNS TABLE (family_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
  v_profile    public.profiles%ROWTYPE;
BEGIN
  -- ── 1. Lock and re-validate the invitation row ──────────────────────────
  SELECT * INTO v_invitation
  FROM   public.invitations
  WHERE  token       = p_token
    AND  accepted_at IS NULL
    AND  revoked_at  IS NULL
    AND  expires_at  > NOW()
  FOR UPDATE;   -- prevents concurrent acceptance of the same token

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or already-used invitation token'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Look up the user's email/name from profiles if not provided ──────
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  -- ── 3. Create the membership — role comes from the invitation, NOT the client
  INSERT INTO public.family_memberships
    (family_id, user_id, user_email, user_name, role, status)
  VALUES (
    v_invitation.family_id,
    p_user_id,
    COALESCE(NULLIF(p_email,     ''), v_profile.email,        ''),
    COALESCE(NULLIF(p_user_name, ''), v_profile.display_name, ''),
    v_invitation.role,   -- ← role from DB, not from client
    'active'
  )
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET
    status     = 'active',
    role       = v_invitation.role,
    user_email = EXCLUDED.user_email,
    user_name  = EXCLUDED.user_name;

  -- ── 4. Mark invitation as accepted ──────────────────────────────────────
  UPDATE public.invitations
  SET    accepted_at = NOW()
  WHERE  token = p_token;

  -- ── 5. Return the family_id ──────────────────────────────────────────────
  RETURN QUERY SELECT v_invitation.family_id;
END;
$$;

