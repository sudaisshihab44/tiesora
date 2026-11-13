# Phase 7 — Read-only Demo Sandbox

Status: **implemented and verified** (2026-11-13).

## What changed

- The public **Explore Live Demo Tree** button is now available even when
  Supabase is configured.
- Demo data is served from an in-memory snapshot in
  `src/services/demoSandbox.ts` (`getDemoSandbox()`); nothing is persisted to
  localStorage or Supabase.
- The demo identity is always `Demo Visitor` with the `viewer` role. Admin-only
  navigation, Add Member, Import PDF, invite controls, and settings are not
  rendered.
- A banner at the top of the workspace states that the sandbox is read-only and
  provides an **Exit demo** button.
- The sidebar storage card reads **Demo Sandbox · Sample data · Read-only**
  instead of claiming the Supabase workspace is active.
- `db()` in `src/services/db/core.ts` refuses to run while the sandbox is
  active, as a hard boundary against accidental writes.
- Realtime subscriptions are disabled during the sandbox, and auth-state events
  are ignored so a token refresh cannot pull the real workspace back in.
- In-flight Supabase loads check the sandbox flag before applying results, so a
  slow request cannot overwrite the demo with real data or the real role.
- Exiting the demo returns to the landing page and restores the real session
  identity without signing the user out. Choosing Sign Out inside the demo
  exits the sandbox rather than ending the visitor's real session.

## Verification performed

1. Opened the landing page while Supabase was configured and launched the demo.
2. Confirmed the demo banner, `Demo Visitor` identity, sample family (21
   members / 4 generations), and Viewer role.
3. Confirmed admin navigation, Add Member, and other write controls were absent.
4. Monitored network traffic for ~3.5 seconds while the sandbox was open: **no
   new Supabase requests**.
5. Confirmed the realtime channel was closed for the real family and no channel
   was opened for the demo family.
6. Exited the demo, signed back in as admin, and confirmed the real workspace
   still showed 675 members / 9 generations with no changes.
7. Lint and build pass; tests 47/47.

## Remaining follow-ups

- The demo is intentionally a fixed snapshot, so it will not reflect changes to
  the sample dataset until the bundle is rebuilt.
- The landing page marketing preview still uses the Montgomery-Vance sample
  family by design.
