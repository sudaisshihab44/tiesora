-- ==============================================================================
-- Tiesora — Family Tree & Relationship Platform
-- PostgreSQL / Supabase Schema & Row-Level-Security (RLS) Policies
-- Migration: 20261023_init_kinroots.sql
-- ==============================================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_path TEXT,
    preferred_language VARCHAR(10) DEFAULT 'en',
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

-- 3. FAMILY_MEMBERSHIPS (RBAC: owner, admin, editor, contributor, viewer)
CREATE TABLE IF NOT EXISTS public.family_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'contributor', 'viewer')),
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
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'contributor', 'viewer')),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CHANGE_REQUESTS (Contributor suggestions for Admin review)
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
-- INDEXES FOR GRAPH TRAVERSALS & QUERY OPTIMIZATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_people_family ON public.family_people(family_id);
CREATE INDEX IF NOT EXISTS idx_people_gen ON public.family_people(family_id, generation_level);
CREATE INDEX IF NOT EXISTS idx_rel_family ON public.relationships(family_id);
CREATE INDEX IF NOT EXISTS idx_rel_source ON public.relationships(source_person_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON public.relationships(target_person_id);
CREATE INDEX IF NOT EXISTS idx_rel_endpoints ON public.relationships(family_id, source_person_id, target_person_id);
CREATE INDEX IF NOT EXISTS idx_memories_family ON public.memories(family_id);
CREATE INDEX IF NOT EXISTS idx_events_family_date ON public.events(family_id, event_date);
CREATE INDEX IF NOT EXISTS idx_audit_family ON public.audit_logs(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id, is_read);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all 11 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check user's role in a family
CREATE OR REPLACE FUNCTION public.get_user_family_role(target_family_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.family_memberships
    WHERE family_id = target_family_id
      AND user_id = auth.uid()
      AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: Users can view all profiles, but edit only their own
CREATE POLICY "Profiles are readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Families: Readable if user is an active member or owner
CREATE POLICY "Families readable by members"
    ON public.families FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.family_memberships
            WHERE family_id = public.families.id
              AND user_id = auth.uid()
              AND status = 'active'
        )
    );

CREATE POLICY "Families manageable by owner"
    ON public.families FOR ALL
    TO authenticated
    USING (owner_id = auth.uid());

-- Family Memberships: Readable by fellow family members
CREATE POLICY "Memberships viewable by family members"
    ON public.family_memberships FOR SELECT
    TO authenticated
    USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Memberships manageable by owner and admin"
    ON public.family_memberships FOR ALL
    TO authenticated
    USING (public.get_user_family_role(family_id) IN ('owner', 'admin'));

-- Family People:
CREATE POLICY "People viewable by family members"
    ON public.family_people FOR SELECT
    TO authenticated
    USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "People insertable/updatable by editor, admin, owner"
    ON public.family_people FOR INSERT
    TO authenticated
    WITH CHECK (public.get_user_family_role(family_id) IN ('editor', 'admin', 'owner'));

CREATE POLICY "People updatable by editor, admin, owner"
    ON public.family_people FOR UPDATE
    TO authenticated
    USING (public.get_user_family_role(family_id) IN ('editor', 'admin', 'owner'));

CREATE POLICY "People deletable by admin and owner"
    ON public.family_people FOR DELETE
    TO authenticated
    USING (public.get_user_family_role(family_id) IN ('admin', 'owner'));

-- Relationships:
CREATE POLICY "Relationships viewable by family members"
    ON public.relationships FOR SELECT
    TO authenticated
    USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Relationships manageable by editor, admin, owner"
    ON public.relationships FOR ALL
    TO authenticated
    USING (public.get_user_family_role(family_id) IN ('editor', 'admin', 'owner'));

-- Memories:
CREATE POLICY "Memories viewable by family members"
    ON public.memories FOR SELECT
    TO authenticated
    USING (
        public.get_user_family_role(family_id) IS NOT NULL
        AND (is_private = false OR created_by = auth.uid() OR public.get_user_family_role(family_id) IN ('owner', 'admin'))
    );

CREATE POLICY "Memories insertable by contributor, editor, admin, owner"
    ON public.memories FOR INSERT
    TO authenticated
    WITH CHECK (public.get_user_family_role(family_id) IN ('contributor', 'editor', 'admin', 'owner'));

CREATE POLICY "Memories updatable/deletable by author, admin, owner"
    ON public.memories FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid() OR public.get_user_family_role(family_id) IN ('admin', 'owner'));

-- Events:
CREATE POLICY "Events viewable by family members"
    ON public.events FOR SELECT
    TO authenticated
    USING (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Events insertable by editor, admin, owner"
    ON public.events FOR INSERT
    TO authenticated
    WITH CHECK (public.get_user_family_role(family_id) IN ('editor', 'admin', 'owner'));

-- Change Requests:
CREATE POLICY "Change requests viewable by author, admin, owner"
    ON public.change_requests FOR SELECT
    TO authenticated
    USING (requested_by = auth.uid() OR public.get_user_family_role(family_id) IN ('admin', 'owner'));

CREATE POLICY "Change requests insertable by contributors"
    ON public.change_requests FOR INSERT
    TO authenticated
    WITH CHECK (public.get_user_family_role(family_id) IS NOT NULL);

CREATE POLICY "Change requests reviewable by admin and owner"
    ON public.change_requests FOR UPDATE
    TO authenticated
    USING (public.get_user_family_role(family_id) IN ('admin', 'owner'));

-- Notifications:
CREATE POLICY "Notifications strictly private to user"
    ON public.notifications FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Audit Logs:
CREATE POLICY "Audit logs viewable by family members"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.get_user_family_role(family_id) IS NOT NULL);

-- ==============================================================================
-- AUTO-CREATE PROFILE ON SIGN-UP
-- ==============================================================================
-- When a new user signs up via Supabase Auth, a trigger automatically creates
-- their profile row using data from auth.users and the metadata provided
-- during sign-up (display_name).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- UPDATED_AT TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER families_updated_at BEFORE UPDATE ON public.families
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER family_memberships_updated_at BEFORE UPDATE ON public.family_memberships
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER family_people_updated_at BEFORE UPDATE ON public.family_people
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER relationships_updated_at BEFORE UPDATE ON public.relationships
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==============================================================================
-- STORAGE BUCKET FOR MEMORY PHOTOS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('family-photos', 'family-photos', true)
ON CONFLICT DO NOTHING;

-- Storage policies: authenticated users can upload to family-photos
CREATE POLICY "Authenticated users can upload family photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'family-photos');

CREATE POLICY "Anyone can view family photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'family-photos');
