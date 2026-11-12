-- =============================================================================
-- Migration: 20261030_create_invitation_rpc.sql
-- Project:   Tiesora — yuysjdytkofnblusdtvu.supabase.co
-- Purpose:
--   The UserManagementPage writes invitations to localStorage only.
--   When the viewer validates the token it queries the Supabase invitations
--   table — finds nothing — and returns "Invalid, expired, or already-used."
--
--   This migration provides a SECURITY DEFINER RPC that:
--     1. Validates the caller is an active admin of the family
--     2. Inserts the invitation row into the real invitations table
--     3. Returns the generated token so the frontend can build the link
--
--   It also confirms the invitations table columns used match the schema.
--
-- Safety: Additive only. No DROP TABLE, no TRUNCATE, no DELETE, no DISABLE RLS.
-- Idempotent: CREATE OR REPLACE.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: create_invitation
--
-- Creates a secure invitation record in the invitations table.
-- Only callable by an active admin of the specified family.
--
-- Parameters:
--   p_family_id UUID   — the family to invite the person into
--   p_email     TEXT   — invitee email (informational; not a FK)
--   p_role      TEXT   — 'admin' or 'viewer' (validated)
--   p_expires_in_days INT — how many days until expiry (default 7)
--
-- Returns: TABLE (token TEXT, link_fragment TEXT)
--   token         — the raw token to embed in the invitation link
--   link_fragment — '#invite=' || token (convenience for the frontend)
--
-- Security:
--   • SECURITY DEFINER — runs as owner, bypasses RLS on INSERT
--   • Validates auth.uid() is not null
--   • Validates caller has active admin membership in the target family
--   • Role is validated server-side (only 'admin' | 'viewer' accepted)
--   • Token is generated using extensions.gen_random_bytes() from pgcrypto
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_family_id      UUID,
  p_email          TEXT,
  p_role           TEXT  DEFAULT 'viewer',
  p_expires_in_days INT  DEFAULT 7
)
RETURNS TABLE (token TEXT, link_fragment TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_role_chk  TEXT;
  v_token     TEXT;
  v_expires   TIMESTAMPTZ;
BEGIN
  -- ── Guard: must be authenticated ──────────────────────────────────────────
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- ── Guard: caller must be an active admin of this family ──────────────────
  SELECT fm.role INTO v_role_chk
  FROM   public.family_memberships fm
  WHERE  fm.family_id = p_family_id
    AND  fm.user_id   = v_caller
    AND  fm.status    = 'active'
  LIMIT  1;

  IF v_role_chk IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only family admins can create invitations'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Guard: role must be valid ──────────────────────────────────────────────
  IF p_role NOT IN ('admin', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: must be admin or viewer'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Generate a cryptographically secure token ──────────────────────────────
  -- Use extensions.gen_random_bytes() from pgcrypto (confirmed installed in
  -- the extensions schema). 24 bytes → 32 base64 chars (URL-safe after translate).
  v_token := translate(
    encode(extensions.gen_random_bytes(24), 'base64'),
    '+/=', '-_'
  );
  v_expires := NOW() + (p_expires_in_days || ' days')::INTERVAL;

  -- ── Insert the invitation ──────────────────────────────────────────────────
  INSERT INTO public.invitations
    (family_id, email, role, token, expires_at, created_by)
  VALUES
    (p_family_id, lower(trim(p_email)), p_role, v_token, v_expires, v_caller);

  -- ── Return token and convenience fragment ──────────────────────────────────
  RETURN QUERY SELECT v_token, '#invite=' || v_token;
END;
$$;

-- Only authenticated users may call this
REVOKE ALL  ON FUNCTION public.create_invitation(UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, TEXT, INT) TO authenticated;
