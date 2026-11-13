# PDF Import System

Status: current as of 2026-11-13. The system has been used successfully on the
61-page Darvesh Mohammed Tiesora family PDF.

## Flow

1. **Upload** — admin selects a PDF (max 50 MB, up to 200 pages). It is stored
   in the private `family-import-pdfs` bucket.
2. **Text extraction** — PDF.js extracts text client-side. The PDF needs a text
   layer; scanned image-only pages are not OCR'd.
3. **AI extraction** — pages are sent in 3-page batches to the
   `extract-family-pdf` Supabase Edge Function. Provider order:
   - Gemini 3.5 Flash-Lite (primary)
   - Gemini 3.6 Flash
   - Gemini 3.8 Flash
   - Groq `openai/gpt-oss-120b`
4. **Normalization** — names are deduplicated across batches, relationship
   endpoints are normalized, and generation levels are inferred from A/B/C
   labels plus parent/spouse links.
5. **Review** — the import dashboard shows staged people, relationships,
   warnings, and duplicates. Admins can edit before approving.
6. **Atomic import** — approval calls `import_approved_family_data`, which
   inserts the reviewed rows in one transaction and records the job result.

## Key files

| File | Purpose |
|---|---|
| `src/components/tree/ImportFamilyTreeModal.tsx` | Upload, progress/ETA, review entry |
| `src/components/import/ImportReviewDashboard.tsx` | Staged review and approval |
| `src/services/pdfProcessor.ts` | PDF page/text extraction |
| `src/services/aiExtractor.ts` | Batching, dedupe, generation inference, retries |
| `src/services/importTransaction.ts` | Approval/import RPC |
| `supabase/functions/extract-family-pdf/index.ts` | Server-side AI provider chain |
| `supabase/migrations/20261101_pdf_import_system.sql` | Staging tables and jobs |
| `supabase/migrations/20261101_import_transaction_function.sql` | Import RPC |
| `supabase/migrations/20261113_fix_import_transaction.sql` | Corrected import RPC |

## Time expectations

- Upload: usually seconds.
- AI analysis: roughly 10–30 minutes for a large genealogy PDF.
  The 61-page import took about 26 minutes (21 batches / 63 AI calls).
- The modal shows a page/batch-based initial estimate, then a live progress bar
  and remaining-time estimate as batches complete.

## Limits and failure modes

- **Groq free tier: 8K TPM.** Five-page batches exceeded it, so batches are
  capped at 3 pages.
- **Gemini 503s** are intermittent. The Edge Function retries and falls through
  the model chain.
- **Retired/decommissioned models** must be removed from the secret list.
- **Scanned PDFs without a text layer** extract little or nothing.
- Re-importing the same PDF into the same family creates duplicate people; the
  tree is not automatically replaced.

## Diagnostics

```bash
node scripts/test-extraction.mjs --pages 1-3
node scripts/test-extraction.mjs --all
node scripts/backfill-generation-levels.mjs
```

The extraction diagnostic uses the Edge Function exactly like the app and
prints per-page text and model responses.

## Data quality

Generation inference is heuristic. After a large import, spot-check known
branches and add missing parent/spouse links. Disconnected names may remain at
Generation 1 if the chart did not provide enough context.
