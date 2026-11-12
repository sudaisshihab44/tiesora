# PDF Import System - Implementation Guide

## Overview

This guide provides step-by-step instructions for completing the AI-powered PDF family tree import system for Tiesora.

## Current Status (4/12 tasks complete)

✅ Database schema designed and migration created  
✅ Upload UI component implemented with drag-drop  
✅ PDF processing service structure created  
⚠️ Requires additional implementation for production use

---

## Required Dependencies

Add these packages to enable full PDF processing:

```bash
npm install pdfjs-dist@3.11.174
npm install canvas  # For server-side PDF rendering (optional for browser)
```

Update your `vite.config.ts` to handle PDF.js worker:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA(/* ... */)],
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  }
});
```

---

## Step 1: Apply Database Migration

**Before testing the upload UI**, apply the migration to Supabase:

1. Go to: https://supabase.com/dashboard/project/yuysjdytkofnblusdtvu/sql/new
2. Open: `supabase/migrations/20261101_pdf_import_system.sql`
3. Copy entire contents
4. Paste into Supabase SQL Editor
5. Click **Run**
6. Verify: "✓ PDF Import System migration completed successfully"

### Create Storage Bucket Manually

If the storage bucket wasn't created automatically:

1. Go to: Storage → Create Bucket
2. Name: `family-import-pdfs`
3. Public: **No** (private)
4. File size limit: 52428800 (50MB)
5. Allowed MIME types: `application/pdf`

---

## Step 2: Complete PDF.js Integration

Replace the placeholder in `src/services/pdfProcessor.ts`:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function extractPDFContent(
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<PDFProcessingResult> {
  const startTime = Date.now();
  const pages: PDFPageContent[] = [];
  const errors: string[] = [];

  try {
    // Load PDF
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    // Process each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (onProgress) {
        onProgress({
          currentPage: pageNum,
          totalPages: pdf.numPages,
          status: `Processing page ${pageNum} of ${pdf.numPages}...`,
        });
      }

      const page = await pdf.getPage(pageNum);
      
      // Extract text
      const textContent = await page.getTextContent();
      const extractedText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      // Render page to canvas for image extraction
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const imageDataUrl = canvas.toDataURL('image/png');

      const pageContent: PDFPageContent = {
        pageNumber: pageNum,
        extractedText: extractedText.trim(),
        hasText: extractedText.trim().length > 50,
        isScanned: extractedText.trim().length < 50,
        imageDataUrl,
        width: viewport.width,
        height: viewport.height,
      };

      pages.push(pageContent);
    }

    return {
      totalPages: pdf.numPages,
      pages,
      processingTimeMs: Date.now() - startTime,
      errors,
    };

  } catch (error: any) {
    console.error('PDF extraction error:', error);
    errors.push(error.message || 'Failed to extract PDF content');
    
    return {
      totalPages: 0,
      pages,
      processingTimeMs: Date.now() - startTime,
      errors,
    };
  }
}
```

---

## Step 3: Configure Google Gemini API

Add your API key to `.env`:

```bash
# Google Gemini API for PDF analysis
VITE_GEMINI_API_KEY=your-api-key-here
```

Get your API key: https://aistudio.google.com/app/apikey

---

## Step 4: Test PDF Upload Flow

1. **Start dev server**: `npm run dev`
2. **Sign in as admin**
3. Navigate to **Family Tree** tab
4. Click **Import PDF** button (visible to admins only)
5. Drag-drop or browse to select a PDF
6. Click **Upload & Analyze**
7. Monitor browser console for job ID

### Expected Behavior

- File validation (PDF only, max 50MB)
- Progress bar during upload
- Success message after upload
- Import job created in database

### Verify in Supabase

```sql
-- Check import job was created
SELECT * FROM family_import_jobs 
ORDER BY created_at DESC 
LIMIT 1;

-- Check file in storage
SELECT * FROM storage.objects 
WHERE bucket_id = 'family-import-pdfs'
ORDER BY created_at DESC
LIMIT 1;
```

---

## Step 5: Implement AI Extraction Engine (Task #6)

Create `src/services/aiExtractor.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/genai';
import type { ProcessedPage } from './pdfProcessor';
import type { ExtractedFamilyMember, ExtractedRelationship } from '../types';

export async function extractFamilyData(
  pages: ProcessedPage[],
  jobId: string,
  familyId: string
): Promise<{
  members: ExtractedFamilyMember[];
  relationships: ExtractedRelationship[];
  conflicts: any[];
}> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  // Combine all page text
  const fullText = pages
    .map(p => `=== Page ${p.pageNumber} ===\n${p.extractedText || p.ocrText || ''}`)
    .join('\n\n');

  const prompt = `You are a genealogy expert analyzing a family tree document.

Extract all family members and relationships from this document:

${fullText}

Return a JSON object with this exact structure:
{
  "members": [
    {
      "full_name": "string",
      "generation_label": "string (e.g., 'A', 'I', 'Gen 1')",
      "generation_level": number,
      "gender": "male" | "female" | "unspecified",
      "birth_year": number | null,
      "death_year": number | null,
      "birth_place": "string" | null,
      "living_status": "living" | "deceased" | "unknown",
      "child_number": number | null,
      "branch": "string | null",
      "source_pages": [number],
      "confidence": 0.0-1.0
    }
  ],
  "relationships": [
    {
      "source_name": "string (parent or spouse A)",
      "target_name": "string (child or spouse B)",
      "type": "parent" | "spouse" | "adoptive_parent",
      "marriage_year": number | null,
      "source_pages": [number],
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Be conservative: only extract information you're confident about
- Use generation labels as they appear in the document
- Mark uncertain extractions with confidence < 0.7
- Include page numbers where each person/relationship was found
- For multiple spouses, create separate spouse relationships`;

  const result = await model.generateContent(prompt);
  const response = await result.response.text();
  
  // Parse JSON response
  const extracted = JSON.parse(response);
  
  // Convert to database format
  // TODO: Map extracted data to ExtractedFamilyMember and ExtractedRelationship types
  
  return {
    members: [],
    relationships: [],
    conflicts: [],
  };
}
```

---

## Step 6: Create Processing Worker/Endpoint

For production, PDF processing should happen server-side to avoid browser limitations.

### Option A: Supabase Edge Function

Create `supabase/functions/process-import-job/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { jobId } = await req.json();
  
  // 1. Get job and PDF from storage
  // 2. Extract PDF content
  // 3. Run AI analysis
  // 4. Save extracted members and relationships
  // 5. Update job status
  
  return new Response(JSON.stringify({ success: true }));
});
```

Deploy: `supabase functions deploy process-import-job`

### Option B: Backend API Endpoint

Create a Node.js/Express endpoint that processes PDFs.

---

## Step 7: Build Review Dashboard (Task #9)

Create `src/components/import/ImportReviewDashboard.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import type { 
  FamilyImportJob, 
  ExtractedFamilyMember, 
  ExtractedRelationship 
} from '../../types';

export const ImportReviewDashboard: React.FC<{
  jobId: string;
  onApprove: () => void;
  onCancel: () => void;
}> = ({ jobId, onApprove, onCancel }) => {
  const [job, setJob] = useState<FamilyImportJob | null>(null);
  const [members, setMembers] = useState<ExtractedFamilyMember[]>([]);
  const [relationships, setRelationships] = useState<ExtractedRelationship[]>([]);
  
  // Load data, render review UI
  // Allow editing, merging duplicates, resolving conflicts
  
  return (
    <div className="p-6">
      {/* Tabs: Members | Relationships | Conflicts | Preview */}
      {/* Edit forms, merge tools, tree preview */}
      {/* Approve & Import button */}
    </div>
  );
};
```

---

## Step 8: Implement Import Transaction (Task #10)

Create database function for atomic import:

```sql
CREATE OR REPLACE FUNCTION public.import_approved_family_data(
  p_job_id UUID
)
RETURNS TABLE (
  imported_person_count INT,
  imported_relationship_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job family_import_jobs%ROWTYPE;
  v_person_count INT := 0;
  v_rel_count INT := 0;
BEGIN
  -- Get job
  SELECT * INTO v_job FROM family_import_jobs WHERE id = p_job_id;
  
  IF v_job.status != 'approved' THEN
    RAISE EXCEPTION 'Job must be approved before import';
  END IF;
  
  -- Start transaction
  UPDATE family_import_jobs SET status = 'importing' WHERE id = p_job_id;
  
  -- Import members
  INSERT INTO family_people (
    family_id, full_name, display_name, gender, birth_date, 
    death_date, living_status, generation_level, branch, created_by
  )
  SELECT 
    family_id, full_name, COALESCE(display_name, full_name), 
    gender, birth_date, death_date, living_status, 
    generation_level, branch, v_job.uploaded_by
  FROM extracted_family_members
  WHERE import_job_id = p_job_id
    AND verification_status = 'verified'
    AND NOT imported;
  
  GET DIAGNOSTICS v_person_count = ROW_COUNT;
  
  -- Import relationships
  -- (Complex: need to map extracted IDs to actual person IDs)
  
  -- Update job
  UPDATE family_import_jobs 
  SET status = 'completed',
      imported_at = NOW(),
      imported_person_count = v_person_count,
      imported_relationship_count = v_rel_count
  WHERE id = p_job_id;
  
  RETURN QUERY SELECT v_person_count, v_rel_count;
END;
$$;
```

---

## Testing with Darvesh Mohammed PDF (Task #12)

### Expected Results

Document structure:
- **Root**: Darvesh Mohammed
- **Branches**: Kunigal, Kempanhalli
- **Generations**: A, B, C, D, E, F (alphabetic labels)
- **Features**: Multiple spouses, adoptions, migrations

### Validation Checklist

- [ ] All 56 pages processed
- [ ] Root ancestor extracted correctly
- [ ] Both major branches identified
- [ ] Generation labels preserved
- [ ] Multiple spouses detected
- [ ] Children numbered correctly (right to left)
- [ ] Adoption relationships marked
- [ ] Duplicates identified and flagged
- [ ] Admin can review and edit
- [ ] Tree preview renders correctly
- [ ] Import creates correct database records

---

## Security Checklist

- [ ] RLS policies prevent viewer access to import features
- [ ] API keys not exposed in frontend code
- [ ] File uploads validated (type, size)
- [ ] Storage bucket is private
- [ ] Import requires admin role
- [ ] Extracted data reviewed before import
- [ ] Import transaction is atomic

---

## Performance Considerations

- **Large PDFs**: Process in batches, show progress
- **AI API costs**: Cache results, limit retries
- **Storage**: Clean up old import jobs periodically
- **Browser memory**: Offload heavy processing to backend

---

## Next Steps

1. Complete PDF.js integration
2. Implement AI extraction engine
3. Build review dashboard UI
4. Create import transaction function
5. Test with sample genealogy PDFs
6. Deploy backend processing endpoint
7. Add duplicate detection logic
8. Implement conflict resolution UI

---

## Support

For issues or questions:
- Check browser console for errors
- Verify Supabase migration was applied
- Confirm API keys are configured
- Test with a simple 1-2 page PDF first


## Import Transaction Function

The system includes a PostgreSQL function `import_approved_family_data` for atomic imports:

### Migration Files

1. **20261101_pdf_import_system.sql** - Core schema (tables, RLS policies, storage)
2. **20261101_import_transaction_function.sql** - Import transaction function

Both migrations must be applied in order.

### Function: import_approved_family_data

**Signature:**
```sql
import_approved_family_data(p_job_id UUID, p_family_id UUID) RETURNS JSON
```

**Security:**
- `SECURITY DEFINER` - Runs with function owner's privileges
- Checks admin permission at runtime
- Full transaction safety - rolls back on any error

**Returns:**
```json
{
  "success": boolean,
  "importedPeople": number,
  "importedRelationships": number,
  "errors": string[],
  "personIdMapping": { "extracted_id": "actual_id", ... }
}
```

**Usage from TypeScript:**
```typescript
const { data, error } = await supabase.rpc('import_approved_family_data', {
  p_job_id: jobId,
  p_family_id: familyId,
});
```

### Import Flow

1. **Admin approves** in review dashboard
2. **Job status** → `ready_to_import`
3. **Function called** with job_id and family_id
4. **Permission check** - verifies admin access
5. **Transaction begins**:
   - Import verified/needs_review members → family_people
   - Build person ID mapping (extracted → actual)
   - Import relationships using mapped IDs
   - Update extracted members with linked_person_id
   - Record review history
6. **Transaction commits** or rolls back entirely
7. **Job status** → `completed`, `completed_with_errors`, or `failed`

### Relationship Type Mapping

| Extracted Type | Database Type | Notes |
|---------------|---------------|-------|
| `parent` | `parent` relationship | Parent → Child |
| `biological_parent` | `parent` | Same as parent |
| `adoptive_parent` | `adoptive_parent` | Dashed line in UI |
| `step_parent` | `step_parent` | Step relationship |
| `spouse` | `spouse` | Spouse/partner |
| `partner` | `spouse` | Same as spouse |
| `sibling` | `sibling` | Brother/sister |

### Error Handling

- **Partial failures**: Individual person/relationship errors logged, rest continues
- **Fatal errors**: Entire transaction rolls back, job marked `failed`
- **Audit trail**: All actions recorded in `import_review_history`

### Rollback Support

Function in `importTransaction.ts`:
```typescript
await rollbackImport(jobId);
```

Deletes all imported people and relationships, marks job as `rolled_back`.
**Use with extreme caution** - cannot be undone!
