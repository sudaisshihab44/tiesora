# Interactive Family Tree & Generations

Status: implemented 2026-11-18.

## Generation calculation

Generation numbers are recalculated from parent/child relationships in
`src/utils/generations.ts`. Stored `generation_level` values are used as the
starting point for disconnected people, then parent links push children below
their parents. This keeps the UI correct even if imported levels drift.

The tree selector labels generations relative to the currently selected root:

- `Root generation` — the selected person's own generation
- `Parents`, `Grandparents`, `Great-grandparents`, …
- `Children`, `Grandchildren`, `Great-grandchildren`, …

Clicking a member makes them the root for generation labels and highlights
their ancestors and descendants. The **All Generations** option returns to the
complete tree.

## Selector and navigation

`GenerationBar` sits above the tree and provides:

- All Generations
- Every generation with its relative label and member count
- Previous / next generation buttons
- An **All** reset when a generation is focused
- Current root person and visible/total counts

For families over 250 people, the tree opens focused on the root generation so
cards stay readable. The full tree remains one click away.

## Tree interactions

- Zoom in/out, wheel zoom, pinch zoom, fit-to-screen, reset zoom
- Drag to pan on desktop and mobile
- Click a card to open the profile drawer
- Expand/collapse a branch; collapsing hides all descendant cards and their
  connecting lines
- Search by name; selecting a result switches to that person's generation
- Selected person's ancestors and descendants are highlighted
- Parent, spouse, adoptive, and step relationships are drawn from the database
- Invalid/self relationships and duplicate edges are ignored
- Generation filtering uses effective calculated levels, not hardcoded values

## Profile photos

Admins can upload a profile photo from the device in the Add/Edit Member
dialog. The image is stored in the private `family-photos` bucket and rendered
through signed URLs (`FamilyImage`). Deleting a person also removes their stored
profile photo on a best-effort basis.

Viewers can open and view profiles but cannot add, edit, delete, upload, or
change relationships.

## Large-tree behavior

- The full 675-member tree renders without overlap and without horizontal page
  overflow.
- Selected generations are vertically and horizontally pannable at a readable
  minimum zoom (0.6); All Generations fits the whole canvas (minimum 0.35).
- Cards are laid out by relationship generation, never alphabetical or age
  order.

## Verification

- 43 cards in Generation 1, 2 in Generation 2, 11 in Generation 3 — no overlaps
- Collapsing Darvesh's branch removes his descendants from the visible count
- Search for a Generation 7 member switches the selector to Generation 7
- All Generations shows 675 cards with no console errors
- Profile photo upload, signed-URL display, and deletion cleanup verified
- Mobile 390px: generation bar, canvas, and bottom navigation fit without page
  overflow
