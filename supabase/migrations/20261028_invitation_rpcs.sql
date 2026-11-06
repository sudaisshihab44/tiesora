-- =============================================================================
-- Migration: 20261028_invitation_rpcs.sql
-- Project:   Tiesora — yuysjdytkofnblusdtvu.supabase.co
-- Purpose:   Add SECURITY DEFINER RPCs for safe invitation validation and
--            acceptance.  The client NEVER specifies a role — the DB reads it
--            from the invitations table, preventing self-promotion.
--
-- Depends on: APPLY_TO_SUPABASE.sql (invitations table, family_memberships)
--             20261027_fix_rls_and_bootstrap.sql (bootstrap RLS policies)
--
-- Safety:  Additive only. No DROP TABLE, no TRUNCATE, no DELETE, no DISABLE RLS.
--          Idempotent — safe to re-run.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: validate_invitation(p_token TEXT)
--
-- Returns a single-row result with family_name and role if the token is:
--   • present in the invitations table
--   • not yet accepted (accepted_at IS NULL)
--   • not revoked (revoked_at IS NULL)
--   • not expired (expires_at > NOW())
--
-- Returns an empty result set for any invalid token.
-- Does NOT modify any data — safe to call multiple times.
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
    i.family_id -- no alias needed — column name matches RETURNS TABLE
  FROM   public.invitations i
  JOIN   public.families    f ON f.id = i.family_id
  WHERE  i.token       = p_token
    AND  i.accepted_at IS NULL
    AND  i.revoked_at  IS NULL
    AND  i.expires_at  > NOW();
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: accept_invitation(p_token TEXT, p_user_id UUID, p_user_name TEXT)
--
-- Atomically:
--   1. Re-validates the token (prevents TOCTOU race conditions)
--   2. Inserts a family_memberships row with the role from the invitation
--      (client NEVER specifies the role — it comes from the DB)
--   3. Marks the invitation as accepted
--
-- Returns: family_id of the joined family
-- Raises P0001 for any invalid/expired/already-used token.
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
  ON CONFLICT (family_memberships.family_id, family_memberships.user_id)
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


-- ─────────────────────────────────────────────────────────────────────────────
-- GRANT execute on both RPCs to authenticated users
-- (SECURITY DEFINER means they run as the owner, but we still need GRANT EXECUTE)
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.validate_invitation(TEXT)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, UUID, TEXT, TEXT)         TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: invitations table — ensure viewers can read invitations addressed to them
-- (needed for validate_invitation to work even though it is SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────
-- The existing "Admins can view invitations" policy covers admins.
-- Add a policy so any authenticated user can read an invitation sent to their email.
DROP POLICY IF EXISTS "Invitee can read own invitation" ON public.invitations;
CREATE POLICY "Invitee can read own invitation"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (auth.email() = email);
