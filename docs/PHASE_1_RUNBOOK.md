# Phase 1 Runbook — Supabase schema alignment

Do these in order. Nothing here changes application code.

## 1. Fill `.env`

Open `.env` in the project root and fill in:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Do **not** put the `service_role` key in this file. The anon key is safe in a
frontend build because RLS enforces access; the service role key bypasses RLS.

The old diagnostic scripts reference project ref `yuysjdytkofnblusdtvu`. Confirm
that is the live project before using it.

## 2. Inspect the live schema

1. Open Supabase Dashboard → **SQL Editor** → New query.
2. Paste the contents of `supabase/validation/check_schema.sql`.
3. Run it.
4. Save the result. The important rows are:
   - `status = MISSING` for tables, functions, buckets, or columns.
   - `constraint` rows showing the allowed `role` values.
   - `policy` rows for `notifications` and `audit_logs`.
   - `storage_policy` rows for `family-photos` / `family-import-pdfs`.

If any of the 11 core tables are `MISSING`, stop and run:

```text
supabase/migrations/APPLY_TO_SUPABASE_IDEMPOTENT.sql
```

Then run the validation script again.

## 3. Inspect existing browser data

1. Open the app in the browser/profile where you normally use it.
2. Open DevTools → Console.
3. Paste the contents of `scripts/inspect-localstorage.js`.
4. Read the verdict:
   - `SAMPLE DATA ONLY` → safe to reset local data; no migration needed.
   - `REAL DATA LIKELY` → keep the downloaded JSON; Phase 9 will migrate it.

The script intentionally does **not** read or export Supabase auth tokens.

## 4. Apply the Phase 1 migration

Only after steps 1–3:

1. Supabase Dashboard → SQL Editor → New query.
2. Paste `supabase/migrations/20261112_supabase_source_of_truth.sql`.
3. Run it. It is wrapped in a transaction; if anything fails, nothing changes.
4. Run `supabase/validation/check_schema.sql` again.

Expected after the migration:

| Item | Expected |
|---|---|
| `profiles.full_name` / `email_verified` | OK |
| `family_memberships.user_email` / `user_name` | OK |
| `memories.created_by_name` | OK |
| `change_requests.requested_by_name` | OK |
| `audit_logs.user_name` | OK |
| `notify_family_admins` | OK |
| `notifications` policies | includes insert + update for own rows |
| `audit_logs` policies | includes insert for own rows |
| `storage.objects` photo/PDF policies | family-folder scoped |

## 5. Notes and caveats

- `family-photos` is switched to **private only if it is empty**. If it already
  contains objects, it stays public until Phase 9 converts those objects and
  their URLs. The new RLS policies are created either way.
- The `profiles` SELECT policy is tightened to self + shared-family members.
  The app only reads the signed-in user's own profile, so this is safe.
- The migration replaces the last-admin trigger. The previous version returned
  `OLD` on UPDATE, which silently cancelled every admin demotion.
- The migration does not change any data except backfilling the new name/email
  columns from `profiles`.
- If the migration fails, the transaction rolls back. Read the error, fix the
  precondition (usually a missing core table), and re-run.

## 6. What to send back

Send:

1. The validation result table (or just the `MISSING` / `INFO` rows).
2. The localStorage verdict line.
3. Confirmation that `.env` is filled (do not paste the key).

Then Phase 2 (the typed Supabase data layer) starts.
