# Phase 9 — Legacy Migration & Production Readiness

Status: **implemented** (2026-11-13).

## Legacy localStorage decision

The real family data now lives in Supabase and was verified before this phase
(675 people, 365 relationships, 9 generations). LocalStorage is no longer a
family-data store:

- Supabase Auth stores only the session token (`tiesora_auth_v1`).
- `storage.ts` keeps UI preferences (current family id) and the local demo
  session for unconfigured/offline use.
- Bulk JSON restore/overwrite is retired while Supabase is configured. The
  Settings page now hides the JSON upload/preview controls and shows a notice
  directing admins to the PDF import pipeline.
- Demo mode is an in-memory sandbox and never writes.

No legacy JSON backup needed to be migrated; the PDF import is the canonical
source for the real family.

## Database audit

| Family | People | Relationships | Members | Decision |
|---|---|---|---|---|
| Darvesh Mohammed Tiesora Family | 675 | 365 | 2 | Keep — production family |
| `ss` | 0 | 0 | 1 | Leave — empty, owned by another email |
| `z` | 0 | 0 | 1 | Leave — empty, owned by another email |
| `vg` | 0 | 0 | 1 | Leave — empty, owned by another email |

The three empty families were not deleted because their owner emails are not
the bootstrap test accounts. They contain no people or memories, so they are
harmless; owners can remove them from Settings if desired.

## RLS verification (live project)

| Probe | Result |
|---|---|
| Anonymous `select families` | 0 rows |
| Anonymous `select family_people` | 0 rows |
| Viewer `select family_people` (own family) | Allowed |
| Viewer `insert family_people` | Blocked (`42501`, row-level security) |
| Viewer `update families` | 0 rows changed |
| Viewer `select invitations` | 0 rows (admin-only policy) |

## Secret and deployment checks

- `.env` is git-ignored; only `.env.example` is tracked.
- Repository scan found no service-role key or provider API key.
- `npm audit --omit=dev` → 0 vulnerabilities.
- Edge Function `extract-family-pdf`: **ACTIVE**, `verify_jwt: true`.
- `npm run lint`, `npm run test` (47/47), and `npm run build` pass.

## Remaining optional work

- Delete the three empty families if their owners confirm.
- Upgrade `vite-plugin-pwa`/workbox deliberately to clear the 6 dev-only
  advisories.
- Continue spot-checking imported branches and filling missing relationships.
- Add pagination or virtualization if the 675-row directory view becomes slow.
