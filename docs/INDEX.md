# Documentation Index

Canonical docs (start here):

| Document | Purpose |
|---|---|
| `README.md` (repo root) | Product overview, quick start, feature list |
| `docs/SETUP.md` | Local environment, migrations, Edge secrets, test accounts |
| `docs/AUTH.md` | Roles, authentication, invitations, security troubleshooting |
| `docs/PDF_IMPORT.md` | Import pipeline, provider chain, limits, diagnostics |
| `docs/DEPLOYMENT.md` | Vercel + Supabase production deployment |
| `docs/EDGE_FUNCTION.md` | Edge Function deployment and secrets |
| `docs/DATA_LAYER.md` | Typed Supabase data layer conventions |

Implementation history:

| Document | Status |
|---|---|
| `docs/BASELINE.md` | Phase 0 baseline and security findings |
| `docs/PHASE_1_RUNBOOK.md` | Schema migration and validation |
| `docs/PHASE_3.md` | UI cutover to Supabase |
| `docs/PHASE_4.md` | Invitations, pending list, deep-link acceptance |
| `docs/PHASE_5.md` | Audit logging and realtime collaboration |
| `docs/PHASE_7.md` | Read-only public demo sandbox |
| `docs/PHASE_8.md` | Docs consolidation, large-tree list default, dependency audit |
| `docs/PHASE_9.md` | Legacy localStorage decision, RLS audit, production readiness |

Remaining optional work:

- Dev-only PWA dependency advisories (requires a deliberate `vite-plugin-pwa`
  version change).
- Delete the three empty families owned by other emails if their owners
  confirm.
- Imported-tree spot checks and missing relationship links.