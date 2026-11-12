# Supabase Setup for PDF Import Feature

## Problem Identified

The PDF import feature fails with **"Failed to Load Review Data"** because:
1. ✅ Database tables exist (migrations applied successfully)
2. ❌ Storage bucket `family-import-pdfs` doesn't exist
3. ❌ No test data in the database

## Required Setup Steps

### Step 1: Create Storage Bucket

1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/yuysjdytkofnblusdtvu
2. Navigate to **Storage** in the left sidebar
3. Click **"Create a new bucket"**
4. Configure the bucket:
   - **Name:** `family-import-pdfs`
   - **Public:** ❌ **OFF** (keep private)
   - **File size limit:** `52428800` (50MB)
   - **Allowed MIME types:** `application/pdf`

5. Click **Create bucket**

### Step 2: Configure Storage Policies

After creating the bucket, set up Row Level Security policies:

1. Click on the `family-import-pdfs` bucket
2. Go to **Policies** tab
3. Create three policies using the SQL below

#### Policy 1: Upload Permission

```sql
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
```

#### Policy 2: Read Permission

```sql
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
```

#### Policy 3: Delete Permission

```sql
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
```

### Step 3: Verify Setup

Run the test script to verify everything is configured:

```bash
node test-db-tables.js
```

Expected output:
```
✅ family_import_jobs: EXISTS (0 records)
✅ family_import_pages: EXISTS (0 records)
✅ extracted_family_members: EXISTS (0 records)
✅ extracted_relationships: EXISTS (0 records)
✅ import_conflicts: EXISTS (0 records)
✅ import_review_history: EXISTS (0 records)
✅ family-import-pdfs bucket: EXISTS
```

### Step 4: Test PDF Upload

1. Start the dev server: `npm run dev`
2. Open http://localhost:3000
3. Sign in as an admin user
4. Navigate to your family tree
5. Click **Import Family Tree**
6. Upload the `Darvesh Mohammed.pdf` file
7. Watch the browser console for logs (F12)

## Alternative: Quick Setup via SQL

Run this complete SQL script in Supabase SQL Editor to set up everything:

```sql
-- Create bucket (run this first, then create policies via UI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'family-import-pdfs',
    'family-import-pdfs',
    false,
    52428800,
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Then create the three storage policies shown above
```

## Troubleshooting

### Error: "relation storage.objects does not exist"

The storage extension might not be enabled. Enable it in:
Dashboard → Project Settings → Extensions → Search "storage" → Enable

### Error: "Bucket not found"

Double-check:
1. Bucket name is exactly `family-import-pdfs` (no typos)
2. You're on the correct Supabase project
3. Bucket was created successfully (refresh the page)

### Error: "Access denied"

Check:
1. You're signed in as an admin user
2. Your user has `admin` role in `family_memberships` table
3. The family_id matches your current family
4. RLS policies are enabled on the bucket

### Still Getting "Failed to Load Review Data"

This means:
1. ✅ PDF uploaded successfully
2. ✅ Import job created
3. ❌ No extracted members or relationships saved

Check console logs for:
- "PDF loaded: X pages"
- "Batch X/Y extracted..."
- Any API errors from Gemini AI

**Note:** You need a valid Gemini API key in `.env`:
```
VITE_GEMINI_API_KEY=your_actual_api_key_here
```

## Success Indicators

After setup, you should see:
1. ✅ PDF uploads without storage errors
2. ✅ Import job appears in `family_import_jobs` table
3. ✅ Console shows "PDF loaded: 56 pages"
4. ✅ Console shows "Batch processing..." messages
5. ✅ Records appear in `extracted_family_members`
6. ✅ Review Dashboard loads with actual counts
7. ✅ Family tree preview displays

