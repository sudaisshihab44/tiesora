# Phase 4 — Collaboration & Invitations

Status: **implemented and verified end to end** (2026-11-13).

## What changed

- `App.tsx` now loads `invitations` alongside the other family data and passes
  them to `UserManagementPage`.
- The **Pending Invitations** tab lists real Supabase invitation rows:
  email, role, expiry countdown, creation date, and actions.
- Invitations whose email already belongs to an active member are hidden, so a
  member who accepted (or was added manually) does not leave a confusing
  duplicate row.
- **New link** regenerates an invitation, revokes the previous token, and shows
  the new link in a copyable banner. If the old token cannot be revoked, the UI
  warns that it remains valid until expiry.
- **Revoke** marks the invitation revoked and refreshes the list.
- The invitation deep link now works in every entry path:
  - signed-out user opens the link → sign-in, then straight to Join Family;
  - new user signs up from the link → straight to Join Family;
  - already signed-in user opens the link → straight to Join Family;
  - a link pasted into an open app (hash-only navigation) is caught by a
    `hashchange` listener.
- After acceptance, the app switches to the joined family instead of whichever
  family happened to be selected before. This matters for users who already
  belong to another family.
- Demo mode still uses invited memberships in localStorage; Supabase mode uses
  the `invitations` table.

## Database fix

`accept_invitation` failed at accept time with:

```
column reference "family_id" is ambiguous
```

The previous proposed fix used `ON CONFLICT (family_memberships.family_id,
family_memberships.user_id)`, which is invalid PostgreSQL syntax. The corrected
migration targets the unique constraint instead:

```sql
ON CONFLICT ON CONSTRAINT family_memberships_family_id_user_id_key
```

Applied migration:
`supabase/migrations/20261031_APPLY_THIS_fix_invitation_ambiguity.sql`.

`validate_invitation` already returned correctly; only the accept path failed.

## Verification performed

1. Admin created an invitation for a new email through User Management.
2. The pending tab showed one invitation with role, expiry, and date.
3. The invitee signed in from the link and landed on Join Family.
4. Acceptance created an **active viewer** membership; the viewer saw the
   675-member family read-only.
5. Admin side then showed 3 active members and 0 pending invitations.
6. Revoking the invitee moved the membership to the suspended/other bucket and
   removed their access.
7. The temporary auth user, profile, membership, and test invitations were
   deleted after verification.

## Remaining follow-ups

- Invitation delivery is still manual (copy link). Automatic email sending
  would need an email provider or Supabase Auth invite templates.
- Invitation history (accepted/revoked/expired) is filtered out of the pending
  tab but not exposed as a separate audit view.
- Expired invitations are not garbage-collected; they are simply ignored.
