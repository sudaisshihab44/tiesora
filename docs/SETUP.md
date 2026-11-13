# Setup Guide

Status: current as of 2026-11-13.

## Prerequisites

- Node.js 18+ and npm
- A Supabase project
- A Gemini API key (primary PDF extraction provider) or Groq API key
- Supabase CLI and a personal access token only if you deploy the Edge Function

## 1. Install

```bash
git clone <repo-url>
cd tiesora-master
npm install
```

## 2. Environment variables

Copy `.env.example` to `.env`. Browser-exposed values must use the `VITE_`
prefix; provider keys and service keys must never do so.

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Public anon/publishable key (RLS protects data) |
| `VITE_APP_URL` | browser | Public origin used to build invitation links |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | local scripts | Test admin account |
| `BOOTSTRAP_VIEWER_EMAIL` / `BOOTSTRAP_VIEWER_PASSWORD` | local scripts | Test viewer account |
| `SUPABASE_ACCESS_TOKEN` | local scripts | Supabase CLI / management API |
| `SUPABASE_SERVICE_ROLE_KEY` | local scripts only | Admin operations; never prefix with `VITE_` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` | Edge Function secret | AI extraction keys; never in the browser |
| `AI_PROVIDER` | Edge Function secret | `gemini` (default) or `groq` |
| `GEMINI_MODEL` | Edge Function secret | Primary Gemini model |
| `GEMINI_MODEL_FALLBACKS` | Edge Function secret | Comma-separated fallback models |
| `GROQ_MODEL` | Edge Function secret | Groq fallback model |

`.env` is git-ignored. Test credentials live only in the local `.env`.

## 3. Database migrations

Apply the migrations in `supabase/migrations/` in filename order. The current
required set is:

1. `20261023_init_kinroots.sql`
2. `20261026_admin_viewer_roles.sql`
3. `20261027_fix_rls_and_bootstrap.sql`
4. `20261028_invitation_rpcs.sql`
5. `20261029_create_family_with_admin.sql`
6. `20261030_create_invitation_rpc.sql`
7. `20261031_APPLY_THIS_fix_invitation_ambiguity.sql` — **required**
8. `20261101_pdf_import_system.sql`
9. `20261101_import_transaction_function.sql`
10. `20261102_create_storage_bucket.sql`
11. `20261112_supabase_source_of_truth.sql`
12. `20261113_fix_import_transaction.sql`
13. `20261113_enable_realtime.sql`

The `APPLY_THIS` name is historical; it now targets the
`family_memberships_family_id_user_id_key` constraint and is safe to run.
`APPLY_TO_SUPABASE*.sql` are legacy combined files and are not the canonical
path.

Validate with `supabase/validation/check_schema.sql` after applying.

## 4. Storage

The private `family-import-pdfs` bucket stores import PDFs. The private
`family-photos` bucket stores memory images. Both are created by the
migrations. Family images are read through short-lived signed URLs.

## 5. Edge Function (PDF import)

The AI call is server-side only. See `docs/EDGE_FUNCTION.md` for project
linking, deployment, and secrets.

```bash
supabase link --project-ref <project-ref>
supabase functions deploy extract-family-pdf
supabase secrets set AI_PROVIDER=gemini GEMINI_API_KEY=... GEMINI_MODEL=gemini-3.5-flash-lite GEMINI_MODEL_FALLBACKS=gemini-3.6-flash,gemini-3.8-flash GROQ_API_KEY=... GROQ_MODEL=openai/gpt-oss-120b
```

## 6. Run

```bash
npm run dev       # http://localhost:3000
npm run lint      # tsc --noEmit
npm run test      # relationship-engine tests
npm run build     # production bundle
```

## 7. Test accounts

```bash
node scripts/bootstrap-via-signup.mjs
```

The script reads emails and passwords from `.env`; it has no hardcoded
credentials. It creates real Supabase Auth users and memberships. Use the
admin account for editing and the viewer account for read-only checks.

## 8. Demo mode

The public **Explore Live Demo Tree** button opens an in-memory, read-only
sample family. It never reads or writes Supabase/localStorage and is safe to
share publicly. See `docs/PHASE_7.md`.

## Documentation map

- `docs/AUTH.md` — authentication, roles, invitations
- `docs/PDF_IMPORT.md` — import pipeline and troubleshooting
- `docs/DEPLOYMENT.md` — Vercel/Supabase production deployment
- `docs/EDGE_FUNCTION.md` — Edge Function secrets and deployment
- `docs/DATA_LAYER.md` — typed Supabase data layer
- `docs/PHASE_*.md` — implementation history
