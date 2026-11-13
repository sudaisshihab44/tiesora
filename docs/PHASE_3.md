# Phase 3 — Supabase UI Cutover

Status: **implemented**, pending authenticated browser verification.

## What changed

- `src/App.tsx` now loads families, people, relationships, memories, events,
  memberships, change requests, notifications, and audit logs from Supabase
  when `.env` is configured. Demo mode still uses localStorage.
- `src/services/dataActions.ts` is the mode-aware write layer. Every component
  write now goes through it:
  - Supabase mode → `src/services/db/`
  - Demo mode → `src/services/storage.ts`
- The authenticated app shell waits for the first Supabase load before
  rendering, and shows a retry screen on failures.
- Family switching re-derives the caller's role from the selected family's
  membership instead of the first membership.
- Onboarding creates the family + admin membership via
  `create_family_with_admin`, then writes people and relationships to
  Supabase.
- Profile editing, person/relationship deletion, memories, events,
  notifications, member roles, invitations, privacy settings, and change
  request review are all wired to Supabase in configured mode.
- Memory uploads go to the private `family-photos` bucket. `memories.image_url`
  stores the object path; `FamilyImage` resolves it to a one-hour signed URL.
- Viewers no longer see “Add Memory”, “Schedule Event”, or similar write
  buttons.
- The landing page hides “Explore Live Demo Tree” when Supabase is configured
  (the demo sandbox is Phase 7).

## Known gaps (intentionally deferred)

| Gap | Phase |
|---|---|
| Pending Supabase invitations are listed in User Management and can be regenerated or revoked. | Done — Phase 4 |
| Audit log entries are written by Supabase-backed client actions, with best-effort failure handling. | Done — Phase 5 |
| JSON restore/overwrite is retired in Supabase mode; the upload UI is hidden and the PDF pipeline is canonical. | Done — Phase 9 |
| `ImportReviewDashboard.tsx` is type-clean; the PDF import flow has been used successfully on the real dataset. | Done — Phase 6 |
| Real-time subscriptions are enabled for family tables with a debounced refresh. | Done — Phase 5 |
| Demo mode is an in-memory read-only sandbox with no Supabase or localStorage writes. | Done — Phase 7 |

## Build / test status

- `npm.cmd run build` → passes.
- `npm.cmd test` → 47/47 pass.
- `tsc --noEmit` → only the 53 pre-existing `ImportReviewDashboard.tsx` errors
  remain; every Phase 3 file is clean.
- Landing and sign-in routes loaded in the browser with **zero console errors**
  and **zero failed network requests**.
- Supabase connectivity check (`node scripts/check-connection.mjs`) passes.

## Authenticated test checklist

Use the running dev server at `http://localhost:3000`.

1. Sign in with an existing account. The app should show a loading state, then
   the dashboard with the family list from Supabase.
2. Switch between families. The role and dashboard variant should follow the
   selected family.
3. Add a person, add a relationship, edit the person, then delete the person.
4. Open Memories, upload a photo, and confirm the image renders (signed URL).
5. Create an event and confirm it appears.
6. Mark notifications as read.
7. Invite a viewer, open the generated link in a private window, accept it, and
   confirm the viewer sees read-only controls.
8. Check the browser console and report any error text.
