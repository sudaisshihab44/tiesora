# Supabase Data Layer

Location: `src/services/db/`

Status: **Phase 2 complete**. The UI still uses `src/services/storage.ts`;
Phase 3 switches it to this layer. No component imports these modules yet.

## Modules

| File | Responsibility |
|---|---|
| `core.ts` | `db()` client guard, `queryOne` / `queryMany` / `execute`, `DbError`, `defined()` |
| `rows.ts` | Postgres row shapes (nullable columns are `T \| null`) |
| `mappers.ts` | Row → app type mapping, date helpers, relationship direction, storage path detection |
| `profiles.ts` | `getProfile`, `updateProfile` |
| `families.ts` | list/get/create/update/delete, `createFamilyWithAdmin` RPC |
| `people.ts` | list/get/create/update/delete |
| `relationships.ts` | list/create/update/delete |
| `memories.ts` | list/create/update/delete |
| `events.ts` | list/create/update/delete |
| `memberships.ts` | list, my memberships, role lookup, role update, revoke |
| `invitations.ts` | list, create via RPC, validate via RPC, accept via RPC, revoke |
| `changeRequests.ts` | list, submit, review (applies approved edits) |
| `notifications.ts` | list, mark read, self-create, `notifyFamilyAdmins` RPC |
| `auditLogs.ts` | list, append |
| `storage.ts` | upload private family photo, signed URL, delete |
| `index.ts` | Barrel export |

## Design decisions

### Dates
Postgres uses `DATE`. `toDbDate()` converts `"1942"` to `"1942-01-01"`;
`date_precision` carries the uncertainty. `fromDbDate()` returns the ISO date
or `undefined`.

### Relationship direction
The app's `RelationshipType` includes `'child'`, but the DB check only allows
canonical parent→child edges. `normalizeRelationshipEndpoints()` swaps the
endpoints and stores `'parent'` when the input is `'child'`.

### Actor-derived columns
All write functions set `created_by`, `requested_by`, or `user_id` from the
signed-in actor. The Phase 1 RLS policies require this, so a client cannot
spoof another user.

### Names on records
Phase 1 added `memories.created_by_name`, `change_requests.requested_by_name`,
and `audit_logs.user_name`. Writes store the actor's display name; reads map
the column directly, so no profile join is needed.

### Photos
Uploads go to the private `family-photos` bucket at
`{family_id}/{uuid}.{ext}`. `memories.image_url` stores the **path**, not a
public URL. `getFamilyPhotoUrl()` returns a one-hour signed URL; external
`https:` / `data:` URLs pass through unchanged.

### Demo mode
Every function calls `db()`, which throws if Supabase is not configured.
Phase 7 will add a separate local sample provider; the UI must branch before
calling this layer when `isSupabaseConfigured` is false.

## Connectivity check

Run:

```bash
node scripts/check-connection.mjs
```

It loads `.env`, verifies the Auth endpoint, and makes one read-only
RLS-scoped query. As an anonymous caller, `families` correctly returns
0 rows. The current project host was verified and the check passed.

## Tests

`npm.cmd test` runs 47 tests:

- 17 relationship-engine tests
- 30 data-mapper tests (`src/services/db/mappers.test.ts`)

The mapper tests cover date normalisation, `'child'` edge swapping, nullable
column mapping, legacy role normalisation, privacy defaults, and storage path
detection.

## Next: Phase 3

1. Add a `DataProvider`/`useFamilyData` hook that loads families, people,
   relationships, memories, events, memberships, change requests,
   notifications, and audit logs in parallel.
2. Replace `storage.*` calls in `App.tsx` and the 14 components with async
   actions from this layer.
3. Add loading/error states.
4. Keep `storage.ts` only for demo mode until Phase 7 isolates it.
