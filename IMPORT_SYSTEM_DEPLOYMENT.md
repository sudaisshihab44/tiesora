# AI-Powered PDF Family Tree Import System - Deployment Guide

## 🎯 System Overview

The Tiesora PDF Import System enables admins to upload genealogy PDFs, extract family data using AI, review and verify the information, and import it into their family tree database.

**Key Features:**
- 📄 Drag-drop PDF upload (max 50MB, 200 pages)
- 🤖 AI-powered extraction (Google Gemini)
- ✅ Confidence scoring & verification workflow
- 👥 Admin review dashboard with edit/merge/conflict resolution
- 🔒 Secure atomic import with full RLS enforcement
- 📊 Interactive tree preview before import
- 🔄 Support for complex genealogies (multiple spouses, adoptions, branches)

---

## 📋 Prerequisites

### 1. Dependencies to Install

```bash
# Required for PDF processing
npm install pdfjs-dist@3.11.174

# Optional for server-side PDF rendering
npm install canvas
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Already configured
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Required for AI extraction
VITE_GEMINI_API_KEY=your_google_gemini_api_key
```

**Get Gemini API Key:**
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Add to your `.env` file

### 3. Supabase Setup

You need **admin access** to your Supabase project.

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations

**IMPORTANT:** Migrations must be applied in order!

1. Open Supabase Dashboard → SQL Editor
2. Run migration 1:
   ```
   supabase/migrations/20261101_pdf_import_system.sql
   ```
   This creates:
   - 6 staging tables (jobs, pages, members, relationships, conflicts, history)
   - RLS policies (admin-only access)
   - Storage bucket `family-import-pdfs`

3. Run migration 2:
   ```
   supabase/migrations/20261101_import_transaction_function.sql
   ```
   This creates:
   - `import_approved_family_data()` function for atomic imports

**Verify migrations:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%import%';

-- Check function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'import_approved_family_data';

-- Check storage bucket
SELECT * FROM storage.buckets WHERE name = 'family-import-pdfs';
```

### Step 2: Configure Storage Policies

Verify the storage bucket has correct policies:

```sql
-- View existing policies
SELECT * FROM storage.policies WHERE bucket_id = 'family-import-pdfs';
```

Expected policies:
- `Admin upload PDFs` - INSERT for admins only
- `Admin read PDFs` - SELECT for admins only
- `Admin delete PDFs` - DELETE for admins only

If missing, run the relevant sections from `20261101_pdf_import_system.sql`.

### Step 3: Install Dependencies

```bash
cd kinroots
npm install pdfjs-dist@3.11.174
```

### Step 4: Complete PDF.js Integration

The PDF processing service has placeholders that need real implementation:

**File:** `src/services/pdfProcessor.ts`

Replace the `extractPDFContent` function with actual PDF.js code:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

async function extractPDFContent(
  file: File,
  onProgress?: (progress: { currentPage: number; totalPages: number }) => void
): Promise<{
  pages: PDFPageContent[];
  totalPages: number;
  metadata: Record<string, any>;
  errors: string[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const totalPages = pdf.numPages;
  const pages: PDFPageContent[] = [];
  const errors: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      if (onProgress) {
        onProgress({ currentPage: pageNum, totalPages });
      }

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      pages.push({
        pageNumber: pageNum,
        text: text.trim(),
        width: page.view[2],
        height: page.view[3],
      });
    } catch (err) {
      errors.push(`Page ${pageNum}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  const metadata = await pdf.getMetadata();

  return {
    pages,
    totalPages,
    metadata: metadata.info || {},
    errors,
  };
}
```

See `PDF_IMPORT_IMPLEMENTATION_GUIDE.md` for complete implementation details.

### Step 5: Implement Gemini Vision API Calls

**File:** `src/services/pdfProcessor.ts`

Replace placeholder functions `performVisionOCR` and `analyzeFamilyTreeDiagram` with actual Gemini API calls.

**File:** `src/services/aiExtractor.ts`

Replace `callAIExtractionAPI` placeholder with actual Gemini API call:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

async function callAIExtractionAPI(prompt: string): Promise<RawExtractionResult> {
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Parse JSON response
  const parsed = JSON.parse(text);
  
  return {
    people: parsed.people || [],
    relationships: parsed.relationships || [],
    metadata: parsed.metadata || {},
  };
}
```

### Step 6: Build and Test

```bash
# Build the project
npm run build

# Start dev server
npm run dev
```

---

## 🧪 Testing Checklist

### Pre-Testing Setup

1. ✅ Migrations applied successfully
2. ✅ Storage bucket created and accessible
3. ✅ Environment variables configured
4. ✅ PDF.js integration completed
5. ✅ Gemini API key valid and working
6. ✅ Test user has admin role in a family

### Test Scenarios

#### Test 1: Basic Upload
- [ ] Login as admin
- [ ] Navigate to Family Tree
- [ ] Click "Import PDF" button
- [ ] Drag-drop a small PDF (1-5 pages)
- [ ] Verify upload progress shows
- [ ] Verify file appears in Supabase Storage
- [ ] Verify job created in `family_import_jobs` table

#### Test 2: PDF Processing
- [ ] Upload triggers processing
- [ ] Check `family_import_pages` table for extracted pages
- [ ] Verify text extraction worked
- [ ] Check browser console for errors

#### Test 3: AI Extraction
- [ ] Processing moves to extraction phase
- [ ] Check `extracted_family_members` table
- [ ] Check `extracted_relationships` table
- [ ] Verify confidence scores calculated
- [ ] Verify verification statuses assigned

#### Test 4: Review Dashboard
- [ ] Dashboard opens after extraction
- [ ] Members tab shows all extracted people
- [ ] Relationships tab shows connections
- [ ] Conflicts tab shows duplicates (if any)
- [ ] Preview tab renders tree visualization
- [ ] Edit a member's information
- [ ] Delete a duplicate member
- [ ] Merge two similar members
- [ ] Resolve a conflict

#### Test 5: Import Transaction
- [ ] Click "Approve & Import" button
- [ ] Import status shows "Importing..."
- [ ] Check `family_people` table for new members
- [ ] Check `relationships` table for new relationships
- [ ] Verify job status changed to "completed"
- [ ] Verify `import_review_history` logged actions
- [ ] New people appear in family tree
- [ ] Relationships render correctly

#### Test 6: Complex Genealogy (Darvesh Mohammed PDF)
- [ ] Upload 56-page Darvesh genealogy PDF
- [ ] Verify all 6 generations extracted (A-F)
- [ ] Verify branches identified (Kunigal, Kempanhalli)
- [ ] Verify multiple spouses detected
- [ ] Verify adoptions marked correctly
- [ ] Verify children numbered right-to-left
- [ ] Review extracted data accuracy
- [ ] Correct any errors before import
- [ ] Import and verify tree structure

#### Test 7: Permissions & Security
- [ ] Login as viewer (non-admin)
- [ ] Verify Import PDF button is hidden
- [ ] Try accessing review dashboard URL directly → should fail
- [ ] Try calling import RPC as viewer → should fail
- [ ] Login as admin
- [ ] All import features accessible

#### Test 8: Error Handling
- [ ] Upload non-PDF file → should reject
- [ ] Upload 51MB PDF → should reject
- [ ] Upload corrupted PDF → should show error
- [ ] Cancel import mid-process
- [ ] Test rollback function (use with caution!)

---

## 🔍 Troubleshooting

### Issue: Upload fails with "Storage not configured"

**Solution:**
1. Check storage bucket exists: `SELECT * FROM storage.buckets WHERE name = 'family-import-pdfs';`
2. Verify bucket policies are active
3. Check RLS policies allow admin uploads

### Issue: "Supabase client not initialized"

**Solution:**
- Check `src/services/supabase.ts` exports `supabase` correctly
- Verify environment variables loaded
- Restart dev server after `.env` changes

### Issue: AI extraction returns empty results

**Solution:**
1. Check Gemini API key is valid
2. Verify `callAIExtractionAPI` implementation
3. Check browser console for API errors
4. Test with simpler PDF first

### Issue: Import transaction fails

**Solution:**
1. Check PostgreSQL function exists: `\df import_approved_family_data`
2. Verify user has admin role: `SELECT * FROM family_memberships WHERE user_id = auth.uid();`
3. Check function logs in Supabase Dashboard → Database → Functions
4. Review error in `import_summary` field of failed job

### Issue: TypeScript errors

**Solution:**
Run type checking and fix remaining issues:
```bash
npx tsc --noEmit
```

Main issues to fix:
- Add null checks for `supabase` client
- Add missing type properties (see errors from earlier)
- Fix type mismatches in ImportReviewDashboard

---

## 📊 Monitoring & Maintenance

### Database Queries for Monitoring

```sql
-- View all import jobs
SELECT id, file_name, status, created_at, completed_at
FROM family_import_jobs
ORDER BY created_at DESC;

-- Check extraction statistics
SELECT 
  j.file_name,
  COUNT(DISTINCT m.id) as total_members,
  COUNT(DISTINCT r.id) as total_relationships,
  COUNT(DISTINCT c.id) as unresolved_conflicts
FROM family_import_jobs j
LEFT JOIN extracted_family_members m ON m.import_job_id = j.id
LEFT JOIN extracted_relationships r ON r.import_job_id = j.id
LEFT JOIN import_conflicts c ON c.import_job_id = j.id AND c.resolved = false
GROUP BY j.id, j.file_name;

-- View recent import activity
SELECT 
  action_type,
  notes,
  created_at
FROM import_review_history
ORDER BY created_at DESC
LIMIT 20;

-- Storage usage
SELECT 
  SUM(file_size_bytes) / (1024.0 * 1024.0) as total_mb
FROM family_import_jobs;
```

### Cleanup Old Jobs

```sql
-- Delete jobs older than 90 days (and related data)
DO $$
DECLARE
  old_job_id UUID;
BEGIN
  FOR old_job_id IN 
    SELECT id FROM family_import_jobs 
    WHERE created_at < NOW() - INTERVAL '90 days'
  LOOP
    DELETE FROM import_review_history WHERE import_job_id = old_job_id;
    DELETE FROM import_conflicts WHERE import_job_id = old_job_id;
    DELETE FROM extracted_relationships WHERE import_job_id = old_job_id;
    DELETE FROM extracted_family_members WHERE import_job_id = old_job_id;
    DELETE FROM family_import_pages WHERE import_job_id = old_job_id;
    DELETE FROM family_import_jobs WHERE id = old_job_id;
  END LOOP;
END $$;
```

---

## 🎓 User Guide for Admins

### How to Import a Family Tree PDF

1. **Prepare your PDF**
   - Ensure it's a genealogy document with clear names and relationships
   - Max 50MB, 200 pages
   - Better results with text-based PDFs vs scanned images

2. **Upload**
   - Go to your Family Tree
   - Click "Import PDF" button
   - Drag-drop or browse for your PDF
   - Click "Upload & Analyze"

3. **Wait for Processing**
   - AI extracts names, dates, relationships
   - May take 2-5 minutes for large documents

4. **Review & Verify**
   - Check the **Members** tab - verify names, dates, genders
   - Check the **Relationships** tab - verify parent-child, spouse connections
   - Check the **Conflicts** tab - resolve duplicates
   - Use **Preview** tab to visualize the tree

5. **Edit as Needed**
   - Click edit icon to fix errors
   - Merge duplicates using "Merge Mode"
   - Delete incorrect entries
   - Resolve conflicts by choosing which data to keep

6. **Approve & Import**
   - Click "Approve & Import" button
   - System imports all verified data atomically
   - New family members appear in your tree

### Tips for Best Results

✅ **DO:**
- Use PDFs with clear text (not handwritten)
- Review all extracted data before importing
- Verify confidence scores (green = high, red = low)
- Merge duplicates before importing
- Test with small PDFs first

❌ **DON'T:**
- Upload scanned images without OCR
- Import without reviewing data
- Ignore low confidence warnings
- Rush through conflict resolution

---

## 📈 Performance Considerations

### Optimization Tips

1. **PDF Size**: Larger PDFs take longer to process. Consider splitting very large genealogies (>100 pages) into chunks.

2. **AI API Costs**: Gemini API calls cost money. Monitor usage in Google Cloud Console.

3. **Storage**: PDFs are stored permanently. Implement cleanup for old jobs.

4. **Database**: Extraction tables can grow large. Archive or delete completed jobs after import.

### Scaling

For high-volume usage:
- Consider background job queue (e.g., BullMQ)
- Move PDF processing to serverless functions
- Add caching for repeated extractions
- Implement rate limiting

---

## 🔐 Security Notes

### RLS Enforcement

All import tables enforce Row Level Security:
- Only admins can create/read/update import jobs
- Viewers cannot access import system
- Permission checked at database level + UI level

### Storage Security

PDFs stored in private bucket:
- Not publicly accessible
- Admin-only download
- Automatic path scoping by family_id

### Import Transaction

`import_approved_family_data` function uses `SECURITY DEFINER`:
- Runs with elevated privileges
- Checks admin permission first
- Full audit trail in `import_review_history`

### Data Validation

- File type validation (PDF only)
- Size limits (50MB)
- SQL injection protection via parameterized queries
- XSS protection in UI

---

## 📞 Support & Issues

### Common Questions

**Q: Can I import the same PDF twice?**
A: Yes, but you'll need to review for duplicates. The system detects existing family members.

**Q: What happens if import fails mid-way?**
A: Transaction rolls back completely. Nothing is imported. Check error logs.

**Q: Can I undo an import?**
A: Yes, use `rollbackImport(jobId)` function, but use with extreme caution!

**Q: Does this work with scanned PDFs?**
A: Partially. Text-based PDFs work best. Scanned images require OCR (Gemini Vision).

### Getting Help

1. Check browser console for errors
2. Review Supabase logs (Dashboard → Database → Logs)
3. Check `import_review_history` for audit trail
4. Test with simple PDF first
5. Verify all deployment steps completed

---

## ✅ Deployment Checklist

Before going live:

- [ ] Migrations applied successfully
- [ ] Storage bucket created and accessible
- [ ] RLS policies verified
- [ ] Environment variables set
- [ ] PDF.js integration completed
- [ ] Gemini API integration completed
- [ ] Dependencies installed
- [ ] TypeScript errors resolved
- [ ] Tested upload with simple PDF
- [ ] Tested extraction accuracy
- [ ] Tested review dashboard
- [ ] Tested import transaction
- [ ] Tested with complex PDF
- [ ] Tested permissions (admin vs viewer)
- [ ] Documented for users
- [ ] Monitoring queries ready

---

## 🎉 Success Criteria

Your import system is ready when:

1. ✅ Admin can upload PDF and see progress
2. ✅ AI extracts family data with confidence scores
3. ✅ Review dashboard allows editing/merging/conflict resolution
4. ✅ Import transaction completes atomically
5. ✅ New people appear correctly in family tree
6. ✅ Relationships render properly
7. ✅ Permissions enforced (admin-only)
8. ✅ Darvesh Mohammed PDF imports successfully

**Next Step:** Test with your Darvesh Mohammed genealogy PDF and verify all 56 pages, 6 generations, branches, and relationships are extracted accurately!
