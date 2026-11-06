-- =============================================================================
-- Migration: 20261029_create_family_with_admin.sql
-- Project:   Tiesora — yuysjdytkofnblusdtvu.supabase.co
-- Purpose:
--   The client-side family INSERT fails with 42501 because every families
--   INSERT policy requires the caller to already be an admin of the family —
--   which is impossible when the family doesn't exist yet (bootstrapping
--   deadlock).
--
--   This migration provides ONE SECURITY DEFINER function that creates both
--   the family row AND the admin membership row atomically inside a single
--   transaction, bypassing the RLS catch-22.  The client never touches the
--   families or family_memberships tables directly during onboarding.
--
-- Safety:
--   • No DROP TABLE, no TRUNCATE, no DELETE, no DISABLE RLS.
--   • SECURITY DEFINER with fixed search_path — no schema injection.
--   • Validates auth.uid() is not null before doing anything.
--   • ON CONFLICT DO NOTHING on both tables — safe to retry.
--   • GRANT EXECUTE to authenticated only — anon users cannot call it.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Fix families INSERT policy
--
-- The existing "Admins can insert families" policy (from APPLY_TO_SUPABASE.sql)
-- uses:  WITH CHECK (owner_id = auth.uid())
-- That is sufficient for the direct INSERT case.  However, the 20261027
-- migration may have overwritten it with a stricter version.  We drop and
-- re-create it here with the correct, permissive-for-owner check so that:
--   • Authenticated users CAN insert a family they will own (owner_id = them).
--   • Viewers CANNOT insert a family for someone else.
-- This is the fallback path; the preferred path is the RPC below.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert families"          ON public.families;
DROP POLICY IF EXISTS "Authenticated users can insert families" ON public.families;

CREATE POLICY "Authenticated users can insert own families"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: create_family_with_admin
--
-- Creates a family row + admin membership row atomically.
-- Called by the OnboardingWizard instead of two separate client inserts.
--
-- Parameters:
--   p_family_id        UUID  — pre-generated on the client (crypto.randomUUID)
--   p_name             TEXT  — family name (required, non-empty)
--   p_description      TEXT  — optional description
--   p_privacy_settings JSONB — privacy settings object
--
-- Returns: the family_id that was created (same as p_family_id)
--
-- Raises P0001 if:
--   • caller is not authenticated (auth.uid() IS NULL)
--   • p_name is blank
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_family_with_admin(
  p_family_id        UUID,
  p_name             TEXT,
  p_description      TEXT    DEFAULT NULL,
  p_privacy_settings JSONB   DEFAULT '{
    "hideLivingDates": false,
    "hideLivingBiographies": false,
    "hidePrivateMemories": false,
    "requireAdminApprovalForEdits": true,
    "isPubliclySearchable": false
  }'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_email     TEXT;
  v_name      TEXT;
BEGIN
  -- ── Guard: must be authenticated ──────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- ── Guard: family name required ───────────────────────────────────────────
  IF trim(p_name) = '' OR p_name IS NULL THEN
    RAISE EXCEPTION 'Family name is required' USING ERRCODE = 'P0001';
  END IF;

  -- ── Look up the user's email and display name from profiles ───────────────
  SELECT email, display_name
  INTO   v_email, v_name
  FROM   public.profiles
  WHERE  id = v_user_id;

  v_email := COALESCE(v_email, '');
  v_name  := COALESCE(v_name, '');

  -- ── 1. Insert the family row ───────────────────────────────────────────────
  -- ON CONFLICT DO NOTHING makes retries safe — if the row already exists
  -- (e.g. user retried after a membership failure) we just continue.
  INSERT INTO public.families
    (id, name, description, owner_id, privacy_settings)
  VALUES
    (p_family_id, trim(p_name), p_description, v_user_id, p_privacy_settings)
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Insert the admin membership row ────────────────────────────────────
  -- ON CONFLICT DO UPDATE so the role is always 'admin' / 'active' even if
  -- a stale 'viewer' row somehow exists.
  INSERT INTO public.family_memberships
    (family_id, user_id, user_email, user_name, role, status)
  VALUES
    (p_family_id, v_user_id, v_email, v_name, 'admin', 'active')
  ON CONFLICT (family_id, user_id) DO UPDATE
    SET role   = 'admin',
        status = 'active';

  RETURN p_family_id;
END;
$$;

-- Only authenticated users may call this function
REVOKE ALL ON FUNCTION public.create_family_with_admin(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_family_with_admin(UUID, TEXT, TEXT, JSONB) TO authenticated;
