# Phase 5 — Audit Logging & Realtime Collaboration

Status: **implemented and verified** (2026-11-13).

## Audit logging

Audit entries are written from the typed Supabase data layer after successful
mutations. `recordAudit()` resolves the signed-in user and delegates to the
existing `logAudit()` insert; failures are logged to the console but never undo
the mutation that already succeeded.

Covered actions:

| Area | Actions recorded |
|---|---|
| People | created, updated, deleted |
| Relationships | created, updated, deleted |
| Memories | created, updated, deleted |
| Events | created, updated, deleted |
| Memberships | role changed, access revoked, deleted |
| Invitations | created, accepted, revoked |
| Family | created, settings updated |
| Change requests | submitted, approved, rejected |

Each entry stores the family, actor, action, target type/ID/name, a short
human-readable detail string, and a timestamp. The Collaboration → Audit Trail
History tab renders these rows directly.

Notes:

- Audit writes are best-effort. A failed insert is logged and ignored.
- Logging is application-level rather than table triggers, so the bulk PDF
  import does not generate hundreds of audit rows for its inserts.
- A future hardening step could add database triggers for direct SQL/API writes
  that bypass the app.

## Realtime collaboration

`src/services/realtime.ts` subscribes to Postgres changes for the selected
family and triggers a debounced refresh (1.2 s) of the workspace.

Tables: `families`, `family_people`, `relationships`, `memories`, `events`,
`family_memberships`, `invitations`, `change_requests`, `audit_logs`.

Database migration `supabase/migrations/20261113_enable_realtime.sql`:

- adds those tables to the `supabase_realtime` publication (idempotent);
- sets `REPLICA IDENTITY FULL` so filtered DELETE/UPDATE events include
  `family_id`.

The subscription starts only after the first Supabase load completes, so it
does not briefly attach to the demo family. Demo mode remains unaffected.

## Verification performed

1. Created a test event through the UI. A `created event` audit row appeared in
   Supabase with the correct actor, family, target, and timestamp.
2. Opened Collaboration → Audit Trail History and confirmed the row rendered.
3. Inserted an audit row directly in Postgres while the tab was open. It
   appeared in the UI without a manual refresh after the debounce window.
4. Deleted the test event and all test audit rows.
5. Lint and build pass; tests remain 47/47.

## Remaining follow-ups

- Realtime currently refreshes the whole family dataset. For very large trees,
  patching only the changed entity would be more efficient.
- Audit history is limited to the newest 100 rows and is not paginated.
- There is no retention/export policy yet.
