# Quick Testing Guide - PDF Import System

## ✅ System Status: READY TO TEST

**Dev Server:** Running at http://localhost:3000/  
**Last Updated:** 2026-11-01 9:52 PM  
**Status:** All core fixes implemented

---

## 🧪 TESTING STEPS

### Step 1: Open the Application
```
http://localhost:3000/
```

### Step 2: Login as Admin
- Use your admin account credentials
- Make sure you're a member of a family with admin role
- Navigate to the Family Tree page

### Step 3: Find the Import Button
Look for the **"Import PDF"** button near the "Add Member" button on the Family Tree page.

**If you don't see it:**
- Make sure you're logged in as an admin (not viewer)
- The button only appears for admin users
- Check browser console for any errors

### Step 4: Upload the PDF
1. Click **"Import PDF"** button
2. **Drag and drop** your `Darvesh Mohammed.pdf` OR click "Browse Files"
3. Select the 56-page PDF file
4. Click **"Upload & Analyze"**

### Step 5: Watch the Processing
You should see:
```
✓ Uploading PDF... (5-10 seconds)
✓ Analyzing Your Family Tree (3-5 minutes for 56 pages)
  • Reading pages and extracting text
  • Running OCR on scanned pages
  • Analyzing family relationships
  • Saving results to database
```

**Important:** Processing 56 pages takes 3-5 minutes. Be patient!

### Step 6: Review the Results
After processing, the **Review Import** dashboard should open showing:

**Expected Results:**
- ✅ **Members count** > 0 (not 0!)
- ✅ **Relationships count** > 0 (not 0!)
- ✅ **Average Confidence** = XX% (not NaN%)
- ✅ **Verified / Needs Review / Uncertain** counts displayed

**Tabs Available:**
- **Members** - All extracted people with names, dates, generations
- **Relationships** - Parent-child, spouse, sibling connections
- **Conflicts** - Duplicates or contradictions to resolve
- **Preview** - Visual family tree diagram

### Step 7: Review the Data
Click through each tab:

**Members Tab:**
- Check if names are extracted correctly
- Verify generation labels (A, B, C, D, E, F)
- Check branch labels (Kunigal, Kempanhalli)
- Edit any incorrect information

**Relationships Tab:**
- Verify parent-child connections
- Check spouse relationships (including multiple marriages)
- Verify adoptions are marked correctly

**Preview Tab:**
- See the visual family tree
- Check if hierarchy makes sense
- Verify confidence scores on each person

### Step 8: Approve or Make Edits
- **Edit** incorrect names or dates by clicking the edit icon
- **Merge** duplicates using "Merge Mode"
- **Resolve** conflicts if any are shown
- **Approve & Import** when ready

---

## 🔍 WHAT TO LOOK FOR

### ✅ SUCCESS INDICATORS

1. **Upload Works**
   - Progress bar shows during upload
   - "Analyzing..." screen appears
   - No error messages

2. **Extraction Works**
   - Processing takes 3-5 minutes (normal for 56 pages)
   - Review dashboard opens automatically
   - Shows actual counts (not 0)

3. **Data Quality**
   - Names appear reasonable
   - Generation labels (A-F) present
   - Relationships make sense
   - Dates in reasonable format

4. **Dashboard Works**
   - Stats show real numbers
   - Average confidence is a percentage (not NaN)
   - Tabs switch correctly
   - Preview renders tree

### ❌ POTENTIAL ISSUES

**If you see "0 people, 0 relationships":**
- Check browser console for errors
- Verify migrations were applied to Supabase
- Check if `extracted_family_members` table exists
- Verify `VITE_GEMINI_API_KEY` is set in .env

**If you see "NaN%":**
- This should be fixed now
- If still occurs, check browser console
- Report the error message

**If extraction takes forever (>10 minutes):**
- Check network connection
- Check Gemini API rate limits
- Check browser console for errors
- May need to reduce batch size

**If you get API errors:**
- Verify `VITE_GEMINI_API_KEY` is valid
- Check Gemini API quota/billing
- Check browser console for exact error message

---

## 🐛 DEBUGGING TIPS

### Check Browser Console
Press `F12` and look at the Console tab for:
```
✓ "PDF loaded: 56 pages"
✓ "Split into 12 batches"
✓ "Processing batch 1/12"
✓ "Batch 1 extracted: X people, Y relationships"
✓ "Inserted X people successfully"
✓ "Inserted Y relationships successfully"
```

### Check Network Tab
Look for requests to:
- `generativelanguage.googleapis.com` (Gemini API)
- `supabase.co` (Database saves)
- Both should return 200 OK

### Check Supabase Database
In Supabase Dashboard → Table Editor:
- `family_import_jobs` - Should have your job
- `extracted_family_members` - Should have people
- `extracted_relationships` - Should have relationships

### Common Console Logs
```javascript
// Good signs:
"PDF loaded: 56 pages"
"Gemini response received, parsing JSON..."
"Extracted: 45 people, 67 relationships"
"Total extracted before validation: 45 people"
"Inserting 45 people..."
"Inserted 45 people successfully"

// Bad signs (errors):
"Failed to load import job details"
"Failed to download PDF file"
"AI extraction failed: [error message]"
"Failed to save extracted people: [error message]"
```

---

## 📋 PRE-FLIGHT CHECKLIST

Before testing, verify:

- [x] **Dev server running** → http://localhost:3000/ ✓
- [x] **pdfjs-dist installed** → `npm install pdfjs-dist@3.11.174` ✓
- [x] **@google/generative-ai installed** → Already in package.json ✓
- [x] **VITE_GEMINI_API_KEY set** → Check .env file ✓
- [ ] **Migrations applied** → Check Supabase Dashboard
- [ ] **Storage bucket exists** → Check Supabase Storage
- [ ] **Admin user exists** → You need admin role
- [ ] **PDF file ready** → Have Darvesh Mohammed.pdf ready

---

## 📊 EXPECTED PERFORMANCE

For **Darvesh Mohammed.pdf (56 pages)**:

| Step | Duration | What's Happening |
|------|----------|------------------|
| Upload | 5-10 sec | Uploading to Supabase Storage |
| Text Extraction | 30-60 sec | PDF.js reading all 56 pages |
| AI Analysis | 2-4 min | Gemini processing 12 batches (5 pages each) |
| Database Save | 5-10 sec | Inserting people & relationships |
| **Total** | **3-5 min** | Complete workflow |

---

## 🎯 SUCCESS CRITERIA

The fix is working if you see:

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| People Count | ❌ 0 | ✅ 40-60 people |
| Relationships | ❌ 0 | ✅ 60-100 relationships |
| Avg Confidence | ❌ NaN% | ✅ 60-80% |
| Dashboard | ❌ Failed to load | ✅ Opens with data |
| Processing | ❌ Instant (fake) | ✅ 3-5 minutes (real) |

---

## 📞 IF YOU ENCOUNTER ISSUES

### 1. Check Migrations First
```sql
-- In Supabase SQL Editor, verify tables exist:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%import%';

-- Should return:
-- family_import_jobs
-- family_import_pages
-- extracted_family_members
-- extracted_relationships
-- import_conflicts
-- import_review_history
```

### 2. Check Storage Bucket
In Supabase Dashboard → Storage:
- Bucket `family-import-pdfs` should exist
- Should be private (not public)
- Should have RLS policies enabled

### 3. Check API Key
```bash
# In .env file:
VITE_GEMINI_API_KEY=AIza...
```
Test at: https://aistudio.google.com/app/apikey

### 4. Check Browser Console
Look for specific error messages and report them.

### 5. Check Network
Ensure stable internet connection for:
- Supabase API calls
- Gemini API calls
- PDF uploads

---

## 🎉 WHAT SUCCESS LOOKS LIKE

After uploading `Darvesh Mohammed.pdf`, you should see something like:

```
Review Import
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Darvesh Mohammed.pdf • 47 people • 73 relationships

┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Verified   │ Needs Review│  Uncertain  │Avg Confidence│
│     15      │     28      │      4      │     68%     │
└─────────────┴─────────────┴─────────────┴─────────────┘

Members (47):
├─ Abdul Rahman (Generation A, Kunigal)
├─ Fatima Begum (Generation A, Kunigal)
├─ Mohammed Hussain (Generation B, Kempanhalli)
└─ ... (44 more)

Relationships (73):
├─ Abdul Rahman → parent → Mohammed Hussain
├─ Abdul Rahman → spouse → Fatima Begum
└─ ... (71 more)
```

---

## 🚀 READY TO TEST!

1. Open http://localhost:3000/
2. Login as admin
3. Click "Import PDF"
4. Upload Darvesh Mohammed.pdf
5. Wait 3-5 minutes
6. Review the extracted data
7. Report results!

**Good luck!** 🎉

---

*Generated: 2026-11-01*  
*System: Fixed & Ready*  
*Status: ✅ Ready for Testing*
