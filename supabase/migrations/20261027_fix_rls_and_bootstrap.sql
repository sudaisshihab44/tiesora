-- =============================================================================
-- Migration: 20261027_fix_rls_and_bootstrap.sql
-- Project:   Tiesora — yuysjdytkofnblusdtvu.supabase.co
-- Purpose:   Fix admin-login routing by creating the missing database policies
--            and correcting the bootstrap_family_admin RPC.
--
-- Verified against live schema (2026-10-27):
--   • profiles(id, email, display_name, full_name, ...)  ← full_name column confirmed
--   • families(id, name, owner_id, description, privacy_settings, ...)
--   • family_memberships(id, family_id, user_id, user_email, user_name, role, status, ...)
--   • RPC bootstrap_family_admin exists but has no ownership guard (old version)
--
-- Safety:
--   • No DROP TABLE, no TRUNCATE, no DELETE, no DISABLE ROW LEVEL SECURITY
--   • Every statement is idempotent (DROP IF EXISTS, ON CONFLICT DO NOTHING, etc.)
--   • Run on an empty DB or a populated DB — result is the same
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1  profiles — allow an authenticated user to INSERT their own row
--
-- Why needed:
--   The only existing profiles policy is SELECT (read-only for authenticated).
--   When auth.ts calls supabase.from('profiles').upsert(...) in signUp(), the
--   INSERT is blocked by RLS with code 42501.  The handle_new_user trigger is
--   the primary path, but this policy is a required fallback.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2  family_memberships — bootstrap INSERT policy
--
-- Why needed:
--   The only existing INSERT policy for family_memberships requires
--   get_user_family_role(family_id) = 'admin'.  That helper queries
--   family_memberships itself, so it always returns NULL for a brand-new
--   family — creating the first row is impossible without a bypass.
--
-- This policy unlocks the bootstrap path for the family owner only:
--   • user_id  = auth.uid()         (own row only)
--   • role     = 'admin'            (cannot bootstrap as viewer)
--   • status   = 'active'
--   • family referenced by family_id must exist and have owner_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Family owner can bootstrap first membership" ON public.family_memberships;

CREATE POLICY "Family owner can bootstrap first membership"
  ON public.family_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role    = 'admin'
    AND status  = 'active'
    AND EXISTS (
      SELECT 1
      FROM   public.families
      WHERE  families.id       = family_memberships.family_id
        AND  families.owner_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3  bootstrap_family_admin RPC — corrected version
--
-- Why needed:
--   The live RPC (old version) has no ownership guard.  It jumps straight to
--   the INSERT and returns a 23503 FK error when the family doesn't exist.
--   When the family DOES exist but the caller doesn't own it, it inserts a row
--   anyway — a security hole.
--
-- This version:
--   1. Rejects calls where auth.uid() ≠ p_user_id         (caller must be the user)
--   2. Rejects calls where family owner ≠ auth.uid()       (caller must own family)
--   3. Uses ON CONFLICT DO UPDATE so it is safe to call twice
--   4. SECURITY DEFINER so it bypasses the RLS bootstrapping catch-22
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bootstrap_family_admin(
  p_family_id UUID,
  p_user_id   UUID,
  p_email     TEXT,
  p_name      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard 1: caller must be the user being bootstrapped
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION
      'Caller (auth.uid=%) is not the user being bootstrapped (%)',
      auth.uid(), p_user_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Guard 2: caller must own the referenced family
  IF NOT EXISTS (
    SELECT 1
    FROM   public.families
    WHERE  id       = p_family_id
      AND  owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION
      'Family % does not exist or caller is not its owner (auth.uid=%)',
      p_family_id, auth.uid()
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert or update the admin membership row
  INSERT INTO public.family_memberships
    (family_id, user_id, user_email, user_name, role, status)
  VALUES
    (p_family_id, p_user_id, p_email, p_name, 'admin', 'active')
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET
    role       = 'admin',
    status     = 'active',
    user_email = EXCLUDED.user_email,
    user_name  = EXCLUDED.user_name;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4  handle_new_user trigger — ensure it exists with ON CONFLICT DO UPDATE
--
-- Why needed:
--   The trigger may not have been applied to this project, or it may be using
--   DO NOTHING which would silently skip profile creation if the row exists
--   but is stale.  ON CONFLICT DO UPDATE ensures it self-heals.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        full_name    = EXCLUDED.full_name,
        email        = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5  Backfill profiles for any existing auth users
--
-- If users signed up before the trigger was created, they have a row in
-- auth.users but no row in profiles.  This fills the gap without touching rows
-- that already exist (ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.profiles (id, email, display_name, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM   auth.users u
WHERE  NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6  Backfill admin memberships for existing family owners
--
-- For every family whose owner has no membership row, insert one.
-- The LEFT JOIN on profiles means this works even if the profiles backfill
-- above inserted no rows (families with no matching profile get empty strings).
-- ON CONFLICT DO NOTHING makes this safe to run repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.family_memberships
  (family_id, user_id, user_email, user_name, role, status)
SELECT
  f.id                              AS family_id,
  f.owner_id                        AS user_id,
  COALESCE(p.email,        '')      AS user_email,
  COALESCE(p.display_name, '')      AS user_name,
  'admin'                           AS role,
  'active'                          AS status
FROM public.families f
LEFT JOIN public.profiles p ON p.id = f.owner_id
WHERE NOT EXISTS (
  SELECT 1
  FROM   public.family_memberships m
  WHERE  m.family_id = f.id
    AND  m.user_id   = f.owner_id
)
ON CONFLICT (family_id, user_id) DO NOTHING;
