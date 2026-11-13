# Authentication, Roles & Invitations

Status: current as of 2026-11-13.

## Roles

Only two roles exist:

- **admin** — add/edit people and relationships, upload memories, manage
  events, invite/revoke members, review change requests, access settings.
- **viewer** — read-only browsing, search, memories, and events. Viewers may
  submit change requests where enabled.

Legacy roles (`owner`, `editor`, `contributor`) normalize to `admin` at the
application boundary and are migrated by the SQL migrations.

The UI never trusts the role selected on the sign-in screen. After
authentication, `getRoleFromDB()` reads the active `family_memberships` row and
the app uses that verified role everywhere.

## Sign-up and sign-in

- Supabase Auth handles email/password, password reset, and session persistence.
- If email confirmation is enabled, sign-up routes to a verification screen
  until the user confirms.
- Password recovery links route to the reset-password screen.
- Signing out clears the Supabase session and returns to the landing page.
- The public demo is separate: signing out inside the demo exits the sandbox
  without ending a real session.

## Invitations

Admins can create invitations from **User Management**:

1. Enter the invitee email and choose admin or viewer.
2. Share the generated link (`/#invite=<token>`). Links expire after 7 days.
3. Pending invitations appear in the **Pending Invitations** tab with role,
   expiry, and creation date. They can be regenerated or revoked.
4. Invitations for people who already have active access are hidden to avoid
   duplicate rows.

The invitee flow:

- Signed-out user opens the link → signs in → lands directly on Join Family.
- New user signs up from the link → lands directly on Join Family.
- Already signed-in user opens the link → lands directly on Join Family.
- Pasting a link into an already-open app is caught by a `hashchange` listener.
- Acceptance switches the app to the joined family, even if the user already
  belongs to another family.

`validate_invitation` checks the token server-side.
`accept_invitation` re-validates atomically, creates/reactivates the membership,
and marks the invitation accepted. The client never chooses the role.

## Database security

- Row Level Security is enabled on family data.
- `create_invitation`, `accept_invitation`, `validate_invitation`,
  `create_family_with_admin`, and the import RPCs are `SECURITY DEFINER` with
  restricted `search_path` and execute grants.
- Only family members can read a family's audit logs; inserts must match
  `auth.uid()`.
- The service-role key is never used in the browser or a `VITE_*` variable.

## Troubleshooting

### “column reference family_id is ambiguous”

Run
`supabase/migrations/20261031_APPLY_THIS_fix_invitation_ambiguity.sql`.
The corrected version uses
`ON CONFLICT ON CONSTRAINT family_memberships_family_id_user_id_key`.
Do not use table-qualified columns inside `ON CONFLICT`; PostgreSQL rejects
that syntax.

### “Invalid, expired, or already-used invitation”

The token was already accepted, revoked, expired, or mistyped. Generate a new
link from User Management.

### Sign-up succeeds but no session is returned

Email confirmation is enabled. Confirm the user in Supabase Dashboard →
Authentication → Users, or disable confirmation for local development.

### “Admin access required”

The signed-in user's active membership is not `admin` for the selected family.
Check `family_memberships` and the family switcher.

### Cannot demote/revoke the last admin

The `ensure_family_has_admin` trigger blocks removing the final administrator.
Promote another admin first.
