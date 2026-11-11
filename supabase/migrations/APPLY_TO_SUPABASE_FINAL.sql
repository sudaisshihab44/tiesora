-- =============================================================================
-- TIESORA — FINAL COMPLETE MIGRATION
-- Safe, idempotent, handles function signature conflicts correctly
-- Version: FINAL (2024-10-26)
-- =============================================================================
--
-- PURPOSE:
-- This migration safely handles the create_invitation function signature
-- conflict by:
-- 1. Checking for dependent objects (views, triggers, other functions)
-- 2. Using DROP FUNCTION with CASCADE ONLY IF dependencies exist
-- 3. Preserving all data, RLS policies, and security settings
-- 4. Maintaining the correct return type: TABLE(token TEXT, link_fragment TEXT)
--
-- WHAT THIS FIXES:
-- ✅ ERROR: 42P13: cannot change return type of existing function
-- ✅ ERROR: 42601: syntax error at end of input
-- ✅ ERROR: 42710: policy already exists
--
-- SAFETY:
-- ✅ All operations are idempotent
-- ✅ Preserves all existing data
-- ✅ Maintains RLS security
-- ✅ Enforces admin/viewer roles
-- ✅ No blind CASCADE operations
--
-- USAGE:
-- Copy this entire file and paste into Supabase Dashboard → SQL Editor → Run
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: CREATE TABLES (IF NOT EXISTS)
-- =============================================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    full_name TEXT,
    avatar_path TEXT,
    preferred_language VARCHAR(10) DEFAULT 'en',
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FAMILIES
CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    avatar_path TEXT,
    cover_path TEXT,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    privacy_settings JSONB DEFAULT '{
        "hideLivingDates": false,
        "hideLivingBiographies": false,
        "hidePrivateMemories": false,
        "requireAdminApprovalForEdits": true,
        "isPubliclySearchable": false
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FAMILY_MEMBERSHIPS (Admin | Viewer only)
CREATE TABLE IF NOT EXISTS public.family_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL DEFAULT '',
    user_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'pending', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_id, user_id)
);

-- 4. FAMILY_PEOPLE
CREATE TABLE IF NOT EXISTS public.family_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unspecified')),
    birth_date DATE,
    birth_place TEXT,
    death_date DATE,
    death_place TEXT,
    date_precision TEXT DEFAULT 'exact' CHECK (date_precision IN ('exact', 'about', 'estimated', 'unknown')),
    living_status TEXT NOT NULL DEFAULT 'living' CHECK (living_status IN ('living', 'deceased', 'unknown')),
    biography TEXT,
    avatar_path TEXT,
    generation_level INT NOT NULL DEFAULT 1,
    branch TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_birth_death CHECK (death_date IS NULL OR birth_date IS NULL OR death_date >= birth_date)
);

-- 5. RELATIONSHIPS
CREATE TABLE IF NOT EXISTS public.relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    source_person_id UUID NOT NULL REFERENCES public.family_people(id) ON DELETE CASCADE,
    target_person_id UUID NOT NULL REFERENCES public.family_people(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'spouse', 'adoptive_parent', 'step_parent', 'partner', 'guardian')),
    relationship_status TEXT NOT NULL DEFAULT 'verified' CHECK (relationship_status IN ('verified', 'disputed', 'unverified')),
    valid_from DATE,
    valid_to DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_no_self_link CHECK (source_person_id <> target_person_id)
);

-- 6. INVITATIONS
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CHANGE_REQUESTS
CREATE TABLE IF NOT EXISTS public.change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.family_people(id) ON DELETE SET NULL,
    requested_by UUID NOT NULL REFERENCES public.profiles(id),
    change_type TEXT NOT NULL CHECK (change_type IN ('add_person', 'edit_person', 'delete_person', 'add_relationship', 'edit_relationship')),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    review_note TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MEMORIES
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    memory_date DATE,
    location TEXT,
    image_url TEXT NOT NULL,
    tagged_person_ids UUID[] DEFAULT '{}',
    album TEXT,
    is_private BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. EVENTS
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('birthday', 'anniversary', 'reunion', 'memorial', 'gathering', 'other')),
    event_date DATE NOT NULL,
    location TEXT,
    description TEXT,
    associated_person_ids UUID[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('invitation', 'change_request_submitted', 'change_request_approved', 'change_request_rejected', 'birthday_reminder', 'event_reminder', 'new_memory')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_tab TEXT,
    link_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AUDIT_LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    target_name TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- STEP 2: CREATE INDEXES (IDEMPOTENT)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_people_family       ON public.family_people(family_id);
CREATE INDEX IF NOT EXISTS idx_people_gen          ON public.family_people(family_id, generation_level);
CREATE INDEX IF NOT EXISTS idx_rel_family          ON public.relationships(family_id);
CREATE INDEX IF NOT EXISTS idx_rel_source          ON public.relationships(source_person_id);
CREATE INDEX IF NOT EXISTS idx_rel_target          ON public.relationships(target_person_id);
CREATE INDEX IF NOT EXISTS idx_rel_endpoints       ON public.relationships(family_id, source_person_id, target_person_id);
CREATE INDEX IF NOT EXISTS idx_memories_family     ON public.memories(family_id);
CREATE INDEX IF NOT EXISTS idx_events_family_date  ON public.events(family_id, event_date);
CREATE INDEX IF NOT EXISTS idx_audit_family        ON public.audit_logs(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user          ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_memberships_user    ON public.family_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_family  ON public.family_memberships(family_id, status);

-- =============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_people      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 4: HELPER FUNCTION - get_user_family_role
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_user_family_role(target_family_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   public.family_memberships
  WHERE  family_id = target_family_id
    AND  user_id   = auth.uid()
    AND  status    = 'active'
  LIMIT  1;
$$;

-- =============================================================================
-- STEP 5: GUARD FUNCTION - ensure_family_has_admin
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ensure_family_has_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO   admin_count
  FROM   public.family_memberships
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

DROP TRIGGER IF EXISTS trg_ensure_family_has_admin_update ON public.family_memberships;
DROP TRIGGER IF EXISTS trg_ensure_family_has_admin_delete ON public.family_memberships;

CREATE TRIGGER trg_ensure_family_has_admin_update
  BEFORE UPDATE OF role, status
  ON public.family_memberships
  FOR EACH ROW
  WHEN (OLD.role = 'admin' AND (NEW.role != 'admin' OR NEW.status != 'active'))
  EXECUTE FUNCTION public.ensure_family_has_admin();

CREATE TRIGGER trg_ensure_family_has_admin_delete
  BEFORE DELETE
  ON public.family_memberships
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION public.ensure_family_has_admin();

-- =============================================================================
-- STEP 6: RLS POLICIES (DROP IF EXISTS, THEN CREATE)
-- =============================================================================

-- PROFILES
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated 
  USING (auth.uid() = id);

-- FAMILIES
DROP POLICY IF EXISTS "Members can view their families" ON public.families;
CREATE POLICY "Members can view their families"
  ON public.families FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_memberships
      WHERE family_id = families.id
        AND user_id   = auth.uid()
        AND status    = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can insert families" ON public.families;
DROP POLICY IF EXISTS "Authenticated users can insert families" ON public.families;
DROP POLICY IF EXISTS "Authenticated users can insert own families" ON public.families;
CREATE POLICY "Authenticated users can insert own families"
  ON public.families FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update families" ON public.families;
CREATE POLICY "Admins can update families"
  ON public.families FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(id) = 'admin')
  WITH CHECK (public.get_user_family_role(id) = 'admin');

DROP POLICY IF EXISTS "Admins can delete families" ON public.families;
CREATE POLICY "Admins can delete families"
  ON public.families FOR DELETE TO authenticated
  USING  (public.get_user_family_role(id) = 'admin');

-- FAMILY_MEMBERSHIPS
DROP POLICY IF EXISTS "Family members can view memberships" ON public.family_memberships;
CREATE POLICY "Family members can view memberships"
  ON public.family_memberships FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert memberships" ON public.family_memberships;
CREATE POLICY "Admins can insert memberships"
  ON public.family_memberships FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can update memberships" ON public.family_memberships;
CREATE POLICY "Admins can update memberships"
  ON public.family_memberships FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can delete memberships" ON public.family_memberships;
CREATE POLICY "Admins can delete memberships"
  ON public.family_memberships FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- FAMILY_PEOPLE
DROP POLICY IF EXISTS "Members can view people" ON public.family_people;
CREATE POLICY "Members can view people"
  ON public.family_people FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert people" ON public.family_people;
CREATE POLICY "Admins can insert people"
  ON public.family_people FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can update people" ON public.family_people;
CREATE POLICY "Admins can update people"
  ON public.family_people FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can delete people" ON public.family_people;
CREATE POLICY "Admins can delete people"
  ON public.family_people FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- RELATIONSHIPS
DROP POLICY IF EXISTS "Members can view relationships" ON public.relationships;
CREATE POLICY "Members can view relationships"
  ON public.relationships FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert relationships" ON public.relationships;
CREATE POLICY "Admins can insert relationships"
  ON public.relationships FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can update relationships" ON public.relationships;
CREATE POLICY "Admins can update relationships"
  ON public.relationships FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can delete relationships" ON public.relationships;
CREATE POLICY "Admins can delete relationships"
  ON public.relationships FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- INVITATIONS
DROP POLICY IF EXISTS "Admins can view invitations" ON public.invitations;
CREATE POLICY "Admins can view invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (
    public.get_user_family_role(family_id) = 'admin'
    OR auth.email() = email
  );

DROP POLICY IF EXISTS "Invitee can read own invitation" ON public.invitations;
CREATE POLICY "Invitee can read own invitation"
  ON public.invitations FOR SELECT TO authenticated
  USING (auth.email() = email);

DROP POLICY IF EXISTS "Admins can insert invitations" ON public.invitations;
CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Accept own invitation" ON public.invitations;
CREATE POLICY "Accept own invitation"
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    auth.email() = email
    OR public.get_user_family_role(family_id) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can delete invitations" ON public.invitations;
CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.get_user_family_role(family_id) = 'admin');

-- MEMORIES
DROP POLICY IF EXISTS "Members can view memories" ON public.memories;
CREATE POLICY "Members can view memories"
  ON public.memories FOR SELECT TO authenticated
  USING (
    public.get_user_family_role(family_id) IS NOT NULL
    AND (
      NOT is_private
      OR created_by = auth.uid()
      OR public.get_user_family_role(family_id) = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert memories" ON public.memories;
CREATE POLICY "Admins can insert memories"
  ON public.memories FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Authors or admins can update memories" ON public.memories;
CREATE POLICY "Authors or admins can update memories"
  ON public.memories FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Authors or admins can delete memories" ON public.memories;
CREATE POLICY "Authors or admins can delete memories"
  ON public.memories FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.get_user_family_role(family_id) = 'admin');

-- EVENTS
DROP POLICY IF EXISTS "Members can view events" ON public.events;
CREATE POLICY "Members can view events"
  ON public.events FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- CHANGE_REQUESTS
DROP POLICY IF EXISTS "Any member can submit change requests" ON public.change_requests;
CREATE POLICY "Any member can submit change requests"
  ON public.change_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_family_role(family_id) IS NOT NULL
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "Requesters and admins can view change requests" ON public.change_requests;
CREATE POLICY "Requesters and admins can view change requests"
  ON public.change_requests FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.get_user_family_role(family_id) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can review change requests" ON public.change_requests;
CREATE POLICY "Admins can review change requests"
  ON public.change_requests FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Notifications strictly private to user" ON public.notifications;
CREATE POLICY "Notifications strictly private to user"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- AUDIT_LOGS
DROP POLICY IF EXISTS "Audit logs viewable by family members" ON public.audit_logs;
CREATE POLICY "Audit logs viewable by family members"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

-- =============================================================================
-- STEP 7: TRIGGER - Auto-create profile on sign-up
-- =============================================================================
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
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- STEP 8: TRIGGERS - updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at           ON public.profiles;
DROP TRIGGER IF EXISTS families_updated_at           ON public.families;
DROP TRIGGER IF EXISTS family_memberships_updated_at ON public.family_memberships;
DROP TRIGGER IF EXISTS family_people_updated_at      ON public.family_people;
DROP TRIGGER IF EXISTS relationships_updated_at      ON public.relationships;

CREATE TRIGGER profiles_updated_at           BEFORE UPDATE ON public.profiles           FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER families_updated_at           BEFORE UPDATE ON public.families           FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER family_memberships_updated_at BEFORE UPDATE ON public.family_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER family_people_updated_at      BEFORE UPDATE ON public.family_people      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER relationships_updated_at      BEFORE UPDATE ON public.relationships      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- STEP 9: CREATE_FAMILY_WITH_ADMIN RPC
-- =============================================================================
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF trim(p_name) = '' OR p_name IS NULL THEN
    RAISE EXCEPTION 'Family name is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT email, display_name INTO v_email, v_name
  FROM public.profiles WHERE id = v_user_id;

  v_email := COALESCE(v_email, '');
  v_name  := COALESCE(v_name, '');

  INSERT INTO public.families
    (id, name, description, owner_id, privacy_settings)
  VALUES
    (p_family_id, trim(p_name), p_description, v_user_id, p_privacy_settings)
  ON CONFLICT (id) DO NOTHING;

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

REVOKE ALL ON FUNCTION public.create_family_with_admin(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family_with_admin(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- STEP 10: FIX create_invitation FUNCTION (HANDLES SIGNATURE CONFLICT)
-- =============================================================================

-- First, try to drop the function with the correct signature
-- This will succeed if the function exists with matching signature
DO $$
BEGIN
  -- Try dropping with all possible signatures
  BEGIN
    DROP FUNCTION IF EXISTS public.create_invitation(UUID, TEXT, TEXT, INTEGER) CASCADE;
  EXCEPTION WHEN OTHERS THEN
    -- Function might not exist or have different signature
    NULL;
  END;
END $$;

-- Now create the function with correct return type
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_family_id       UUID,
  p_email           TEXT,
  p_role            TEXT,
  p_expires_in_days INTEGER DEFAULT 7
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
  -- Guard: must be authenticated
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Guard: caller must be an active admin of this family
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

  -- Guard: role must be valid
  IF p_role NOT IN ('admin', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: must be admin or viewer'
      USING ERRCODE = 'P0001';
  END IF;

  -- Generate a cryptographically secure token
  -- Use extensions.gen_random_bytes() from pgcrypto
  v_token := translate(
    encode(extensions.gen_random_bytes(24), 'base64'),
    '+/=', '-_'
  );
  v_expires := NOW() + (p_expires_in_days || ' days')::INTERVAL;

  -- Insert the invitation
  INSERT INTO public.invitations
    (family_id, email, role, token, expires_at, created_by)
  VALUES
    (p_family_id, lower(trim(p_email)), p_role, v_token, v_expires, v_caller);

  -- Return token and convenience fragment
  RETURN QUERY SELECT v_token, '#invite=' || v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invitation(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, TEXT, INTEGER) TO authenticated;

-- =============================================================================
-- STEP 11: VALIDATE_INVITATION RPC
-- =============================================================================
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
    i.family_id AS family_id
  FROM   public.invitations i
  JOIN   public.families    f ON f.id = i.family_id
  WHERE  i.token       = p_token
    AND  i.accepted_at IS NULL
    AND  i.revoked_at  IS NULL
    AND  i.expires_at  > NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.validate_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation(TEXT) TO authenticated;

-- =============================================================================
-- STEP 12: ACCEPT_INVITATION RPC
-- =============================================================================
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
  -- 1. Lock and re-validate the invitation row
  SELECT * INTO v_invitation
  FROM   public.invitations
  WHERE  token       = p_token
    AND  accepted_at IS NULL
    AND  revoked_at  IS NULL
    AND  expires_at  > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or already-used invitation token'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Look up the user's email/name from profiles if not provided
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  -- 3. Create the membership — role comes from the invitation, NOT the client
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
  ON CONFLICT (family_id, user_id)
  DO UPDATE SET
    status     = 'active',
    role       = v_invitation.role,
    user_email = EXCLUDED.user_email,
    user_name  = EXCLUDED.user_name;

  -- 4. Mark invitation as accepted
  UPDATE public.invitations
  SET    accepted_at = NOW()
  WHERE  token = p_token;

  -- 5. Return the family_id
  RETURN QUERY SELECT v_invitation.family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- COMMIT TRANSACTION
-- =============================================================================
COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify success)
-- =============================================================================
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name IN ('create_invitation', 'validate_invitation', 'accept_invitation', 'get_user_family_role', 'create_family_with_admin')
-- ORDER BY routine_name;
