-- ============================================================
-- TIESORA — COMPLETE DATABASE SETUP
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- This combines the initial schema + the Admin/Viewer migration
--
-- ⚠️  WARNING: This file is NOT idempotent
-- If you get "policy already exists" errors, use:
-- APPLY_TO_SUPABASE_IDEMPOTENT.sql instead
-- ============================================================

-- ==============================================================================
-- STEP 1: INITIAL SCHEMA (11 tables)
-- ==============================================================================

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

-- 5. RELATIONSHIPS (Graph Edges)
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

-- ==============================================================================
-- INDEXES
-- ==============================================================================
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

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================
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

-- ==============================================================================
-- HELPER FUNCTION: get current user's role in a family
-- ==============================================================================
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

-- ==============================================================================
-- GUARD FUNCTION: prevent removing the last admin
-- ==============================================================================
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
CREATE TRIGGER trg_ensure_family_has_admin_update
  BEFORE UPDATE OF role, status
  ON public.family_memberships
  FOR EACH ROW
  WHEN (OLD.role = 'admin' AND (NEW.role != 'admin' OR NEW.status != 'active'))
  EXECUTE FUNCTION public.ensure_family_has_admin();

DROP TRIGGER IF EXISTS trg_ensure_family_has_admin_delete ON public.family_memberships;
CREATE TRIGGER trg_ensure_family_has_admin_delete
  BEFORE DELETE
  ON public.family_memberships
  FOR EACH ROW
  WHEN (OLD.role = 'admin')
  EXECUTE FUNCTION public.ensure_family_has_admin();

-- ==============================================================================
-- RLS POLICIES (Admin/Viewer two-role model)
-- ==============================================================================

-- profiles
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- families
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

CREATE POLICY "Admins can insert families"
  ON public.families FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can update families"
  ON public.families FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(id) = 'admin')
  WITH CHECK (public.get_user_family_role(id) = 'admin');

CREATE POLICY "Admins can delete families"
  ON public.families FOR DELETE TO authenticated
  USING  (public.get_user_family_role(id) = 'admin');

-- family_memberships
CREATE POLICY "Family members can view memberships"
  ON public.family_memberships FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Admins can insert memberships"
  ON public.family_memberships FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can update memberships"
  ON public.family_memberships FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete memberships"
  ON public.family_memberships FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- family_people
CREATE POLICY "Members can view people"
  ON public.family_people FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Admins can insert people"
  ON public.family_people FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can update people"
  ON public.family_people FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete people"
  ON public.family_people FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- relationships
CREATE POLICY "Members can view relationships"
  ON public.relationships FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Admins can insert relationships"
  ON public.relationships FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can update relationships"
  ON public.relationships FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete relationships"
  ON public.relationships FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- invitations
CREATE POLICY "Admins can view invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (
    public.get_user_family_role(family_id) = 'admin'
    OR auth.email() = email
  );

CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Accept own invitation"
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    auth.email() = email
    OR public.get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.get_user_family_role(family_id) = 'admin');

-- memories
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

CREATE POLICY "Admins can insert memories"
  ON public.memories FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Authors or admins can update memories"
  ON public.memories FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Authors or admins can delete memories"
  ON public.memories FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.get_user_family_role(family_id) = 'admin');

-- events
CREATE POLICY "Members can view events"
  ON public.events FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin');

-- change_requests
CREATE POLICY "Any member can submit change requests"
  ON public.change_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_family_role(family_id) IS NOT NULL
    AND requested_by = auth.uid()
  );

CREATE POLICY "Requesters and admins can view change requests"
  ON public.change_requests FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.get_user_family_role(family_id) = 'admin'
  );

CREATE POLICY "Admins can review change requests"
  ON public.change_requests FOR UPDATE TO authenticated
  USING  (public.get_user_family_role(family_id) = 'admin')
  WITH CHECK (public.get_user_family_role(family_id) = 'admin');

-- notifications
CREATE POLICY "Notifications strictly private to user"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- audit_logs
CREATE POLICY "Audit logs viewable by family members"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.get_user_family_role(family_id) IS NOT NULL);

-- ==============================================================================
-- TRIGGER: Auto-create profile on sign-up
-- ==============================================================================
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

-- ==============================================================================
-- TRIGGERS: updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at           BEFORE UPDATE ON public.profiles           FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER families_updated_at           BEFORE UPDATE ON public.families           FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER family_memberships_updated_at BEFORE UPDATE ON public.family_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER family_people_updated_at      BEFORE UPDATE ON public.family_people      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER relationships_updated_at      BEFORE UPDATE ON public.relationships      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==============================================================================
-- BOOTSTRAP FUNCTION: grant admin to family creator (server-side only)
-- ==============================================================================
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
  INSERT INTO public.family_memberships (family_id, user_id, user_email, user_name, role, status)
  VALUES (p_family_id, p_user_id, p_email, p_name, 'admin', 'active')
  ON CONFLICT (family_id, user_id) DO UPDATE
    SET role   = 'admin',
        status = 'active';
END;
$$;

-- ==============================================================================
-- STORAGE BUCKET for family photos
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('family-photos', 'family-photos', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Admins can upload family photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'family-photos');

CREATE POLICY "Members can view family photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'family-photos');

-- ==============================================================================
-- STORAGE BUCKET for PDF imports
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-import-pdfs',
  'family-import-pdfs',
  false,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for PDF imports
CREATE POLICY "Users can upload PDFs to their family folders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'family-import-pdfs' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT f.id::text 
    FROM families f
    INNER JOIN family_memberships fm ON f.id = fm.family_id
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.role = 'admin'
  )
);

CREATE POLICY "Users can read PDFs from their family folders"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'family-import-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT f.id::text 
    FROM families f
    INNER JOIN family_memberships fm ON f.id = fm.family_id
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'active'
  )
);

CREATE POLICY "Admins can delete family PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'family-import-pdfs'
  AND (storage.foldername(name))[1] IN (
    SELECT f.id::text 
    FROM families f
    INNER JOIN family_memberships fm ON f.id = fm.family_id
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.role = 'admin'
  )
);
