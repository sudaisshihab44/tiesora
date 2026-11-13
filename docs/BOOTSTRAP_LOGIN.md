# Bootstrap Admin & Viewer Login

Local development only. This creates **real Supabase Auth users** and a test
family. Do not run it against a production project you care about without
understanding the cleanup steps.

## Current local test accounts

Created 2026-11-13 for this project:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@tiesora.test` | `Tiesora-Admin-2026!` |
| Viewer | `viewer@tiesora.test` | `Tiesora-Viewer-2026!` |

Family: **Bootstrap Test Family** (`fc5ba4da-de86-4b99-82f4-d7394abd4801`)

These are real Supabase Auth users. Delete them before production.

## If you do not have the service_role key

Use the public sign-up bootstrap instead:

```powershell
node scripts/bootstrap-via-signup.mjs
```

It signs up the admin and viewer through Supabase Auth, creates the test family
with the admin, and adds the viewer membership. If the live
`accept_invitation` RPC still has the `family_id is ambiguous` bug, the script
falls back to inserting the viewer membership directly as the admin.

To fix the real invitation flow, run:

```text
supabase/migrations/20261031_APPLY_THIS_fix_invitation_ambiguity.sql
```

in the Supabase SQL Editor. That version qualifies the `ON CONFLICT` columns.

## What it creates

| Account | Role | Email (default) |
|---|---|---|
| Bootstrap Admin | `admin` | `admin@tiesora.test` |
| Bootstrap Viewer | `viewer` | `viewer@tiesora.test` |

Plus a family named **Bootstrap Test Family**.

Passwords are either read from `.env` or randomly generated and printed by the
script.

## Steps

### 1. Get the service_role key

Supabase Dashboard → **Project Settings → API → Project API keys** → copy the
`service_role` key.

Never put this key in a `VITE_*` variable. It bypasses Row Level Security and
would be exposed to every browser that loads the app.

### 2. Add it to `.env`

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Optionally set fixed credentials:

```env
BOOTSTRAP_ADMIN_EMAIL=admin@tiesora.test
BOOTSTRAP_ADMIN_PASSWORD=choose-a-strong-password
BOOTSTRAP_VIEWER_EMAIL=viewer@tiesora.test
BOOTSTRAP_VIEWER_PASSWORD=choose-a-strong-password
```

If the password values are empty, the script generates random passwords and
prints them once.

### 3. Run the script

```powershell
node scripts/bootstrap-users.mjs
```

Expected output:

```text
Bootstrap login ready
Admin:   admin@tiesora.test
         Password: ...
Viewer:  viewer@tiesora.test
         Password: ...
Family:  Bootstrap Test Family (uuid)
```

Save the passwords. The script is idempotent: re-running it finds the existing
users, resets their passwords to the current values, and re-upserts the family
and memberships.

### 4. Sign in

Use the normal Tiesora sign-in page:

- Admin → choose **Admin Login**, then the admin email/password.
- Viewer → choose **User Login**, then the viewer email/password.

The role is always re-verified from `family_memberships`; the button choice does
not grant access.

### 5. Remove the service_role key

After the users exist, remove `SUPABASE_SERVICE_ROLE_KEY` from `.env` (or leave
it blank) and restart the dev server. It is not needed by the app.

## Cleanup

When you are done testing:

1. Supabase Dashboard → **Authentication → Users** → delete the two bootstrap
   users.
2. Supabase Dashboard → **Table Editor → families** → delete
   **Bootstrap Test Family**. Memberships, people, and relationships cascade.
3. Remove the `BOOTSTRAP_*` variables from `.env` if you no longer need them.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It may only be used by local Node
  scripts.
- `.env` is git-ignored. Never commit this key.
- The bootstrap accounts are real Auth users. Do not leave them enabled on a
  public production project.
- The app itself never receives the service_role key; it only uses the anon
  key plus the signed-in user's JWT.
