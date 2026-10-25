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
const HORIZONTAL_GAP = 60;
const VERTICAL_LEVEL_GAP = 190;

export function computeTreeLayout(
  people: FamilyPerson[],
  relationships: Relationship[],
  collapsedPersonIds: Set<string> = new Set()
): TreeLayoutResult {
  if (people.length === 0) {
    return {
      nodes: [],
      edges: [],
      bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600, width: 800, height: 600 },
      generationLevels: [],
    };
  }

  const peopleMap = new Map<string, FamilyPerson>(people.map(p => [p.id, p]));
  const parentToChildren = new Map<string, string[]>();
  const childToParents = new Map<string, string[]>();
  const spousesMap = new Map<string, string[]>();

  relationships.forEach(rel => {
    if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationship_type)) {
      const c = parentToChildren.get(rel.source_person_id) || [];
      c.push(rel.target_person_id);
      parentToChildren.set(rel.source_person_id, c);

      const p = childToParents.get(rel.target_person_id) || [];
      p.push(rel.source_person_id);
      childToParents.set(rel.target_person_id, p);
    } else if (['spouse', 'partner'].includes(rel.relationship_type)) {
      const s1 = spousesMap.get(rel.source_person_id) || [];
      s1.push(rel.target_person_id);
      spousesMap.set(rel.source_person_id, s1);

      const s2 = spousesMap.get(rel.target_person_id) || [];
      s2.push(rel.source_person_id);
      spousesMap.set(rel.target_person_id, s2);
    }
  });

  // Group by generation level (1, 2, 3, 4, ...)
  const generationGroups = new Map<number, FamilyPerson[]>();
  people.forEach(person => {
    const gen = person.generation_level || 1;
    const group = generationGroups.get(gen) || [];
    group.push(person);
    generationGroups.set(gen, group);
  });

  const sortedLevels = Array.from(generationGroups.keys()).sort((a, b) => a - b);
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Determine starting Y coordinates
  const levelLabels: { [key: number]: string } = {
    1: 'Generation I · Great-Grandparents',
    2: 'Generation II · Grandparents & Extended',
    3: 'Generation III · Family & Siblings',
    4: 'Generation IV · Children',
    5: 'Generation V · Descendants',
  };

  const generationLevels: { level: number; label: string; y: number }[] = [];

  // Layout each generation level horizontally
  let currentY = 100;
  sortedLevels.forEach(lvl => {
    generationLevels.push({
      level: lvl,
      label: levelLabels[lvl] || `Generation ${lvl}`,
      y: currentY - 40,
    });

    const members = generationGroups.get(lvl)!;

    // Sort members logically: group spouses together, or sort by birth date
    const orderedMembers: FamilyPerson[] = [];
    const placed = new Set<string>();

    members.forEach(m => {
      if (placed.has(m.id)) return;
      orderedMembers.push(m);
      placed.add(m.id);

      // Check if spouse is in the same generation
      const sps = spousesMap.get(m.id) || [];
      sps.forEach(spId => {
        const spouseObj = members.find(other => other.id === spId);
        if (spouseObj && !placed.has(spouseObj.id)) {
          orderedMembers.push(spouseObj);
          placed.add(spouseObj.id);
        }
      });
    });

    const totalWidth = orderedMembers.length * (CARD_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;
    // Center generation row around X = 700
    const startX = Math.max(80, 700 - totalWidth / 2);

    orderedMembers.forEach((person, idx) => {
      const x = startX + idx * (CARD_WIDTH + HORIZONTAL_GAP);
      nodePositions.set(person.id, { x, y: currentY });
    });

    currentY += VERTICAL_LEVEL_GAP;
  });

  // Build coordinate nodes
  const nodes: TreeCoordinateNode[] = people.map(p => {
    const pos = nodePositions.get(p.id) || { x: 100, y: 100 };
    const parentList = (childToParents.get(p.id) || [])
      .map(id => peopleMap.get(id))
      .filter((m): m is FamilyPerson => Boolean(m));
    const spouseList = (spousesMap.get(p.id) || [])
      .map(id => peopleMap.get(id))
      .filter((m): m is FamilyPerson => Boolean(m));
    const childList = (parentToChildren.get(p.id) || [])
      .map(id => peopleMap.get(id))
      .filter((m): m is FamilyPerson => Boolean(m));

    return {
      person: p,
      x: pos.x,
      y: pos.y,
      parents: parentList,
      spouses: spouseList,
      children: childList,
      collapsed: collapsedPersonIds.has(p.id),
    };
  });

  // Calculate edges for rendering
  const edges: TreeEdge[] = [];
  const processedSpousePairs = new Set<string>();

  relationships.forEach(rel => {
    const sourcePos = nodePositions.get(rel.source_person_id);
    const targetPos = nodePositions.get(rel.target_person_id);

    if (!sourcePos || !targetPos) return;

    if (['spouse', 'partner'].includes(rel.relationship_type)) {
      const pairKey = [rel.source_person_id, rel.target_person_id].sort().join('-');
      if (processedSpousePairs.has(pairKey)) return;
      processedSpousePairs.add(pairKey);

      // Determine left and right card
      const leftPos = sourcePos.x < targetPos.x ? sourcePos : targetPos;
      const rightPos = sourcePos.x < targetPos.x ? targetPos : sourcePos;

      edges.push({
        id: rel.id,
        sourceId: rel.source_person_id,
        targetId: rel.target_person_id,
        sourceX: leftPos.x + CARD_WIDTH,
        sourceY: leftPos.y + CARD_HEIGHT / 2,
        targetX: rightPos.x,
        targetY: rightPos.y + CARD_HEIGHT / 2,
        type: rel.relationship_type,
        status: rel.relationship_status,
        label: 'Spouse',
      });
    } else {
      // Parent -> Child
      // Check if source branch is collapsed
      if (collapsedPersonIds.has(rel.source_person_id)) return;

      edges.push({
        id: rel.id,
        sourceId: rel.source_person_id,
        targetId: rel.target_person_id,
        sourceX: sourcePos.x + CARD_WIDTH / 2,
        sourceY: sourcePos.y + CARD_HEIGHT,
        targetX: targetPos.x + CARD_WIDTH / 2,
        targetY: targetPos.y,
        type: rel.relationship_type,
        status: rel.relationship_status,
        label: rel.relationship_type === 'adoptive_parent' 
          ? 'Adoptive' 
          : rel.relationship_type === 'step_parent' 
          ? 'Step' 
          : undefined,
      });
    }
  });

  // Compute bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach(n => {
    if (n.x < minX) minX = n.x;
    if (n.x + CARD_WIDTH > maxX) maxX = n.x + CARD_WIDTH;
    if (n.y < minY) minY = n.y;
    if (n.y + CARD_HEIGHT > maxY) maxY = n.y + CARD_HEIGHT;
  });

  if (minX === Infinity) {
    minX = 0; maxX = 800; minY = 0; maxY = 600;
  }

  // Add margin
  minX = Math.max(0, minX - 100);
  maxX += 100;
  minY = Math.max(0, minY - 80);
  maxY += 120;

  return {
    nodes,
    edges,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
    generationLevels,
  };
}
