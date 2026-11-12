-- ============================================================================
-- Create Storage Bucket for PDF Imports
-- ============================================================================
-- Created: November 2, 2026
-- Purpose: Create the 'family-import-pdfs' storage bucket and configure
--          Row Level Security (RLS) policies for secure PDF uploads
-- ============================================================================

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-import-pdfs',
  'family-import-pdfs',
  false,  -- Private bucket
  52428800,  -- 50MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS POLICIES FOR STORAGE BUCKET
-- ============================================================================

-- Policy 1: Allow authenticated users to upload PDFs to their own family folders
CREATE POLICY "Users can upload PDFs to their family folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'family-import-pdfs' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] IN (
    SELECT f.id::text 
    FROM families f
    INNER JOIN family_memberships fm ON f.id = fm.family_id
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.role IN ('admin', 'editor')
  )
);

-- Policy 2: Allow users to read PDFs from their family folders
CREATE POLICY "Users can read PDFs from their family folders"
ON storage.objects
FOR SELECT
TO authenticated
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

-- Policy 3: Allow users to delete their own family PDFs (admins only)
CREATE POLICY "Admins can delete family PDFs"
ON storage.objects
FOR DELETE
TO authenticated
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

-- Policy 4: Allow users to update metadata for their family PDFs (admins only)
CREATE POLICY "Admins can update family PDF metadata"
ON storage.objects
FOR UPDATE
TO authenticated
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
)
WITH CHECK (
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

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify bucket was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'family-import-pdfs') THEN
    RAISE NOTICE '✅ Storage bucket "family-import-pdfs" created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create storage bucket';
  END IF;
END $$;

-- Count policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%family%PDF%'
    OR policyname LIKE '%family%pdf%';
  
  RAISE NOTICE '✅ Created % RLS policies for storage bucket', policy_count;
END $$;
