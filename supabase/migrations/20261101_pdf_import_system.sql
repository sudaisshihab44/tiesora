-- =============================================================================
-- Migration: 20261101_pdf_import_system.sql
-- Project:   Tiesora — PDF Family Tree Import System
-- Purpose:   Add tables and functions for AI-powered genealogy PDF import
--
-- Features:
--   • Secure PDF upload tracking
--   • Page-by-page extraction results
--   • Extracted person records with confidence scores
--   • Extracted relationship records with verification status
--   • Admin review and approval workflow
--   • Duplicate detection and merging
--   • Import history and audit trail
--
-- Safety: Additive only. Does not modify existing tables or RLS policies.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: family_import_jobs
-- Tracks each PDF upload and processing job
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.family_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    
    -- File metadata
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    mime_type TEXT NOT NULL,
    page_count INT,
    
    -- Processing status
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
        'uploaded',        -- PDF uploaded, not yet processed
        'processing',      -- AI analysis in progress
        'processed',       -- Analysis complete, awaiting review
        'reviewing',       -- Admin is reviewing extracted data
        'approved',        -- Admin approved, ready to import
        'importing',       -- Import transaction in progress
        'completed',       -- Successfully imported to family tree
        'failed',          -- Processing or import failed
        'cancelled'        -- Cancelled by admin
    )),
    
    -- Processing metadata
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    -- Extraction summary
    extracted_person_count INT DEFAULT 0,
    extracted_relationship_count INT DEFAULT 0,
    verified_person_count INT DEFAULT 0,
    uncertain_person_count INT DEFAULT 0,
    duplicate_person_count INT DEFAULT 0,
    
    -- Review and approval
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Import completion
    imported_at TIMESTAMPTZ,
    imported_person_count INT DEFAULT 0,
    imported_relationship_count INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: family_import_pages
-- Stores per-page analysis results from PDF
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.family_import_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES public.family_import_jobs(id) ON DELETE CASCADE,
    
    page_number INT NOT NULL,
    
    -- Extracted content
    extracted_text TEXT, -- Raw text extraction
    ocr_text TEXT,       -- OCR result for scanned pages
    
    -- AI analysis results
    analysis_result JSONB, -- Full AI response
    extraction_method TEXT CHECK (extraction_method IN ('text', 'ocr', 'vision', 'hybrid')),
    
    -- Processing metadata
    processed_at TIMESTAMPTZ,
    processing_duration_ms INT,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(import_job_id, page_number)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: extracted_family_members
-- Stores extracted person records before import
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.extracted_family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES public.family_import_jobs(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    
    -- Extracted person data (mirrors family_people structure)
    full_name TEXT NOT NULL,
    display_name TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'unspecified')),
    birth_date DATE,
    birth_year INT,
    birth_place TEXT,
    death_date DATE,
    death_year INT,
    death_place TEXT,
    living_status TEXT CHECK (living_status IN ('living', 'deceased', 'unknown')),
    biography TEXT,
    
    -- Genealogy-specific fields
    generation_label TEXT, -- e.g. 'A', 'B', 'C' or 'I', 'II', 'III'
    generation_level INT,
    branch TEXT, -- e.g. 'Kunigal', 'Kempanhalli'
    child_number INT, -- Position among siblings (1, 2, 3...)
    
    -- Source and confidence
    source_page_numbers INT[] DEFAULT '{}', -- Pages where this person was mentioned
    source_text TEXT, -- Original text snippet
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Verification status
    verification_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN (
        'verified',      -- Admin confirmed correct
        'needs_review',  -- Requires admin review
        'uncertain',     -- Low confidence or ambiguous
        'duplicate',     -- Potential duplicate of existing person
        'rejected'       -- Admin marked as incorrect
    )),
    
    -- Duplicate detection
    potential_duplicate_of UUID REFERENCES public.family_people(id),
    duplicate_confidence DECIMAL(3,2),
    
    -- Admin edits
    admin_edited BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    
    -- Import tracking
    imported BOOLEAN DEFAULT FALSE,
    imported_person_id UUID REFERENCES public.family_people(id),
    imported_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: extracted_relationships
-- Stores extracted relationship records before import
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.extracted_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES public.family_import_jobs(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    
    -- Links to extracted members (before import)
    source_extracted_id UUID REFERENCES public.extracted_family_members(id) ON DELETE CASCADE,
    target_extracted_id UUID REFERENCES public.extracted_family_members(id) ON DELETE CASCADE,
    
    -- Relationship data
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'parent', 'spouse', 'child', 'adoptive_parent', 'adopted_child',
        'step_parent', 'partner', 'guardian', 'sibling'
    )),
    
    -- Marriage/relationship details
    marriage_date DATE,
    marriage_year INT,
    marriage_place TEXT,
    divorce_date DATE,
    relationship_notes TEXT,
    
    -- For adoptions
    is_adoptive BOOLEAN DEFAULT FALSE,
    
    -- For multiple spouses
    spouse_number INT, -- 1st wife, 2nd wife, etc.
    
    -- Source and confidence
    source_page_numbers INT[] DEFAULT '{}',
    source_text TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Verification status
    verification_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (verification_status IN (
        'verified',
        'needs_review',
        'uncertain',
        'conflicting',   -- Contradictory information found
        'rejected'
    )),
    
    admin_edited BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    
    -- Import tracking
    imported BOOLEAN DEFAULT FALSE,
    imported_relationship_id UUID REFERENCES public.relationships(id),
    imported_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: import_conflicts
-- Tracks conflicts and contradictions found during extraction
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES public.family_import_jobs(id) ON DELETE CASCADE,
    
    conflict_type TEXT NOT NULL CHECK (conflict_type IN (
        'duplicate_person',
        'contradictory_dates',
        'contradictory_parentage',
        'multiple_spouses_unclear',
        'missing_parent',
        'circular_relationship',
        'generation_mismatch'
    )),
    
    -- Involved records
    extracted_member_ids UUID[] DEFAULT '{}',
    extracted_relationship_ids UUID[] DEFAULT '{}',
    
    description TEXT NOT NULL,
    evidence_pages INT[] DEFAULT '{}',
    evidence_text TEXT,
    
    -- Resolution
    resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (resolution_status IN (
        'pending',
        'resolved',
        'ignored'
    )),
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: import_review_history
-- Audit trail of admin edits during review process
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_review_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES public.family_import_jobs(id) ON DELETE CASCADE,
    reviewed_by UUID NOT NULL REFERENCES public.profiles(id),
    
    action TEXT NOT NULL CHECK (action IN (
        'person_edited',
        'person_verified',
        'person_rejected',
        'person_merged',
        'relationship_edited',
        'relationship_verified',
        'relationship_rejected',
        'conflict_resolved',
        'job_approved',
        'job_cancelled'
    )),
    
    target_type TEXT CHECK (target_type IN ('person', 'relationship', 'conflict', 'job')),
    target_id UUID,
    
    changes JSONB, -- Before/after values for edits
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_import_jobs_family 
    ON public.family_import_jobs(family_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_jobs_uploaded_by 
    ON public.family_import_jobs(uploaded_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_pages_job 
    ON public.family_import_pages(import_job_id, page_number);

CREATE INDEX IF NOT EXISTS idx_extracted_members_job 
    ON public.extracted_family_members(import_job_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_extracted_members_family 
    ON public.extracted_family_members(family_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_extracted_members_duplicate 
    ON public.extracted_family_members(potential_duplicate_of) 
    WHERE potential_duplicate_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_extracted_relationships_job 
    ON public.extracted_relationships(import_job_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_extracted_relationships_source 
    ON public.extracted_relationships(source_extracted_id);

CREATE INDEX IF NOT EXISTS idx_extracted_relationships_target 
    ON public.extracted_relationships(target_extracted_id);

CREATE INDEX IF NOT EXISTS idx_import_conflicts_job 
    ON public.import_conflicts(import_job_id, resolution_status);

CREATE INDEX IF NOT EXISTS idx_import_review_history_job 
    ON public.import_review_history(import_job_id, created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all import tables
ALTER TABLE public.family_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_import_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_review_history ENABLE ROW LEVEL SECURITY;

-- ─── Import Jobs: Admins only ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view import jobs in their families" 
    ON public.family_import_jobs;
CREATE POLICY "Admins can view import jobs in their families"
    ON public.family_import_jobs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.family_memberships fm
            WHERE fm.family_id = family_import_jobs.family_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Admins can create import jobs in their families" 
    ON public.family_import_jobs;
CREATE POLICY "Admins can create import jobs in their families"
    ON public.family_import_jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.family_memberships fm
            WHERE fm.family_id = family_import_jobs.family_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Admins can update import jobs in their families" 
    ON public.family_import_jobs;
CREATE POLICY "Admins can update import jobs in their families"
    ON public.family_import_jobs
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.family_memberships fm
            WHERE fm.family_id = family_import_jobs.family_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

-- ─── Import Pages: Cascade from jobs ──────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view pages from their import jobs" 
    ON public.family_import_pages;
CREATE POLICY "Admins can view pages from their import jobs"
    ON public.family_import_pages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.family_import_jobs j
            JOIN public.family_memberships fm ON fm.family_id = j.family_id
            WHERE j.id = family_import_pages.import_job_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

-- ─── Extracted Members: Cascade from jobs ─────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage extracted members" 
    ON public.extracted_family_members;
CREATE POLICY "Admins can manage extracted members"
    ON public.extracted_family_members
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.family_memberships fm
            WHERE fm.family_id = extracted_family_members.family_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

-- ─── Extracted Relationships: Cascade from jobs ───────────────────────────────

DROP POLICY IF EXISTS "Admins can manage extracted relationships" 
    ON public.extracted_relationships;
CREATE POLICY "Admins can manage extracted relationships"
    ON public.extracted_relationships
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.family_memberships fm
            WHERE fm.family_id = extracted_relationships.family_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

-- ─── Import Conflicts: Cascade from jobs ──────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage import conflicts" 
    ON public.import_conflicts;
CREATE POLICY "Admins can manage import conflicts"
    ON public.import_conflicts
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.family_import_jobs j
            JOIN public.family_memberships fm ON fm.family_id = j.family_id
            WHERE j.id = import_conflicts.import_job_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

-- ─── Import Review History: Read-only for admins ──────────────────────────────

DROP POLICY IF EXISTS "Admins can view review history" 
    ON public.import_review_history;
CREATE POLICY "Admins can view review history"
    ON public.import_review_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.family_import_jobs j
            JOIN public.family_memberships fm ON fm.family_id = j.family_id
            WHERE j.id = import_review_history.import_job_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Admins can create review history entries" 
    ON public.import_review_history;
CREATE POLICY "Admins can create review history entries"
    ON public.import_review_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        reviewed_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.family_import_jobs j
            JOIN public.family_memberships fm ON fm.family_id = j.family_id
            WHERE j.id = import_review_history.import_job_id
              AND fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

-- =============================================================================
-- STORAGE BUCKET SETUP
-- =============================================================================

-- Create storage bucket for uploaded PDFs (if not exists)
-- NOTE: This requires the Supabase Storage extension to be enabled
-- Run this in Supabase Dashboard → Storage → Create Bucket manually, or via SQL:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'family-import-pdfs',
    'family-import-pdfs',
    false, -- Private bucket
    52428800, -- 50MB max file size
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Only admins can upload/view PDFs for their families
-- This policy needs to be created in Supabase Dashboard → Storage → Policies
-- Or via SQL (requires storage schema access):

DROP POLICY IF EXISTS "Admins can upload PDFs to their family folders" 
    ON storage.objects;
CREATE POLICY "Admins can upload PDFs to their family folders"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'family-import-pdfs'
        AND (storage.foldername(name))[1] IN (
            SELECT f.id::text
            FROM public.families f
            JOIN public.family_memberships fm ON fm.family_id = f.id
            WHERE fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Admins can view PDFs from their family folders" 
    ON storage.objects;
CREATE POLICY "Admins can view PDFs from their family folders"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'family-import-pdfs'
        AND (storage.foldername(name))[1] IN (
            SELECT f.id::text
            FROM public.families f
            JOIN public.family_memberships fm ON fm.family_id = f.id
            WHERE fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Admins can delete PDFs from their family folders" 
    ON storage.objects;
CREATE POLICY "Admins can delete PDFs from their family folders"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'family-import-pdfs'
        AND (storage.foldername(name))[1] IN (
            SELECT f.id::text
            FROM public.families f
            JOIN public.family_memberships fm ON fm.family_id = f.id
            WHERE fm.user_id = auth.uid()
              AND fm.role = 'admin'
              AND fm.status = 'active'
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- ─── Function: Create import job after PDF upload ─────────────────────────────
CREATE OR REPLACE FUNCTION public.create_import_job(
    p_family_id UUID,
    p_file_name TEXT,
    p_file_size_bytes BIGINT,
    p_file_path TEXT,
    p_mime_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    -- Verify admin permissions
    IF NOT EXISTS (
        SELECT 1 FROM public.family_memberships fm
        WHERE fm.family_id = p_family_id
          AND fm.user_id = v_user_id
          AND fm.role = 'admin'
          AND fm.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Only family admins can create import jobs' 
            USING ERRCODE = 'P0001';
    END IF;

    -- Create the job
    INSERT INTO public.family_import_jobs (
        family_id, uploaded_by, file_name, file_size_bytes, 
        file_path, mime_type, status
    ) VALUES (
        p_family_id, v_user_id, p_file_name, p_file_size_bytes,
        p_file_path, p_mime_type, 'uploaded'
    )
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_import_job(UUID, TEXT, BIGINT, TEXT, TEXT) 
    TO authenticated;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '✓ PDF Import System migration completed successfully';
    RAISE NOTICE '  - 6 new tables created (import_jobs, pages, members, relationships, conflicts, history)';
    RAISE NOTICE '  - RLS policies enforced (admin-only access)';
    RAISE NOTICE '  - Storage bucket "family-import-pdfs" configured';
    RAISE NOTICE '  - Helper function create_import_job() available';
END $$;
