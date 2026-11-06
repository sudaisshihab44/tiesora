-- =============================================================================
-- Migration: 20261031_APPLY_THIS_fix_invitation_ambiguity.sql
-- Project:   Tiesora — yuysjdytkofnblusdtvu.supabase.co
-- 
-- **APPLY THIS MIGRATION TO SUPABASE SQL EDITOR NOW**
--
-- Purpose:
--   Fix "column reference family_id is ambiguous" in accept_invitation().
--   
--   When a user clicks "Join Family", the accept_invitation RPC inserts a
--   membership row with ON CONFLICT (family_id, user_id).
--   
--   The function has:
--     RETURNS TABLE (family_id UUID)  ← output column named family_id
--   
--   The INSERT has:
--     ON CONFLICT (family_id, user_id)  ← unqualified column names
--   
--   Postgres doesn't know if family_id means:
--     • family_memberships.family_id (table column)
--     • the RETURNS TABLE output column
--   
--   Fix: Qualify the ON CONFLICT columns with the table name.
--
-- Also fixes validate_invitation (same pattern but in SELECT clause).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: validate_invitation — remove ambiguous AS family_id alias
-- ─────────────────────────────────────────────────────────────────────────────
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
    i.family_id  -- ← no AS alias to avoid ambiguity with RETURNS TABLE column
  FROM   public.invitations i
  JOIN   public.families    f ON f.id = i.family_id
  WHERE  i.token       = p_token
    AND  i.accepted_at IS NULL
    AND  i.revoked_at  IS NULL
    AND  i.expires_at  > NOW();
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 2: accept_invitation — qualify ON CONFLICT columns with table name
-- ─────────────────────────────────────────────────────────────────────────────
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
  -- ── 1. Lock and re-validate the invitation row ────────────────────────────
  SELECT * INTO v_invitation
  FROM   public.invitations
  WHERE  token       = p_token
    AND  accepted_at IS NULL
    AND  revoked_at  IS NULL
    AND  expires_at  > NOW()
  FOR UPDATE;   -- prevents concurrent acceptance

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or already-used invitation token'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 2. Look up user's email/name from profiles if not provided ────────────
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  -- ── 3. Create membership — role comes from invitation, NOT client ──────────
  INSERT INTO public.family_memberships
    (family_id, user_id, user_email, user_name, role, status)
  VALUES (
    v_invitation.family_id,
    p_user_id,
    COALESCE(NULLIF(p_email,     ''), v_profile.email,        ''),
    COALESCE(NULLIF(p_user_name, ''), v_profile.display_name, ''),
    v_invitation.role,
    'active'
  )
  ON CONFLICT (family_memberships.family_id, family_memberships.user_id)
  --            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ qualified to avoid ambiguity
  DO UPDATE SET
    status     = 'active',
    role       = v_invitation.role,
    user_email = EXCLUDED.user_email,
    user_name  = EXCLUDED.user_name;

  -- ── 4. Mark invitation as accepted ─────────────────────────────────────────
  UPDATE public.invitations
  SET    accepted_at = NOW()
  WHERE  token = p_token;

  -- ── 5. Return the family_id ────────────────────────────────────────────────
  RETURN QUERY SELECT v_invitation.family_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Success message
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Migration 20261031 applied successfully.';
  RAISE NOTICE 'Both validate_invitation and accept_invitation have been updated.';
  RAISE NOTICE 'The "column reference family_id is ambiguous" error should be resolved.';
END $$;
