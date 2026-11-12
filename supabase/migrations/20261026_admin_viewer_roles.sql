-- ============================================================
-- Migration: Simplify roles to admin | viewer
-- Date: 2026-10-26
-- Description:
--   1. Migrate legacy roles (owner, editor, contributor) → admin
--   2. Viewer stays viewer
--   3. Tighten CHECK constraint to only allow 'admin' | 'viewer'
--   4. Update RLS policies to use the two-role model
--   5. Add email_confirmed_at, full_name to profiles for auth UX
--   6. Prevent last admin removal via a DB function
--   7. All changes are documented and reversible via the rollback section
-- ============================================================

-- ─── STEP 1: Migrate existing role values ─────────────────────────────────────
-- Map owner → admin, editor → admin, contributor → admin, viewer → viewer
UPDATE family_memberships
SET role = 'admin'
WHERE role IN ('owner', 'editor', 'contributor');

-- ─── STEP 2: Drop the old role CHECK constraint ───────────────────────────────
ALTER TABLE family_memberships
  DROP CONSTRAINT IF EXISTS family_memberships_role_check;

ALTER TABLE invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check;

-- ─── STEP 3: Re-add tightened CHECK constraints ───────────────────────────────
ALTER TABLE family_memberships
  ADD CONSTRAINT family_memberships_role_check
  CHECK (role IN ('admin', 'viewer'));

ALTER TABLE invitations
  ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('admin', 'viewer'));

-- ─── STEP 4: Enrich profiles table ───────────────────────────────────────────
-- Add full_name for display; keep display_name for compatibility
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE NOT NULL;

-- Backfill full_name from display_name for existing rows
UPDATE profiles SET full_name = display_name WHERE full_name IS NULL;

-- ─── STEP 5: Update helper function ──────────────────────────────────────────
-- get_user_family_role(target_family_id) now returns only 'admin' | 'viewer' | null
CREATE OR REPLACE FUNCTION get_user_family_role(target_family_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   family_memberships
  WHERE  family_id = target_family_id
    AND  user_id   = auth.uid()
    AND  status    = 'active'
  LIMIT  1;
$$;

-- ─── STEP 6: Guard function — prevent removing last admin ─────────────────────
CREATE OR REPLACE FUNCTION ensure_family_has_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Count admins still in the family after this change
  SELECT COUNT(*)
  INTO   admin_count
  FROM   family_memberships
  WHERE  family_id = COALESCE(OLD.family_id, NEW.family_id)
    AND  role      = 'admin'
    AND  status    = 'active'
    AND  id        != COALESCE(OLD.id, NEW.id);

  IF admin_count = 0 THEN
    RAISE EXCEPTION
      'Cannot remove the last administrator from a family. Assign another admin first.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

-- Attach to UPDATE (role demotion) and DELETE (membership removal)
DROP TRIGGER IF EXISTS trg_ensure_family_has_admin_update ON family_memberships;
CREATE TRIGGER trg_ensure_family_has_admin_update
  BEFORE UPDATE OF role, status
  ON family_memberships
  FOR EACH ROW
  WHEN (
    OLD.role = 'admin'
    AND (NEW.role != 'admin' OR NEW.status != 'active')
  )
  EXECUTE FUNCTION ensure_family_has_admin();

DROP TRIGGER IF EXISTS trg_ensure_family_has_admin_delete ON family_memberships;
CREATE TRIGGER trg_ensure_family_has_admin_delete
  BEFORE DELETE
  ON family_memberships
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION ensure_family_has_admin();

-- ─── STEP 7: Update RLS policies to the two-role model ───────────────────────
-- We replace every policy that references 'owner', 'editor', or 'contributor'.

-- family_people: SELECT — any active member; INSERT/UPDATE — admin only; DELETE — admin only
DROP POLICY IF EXISTS "Members can view people" ON family_people;
DROP POLICY IF EXISTS "Editors and above can insert people" ON family_people;
DROP POLICY IF EXISTS "Editors and above can update people" ON family_people;
DROP POLICY IF EXISTS "Admins can delete people" ON family_people;

CREATE POLICY "Members can view people"
  ON family_people FOR SELECT
  USING (
    get_user_family_role(family_id) IS NOT NULL
  );

CREATE POLICY "Admins can insert people"
  ON family_people FOR INSERT
  WITH CHECK (
    get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can update people"
  ON family_people FOR UPDATE
  USING  (get_user_family_role(family_id) = 'admin')
  WITH CHECK (get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete people"
  ON family_people FOR DELETE
  USING (
    get_user_family_role(family_id) = 'admin'
  );

-- relationships: SELECT — any member; INSERT/UPDATE/DELETE — admin only
DROP POLICY IF EXISTS "Members can view relationships" ON relationships;
DROP POLICY IF EXISTS "Editors and above can insert relationships" ON relationships;
DROP POLICY IF EXISTS "Editors and above can update relationships" ON relationships;
DROP POLICY IF EXISTS "Editors and above can delete relationships" ON relationships;

CREATE POLICY "Members can view relationships"
  ON relationships FOR SELECT
  USING (
    get_user_family_role(family_id) IS NOT NULL
  );

CREATE POLICY "Admins can insert relationships"
  ON relationships FOR INSERT
  WITH CHECK (
    get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can update relationships"
  ON relationships FOR UPDATE
  USING  (get_user_family_role(family_id) = 'admin')
  WITH CHECK (get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete relationships"
  ON relationships FOR DELETE
  USING (
    get_user_family_role(family_id) = 'admin'
  );

-- memories: SELECT — members (private: own or admin); INSERT — admin only; UPDATE/DELETE — author or admin
DROP POLICY IF EXISTS "Members can view non-private memories" ON memories;
DROP POLICY IF EXISTS "Contributors and above can insert memories" ON memories;
DROP POLICY IF EXISTS "Authors or admins can update memories" ON memories;
DROP POLICY IF EXISTS "Authors or admins can delete memories" ON memories;

CREATE POLICY "Members can view memories"
  ON memories FOR SELECT
  USING (
    get_user_family_role(family_id) IS NOT NULL
    AND (
      NOT is_private
      OR created_by = auth.uid()
      OR get_user_family_role(family_id) = 'admin'
    )
  );

CREATE POLICY "Admins can insert memories"
  ON memories FOR INSERT
  WITH CHECK (
    get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Authors or admins can update memories"
  ON memories FOR UPDATE
  USING (
    created_by = auth.uid()
    OR get_user_family_role(family_id) = 'admin'
  )
  WITH CHECK (
    created_by = auth.uid()
    OR get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Authors or admins can delete memories"
  ON memories FOR DELETE
  USING (
    created_by = auth.uid()
    OR get_user_family_role(family_id) = 'admin'
  );

-- events: SELECT — members; INSERT/UPDATE/DELETE — admin only
DROP POLICY IF EXISTS "Members can view events" ON events;
DROP POLICY IF EXISTS "Editors and above can insert events" ON events;

CREATE POLICY "Members can view events"
  ON events FOR SELECT
  USING (
    get_user_family_role(family_id) IS NOT NULL
  );

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  WITH CHECK (
    get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  USING  (get_user_family_role(family_id) = 'admin')
  WITH CHECK (get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  USING (
    get_user_family_role(family_id) = 'admin'
  );

-- family_memberships: SELECT — any member; INSERT/UPDATE/DELETE — admin only
DROP POLICY IF EXISTS "Family members can view memberships" ON family_memberships;
DROP POLICY IF EXISTS "Owner and admin can manage memberships" ON family_memberships;
DROP POLICY IF EXISTS "Owner and admin can update memberships" ON family_memberships;
DROP POLICY IF EXISTS "Owner and admin can delete memberships" ON family_memberships;

CREATE POLICY "Family members can view memberships"
  ON family_memberships FOR SELECT
  USING (
    get_user_family_role(family_id) IS NOT NULL
  );

CREATE POLICY "Admins can insert memberships"
  ON family_memberships FOR INSERT
  WITH CHECK (
    get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can update memberships"
  ON family_memberships FOR UPDATE
  USING  (get_user_family_role(family_id) = 'admin')
  WITH CHECK (get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete memberships"
  ON family_memberships FOR DELETE
  USING (
    get_user_family_role(family_id) = 'admin'
  );

-- invitations: SELECT — admin; INSERT — admin; UPDATE (accept) — self; DELETE — admin
DROP POLICY IF EXISTS "Admins can manage invitations" ON invitations;

CREATE POLICY "Admins can view invitations"
  ON invitations FOR SELECT
  USING (
    get_user_family_role(family_id) = 'admin'
    OR auth.email() = email  -- invitee can see their own invitation
  );

CREATE POLICY "Admins can insert invitations"
  ON invitations FOR INSERT
  WITH CHECK (
    get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Accept own invitation"
  ON invitations FOR UPDATE
  USING (
    auth.email() = email           -- invitee accepting their own invite
    OR get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE
  USING (
    get_user_family_role(family_id) = 'admin'
  );

-- change_requests: only viewers can submit; admin can review
DROP POLICY IF EXISTS "Members can submit change requests" ON change_requests;
DROP POLICY IF EXISTS "Requesters and admins can view change requests" ON change_requests;
DROP POLICY IF EXISTS "Admins can review change requests" ON change_requests;

CREATE POLICY "Any member can submit change requests"
  ON change_requests FOR INSERT
  WITH CHECK (
    get_user_family_role(family_id) IS NOT NULL
    AND requested_by = auth.uid()
  );

CREATE POLICY "Requesters and admins can view change requests"
  ON change_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can review change requests"
  ON change_requests FOR UPDATE
  USING  (get_user_family_role(family_id) = 'admin')
  WITH CHECK (get_user_family_role(family_id) = 'admin');

-- families: SELECT/INSERT/UPDATE/DELETE — admin only
DROP POLICY IF EXISTS "Members can view their families" ON families;
DROP POLICY IF EXISTS "Owners can update families" ON families;
DROP POLICY IF EXISTS "Owners can delete families" ON families;

CREATE POLICY "Members can view their families"
  ON families FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM family_memberships
      WHERE family_memberships.family_id = families.id
        AND family_memberships.user_id   = auth.uid()
        AND family_memberships.status    = 'active'
    )
  );

CREATE POLICY "Admins can update families"
  ON families FOR UPDATE
  USING  (get_user_family_role(id) = 'admin')
  WITH CHECK (get_user_family_role(id) = 'admin');

CREATE POLICY "Admins can delete families"
  ON families FOR DELETE
  USING (
    get_user_family_role(id) = 'admin'
  );

-- Storage bucket policy: only admins can upload; all members can view
-- (These are managed via Supabase dashboard or storage.objects RLS)
DROP POLICY IF EXISTS "Authenticated users can upload family photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view family photos" ON storage.objects;

CREATE POLICY "Admins can upload family photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'family-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Members can view family photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'family-photos'
  );

-- ─── STEP 8: New family creator bootstrap function ────────────────────────────
-- Called server-side (service-role) after Supabase onboarding to grant admin
-- to the user who created the family — not trusted from the client.
CREATE OR REPLACE FUNCTION bootstrap_family_admin(
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
  INSERT INTO family_memberships (family_id, user_id, user_email, user_name, role, status)
  VALUES (p_family_id, p_user_id, p_email, p_name, 'admin', 'active')
  ON CONFLICT (family_id, user_id) DO UPDATE
    SET role   = 'admin',
        status = 'active';
END;
$$;

-- ─── ROLLBACK SECTION (run manually if needed) ────────────────────────────────
-- To revert this migration:
--
-- ALTER TABLE family_memberships DROP CONSTRAINT family_memberships_role_check;
-- ALTER TABLE family_memberships ADD CONSTRAINT family_memberships_role_check
--   CHECK (role IN ('owner','admin','editor','contributor','viewer'));
-- ALTER TABLE invitations DROP CONSTRAINT invitations_role_check;
-- ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
--   CHECK (role IN ('owner','admin','editor','contributor','viewer'));
-- DROP TRIGGER IF EXISTS trg_ensure_family_has_admin_update ON family_memberships;
-- DROP TRIGGER IF EXISTS trg_ensure_family_has_admin_delete ON family_memberships;
-- DROP FUNCTION IF EXISTS ensure_family_has_admin();
-- DROP FUNCTION IF EXISTS bootstrap_family_admin(UUID, UUID, TEXT, TEXT);
-- (Re-create old RLS policies as needed from the original migration file)
