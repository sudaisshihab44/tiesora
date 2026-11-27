# Interactive Family Tree & Generations

Status: updated 2026-11-27 with the Focus-first view.

## Hierarchical layout

The tree is a family-unit hierarchy, not a flat generation list:

- Spouses are placed side by side.
- Their children are centered beneath the couple.
- Each child couple becomes its own unit and continues the hierarchy.
- Multiple root branches are laid out left to right.
- Disconnected members keep their own generation row.
- Couples that span generations are placed on the younger partner's row so
  parent and child rows cannot collide.
- Invalid spouse links (direct parent/child, in-laws, or a gap of more than one
  generation) are not drawn and do not form a couple unit. One definite
  parent-in-law spouse row was removed from the database; the rest are only
  suppressed visually pending review.

Generation focus keeps the selected generation **plus its direct parents,
children, and spouses**, one hop only. This preserves the connecting lines
without rendering every unrelated generation.

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

For families over 50 people, the tree opens in Focus view. The full Tree view
remains one click away and uses the generation selector; families over 250
people still open the Tree view focused on the root generation.

## Focus view

Families with more than 50 people open in **Focus** view by default.

Focus shows the focused person with:

- recorded parents above,
- recorded spouse(s) beside them,
- siblings in the same generation,
- recorded children below.

The focus person is centered and selected. Search changes the focused person
without opening the profile drawer; clicking a card still opens the profile.
**Center** returns the focused person to the middle of the viewport.

Ancestors and descendants expand **one generation per click**:

- `Show grandparents`
- `Show great-grandparents`, and deeper
- `Show grandchildren`
- `Show great-grandchildren`, and deeper

The Focus bar reports the recorded counts for parents, spouses, siblings and
children. It explicitly says **No recorded ancestors/descendants** when the
records do not exist. Expanding a branch fits the newly visible branch while
preserving a readable minimum zoom. **Fit** is available for an explicit
full-branch fit. **Full tree** switches to Tree view with **All Generations**
selected; the Tree tab keeps the focused generation for a more manageable
context view.

### Home Person and remembered focus

- **Set home** stores the current focus person as the user's Home Person for
  that family.
- **Home** returns directly to that person from anywhere in Focus view.
- The current Home Person shows a **HOME** badge in the Focus bar.
- The last focused person is remembered across reloads.
- Resolution order on reopening: selected person → remembered last focus →
  Home Person → founder/root.
- Preferences are per **user + family** and stored only in browser
  `localStorage`. They are UI preferences, not Supabase records.
- Viewer-role users can set a Home Person locally; this does not modify family
  data or bypass RLS.
- Invalid or deleted stored person IDs are cleared automatically.
- On desktop/mobile viewport resize, Focus re-centers the focus person at a
  responsive readable zoom instead of leaving the canvas off-screen.

## View modes

The tree exposes three views:

- **Focus** — immediate family plus one-generation branch expansion.
- **Tree** — hierarchical family-unit canvas with the generation selector.
- **List** — searchable directory of the selected generation or all people.

The former Ancestors and Descendants view tabs remain removed; selecting a
person still highlights their lineage as part of the tree.

## Tree interactions

- Zoom in/out, wheel zoom, pinch zoom, fit-to-screen, reset zoom
- Drag to pan on desktop and mobile
- Click a card to open the profile drawer
- Expand/collapse a branch; collapsing hides all descendant cards and their
  connecting lines
- Search by name; selecting a result focuses/centers that person. In Tree view
  it switches to the person's generation.
- In Focus view, search changes the focus person without opening the profile
  drawer; clicking a person card still opens the drawer.
- Selected person's ancestors and descendants are highlighted
- **View on Family Tree** from the Relationship Explorer focuses a generation
  spanning the calculated path and marks every path node on the tree
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
- Focus view defaults to a small immediate-family subgraph; the full graph is
  only rendered when the user chooses Tree view.
- Automatic focus expansion keeps a readable minimum zoom (0.55); explicit Fit
  can go to 0.35 to show the complete expanded branch.
- Selected generations are vertically and horizontally pannable at a readable
  minimum zoom (0.6); All Generations fits the whole canvas (minimum 0.35).
- Cards are laid out by relationship generation, never alphabetical or age
  order.

## Verification

- 43 cards in Generation 1, 2 in Generation 2, 11 in Generation 3 — no overlaps
- Generation 2 focus shows 12 cards: the selected members, their parents,
  children, and direct spouses, with parents above children
- Collapsing Darvesh's branch removes his descendants from the visible count
- Search for a Generation 7 member switches the selector to Generation 7
- All Generations shows 675 cards with **zero overlaps** and no console errors
- Profile photo upload, signed-URL display, and deletion cleanup verified
- Focus view opens the 675-person family on 3 immediate-family cards, no
  horizontal page overflow, at 85% zoom
- `Show grandchildren` reveals 12 cards and auto-fits to 55%; explicit **Fit**
  shows all 12 inside the viewport at 35%
- Search for Badar focuses 6 cards without opening the profile drawer; ancestor
  expansion adds 2 grandparents for 8 cards
- Mobile 390px: Focus bar wraps, canvas is pannable, and page width remains
  390px
- Viewer can use Focus; no Add Member or User Management controls
- Focus tree tests: 10/10 passing
- Tree preference tests: 5/5 passing
- Home/last-focus persistence verified across full page reloads:
  - Set Badar as Home, focus Maher, reload → Maher remains focused
  - Click Home → Badar; reload → Badar is the default focus
  - Home and last-focus keys are isolated per user and family
- Production verification:
  - Badar set as Home, Maher focused, reload → Maher restored
  - Home → Badar, reload → Badar restored with HOME badge
  - Viewer has separate preferences and no Admin controls
  - Mobile 390px re-centers the focused card fully inside the viewport at 65%
  - Zero console errors
- Production smoke test at `https://tiesora-alpha.vercel.app`:
  - Focus opens 3 cards at 85% with the focus person selected
  - `Show grandchildren` reaches 12 cards at 55%; Fit shows all 12 at 35%
  - Search for Badar focuses 6 cards without opening the drawer; ancestor
    expansion reaches 8
  - Full tree shows 675 cards at 35% with the generation selector
  - Relationship Explorer → View on Family Tree switches to Tree view,
    Generation 2, with all 3 path cards highlighted
  - Viewer can use Focus; no Admin write controls
  - Zero console errors
- Mobile 390px: generation bar, canvas, and bottom navigation fit without page
  overflow
