# Data Repair — 2026-11-13

Source: `Darvesh_Mohammed_Tiesora_Family_Connection_Guide.pdf` (61 pages).

## Why

The first import deduplicated people by name. The source restarts generation
labels (A.1, B.1, …) in separate branches and repeats many names, so the import
left 263 people unconnected and had several parent/child generation mismatches.

## What was reconstructed

A layout parser read the PDF text items with coordinates and extracted:

- 993 labelled boxes (`A.1`, `B.2`, …) with names and spouse text
- 851 layout-derived parent edges

Only high-confidence corrections were applied:

- both names matched exactly to one existing person;
- the child had **zero** existing relationships;
- exactly one parent candidate existed;
- the parent’s generation was exactly one below the child’s.

## Applied

| Change | Count |
|---|---|
| Parent–child links added | 146 |
| Direct generation corrections | 6 |
| Iterative generation bumps to clear conflicts | 9 |
| Spouse links added | 0 (not enough unique evidence) |

Result on the real family:

| Metric | Before | After |
|---|---|---|
| People | 675 | 675 |
| Relationships | 365 | 511 |
| People with no relationships | 263 | 113 |
| Parent/child generation conflicts | 9 | 0 |
| Maximum generation | 9 | 10 |

An audit entry was written to `audit_logs`:
`repaired imported tree` and `repaired generation levels`.

The family description was also corrected from “56-page” to “61-page”.

## Backup

The exact applied generation changes and parent links are in
`docs/data/repair-2026-11-13.json`.

## Remaining limitations

- **113 people still have no relationships.** Their pages either contain
  repeated names that cannot be matched uniquely, or the connector lines were
  not represented in the extracted text.
- **Duplicate names across branches were merged by the original import.** The
  repair does not split those records. A fully branch-aware rebuild would be
  required for a perfect reconstruction.
- Spouse links were not bulk-added because duplicate names made many pairings
  ambiguous.
- The parser will misread a page if its layout differs significantly from the
  standard parent-box-over-child-row chart.

For the remaining people, open the chart page listed in the PDF and connect
records one branch at a time. Do not guess ambiguous connectors; leave them
pending instead.
