# PDF AI Extraction — Supabase Edge Function

The browser no longer calls Groq or Gemini directly. It sends the extraction
prompt and the target `familyId` to the `extract-family-pdf` Edge Function. The
function:

1. Verifies the caller's Supabase JWT.
2. Calls `get_user_family_role(familyId)` and requires `admin`.
3. Calls Groq (preferred) or Gemini using a **Supabase secret**.
4. Returns the raw JSON text to the browser.

The provider key never enters the Vite bundle or `.env` as a `VITE_*` variable.

## Files

- `supabase/functions/extract-family-pdf/index.ts`
- Client call: `src/services/aiExtractor.ts` → `callAIExtractionAPI()`

## Deploy

### 1. Log in with the Supabase CLI

The CLI is not installed globally. Use `npx` (it downloads on first run):

```powershell
npx supabase login
```

If you prefer a global install:

```powershell
npm install -g supabase
supabase login
```

### 2. Link the project

```powershell
npx supabase link --project-ref yuysjdytkofnblusdtvu
```

Confirm the ref matches the project in `.env`.

### 3. Set the AI secret

```powershell
npx supabase secrets set GROQ_API_KEY=gsk_...
```

Optional:

```powershell
npx supabase secrets set GROQ_MODEL=openai/gpt-oss-120b
# or
npx supabase secrets set GEMINI_API_KEY=...
npx supabase secrets set GEMINI_MODEL=gemini-2.0-flash
```

Do not add these to `.env` or any `VITE_*` variable.

### 4. Deploy the function

```powershell
npx supabase functions deploy extract-family-pdf
```

The function is deployed with JWT verification enabled by default. The app's
`supabase.functions.invoke()` sends the signed-in user's session automatically.

### 5. Test

Use the app's PDF import flow as an admin. The function logs appear in:

Supabase Dashboard → **Edge Functions → extract-family-pdf → Logs**

## Local development

```bash
supabase functions serve extract-family-pdf --env-file supabase/.env.local
```

Create `supabase/.env.local` with `GROQ_API_KEY=...` (git-ignored by Supabase
CLI conventions; do not commit it). Point the app at the local function if you
use the Supabase CLI proxy.

## Error codes

| Status | Meaning |
|---|---|
| 401 | Missing/invalid session |
| 403 | Caller is not an active admin of the target family |
| 413 | Prompt exceeds 300k characters |
| 500 | Missing Supabase env or AI secret |
| 502 | AI provider returned an error or empty response |

## Why an Edge Function

A `VITE_GROQ_API_KEY` is bundled into the browser and can be extracted by
anyone who loads the app. The Edge Function keeps the key server-side and adds
an admin authorization check per request.
