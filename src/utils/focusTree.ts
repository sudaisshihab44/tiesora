import type { FamilyPerson, Relationship } from '../types';

export interface FocusTreeResult {
  people: FamilyPerson[];
  focusPerson?: FamilyPerson;
  maxAncestorDepth: number;
  maxDescendantDepth: number;
  nextAncestorCount: number;
  nextDescendantCount: number;
  parentCount: number;
  childCount: number;
  spouseCount: number;
  siblingCount: number;
}

interface FocusIndex {
  byId: Map<string, FamilyPerson>;
  parentMap: Map<string, string[]>;
  childMap: Map<string, string[]>;
  spouseMap: Map<string, string[]>;
}

const PARENT_TYPES = new Set(['parent', 'adoptive_parent', 'step_parent']);
const SPOUSE_TYPES = new Set(['spouse', 'partner']);

function addUnique(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key) ?? [];
  if (!list.includes(value)) list.push(value);
  map.set(key, list);
}

function buildFocusIndex(
  people: FamilyPerson[],
  relationships: Relationship[],
): FocusIndex {
  const byId = new Map(people.map((person) => [person.id, person]));
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();
  const spouseMap = new Map<string, string[]>();

  for (const relationship of relationships) {
    const source = byId.get(relationship.source_person_id);
    const target = byId.get(relationship.target_person_id);
    if (!source || !target || source.id === target.id) continue;

    if (PARENT_TYPES.has(relationship.relationship_type)) {
      addUnique(parentMap, target.id, source.id);
      addUnique(childMap, source.id, target.id);
    } else if (SPOUSE_TYPES.has(relationship.relationship_type)) {
      addUnique(spouseMap, source.id, target.id);
      addUnique(spouseMap, target.id, source.id);
    }
  }

  return { byId, parentMap, childMap, spouseMap };
}

function collectDepths(
  startId: string,
  nextMap: Map<string, string[]>,
): Map<string, number> {
  const depths = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    depths.set(current.id, current.depth);
    for (const next of nextMap.get(current.id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, depth: current.depth + 1 });
    }
  }

  return depths;
}

/**
 * Builds the visible subgraph for the Focus view.
 *
 * Default focus scope:
 * - the focused person
 * - their recorded parents
 * - their recorded spouse(s)
 * - their siblings (any shared parent)
 * - their children
 *
 * Additional ancestor/descendant generations are revealed one at a time.
 */
export function computeFocusTree(
  people: FamilyPerson[],
  relationships: Relationship[],
  focusPersonId: string,
  ancestorDepth: number,
  descendantDepth: number,
): FocusTreeResult {
  const index = buildFocusIndex(people, relationships);
  const focusPerson = index.byId.get(focusPersonId);
  if (!focusPerson) {
    return {
      people: [],
      focusPerson: undefined,
      maxAncestorDepth: 0,
      maxDescendantDepth: 0,
      nextAncestorCount: 0,
      nextDescendantCount: 0,
      parentCount: 0,
      childCount: 0,
      spouseCount: 0,
      siblingCount: 0,
    };
  }

  const ancestorDepths = collectDepths(focusPersonId, index.parentMap);
  const descendantDepths = collectDepths(focusPersonId, index.childMap);
  const safeAncestorDepth = Math.max(1, ancestorDepth);
  const safeDescendantDepth = Math.max(1, descendantDepth);

  const visibleIds = new Set<string>([focusPersonId]);

  for (const [id, depth] of ancestorDepths) {
    if (depth > 0 && depth <= safeAncestorDepth) visibleIds.add(id);
  }
  for (const [id, depth] of descendantDepths) {
    if (depth > 0 && depth <= safeDescendantDepth) visibleIds.add(id);
  }

  // Spouses of the focused person.
  const spouseIds = index.spouseMap.get(focusPersonId) ?? [];
  for (const spouseId of spouseIds) {
    visibleIds.add(spouseId);
  }

  // Siblings share at least one recorded parent with the focused person.
  const siblingIds = new Set<string>();
  for (const parentId of index.parentMap.get(focusPersonId) ?? []) {
    for (const siblingId of index.childMap.get(parentId) ?? []) {
      if (siblingId !== focusPersonId) siblingIds.add(siblingId);
    }
  }
  siblingIds.forEach((siblingId) => visibleIds.add(siblingId));

  const maxAncestorDepth = Math.max(0, ...ancestorDepths.values());
  const maxDescendantDepth = Math.max(0, ...descendantDepths.values());
  const nextAncestorDepth = safeAncestorDepth + 1;
  const nextDescendantDepth = safeDescendantDepth + 1;
  const nextAncestorCount = [...ancestorDepths.values()].filter(
    (depth) => depth === nextAncestorDepth,
  ).length;
  const nextDescendantCount = [...descendantDepths.values()].filter(
    (depth) => depth === nextDescendantDepth,
  ).length;

  return {
    people: people.filter((person) => visibleIds.has(person.id)),
    focusPerson,
    maxAncestorDepth,
    maxDescendantDepth,
    nextAncestorCount,
    nextDescendantCount,
    parentCount: (index.parentMap.get(focusPersonId) ?? []).length,
    childCount: (index.childMap.get(focusPersonId) ?? []).length,
    spouseCount: spouseIds.length,
    siblingCount: siblingIds.size,
  };
}
