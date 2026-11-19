import { FamilyPerson, Relationship, TreeCoordinateNode } from '../types';

export interface TreeEdge {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  type: Relationship['relationship_type'];
  status: Relationship['relationship_status'];
  label?: string;
  sourceId: string;
  targetId: string;
}

export interface TreeLayoutResult {
  nodes: TreeCoordinateNode[];
  edges: TreeEdge[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  generationLevels: { level: number; label: string; y: number }[];
}

const CARD_WIDTH = 240;
const CARD_HEIGHT = 110;
const SPOUSE_GAP = 30;
const SIBLING_GAP = 60;
const ROOT_GAP = 140;
const VERTICAL_GAP = 200;
const BASE_Y = 100;

const PARENT_TYPES = ['parent', 'adoptive_parent', 'step_parent'];
const SPOUSE_TYPES = ['spouse', 'partner'];

interface FamilyUnit {
  id: string;
  adults: FamilyPerson[];
  level: number;
}

const byLevelThenName = (a: FamilyPerson, b: FamilyPerson) =>
  (a.generation_level || 1) - (b.generation_level || 1) ||
  (a.birth_date || '9999').localeCompare(b.birth_date || '9999') ||
  a.display_name.localeCompare(b.display_name);

/**
 * Builds a top-to-bottom family-unit hierarchy:
 * - spouses are placed side by side;
 * - their children are centered under the couple;
 * - each root branch is laid out beside the next;
 * - disconnected people keep their own generation row.
 *
 * Layout is derived from parent/child and spouse relationships only.
 */
export function computeTreeLayout(
  people: FamilyPerson[],
  relationships: Relationship[],
  collapsedPersonIds: Set<string> = new Set(),
  generationLabels: Record<number, string> = {},
): TreeLayoutResult {
  if (people.length === 0) {
    return {
      nodes: [],
      edges: [],
      bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600, width: 800, height: 600 },
      generationLevels: [],
    };
  }

  const peopleMap = new Map(people.map((person) => [person.id, person]));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  const addTo = (map: Map<string, string[]>, key: string, value: string) => {
    const values = map.get(key) || [];
    if (!values.includes(value)) values.push(value);
    map.set(key, values);
  };

  for (const relationship of relationships) {
    const { source_person_id: source, target_person_id: target, relationship_type: type } =
      relationship;
    if (source === target || !peopleMap.has(source) || !peopleMap.has(target)) continue;

    if (PARENT_TYPES.includes(type)) {
      addTo(childrenOf, source, target);
      addTo(parentsOf, target, source);
    } else if (SPOUSE_TYPES.includes(type)) {
      addTo(spousesOf, source, target);
      addTo(spousesOf, target, source);
    }
  }

  // ── Build family units (a person plus their primary spouse) ──────────────
  const invalidSpousePair = (a: string, b: string): boolean => {
    if (a === b) return true;
    const personA = peopleMap.get(a);
    const personB = peopleMap.get(b);
    if (
      personA &&
      personB &&
      Math.abs((personA.generation_level || 1) - (personB.generation_level || 1)) > 1
    ) {
      return true;
    }
    if ((parentsOf.get(a) || []).includes(b)) return true;
    if ((parentsOf.get(b) || []).includes(a)) return true;

    // A parent of one spouse is not themselves a spouse of the other spouse.
    // This catches imported in-law pairs such as father-in-law ↔ son-in-law.
    const aChildren = childrenOf.get(a) || [];
    const bSpouses = spousesOf.get(b) || [];
    if (aChildren.some((child) => bSpouses.includes(child))) return true;

    const bChildren = childrenOf.get(b) || [];
    const aSpouses = spousesOf.get(a) || [];
    if (bChildren.some((child) => aSpouses.includes(child))) return true;

    return false;
  };

  const unitByPerson = new Map<string, FamilyUnit>();
  const units: FamilyUnit[] = [];

  for (const person of [...people].sort(byLevelThenName)) {
    if (unitByPerson.has(person.id)) continue;

    const adults = [person];
    const personLevel = person.generation_level || 1;
    const personChildren = new Set(childrenOf.get(person.id) || []);
    const spouseCandidates = (spousesOf.get(person.id) || [])
      .map((spouseId) => peopleMap.get(spouseId))
      .filter(
        (spouse): spouse is FamilyPerson =>
          Boolean(spouse) &&
          !unitByPerson.has(spouse!.id) &&
          !invalidSpousePair(person.id, spouse!.id) &&
          Math.abs((spouse!.generation_level || 1) - personLevel) <= 1,
      )
      .map((spouse) => {
        const sharedChildren = (childrenOf.get(spouse.id) || []).filter((child) =>
          personChildren.has(child),
        ).length;
        return {
          spouse,
          score:
            sharedChildren * 10 +
            (spouse.generation_level === person.generation_level ? 2 : 0) -
            Math.abs((spouse.generation_level || 1) - personLevel),
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          byLevelThenName(a.spouse, b.spouse),
      );

    if (spouseCandidates.length > 0) {
      adults.push(spouseCandidates[0].spouse);
    }

    const unit: FamilyUnit = {
      id: adults.map((adult) => adult.id).sort().join('|'),
      adults: adults.sort(byLevelThenName),
      level: Math.max(...adults.map((adult) => adult.generation_level || 1)),
    };
    adults.forEach((adult) => unitByPerson.set(adult.id, unit));
    units.push(unit);
  }

  // ── Attach each unit to one parent unit ─────────────────────────────────
  const unitParent = new Map<string, FamilyUnit>();
  for (const unit of units) {
    const candidates: FamilyUnit[] = [];
    for (const adult of unit.adults) {
      for (const parentId of parentsOf.get(adult.id) || []) {
        const parentUnit = unitByPerson.get(parentId);
        if (parentUnit && parentUnit.id !== unit.id) candidates.push(parentUnit);
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.level - a.level);
      unitParent.set(unit.id, candidates[0]);
    }
  }

  const childUnits = new Map<string, FamilyUnit[]>();
  for (const unit of units) {
    const parent = unitParent.get(unit.id);
    if (!parent) continue;
    const values = childUnits.get(parent.id) || [];
    values.push(unit);
    childUnits.set(parent.id, values);
  }
  for (const values of childUnits.values()) {
    values.sort((a, b) => byLevelThenName(a.adults[0], b.adults[0]));
  }

  const levelOf = (unit: FamilyUnit) => unit.level;
  const minLevel = Math.min(...people.map((person) => person.generation_level || 1));
  const yForLevel = (level: number) => BASE_Y + (level - minLevel) * VERTICAL_GAP;
  const adultWidth = (unit: FamilyUnit) =>
    unit.adults.length * CARD_WIDTH + (unit.adults.length - 1) * SPOUSE_GAP;

  // ── Measure each unit's subtree ─────────────────────────────────────────
  const widthMemo = new Map<string, number>();
  const measuring = new Set<string>();

  const subtreeWidth = (unit: FamilyUnit): number => {
    const cached = widthMemo.get(unit.id);
    if (cached !== undefined) return cached;
    if (measuring.has(unit.id)) return adultWidth(unit);

    measuring.add(unit.id);
    const children = childUnits.get(unit.id) || [];
    const childrenWidth =
      children.length === 0
        ? 0
        : children.reduce((total, child, index) => {
            return total + subtreeWidth(child) + (index > 0 ? SIBLING_GAP : 0);
          }, 0);
    measuring.delete(unit.id);

    const width = Math.max(adultWidth(unit), childrenWidth);
    widthMemo.set(unit.id, width);
    return width;
  };

  // ── Place units ─────────────────────────────────────────────────────────
  const positions = new Map<string, { x: number; y: number }>();
  const placedUnits = new Set<string>();
  const displayLevels = new Map<string, number>();

  const placeUnit = (unit: FamilyUnit, leftX: number, minLevel = 0): void => {
    if (placedUnits.has(unit.id)) return;
    placedUnits.add(unit.id);

    const displayLevel = Math.max(unit.level, minLevel);
    displayLevels.set(unit.id, displayLevel);

    const width = subtreeWidth(unit);
    const center = leftX + width / 2;
    const unitWidth = adultWidth(unit);
    let adultX = center - unitWidth / 2;
    const y = yForLevel(displayLevel);

    for (const adult of unit.adults) {
      positions.set(adult.id, { x: adultX, y });
      adultX += CARD_WIDTH + SPOUSE_GAP;
    }

    const children = childUnits.get(unit.id) || [];
    if (children.length === 0) return;

    const childrenWidth = children.reduce(
      (total, child, index) =>
        total + subtreeWidth(child) + (index > 0 ? SIBLING_GAP : 0),
      0,
    );
    let childX = leftX + (width - childrenWidth) / 2;
    for (const child of children) {
      placeUnit(child, childX, displayLevel + 1);
      childX += subtreeWidth(child) + SIBLING_GAP;
    }
  };

  const rootUnits = units
    .filter((unit) => !unitParent.has(unit.id))
    .sort((a, b) => byLevelThenName(a.adults[0], b.adults[0]));

  let cursorX = 0;
  for (const root of rootUnits) {
    placeUnit(root, cursorX, root.level);
    cursorX += subtreeWidth(root) + ROOT_GAP;
  }

  // Cycles or unlinked parent units still get a home.
  for (const unit of units) {
    if (placedUnits.has(unit.id)) continue;
    placeUnit(unit, cursorX, unit.level);
    cursorX += subtreeWidth(unit) + ROOT_GAP;
  }

  // Fallback for any person that could not be placed (defensive).
  const unplaced = people.filter((person) => !positions.has(person.id));
  if (unplaced.length > 0) {
    const maxY = Math.max(
      BASE_Y,
      ...[...positions.values()].map((position) => position.y),
    );
    unplaced.forEach((person, index) => {
      positions.set(person.id, {
        x: index * (CARD_WIDTH + SPOUSE_GAP),
        y: maxY + VERTICAL_GAP,
      });
    });
  }

  // ── Nodes ───────────────────────────────────────────────────────────────
  const nodes: TreeCoordinateNode[] = people.map((person) => {
    const position = positions.get(person.id) || { x: 0, y: BASE_Y };
    return {
      person,
      x: position.x,
      y: position.y,
      parents: (parentsOf.get(person.id) || [])
        .map((id) => peopleMap.get(id))
        .filter((parent): parent is FamilyPerson => Boolean(parent)),
      spouses: (spousesOf.get(person.id) || [])
        .map((id) => peopleMap.get(id))
        .filter((spouse): spouse is FamilyPerson => Boolean(spouse)),
      children: (childrenOf.get(person.id) || [])
        .map((id) => peopleMap.get(id))
        .filter((child): child is FamilyPerson => Boolean(child)),
      collapsed: collapsedPersonIds.has(person.id),
    };
  });

  // ── Edges ───────────────────────────────────────────────────────────────
  const edges: TreeEdge[] = [];
  const processedSpousePairs = new Set<string>();
  const processedEdges = new Set<string>();

  for (const relationship of relationships) {
    const { source_person_id: source, target_person_id: target, relationship_type: type } =
      relationship;
    if (source === target) continue;

    const isSpouse = SPOUSE_TYPES.includes(type);
    const isParent = PARENT_TYPES.includes(type);
    if (!isSpouse && !isParent) continue;

    const sourcePos = positions.get(source);
    const targetPos = positions.get(target);
    if (!sourcePos || !targetPos) continue;

    if (isSpouse) {
      if (invalidSpousePair(source, target)) continue;

      const pairKey = [source, target].sort().join('|');
      if (processedSpousePairs.has(pairKey)) continue;
      processedSpousePairs.add(pairKey);

      const leftPos = sourcePos.x < targetPos.x ? sourcePos : targetPos;
      const rightPos = sourcePos.x < targetPos.x ? targetPos : sourcePos;
      edges.push({
        id: relationship.id,
        sourceId: source,
        targetId: target,
        sourceX: leftPos.x + CARD_WIDTH,
        sourceY: leftPos.y + CARD_HEIGHT / 2,
        targetX: rightPos.x,
        targetY: rightPos.y + CARD_HEIGHT / 2,
        type,
        status: relationship.relationship_status,
        label: 'Spouse',
      });
      continue;
    }

    if (collapsedPersonIds.has(source)) continue;

    const edgeKey = `${type}:${source}:${target}`;
    if (processedEdges.has(edgeKey)) continue;
    processedEdges.add(edgeKey);

    edges.push({
      id: relationship.id,
      sourceId: source,
      targetId: target,
      sourceX: sourcePos.x + CARD_WIDTH / 2,
      sourceY: sourcePos.y + CARD_HEIGHT,
      targetX: targetPos.x + CARD_WIDTH / 2,
      targetY: targetPos.y,
      type,
      status: relationship.relationship_status,
      label: type === 'adoptive_parent' ? 'Adoptive' : type === 'step_parent' ? 'Step' : undefined,
    });
  }

  // ── Generation bands ────────────────────────────────────────────────────
  const generationY = new Map<number, number>();
  for (const unit of units) {
    const level = displayLevels.get(unit.id);
    if (level === undefined) continue;
    for (const adult of unit.adults) {
      const position = positions.get(adult.id);
      if (!position) continue;
      const current = generationY.get(level);
      if (current === undefined || position.y < current) {
        generationY.set(level, position.y);
      }
    }
  }
  const generationLevels = [...generationY.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, y]) => ({
      level,
      label:
        generationLabels[level] ||
        (level === 1 ? 'Generation I · Earliest ancestors' : `Generation ${level}`),
      y: y - 45,
    }));

  // ── Bounds ──────────────────────────────────────────────────────────────
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + CARD_WIDTH);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + CARD_HEIGHT);
  }
  if (minX === Infinity) {
    minX = 0;
    maxX = 800;
    minY = 0;
    maxY = 600;
  }

  return {
    nodes,
    edges,
    bounds: {
      minX: Math.max(0, minX - 100),
      maxX: maxX + 100,
      minY: Math.max(0, minY - 80),
      maxY: maxY + 120,
      width: maxX - minX + 200,
      height: maxY - minY + 200,
    },
    generationLevels,
  };
}
