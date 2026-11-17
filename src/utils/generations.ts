import type { FamilyPerson, Relationship } from '../types';

const PARENT_TYPES = new Set([
  'parent',
  'adoptive_parent',
  'step_parent',
]);

export interface GenerationOption {
  level: number;
  count: number;
  /** Label relative to the selected root, e.g. "Parents". */
  relativeLabel: string;
  /** Full selector label, e.g. "Generation 4 · Parents (23)". */
  label: string;
}

/**
 * Recalculates generation levels from parent/child relationships, using the
 * stored level only as the starting point for disconnected people. This keeps
 * the UI correct even if imported generation numbers drift.
 */
export function computeEffectiveGenerations(
  people: FamilyPerson[],
  relationships: Relationship[],
): Map<string, number> {
  const levels = new Map<string, number>(
    people.map((person) => [person.id, person.generation_level || 1]),
  );

  const parentLinks = relationships.filter(
    (relationship) =>
      PARENT_TYPES.has(relationship.relationship_type) &&
      relationship.source_person_id !== relationship.target_person_id,
  );

  // Iterate to a stable state. The cap prevents cycles from looping forever.
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const relationship of parentLinks) {
      const parentLevel = levels.get(relationship.source_person_id);
      const childLevel = levels.get(relationship.target_person_id);
      if (parentLevel === undefined || childLevel === undefined) continue;
      if (childLevel <= parentLevel) {
        levels.set(relationship.target_person_id, parentLevel + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return levels;
}

export function relativeGenerationLabel(offset: number): string {
  if (offset === 0) return 'Root generation';
  if (offset < 0) {
    const distance = Math.abs(offset);
    if (distance === 1) return 'Parents';
    if (distance === 2) return 'Grandparents';
    if (distance === 3) return 'Great-grandparents';
    if (distance === 4) return 'Great-great-grandparents';
    return `${distance} generations above`;
  }
  if (offset === 1) return 'Children';
  if (offset === 2) return 'Grandchildren';
  if (offset === 3) return 'Great-grandchildren';
  if (offset === 4) return 'Great-great-grandchildren';
  return `${offset} generations below`;
}

export function buildGenerationOptions(
  people: FamilyPerson[],
  levels: Map<string, number>,
  rootLevel: number,
): GenerationOption[] {
  const counts = new Map<number, number>();
  for (const person of people) {
    const level = levels.get(person.id) ?? person.generation_level ?? 1;
    counts.set(level, (counts.get(level) || 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, count]) => {
      const relativeLabel = relativeGenerationLabel(level - rootLevel);
      return {
        level,
        count,
        relativeLabel,
        label: `Generation ${level} · ${relativeLabel} (${count})`,
      };
    });
}

/**
 * Picks a sensible root: a top-level ancestor with the largest visible
 * descendant branch. A selected person overrides this.
 */
export function pickRootPerson(
  people: FamilyPerson[],
  relationships: Relationship[],
  levels: Map<string, number>,
  selectedPerson?: FamilyPerson,
): FamilyPerson | undefined {
  if (selectedPerson) return selectedPerson;
  if (people.length === 0) return undefined;

  const childIds = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const relationship of relationships) {
    if (!PARENT_TYPES.has(relationship.relationship_type)) continue;
    if (relationship.source_person_id === relationship.target_person_id) continue;
    const children = childIds.get(relationship.source_person_id) || [];
    children.push(relationship.target_person_id);
    childIds.set(relationship.source_person_id, children);
    hasParent.add(relationship.target_person_id);
  }

  const topLevel = Math.min(...people.map((p) => levels.get(p.id) ?? p.generation_level ?? 1));
  const candidates = people.filter(
    (p) =>
      (levels.get(p.id) ?? p.generation_level ?? 1) === topLevel ||
      !hasParent.has(p.id),
  );
  if (candidates.length === 0) return people[0];

  const descendantCount = (id: string): number => {
    const seen = new Set<string>();
    const stack = [...(childIds.get(id) || [])];
    while (stack.length) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(childIds.get(next) || []));
    }
    return seen.size;
  };

  return candidates
    .map((person) => ({
      person,
      descendants: descendantCount(person.id),
      level: levels.get(person.id) ?? person.generation_level ?? 1,
    }))
    .sort(
      (a, b) =>
        b.descendants - a.descendants ||
        a.level - b.level ||
        a.person.display_name.localeCompare(b.person.display_name),
    )[0].person;
}
