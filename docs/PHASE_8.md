# Phase 8 — Cleanup & Hardening

Status: **implemented** (2026-11-13).

## Documentation consolidation

The eleven overlapping setup/import/auth markdown files at the repository root
were replaced by four current guides:

- `docs/SETUP.md`
- `docs/AUTH.md`
- `docs/PDF_IMPORT.md`
- `docs/DEPLOYMENT.md`

`docs/INDEX.md` maps the canonical docs and phase history. `README.md` now
describes the actual architecture (Supabase source of truth, Edge Function AI,
no provider keys in `VITE_*` variables) and links to the guides.

Removed root files:

`AUTHENTICATION_DIAGNOSIS.md`, `DEPLOYMENT.md`, `IMPORT_SYSTEM_DEPLOYMENT.md`,
`IMPORT_SYSTEM_SUMMARY.md`, `PDF_IMPORT_FIX_REPORT.md`,
`PDF_IMPORT_FIX_SUMMARY.md`, `PDF_IMPORT_IMPLEMENTATION_GUIDE.md`,
`QUICK_TEST_GUIDE.md`, `SETUP.md`, `SETUP_AUTHENTICATION.md`,
`SUPABASE_SETUP_PDF_IMPORT.md`.

Removed obsolete root debug scripts:

`complete-test.js`, `create-bucket-auto.js`, `create-storage-bucket.js`,
`run-bucket-creation.js`, `test-authentication.js`, `test-db-tables.js`,
`test-storage-bucket.js`, `test-pdf-extraction.html`.

## Large-tree performance

- Families larger than 400 people open the tree tab in **Family Directory
  (list) view** once, avoiding the full SVG canvas render.
- The list view shows a note explaining that Tree view is still available.
- Verified with the real 675-member family: 675 rows rendered, no canvas
  generation nodes, and the note is visible.
- The 500 kB chunk warning remains; it is a build-size notification, not a
  functional failure. Splitting PDF.js/Gemini dependencies would be the next
  optimization.

## Dependencies

- `npm audit --omit=dev` → **0 vulnerabilities**.
- The remaining 6 advisories are dev-only in the
  `vite-plugin-pwa` → `workbox-build` → `glob`/`minimatch` chain.
  `npm audit fix --force` would downgrade `vite-plugin-pwa` to 1.1.0, a
  breaking toolchain change, so it is intentionally deferred.

## Verification

- Lint clean, build passes, tests 47/47.
- Tree list default verified in the browser on the real family.
