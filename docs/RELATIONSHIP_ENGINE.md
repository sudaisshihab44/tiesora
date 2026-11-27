# Relationship Engine

Status: implemented 2026-11-23.

## Audit of the existing system

The Interactive Tree and Relationship Explorer already shared the same Supabase
tables. No duplicate relationship system or second table was created.

| Item | Recorded value |
|---|---|
| Family | Darvesh Mohammed Tiesora Family |
| People | 675 |
| Relationships | 510 |
| `parent` records | 289 |
| `spouse` records | 220 |
| `adoptive_parent` records | 1 |
| Unique spouse pairs | 207 |
| Duplicate spouse pairs | 13 (both directions of the same pair) |
| Spouse links spanning more than one generation | 10 |
| Parent-child / spouse contradictions | 0 |
| Cross-family relationship endpoints | 0 |
| Self links | 0 |
| People with no parent recorded | 434 |
| People with one parent recorded | 192 |
| People with two parents recorded | 49 |
| People with no relationships at all | 113 |
| Recorded birth dates | 0 |

Relationship direction is `source_person_id -> target_person_id`:

- `parent`: source is the parent, target is the child.
- `adoptive_parent`: source is the adoptive parent, target is the child.
- `step_parent`: source is the step-parent, target is the child.
- `spouse` / `partner`: undirected pair.

The writer normalizes a `child` input into a `parent` edge, so the engine reads
one consistent direction.

## Why "No Recorded Connection" appeared

The undirected graph built from all 510 records contains **227 components**.
The largest component has only **86 people**; **589 people are outside it**, and
113 people have no relationships at all. This is a data-completeness problem,
not an ancestor-traversal failure.

For example, the requested Abdul Latheef → Maher pair cannot be calculated
because:

- Abdul Latheef has one recorded parent (Darvesh Mohammed) and children.
- Maher has one recorded parent (Fayaz Ahmed).
- No recorded parent, spouse, or child path connects those two branches.

The engine must not invent the missing link. It now reports **Incomplete Family
Records**, lists the missing parent records, and explains what would make the
relationship calculable.

Connected pairs are no longer returned as "No Recorded Connection". A
5,000-pair sample of connected people produced **zero** false disconnections.

## Engine behavior

`src/utils/relationshipEngine.ts` now:

- Builds one cached family graph per people/relationship array identity.
- Uses BFS for ancestors and shortest recorded paths.
- Separates biological/adoptive ancestry from step and marriage edges.
- Finds the closest common ancestor(s), not just any shared ancestor.
- Calculates direct ancestry dynamically for any number of generations.
- Distinguishes full, half, and ambiguous siblings.
- Produces paternal/maternal aunt and uncle labels when the connecting parent
  is recorded.
- Calculates cousin degree and removal from actual generation distances.
- Supports parent-, child-, and sibling-in-law links.
- Supports step-parent, step-child, and step-sibling relationships.
- Supports multiple spouses without overwriting one another.
- Validates family membership before calculating.
- Returns explicit statuses:
  - `verified`
  - `incomplete`
  - `not_found`
  - `invalid`
- Returns no fabricated path for a disconnected pair.
- Flags spouse links that span multiple generations while still allowing the
  recorded connection to be inspected.

Generation numbers are used only to flag suspicious spouse records. They are
never used as proof that two people are parent and child.

## UI behavior

- Person A and Person B are searchable by partial/full name, branch, or
  generation; suggestions show photos and generation numbers.
- The result card shows the relationship name, direction, status, explanation,
  closest common ancestor, and generation distance.
- The old unconditional "Graph Verified" badge was removed. Graph connectivity
  and relationship certainty are separate.
- Collateral relationships show a two-branch view from the closest common
  ancestor to each selected person.
- The complete clickable step-by-step path is shown only when a real path
  exists.
- **View on Family Tree** focuses a generation spanning the path and highlights
  the path nodes in the Interactive Tree.
- Missing records are listed with an explicit warning that Tiesora does not
  guess.

## Performance

The graph is cached by the identity of the loaded people/relationships arrays,
so the UI does not rebuild it for every calculation.

Synthetic benchmark:

| People | Relationships | First call | 1,000 calls |
|---|---|---|---|
| 1,200 | 1,799 | 7.0 ms | 24.9 ms total (0.025 ms average) |

The real 675-person family graph is smaller and uses the same path.

## Visual examples

A browsable gallery of **39 production screenshots** is available at
[`docs/relationship-examples/index.html`](relationship-examples/index.html).

It covers direct family, siblings, aunts/uncles, nieces/nephews, cousins,
marriage and in-laws, step and adoptive relationships, extended connections,
and incomplete-record cases. Every screenshot matched its expected label and
the capture run reported zero console errors.

## Verification

- Relationship engine tests: **36/36 passing**.
- Focus tree tests: **10/10 passing**.
- Data mapper tests: **30/30 passing**.
- Combined suite: **76/76 passing**.
- Real-data scenarios verified:
  - Father/son
  - Grandfather/grandson
  - Grandmother/granddaughter
  - Full sibling
  - Ambiguous sibling with one parent missing
  - Paternal aunt/uncle
  - Nephew
  - First cousin
  - First cousin once removed
  - Second cousin
  - Parent-in-law
  - Sibling-in-law
  - Child-in-law
  - Multiple spouses
  - Step relationships
  - Disconnected/incomplete records
  - Different-family invalid selection
- Mobile 390 px: no horizontal page overflow; searchable picker stays inside
  the viewport.
- Admin and Viewer both calculate relationships; Viewer has no write controls.
- No database migrations or data changes were required.

Production verification at `https://tiesora-alpha.vercel.app`:

- Default parent result: **Son / Verified Relationship**.
- Grandfather: **Verified Relationship** with common ancestor and path.
- First cousin: **Verified Relationship** with two-branch view.
- Sibling-in-law: **Verified Relationship** with a complete path.
- Abdul Latheef → Maher: **Incomplete Family Records**, no fabricated path.
- **View on Family Tree**: focuses Generation 2 and highlights all 3 path cards.
- Mobile 390 px: no page overflow; both searchable pickers fit.
- Viewer: can calculate Grandfather; no User Management or Add Member controls.
- Browser console: **0 errors**.

## Known data limitations

These are preserved, not auto-fixed:

- 434 people have no recorded parents; 192 have only one.
- 113 people have no relationships at all.
- 13 spouse pairs are stored in both directions.
- 10 spouse links span more than one generation and are marked low confidence.
- No birth dates are recorded, so elder/younger sibling labels can only appear
  when dates are added.
- Four additional families exist with zero people.
