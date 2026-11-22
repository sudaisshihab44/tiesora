# Profile Photos

Status: implemented 2026-11-23.

## Upload flow

Admins upload a profile photo while creating or editing a member:

1. Choose a file or drag it onto the photo drop zone.
2. The file is validated (JPG, JPEG, PNG, WEBP; maximum 5 MB).
3. Large images are resized to a maximum of 1280 px and compressed to WebP
   when that produces a smaller file.
4. A preview is shown before saving.
5. On save, the image uploads to Supabase Storage with a live progress bar.
6. The object path is written to `family_people.avatar_path`.

The dialog supports **Change**, **Remove**, and replace. The URL field remains
as a fallback for external images.

## Storage layout and cleanup

```
family-photos/
  {family_id}/
    {member_id}/
      profile-photo-{version}.{jpg|png|webp}
```

The version suffix prevents stale browser/PWA image caches when a photo is
replaced. The previous object is deleted after a successful update. Removing a
photo writes `avatar_path = null` and deletes the object. Deleting a member also
removes their stored photo on a best-effort basis.

## Security

Existing `family-photos` policies are reused:

- **SELECT**: active family members.
- **INSERT / UPDATE / DELETE**: family admins only.

All reads use short-lived signed URLs. Viewers can see authorized photos but
cannot upload, replace, or delete them. Unauthenticated users and authenticated
non-members receive “Object not found” for other families’ objects.

## Display surfaces

`MemberAvatar` and `FamilyImage` are used consistently in:

- Interactive tree cards, directory rows, and mobile member list
- Member profile drawer
- Viewer dashboard member list
- Admin dashboard relationship card
- Relationship Explorer selectors, ancestor chips, and path nodes
- Search results in the tree controls
- Memories and gallery images already use `FamilyImage`

Members without a photo show their initials as the default avatar.

## Verification performed

| Test | Result |
|---|---|
| Admin adds a new photo | Uploaded, path correct, tree displays it |
| Admin replaces photo | New version uploaded, old object deleted |
| Admin removes photo | `avatar_path` null, object deleted |
| Unsupported file | Rejected with clear error |
| Oversized file (6 MB) | Rejected with 5 MB error |
| Drag-and-drop preview | Works on desktop and 390 px mobile |
| Upload progress | Progress UI appears during upload |
| Viewer sees photo | Tree, profile, relationship explorer |
| Viewer attempts upload | Blocked by Storage RLS |
| Photo after logout/login | Persists and displays |
| Non-member access | “Object not found” for other family’s object |
| Member deletion | Photo object cleaned up |
| Production smoke test | Upload, replace, remove, viewer visibility and RLS verified at `https://tiesora-alpha.vercel.app` |
| Photo count after cleanup | 675 people, 510 relationships, no test photos |
