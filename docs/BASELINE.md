# Tiesora — Phase 0 Baseline

Recorded: 2026-11-12
Baseline commit: `3bca045` (`chore: baseline snapshot before Supabase migration`)
Environment: Node v24.15.0, npm 11.12.1, git 2.54.0 (Windows)

## Commands

| Command | Result |
|---|---|
| `npm.cmd install` | 488 packages installed. 9 vulnerabilities reported by npm. |
| `npm.cmd run lint` (`tsc --noEmit`) | **FAIL** — 53 TypeScript errors, all in `src/components/import/ImportReviewDashboard.tsx`. |
| `npm.cmd run build` (`vite build`) | **PASS** — built in ~1.3s. PWA service worker generated. |
| `npm.cmd test` (`tsx src/utils/runTests.ts`) | **PASS** — 17/17 relationship-engine tests. |

## Lint failure summary

All 53 errors are confined to `ImportReviewDashboard.tsx`. Main categories:

- `supabase` is possibly `null` (not narrowed before use).
- Local editing types (`EditingMember`, `EditingRelationship`) are missing fields used by the UI (`branch_label`, `notes`, `person1_id`, `person2_id`).
- `confidence_score` is `number | undefined` but passed where `number` is required.
- `ConfidenceMetrics` is passed where `number` is expected.
- Conflict objects use `severity` / `conflicting_data` fields that are not on `ImportConflict`.
- `"conflicting"` verification status is not on `VerificationStatus`.
- `Gender` / relationship-type string literals are not narrowed.

This matches the README's known issue. It must be fixed properly in Phase 8; `vite build` succeeds because Vite does not type-check.

## Build warnings

- Main JS chunk is 626 kB (over the 500 kB warning threshold).
- Two ineffective dynamic imports (`src/types/index.ts`, `src/services/supabase.ts`).

## Dependency audit

Original baseline: **9 vulnerabilities** — 1 critical, 2 high, 4 moderate, 2 low.

- **Critical:** `tar` (transitive via `canvas` → `@mapbox/node-pre-gyp`, an *optional* dependency of the old `pdfjs-dist`).
- **High:** `pdfjs-dist <= 4.1.392` (arbitrary JavaScript execution on a malicious PDF).
- **Moderate/low:** `glob`, `minimatch`, `workbox-build`/`vite-plugin-pwa`, `deepmerge` (all build-time).

### Post-baseline security update

- `pdfjs-dist` upgraded **3.11.174 → 6.5.438**.
  - Fixed the high-severity PDF.js advisory.
  - The new optional dependency is `@napi-rs/canvas`, which removes the
    `canvas` → `@mapbox/node-pre-gyp` → `tar` critical chain.
  - Worker is now bundled locally from
    `pdfjs-dist/build/pdf.worker.min.mjs?url` instead of a version-pinned CDN
    URL.
  - `page.render()` now passes the `canvas` element, as required by 6.x types.
- **`npm audit --omit=dev` now reports 0 vulnerabilities.**
- Remaining full-tree audit: **6 dev-only advisories** (2 low, 4 moderate) in
  the `vite-plugin-pwa` → `workbox-build` → `glob`/`minimatch`/`deepmerge`
  chain. These are build-time only. `npm audit fix --force` would downgrade
  `vite-plugin-pwa` to 1.1.0, a breaking change, so this is deferred to
  Phase 8 for a deliberate upgrade.
- Build and all 17 relationship tests still pass after the upgrade.

## Schema inconsistencies found

The migration history is not self-consistent:

- `20261023_init_kinroots.sql` does **not** create `profiles.full_name`, `profiles.email_verified`, `family_memberships.user_email`, or `family_memberships.user_name`.
- Later migrations and RPCs insert into all of those columns.
- `APPLY_TO_SUPABASE.sql` and `APPLY_TO_SUPABASE_IDEMPOTENT.sql` **do** include them.
- The original init also does not create `memories.created_by_name`, `change_requests.requested_by_name`, or `audit_logs.user_name`, although the app types expose them.

The Phase 1 migration adds the missing columns defensively and aborts early if the core schema is absent.

## Security findings from the snapshot

- A full Supabase **anon** key was hardcoded in `test-db-tables.js`. It has been replaced with `process.env` reads before the baseline commit. The anon key is designed to be public, but source-level keys should still not be committed.
- No `service_role` key was found in the repository.
- The existing `ensure_family_has_admin()` trigger returns `OLD` for UPDATE, which would silently cancel **every** admin demotion (not just the last-admin case). Phase 1 replaces it with an `OLD`/`NEW` branch.
- The existing `family-photos` bucket is public and its policies allow anyone to read/write the whole bucket. Phase 1 adds family-folder policies and makes the bucket private when empty.
- Several `SECURITY DEFINER` functions do not restrict `EXECUTE` to authenticated users. Phase 1 hardens `search_path` and grants.

## Gate for Phase 1

Before applying the schema migration we need:

1. `supabase/validation/check_schema.sql` output (missing tables / columns / policies / RPCs).
2. `scripts/inspect-localstorage.js` verdict (`REAL DATA LIKELY` or `SAMPLE DATA ONLY`).
3. `.env` filled with the project URL and anon key so the cutover can be tested.
