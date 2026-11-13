# Deployment Guide

Status: current as of 2026-11-13.

## Architecture

- **Frontend**: Vite/React build on Vercel.
- **Database/Auth/Storage**: Supabase, protected by RLS.
- **AI extraction**: Supabase Edge Function `extract-family-pdf` (never called
  directly from the browser with provider keys).
- **Source of truth**: Supabase. `localStorage` is only used for UI preferences
  and local demo sessions.

## Vercel

1. Push the repository to GitHub.
2. Import the project in Vercel. Framework preset: Vite.
3. Build command `npm run build`, output directory `dist`.
4. Add environment variables (browser-safe only):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
VITE_APP_URL=https://<your-domain>
```

Do **not** add `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `GROQ_API_KEY`
to Vercel's `VITE_*` environment. Provider keys belong in Supabase Edge
Function secrets.

5. Deploy.

## Supabase

- Apply all migrations listed in `docs/SETUP.md`.
- Authentication → URL Configuration:
  - Site URL: your production origin.
  - Redirect URLs: `https://<your-domain>/**` (and localhost for development).
- Confirm the private buckets `family-import-pdfs` and `family-photos` exist.
- Deploy the Edge Function and set secrets:

```bash
supabase link --project-ref <project-ref>
supabase functions deploy extract-family-pdf
supabase secrets set AI_PROVIDER=gemini \
  GEMINI_API_KEY=... \
  GEMINI_MODEL=gemini-3.5-flash-lite \
  GEMINI_MODEL_FALLBACKS=gemini-3.6-flash,gemini-3.8-flash \
  GROQ_API_KEY=... \
  GROQ_MODEL=openai/gpt-oss-120b
```

See `docs/EDGE_FUNCTION.md` for details.

## Post-deploy checklist

1. Sign in as admin; dashboard shows the real family and member counts.
2. Sign in as viewer; write controls are absent.
3. Create an invitation, open the link in a private window, sign in, and join.
4. Create and delete a test event; confirm the audit trail records it.
5. Open two sessions and confirm a change appears in the other after ~1–2 s
   (Realtime).
6. Open the public demo and confirm the read-only banner and sample data.
7. Confirm `npm run lint`, `npm run test`, and `npm run build` pass.

## Notes

- The PWA service worker may cache an old build; hard-refresh after deploying.
- Dev-only workbox advisories remain in the build toolchain; they are not
  shipped to users.
- The demo is a fixed in-bundle sample and never touches production data.
