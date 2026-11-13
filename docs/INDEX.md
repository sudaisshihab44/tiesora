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

Remaining phases:

- **Phase 8** — documentation consolidation (done), large-tree list default
  (done), dev-only PWA dependency advisories (deferred: requires a deliberate
  `vite-plugin-pwa` version change).
- **Phase 9** — legacy localStorage data decision, sample-family cleanup,
  final production checklist.