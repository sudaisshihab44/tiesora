import {
  CalculatedRelationship,
  FamilyPerson,
  Relationship,
  RelationshipBranch,
  RelationshipConnectionStatus,
  RelationshipGenerationDistance,
} from '../types';

type ParentType = 'parent' | 'adoptive_parent' | 'step_parent';

interface ParentLink {
  parentId: string;
  type: ParentType;
  status: Relationship['relationship_status'];
}

interface ChildLink {
  childId: string;
  type: ParentType;
  status: Relationship['relationship_status'];
}

interface FamilyGraph {
  peopleById: Map<string, FamilyPerson>;
  parentMap: Map<string, ParentLink[]>;
  childMap: Map<string, ChildLink[]>;
  spouseMap: Map<string, string[]>;
  adjacency: Map<string, Set<string>>;
  ignoredSpouseLinks: Map<string, string[]>;
}

interface AncestorEntry {
  distance: number;
  path: string[];
}

const PARENT_TYPES: readonly ParentType[] = [
  'parent',
  'adoptive_parent',
  'step_parent',
];

const BLOOD_PARENT_TYPES = new Set<Relationship['relationship_type']>([
  'parent',
  'adoptive_parent',
]);

const SPOUSE_TYPES = new Set<Relationship['relationship_type']>([
  'spouse',
  'partner',
]);

const graphCache = new WeakMap<
  readonly FamilyPerson[],
  WeakMap<readonly Relationship[], FamilyGraph>
>();

function isParentType(type: Relationship['relationship_type']): type is ParentType {
  return (PARENT_TYPES as readonly string[]).includes(type);
}

function isSpouseType(type: Relationship['relationship_type']): boolean {
  return SPOUSE_TYPES.has(type);
}

function addUnique<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key) ?? [];
  if (!list.includes(value)) list.push(value);
  map.set(key, list);
}

function link(adjacency: Map<string, Set<string>>, a: string, b: string) {
  if (!adjacency.has(a) || !adjacency.has(b) || a === b) return;
  adjacency.get(a)!.add(b);
  adjacency.get(b)!.add(a);
}

function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

/**
 * Builds the family graph once per people/relationship array identity. The app
 * replaces those arrays after every mutation, so a replaced array naturally
 * invalidates the cache without any manual invalidation step.
 */
function getFamilyGraph(
  allPeople: FamilyPerson[],
  allRelationships: Relationship[],
): FamilyGraph {
  let byRelationships = graphCache.get(allPeople);
  if (!byRelationships) {
    byRelationships = new WeakMap();
    graphCache.set(allPeople, byRelationships);
  }
  const cached = byRelationships.get(allRelationships);
  if (cached) return cached;

  const graph = buildFamilyGraph(allPeople, allRelationships);
  byRelationships.set(allRelationships, graph);
  return graph;
}

function buildFamilyGraph(
  allPeople: FamilyPerson[],
  allRelationships: Relationship[],
): FamilyGraph {
  const peopleById = new Map(allPeople.map((person) => [person.id, person]));
  const familyId = allPeople[0]?.family_id;
  const parentMap = new Map<string, ParentLink[]>();
  const childMap = new Map<string, ChildLink[]>();
  const spouseMap = new Map<string, string[]>();
  const adjacency = new Map<string, Set<string>>();
  const ignoredSpouseLinks = new Map<string, string[]>();
  allPeople.forEach((person) => adjacency.set(person.id, new Set()));

  const noteIgnoredSpouse = (
    source: FamilyPerson,
    target: FamilyPerson,
    message: string,
  ) => {
    for (const personId of [source.id, target.id]) {
      const notes = ignoredSpouseLinks.get(personId) ?? [];
      if (!notes.includes(message)) notes.push(message);
      ignoredSpouseLinks.set(personId, notes);
    }
  };

  const spouseCandidates: Array<{
    sourceId: string;
    targetId: string;
    status: Relationship['relationship_status'];
  }> = [];
  const spouseCandidateNeighbors = new Map<string, Set<string>>();

  for (const relationship of allRelationships) {
    if (familyId && relationship.family_id !== familyId) continue;
    const source = peopleById.get(relationship.source_person_id);
    const target = peopleById.get(relationship.target_person_id);
    if (!source || !target || source.id === target.id) continue;
    if (source.family_id !== target.family_id) continue;
    if (familyId && source.family_id !== familyId) continue;

    if (isParentType(relationship.relationship_type)) {
      const parentLink: ParentLink = {
        parentId: source.id,
        type: relationship.relationship_type,
        status: relationship.relationship_status,
      };
      const childLink: ChildLink = {
        childId: target.id,
        type: relationship.relationship_type,
        status: relationship.relationship_status,
      };
      const parents = parentMap.get(target.id) ?? [];
      if (!parents.some((p) => p.parentId === source.id && p.type === parentLink.type)) {
        parents.push(parentLink);
      }
      parentMap.set(target.id, parents);
      const children = childMap.get(source.id) ?? [];
      if (!children.some((c) => c.childId === target.id && c.type === childLink.type)) {
        children.push(childLink);
      }
      childMap.set(source.id, children);
      link(adjacency, source.id, target.id);
      continue;
    }

    if (isSpouseType(relationship.relationship_type)) {
      spouseCandidates.push({
        sourceId: source.id,
        targetId: target.id,
        status: relationship.relationship_status,
      });
      const sourceNeighbors = spouseCandidateNeighbors.get(source.id) ?? new Set<string>();
      sourceNeighbors.add(target.id);
      spouseCandidateNeighbors.set(source.id, sourceNeighbors);
      const targetNeighbors = spouseCandidateNeighbors.get(target.id) ?? new Set<string>();
      targetNeighbors.add(source.id);
      spouseCandidateNeighbors.set(target.id, targetNeighbors);
      continue;
    }

    // Guardian and any future relationship type still contributes a path edge.
    link(adjacency, source.id, target.id);
  }

  const candidateKeys = new Set(
    spouseCandidates.map((candidate) => edgeKey(candidate.sourceId, candidate.targetId)),
  );

  for (const candidate of spouseCandidates) {
    const source = peopleById.get(candidate.sourceId);
    const target = peopleById.get(candidate.targetId);
    if (!source || !target) continue;

    if (findParentLinkInMaps(parentMap, source.id, target.id)) {
      noteIgnoredSpouse(
        source,
        target,
        `A recorded spouse link between ${source.display_name} and ${target.display_name} conflicts with a parent-child record and was ignored.`,
      );
      continue;
    }
    if (findParentLinkInMaps(parentMap, target.id, source.id)) {
      noteIgnoredSpouse(
        source,
        target,
        `A recorded spouse link between ${source.display_name} and ${target.display_name} conflicts with a parent-child record and was ignored.`,
      );
      continue;
    }

    // A parent of one spouse is not the spouse of the other spouse. This
    // filters imported in-law pairs such as father-in-law ↔ son-in-law.
    const sourceChildren = childMap.get(source.id) ?? [];
    if (
      sourceChildren.some((child) =>
        spouseCandidateNeighbors.get(child.childId)?.has(target.id),
      )
    ) {
      noteIgnoredSpouse(
        source,
        target,
        `A recorded spouse link between ${source.display_name} and ${target.display_name} conflicts with an in-law parent relationship and was ignored.`,
      );
      continue;
    }
    const targetChildren = childMap.get(target.id) ?? [];
    if (
      targetChildren.some((child) =>
        spouseCandidateNeighbors.get(child.childId)?.has(source.id),
      )
    ) {
      noteIgnoredSpouse(
        source,
        target,
        `A recorded spouse link between ${source.display_name} and ${target.display_name} conflicts with an in-law parent relationship and was ignored.`,
      );
      continue;
    }

    if (!candidateKeys.has(edgeKey(source.id, target.id))) continue;

    addUnique(spouseMap, source.id, target.id);
    addUnique(spouseMap, target.id, source.id);
    link(adjacency, source.id, target.id);
  }

  return {
    peopleById,
    parentMap,
    childMap,
    spouseMap,
    adjacency,
    ignoredSpouseLinks,
  };
}

function findParentLinkInMaps(
  parentMap: Map<string, ParentLink[]>,
  childId: string,
  parentId: string,
): ParentLink | undefined {
  const links = parentMap.get(childId) ?? [];
  return (
    links.find((link) => link.parentId === parentId && link.type === 'parent') ??
    links.find(
      (link) => link.parentId === parentId && link.type === 'adoptive_parent',
    ) ??
    links.find((link) => link.parentId === parentId)
  );
}

function findParentLink(
  graph: FamilyGraph,
  childId: string,
  parentId: string,
): ParentLink | undefined {
  return findParentLinkInMaps(graph.parentMap, childId, parentId);
}

function bloodParents(graph: FamilyGraph, personId: string): ParentLink[] {
  return (graph.parentMap.get(personId) ?? []).filter((parent) =>
    BLOOD_PARENT_TYPES.has(parent.type),
  );
}

function bloodChildren(graph: FamilyGraph, personId: string): ChildLink[] {
  return (graph.childMap.get(personId) ?? []).filter((child) =>
    BLOOD_PARENT_TYPES.has(child.type),
  );
}

function parentLabel(person: FamilyPerson, type: Relationship['relationship_type']): string {
  if (type === 'adoptive_parent') {
    return person.gender === 'female'
      ? 'Adoptive Mother'
      : person.gender === 'male'
        ? 'Adoptive Father'
        : 'Adoptive Parent';
  }
  if (type === 'step_parent') {
    return person.gender === 'female'
      ? 'Step-Mother'
      : person.gender === 'male'
        ? 'Step-Father'
        : 'Step-Parent';
  }
  return person.gender === 'female'
    ? 'Mother'
    : person.gender === 'male'
      ? 'Father'
      : 'Parent';
}

function childLabel(person: FamilyPerson, type: Relationship['relationship_type']): string {
  if (type === 'adoptive_parent') {
    return person.gender === 'female'
      ? 'Adoptive Daughter'
      : person.gender === 'male'
        ? 'Adoptive Son'
        : 'Adoptive Child';
  }
  if (type === 'step_parent') {
    return person.gender === 'female'
      ? 'Step-Daughter'
      : person.gender === 'male'
        ? 'Step-Son'
        : 'Step-Child';
  }
  return person.gender === 'female'
    ? 'Daughter'
    : person.gender === 'male'
      ? 'Son'
      : 'Child';
}

function spouseLabel(person: FamilyPerson): string {
  return person.gender === 'female'
    ? 'Wife'
    : person.gender === 'male'
      ? 'Husband'
      : 'Spouse / Partner';
}

function siblingLabel(person: FamilyPerson, half: boolean): string {
  if (half) {
    return person.gender === 'female'
      ? 'Half-Sister'
      : person.gender === 'male'
        ? 'Half-Brother'
        : 'Half-Sibling';
  }
  return person.gender === 'female'
    ? 'Sister'
    : person.gender === 'male'
      ? 'Brother'
      : 'Sibling';
}

function ancestorLabel(depth: number, person: FamilyPerson): string {
  const base =
    person.gender === 'female'
      ? 'Grandmother'
      : person.gender === 'male'
        ? 'Grandfather'
        : 'Grandparent';
  if (depth <= 2) return base;
  if (depth === 3) return `Great-${base}`;
  return `${depth - 2}x Great-${base}`;
}

function descendantLabel(depth: number, person: FamilyPerson): string {
  const base =
    person.gender === 'female'
      ? 'Granddaughter'
      : person.gender === 'male'
        ? 'Grandson'
        : 'Grandchild';
  if (depth <= 2) return base;
  if (depth === 3) return `Great-${base}`;
  return `${depth - 2}x Great-${base}`;
}

function collateralAncestorLabel(depth: number, person: FamilyPerson): string {
  const base =
    person.gender === 'female' ? 'Aunt' : person.gender === 'male' ? 'Uncle' : 'Aunt/Uncle';
  if (depth <= 2) return base;
  if (depth === 3) return `Great-${base}`;
  return `${depth - 2}x Great-${base}`;
}

function collateralDescendantLabel(depth: number, person: FamilyPerson): string {
  const base =
    person.gender === 'female'
      ? 'Niece'
      : person.gender === 'male'
        ? 'Nephew'
        : 'Niece/Nephew';
  if (depth <= 2) return base;
  if (depth === 3) return `Grand${base.toLowerCase()}`;
  const greats = depth - 3;
  const prefix = greats === 1 ? 'Great-' : `${greats}x Great-`;
  return `${prefix}Grand${base.toLowerCase()}`;
}

function getOrdinal(n: number): string {
  const words = [
    'Zero',
    'First',
    'Second',
    'Third',
    'Fourth',
    'Fifth',
    'Sixth',
    'Seventh',
    'Eighth',
    'Ninth',
    'Tenth',
  ];
  if (n >= 1 && n < words.length) return words[n];
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = n % 100;
  return n + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}

function getRemovalWord(removal: number): string {
  if (removal === 1) return 'Once Removed';
  if (removal === 2) return 'Twice Removed';
  if (removal === 3) return 'Three Times Removed';
  return `${removal} Times Removed`;
}

function collectAncestors(
  startId: string,
  graph: FamilyGraph,
): Map<string, AncestorEntry> {
  const ancestors = new Map<string, AncestorEntry>();
  const queue: Array<{ id: string; distance: number; path: string[] }> = [
    { id: startId, distance: 0, path: [startId] },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    ancestors.set(current.id, {
      distance: current.distance,
      path: current.path,
    });

    for (const parent of bloodParents(graph, current.id)) {
      if (visited.has(parent.parentId)) continue;
      visited.add(parent.parentId);
      queue.push({
        id: parent.parentId,
        distance: current.distance + 1,
        path: [...current.path, parent.parentId],
      });
    }
  }

  return ancestors;
}

function edgeLabel(from: FamilyPerson, to: FamilyPerson, graph: FamilyGraph): string {
  const toIsParent = findParentLink(graph, from.id, to.id);
  if (toIsParent) return parentLabel(to, toIsParent.type);

  const fromIsParent = findParentLink(graph, to.id, from.id);
  if (fromIsParent) return childLabel(to, fromIsParent.type);

  if ((graph.spouseMap.get(from.id) ?? []).includes(to.id)) {
    return spouseLabel(to);
  }

  return 'Related to';
}

function edgeLabelsForPath(nodes: string[], graph: FamilyGraph): string[] {
  const labels: string[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const from = graph.peopleById.get(nodes[i]);
    const to = graph.peopleById.get(nodes[i + 1]);
    if (from && to) labels.push(edgeLabel(from, to, graph));
  }
  return labels;
}

function branchForPath(nodes: string[], graph: FamilyGraph): RelationshipBranch | undefined {
  if (nodes.length < 2) return undefined;
  return {
    nodes: nodes.map((id) => graph.peopleById.get(id)!).filter(Boolean),
    edgeDescriptions: edgeLabelsForPath(nodes, graph),
  };
}

function buildPathThroughCommonAncestor(
  sourcePath: string[],
  targetPath: string[],
): string[] {
  return [...sourcePath, ...targetPath.slice().reverse().slice(1)];
}

function generationDistanceFor(
  sourceDistance: number,
  targetDistance: number,
): RelationshipGenerationDistance {
  return {
    sourceToCommonAncestor: sourceDistance,
    targetToCommonAncestor: targetDistance,
    generationOffset: Math.abs(sourceDistance - targetDistance),
    totalSteps: sourceDistance + targetDistance,
  };
}

function relationshipDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ageRelationFor(
  source: FamilyPerson,
  target: FamilyPerson,
): { ageRelation?: 'elder' | 'younger'; years?: number } {
  const sourceDate = relationshipDate(source.birth_date);
  const targetDate = relationshipDate(target.birth_date);
  if (!sourceDate || !targetDate) return {};
  if (sourceDate.getTime() === targetDate.getTime()) return {};
  const older = sourceDate.getTime() < targetDate.getTime() ? 'source' : 'target';
  return {
    ageRelation: older === 'target' ? 'elder' : 'younger',
    years: Math.abs(sourceDate.getFullYear() - targetDate.getFullYear()),
  };
}

function verifiedStatus(
  statuses: Array<Relationship['relationship_status']>,
): RelationshipConnectionStatus {
  return statuses.every((status) => status === 'verified') ? 'verified' : 'incomplete';
}

function confidenceForStatus(
  status: RelationshipConnectionStatus,
): CalculatedRelationship['confidence'] {
  if (status === 'verified') return 'verified';
  if (status === 'incomplete') return 'inferred';
  return 'ambiguous';
}

function pathConfidence(
  pathIds: string[],
  graph: FamilyGraph,
): { status: RelationshipConnectionStatus; notes: string[] } {
  let status: RelationshipConnectionStatus = 'verified';
  const notes: string[] = [];

  for (let index = 0; index < pathIds.length - 1; index += 1) {
    const from = graph.peopleById.get(pathIds[index]);
    const to = graph.peopleById.get(pathIds[index + 1]);
    if (!from || !to) continue;

    if ((graph.spouseMap.get(from.id) ?? []).includes(to.id)) {
      const gap = Math.abs(
        (from.generation_level || 1) - (to.generation_level || 1),
      );
      if (gap > 1) {
        status = 'incomplete';
        const note = `The connection relies on a spouse link between ${from.display_name} and ${to.display_name} that spans ${gap} generations; verify this record.`;
        if (!notes.includes(note)) notes.push(note);
      }
    }

    const parentLink =
      findParentLink(graph, to.id, from.id) ??
      findParentLink(graph, from.id, to.id);
    if (parentLink && parentLink.status !== 'verified') {
      status = 'incomplete';
      const note = `The parent link between ${from.display_name} and ${to.display_name} is marked ${parentLink.status} and needs review.`;
      if (!notes.includes(note)) notes.push(note);
    }
  }

  return { status, notes };
}

function missingRecordsForPerson(
  person: FamilyPerson,
  graph: FamilyGraph,
): string[] {
  const parents = bloodParents(graph, person.id);
  const relationshipCount = graph.adjacency.get(person.id)?.size ?? 0;
  const ignored = graph.ignoredSpouseLinks.get(person.id) ?? [];
  const notes: string[] = [];

  if (relationshipCount === 0) {
    notes.push(
      `${person.display_name} has no verified parents, spouses, children, or other family links.`,
    );
  } else if (parents.length === 0 && (person.generation_level || 1) > 1) {
    notes.push(`No parents are recorded for ${person.display_name}.`);
  } else if (parents.length === 1) {
    notes.push(
      `Only one parent is recorded for ${person.display_name}; the other parent is missing.`,
    );
  }

  notes.push(...ignored);
  return notes;
}

function invalidResult(
  source: FamilyPerson,
  target: FamilyPerson,
  message: string,
): CalculatedRelationship {
  return {
    sourcePerson: source,
    targetPerson: target,
    primaryLabel: 'Invalid Selection',
    pathDescription: message,
    sharedAncestors: [],
    pathNodes: [],
    pathEdgeDescriptions: [],
    connectionStatus: 'invalid',
    confidence: 'ambiguous',
    relationshipCategory: 'invalid',
  };
}

export function calculateRelationship(
  sourcePerson: FamilyPerson,
  targetPerson: FamilyPerson,
  allPeople: FamilyPerson[],
  allRelationships: Relationship[],
): CalculatedRelationship {
  if (sourcePerson.family_id !== targetPerson.family_id) {
    return invalidResult(
      sourcePerson,
      targetPerson,
      'These two people belong to different families. Select two members of the same family to calculate a relationship.',
    );
  }

  if (sourcePerson.id === targetPerson.id) {
    return {
      sourcePerson,
      targetPerson,
      primaryLabel: 'Self',
      pathDescription: 'This is the same individual in the family tree.',
      sharedAncestors: [],
      pathNodes: [sourcePerson],
      pathEdgeDescriptions: [],
      connectionStatus: 'verified',
      confidence: 'verified',
      relationshipCategory: 'self',
    };
  }

  const graph = getFamilyGraph(allPeople, allRelationships);
  if (!graph.peopleById.has(sourcePerson.id) || !graph.peopleById.has(targetPerson.id)) {
    return invalidResult(
      sourcePerson,
      targetPerson,
      'One or both selected people are not part of the loaded family records.',
    );
  }

  const source = graph.peopleById.get(sourcePerson.id)!;
  const target = graph.peopleById.get(targetPerson.id)!;

  // 1. Direct spouse or partner.
  if ((graph.spouseMap.get(source.id) ?? []).includes(target.id)) {
    const generationGap = Math.abs(
      (source.generation_level || 1) - (target.generation_level || 1),
    );
    const notes =
      generationGap > 1
        ? [
            `The recorded spouse link between ${source.display_name} and ${target.display_name} spans ${generationGap} generations; verify this record.`,
          ]
        : [];
    return {
      sourcePerson: source,
      targetPerson: target,
      primaryLabel: spouseLabel(target),
      pathDescription: `${target.display_name} is the recorded spouse or partner of ${source.display_name}.`,
      sharedAncestors: [],
      pathNodes: [source, target],
      pathEdgeDescriptions: [spouseLabel(target)],
      relationshipDetail:
        generationGap > 1
          ? 'Direct marriage record, but the generation gap needs review.'
          : 'Direct marriage or partnership record.',
      missingRecords: notes.length > 0 ? notes : undefined,
      connectionStatus: generationGap > 1 ? 'incomplete' : 'verified',
      confidence: generationGap > 1 ? 'inferred' : 'verified',
      relationshipCategory: 'spouse',
    };
  }

  // 2. Direct parent or child, including adoptive and step records.
  const targetAsParent = findParentLink(graph, source.id, target.id);
  if (targetAsParent) {
    const label = parentLabel(target, targetAsParent.type);
    const status = targetAsParent.status === 'verified' ? 'verified' : 'incomplete';
    return {
      sourcePerson: source,
      targetPerson: target,
      primaryLabel: label,
      pathDescription: `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name}.`,
      sharedAncestors: [],
      pathNodes: [source, target],
      pathEdgeDescriptions: [label],
      relationshipDetail:
        targetAsParent.type === 'step_parent'
          ? 'Step-parent record.'
          : targetAsParent.type === 'adoptive_parent'
            ? 'Adoptive-parent record.'
            : 'Biological parent record.',
      connectionStatus: status,
      confidence: confidenceForStatus(status),
      relationshipCategory:
        targetAsParent.type === 'step_parent'
          ? 'step'
          : targetAsParent.type === 'adoptive_parent'
            ? 'adoptive'
            : 'parent',
    };
  }

  const sourceAsParent = findParentLink(graph, target.id, source.id);
  if (sourceAsParent) {
    const label = childLabel(target, sourceAsParent.type);
    const status = sourceAsParent.status === 'verified' ? 'verified' : 'incomplete';
    return {
      sourcePerson: source,
      targetPerson: target,
      primaryLabel: label,
      pathDescription: `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name}.`,
      sharedAncestors: [],
      pathNodes: [source, target],
      pathEdgeDescriptions: [label],
      relationshipDetail:
        sourceAsParent.type === 'step_parent'
          ? 'Step-child record.'
          : sourceAsParent.type === 'adoptive_parent'
            ? 'Adoptive-child record.'
            : 'Biological child record.',
      connectionStatus: status,
      confidence: confidenceForStatus(status),
      relationshipCategory:
        sourceAsParent.type === 'step_parent'
          ? 'step'
          : sourceAsParent.type === 'adoptive_parent'
            ? 'adoptive'
            : 'child',
    };
  }

  // 3. Blood relationship through recorded parent links.
  const sourceAncestors = collectAncestors(source.id, graph);
  const targetAncestors = collectAncestors(target.id, graph);
  const commonAncestorIds = [...sourceAncestors.keys()].filter((id) =>
    targetAncestors.has(id),
  );

  if (commonAncestorIds.length > 0) {
    const closestDistance = Math.min(
      ...commonAncestorIds.map(
        (id) =>
          (sourceAncestors.get(id)?.distance ?? 0) +
          (targetAncestors.get(id)?.distance ?? 0),
      ),
    );
    const closestIds = commonAncestorIds
      .filter(
        (id) =>
          (sourceAncestors.get(id)?.distance ?? 0) +
            (targetAncestors.get(id)?.distance ?? 0) ===
          closestDistance,
      )
      .sort((a, b) =>
        (graph.peopleById.get(a)?.display_name ?? '').localeCompare(
          graph.peopleById.get(b)?.display_name ?? '',
        ),
      );

    const lcaId = closestIds[0];
    const sourceEntry = sourceAncestors.get(lcaId)!;
    const targetEntry = targetAncestors.get(lcaId)!;
    const dA = sourceEntry.distance;
    const dB = targetEntry.distance;
    const sharedAncestorPeople = closestIds
      .map((id) => graph.peopleById.get(id))
      .filter((person): person is FamilyPerson => Boolean(person));
    const lcaPerson = graph.peopleById.get(lcaId)!;
    const pathNodes = buildPathThroughCommonAncestor(
      sourceEntry.path,
      targetEntry.path,
    )
      .map((id) => graph.peopleById.get(id))
      .filter((person): person is FamilyPerson => Boolean(person));
    const sourceBranch = branchForPath(sourceEntry.path, graph);
    const targetBranch = branchForPath(targetEntry.path, graph);
    const generationDistance = generationDistanceFor(dA, dB);
    const sharedNames = sharedAncestorPeople.map((person) => person.display_name);

    let primaryLabel = 'Relative';
    let category: CalculatedRelationship['relationshipCategory'] = 'distant';
    let pathDescription = '';
    let relationshipDetail: string | undefined;
    let ageRelation: 'elder' | 'younger' | undefined;
    let missingRecords: string[] = [];
    let connectionStatus: RelationshipConnectionStatus = 'verified';

    if (dA === 0 && dB > 0) {
      const label = descendantLabel(dB, target);
      primaryLabel = label;
      category =
        dB === 2
          ? 'grandchild'
          : dB === 3
            ? 'great_grandchild'
            : 'great_grandchild';
      pathDescription = `${target.display_name} is a direct descendant (${label}) of ${source.display_name}, ${dB} parent-child step${dB === 1 ? '' : 's'} below.`;
      relationshipDetail = `${dB} generation${dB === 1 ? '' : 's'} below ${source.display_name}.`;
    } else if (dB === 0 && dA > 0) {
      const label = ancestorLabel(dA, target);
      primaryLabel = label;
      category =
        dA === 2
          ? 'grandparent'
          : dA === 3
            ? 'great_grandparent'
            : 'great_grandparent';
      pathDescription = `${target.display_name} is an ancestor (${label}) of ${source.display_name}, ${dA} parent-child step${dA === 1 ? '' : 's'} above.`;
      relationshipDetail = `${dA} generation${dA === 1 ? '' : 's'} above ${source.display_name}.`;
    } else if (dA === 1 && dB === 1) {
      const sourceParentIds = bloodParents(graph, source.id).map((parent) => parent.parentId);
      const targetParentIds = bloodParents(graph, target.id).map((parent) => parent.parentId);
      const commonParentIds = sourceParentIds.filter((id) => targetParentIds.includes(id));
      const sourceHasBothParents = sourceParentIds.length >= 2;
      const targetHasBothParents = targetParentIds.length >= 2;

      if (commonParentIds.length >= 2) {
        primaryLabel = siblingLabel(target, false);
        category = 'sibling';
        pathDescription = `${source.display_name} and ${target.display_name} share both recorded parents${sharedNames.length ? ` (${sharedNames.join(' and ')})` : ''}.`;
        relationshipDetail = 'Full sibling: both parents are recorded.';
      } else if (commonParentIds.length === 1 && sourceHasBothParents && targetHasBothParents) {
        primaryLabel = siblingLabel(target, true);
        category = 'half_sibling';
        pathDescription = `${source.display_name} and ${target.display_name} share one recorded parent${sharedNames.length ? ` (${sharedNames[0]})` : ''}; their other recorded parents are different.`;
        relationshipDetail = 'Half-sibling: both people have two recorded parents and only one is shared.';
      } else {
        primaryLabel = siblingLabel(target, false);
        category = 'sibling';
        pathDescription = `${source.display_name} and ${target.display_name} share one recorded parent${sharedNames.length ? ` (${sharedNames[0]})` : ''}. The other parent records are incomplete, so a full or half sibling cannot be confirmed.`;
        relationshipDetail = 'One shared parent is recorded; the second parent is missing for at least one person.';
        connectionStatus = 'incomplete';
        missingRecords = [
          ...missingRecordsForPerson(source, graph),
          ...missingRecordsForPerson(target, graph),
        ];
      }

      const age = ageRelationFor(source, target);
      ageRelation = age.ageRelation;
      if (age.ageRelation) {
        const ageWord = age.ageRelation === 'elder' ? 'elder' : 'younger';
        relationshipDetail = `${ageWord[0].toUpperCase()}${ageWord.slice(1)} sibling${age.years ? ` · about ${age.years} year${age.years === 1 ? '' : 's'} apart` : ''}. ${relationshipDetail}`;
      }
    } else if (dA === 2 && dB === 1) {
      const sourceParentId = sourceEntry.path[1];
      const sourceParent = sourceParentId
        ? graph.peopleById.get(sourceParentId)
        : undefined;
      const side =
        sourceParent?.gender === 'male'
          ? 'Paternal'
          : sourceParent?.gender === 'female'
            ? 'Maternal'
            : '';
      const base = target.gender === 'female' ? 'Aunt' : target.gender === 'male' ? 'Uncle' : 'Aunt/Uncle';
      primaryLabel = side ? `${side} ${base}` : base;
      category = 'aunt_uncle';
      pathDescription = `${target.display_name} is the ${side ? `${side.toLowerCase()} ` : ''}${base.toLowerCase()} of ${source.display_name} because ${target.display_name} is a sibling of ${source.display_name}'s ${sourceParent ? parentLabel(sourceParent, 'parent').toLowerCase() : 'parent'}${sourceParent ? ` (${sourceParent.display_name})` : ''}.`;
      relationshipDetail = `Shares ${sharedNames.length ? sharedNames.join(' and ') : 'a common parent'} with ${source.display_name}'s parent.`;
    } else if (dA === 1 && dB === 2) {
      const targetParentId = targetEntry.path[1];
      const targetParent = targetParentId
        ? graph.peopleById.get(targetParentId)
        : undefined;
      const base = target.gender === 'female' ? 'Niece' : target.gender === 'male' ? 'Nephew' : 'Niece/Nephew';
      primaryLabel = base;
      category = 'niece_nephew';
      pathDescription = `${target.display_name} is the ${base.toLowerCase()} of ${source.display_name} because ${target.display_name} is the child of ${source.display_name}'s sibling${targetParent ? ` (${targetParent.display_name})` : ''}.`;
      relationshipDetail = `The connecting sibling is ${targetParent?.display_name ?? 'recorded in the family graph'}.`;
    } else if (dA >= 3 && dB === 1) {
      primaryLabel = collateralAncestorLabel(dA, target);
      category = 'aunt_uncle';
      pathDescription = `${target.display_name} is the ${primaryLabel.toLowerCase()} of ${source.display_name}: ${target.display_name} is the sibling of an ancestor ${dA - 1} generation${dA - 1 === 1 ? '' : 's'} above ${source.display_name}.`;
      relationshipDetail = `Collateral ancestor ${dA - 1} generation${dA - 1 === 1 ? '' : 's'} above ${source.display_name}.`;
    } else if (dA === 1 && dB >= 3) {
      primaryLabel = collateralDescendantLabel(dB, target);
      category = 'niece_nephew';
      pathDescription = `${target.display_name} is the ${primaryLabel.toLowerCase()} of ${source.display_name}: ${target.display_name} is a descendant of ${source.display_name}'s sibling.`;
      relationshipDetail = `Collateral descendant ${dB - 1} generation${dB - 1 === 1 ? '' : 's'} below ${source.display_name}.`;
    } else {
      const cousinDegree = Math.min(dA, dB) - 1;
      const removal = Math.abs(dA - dB);
      const ordinal = getOrdinal(cousinDegree);
      if (removal === 0) {
        primaryLabel = `${ordinal} Cousin`;
        category =
          cousinDegree === 1
            ? 'first_cousin'
            : cousinDegree === 2
              ? 'second_cousin'
              : 'cousin';
        pathDescription = `${source.display_name} and ${target.display_name} are ${primaryLabel}s, sharing ${sharedNames.length ? sharedNames.join(' and ') : 'a common ancestor'} as their closest common ancestor${sharedNames.length === 1 ? '' : 's'}.`;
      } else {
        primaryLabel = `${ordinal} Cousin ${getRemovalWord(removal)}`;
        category =
          cousinDegree === 1 && removal === 1
            ? 'first_cousin_once_removed'
            : 'cousin';
        pathDescription = `${source.display_name} and ${target.display_name} are ${primaryLabel}, connected through ${sharedNames.length ? sharedNames.join(' and ') : 'a common ancestor'} with a ${removal}-generation offset.`;
      }
      const sourceParent = sourceEntry.path[1]
        ? graph.peopleById.get(sourceEntry.path[1])
        : undefined;
      const targetParent = targetEntry.path[1]
        ? graph.peopleById.get(targetEntry.path[1])
        : undefined;
      relationshipDetail =
        sourceParent && targetParent
          ? `The connecting branches run through ${sourceParent.display_name} and ${targetParent.display_name}.`
          : `Closest common ancestor${sharedNames.length === 1 ? '' : 's'}: ${sharedNames.join(' and ')}.`;
    }

    return {
      sourcePerson: source,
      targetPerson: target,
      primaryLabel,
      pathDescription,
      sharedAncestors: sharedAncestorPeople,
      commonAncestor: lcaPerson,
      pathNodes,
      pathEdgeDescriptions: edgeLabelsForPath(
        pathNodes.map((person) => person.id),
        graph,
      ),
      sourceBranch,
      targetBranch,
      generationDistance,
      relationshipDetail,
      ageRelation,
      missingRecords: missingRecords.length > 0 ? missingRecords : undefined,
      connectionStatus:
        connectionStatus === 'incomplete'
          ? 'incomplete'
          : verifiedStatus(
              pathNodes
                .slice(0, -1)
                .flatMap((person, index) => {
                  const next = pathNodes[index + 1];
                  const link = findParentLink(graph, next.id, person.id) ??
                    findParentLink(graph, person.id, next.id);
                  return link ? [link.status] : [];
                }),
            ),
      confidence:
        connectionStatus === 'incomplete'
          ? 'inferred'
          : confidenceForStatus('verified'),
      relationshipCategory: category,
    };
  }

  // 4. Marriage-based and step relationships.
  const inLaw = findInLawOrStepRelationship(source, target, graph);
  if (inLaw) return inLaw;

  // 5. Any other valid recorded path.
  const generalPath = findShortestGraphPath(
    source.id,
    target.id,
    graph,
  );
  if (generalPath && generalPath.length > 1) {
    const pathNodes = generalPath
      .map((id) => graph.peopleById.get(id))
      .filter((person): person is FamilyPerson => Boolean(person));
    const intermediates = pathNodes.slice(1, -1).map((person) => person.display_name);
    const quality = pathConfidence(generalPath, graph);
    return {
      sourcePerson: source,
      targetPerson: target,
      primaryLabel: 'Extended Family Connection',
      pathDescription: `${source.display_name} and ${target.display_name} are connected through ${intermediates.length} intermediate family member${intermediates.length === 1 ? '' : 's'}${intermediates.length ? ` (${intermediates.join(' → ')})` : ''}. The exact genealogical label cannot be determined from the recorded relationship types.`,
      sharedAncestors: [],
      pathNodes,
      pathEdgeDescriptions: edgeLabelsForPath(generalPath, graph),
      relationshipDetail: 'A recorded path exists, but the relationship label is not fully specified by the data.',
      connectionStatus: 'incomplete',
      confidence: 'inferred',
      relationshipCategory: 'distant',
      missingRecords: [
        'Some relationship types or intermediate relatives are missing, so only an extended connection can be shown.',
        ...quality.notes,
      ],
    };
  }

  // 6. Disconnected / incomplete records.
  const sourceMissing = missingRecordsForPerson(source, graph);
  const targetMissing = missingRecordsForPerson(target, graph);
  const missingRecords = [...sourceMissing, ...targetMissing];
  const incomplete = missingRecords.length > 0;
  return {
    sourcePerson: source,
    targetPerson: target,
    primaryLabel: 'No Verified Relationship Found',
    pathDescription: incomplete
      ? `Relationship cannot be determined from the available family records. ${missingRecords.join(' ')} Adding the missing parents or connecting relatives may establish this relationship.`
      : `No recorded parent, child, spouse, or in-law path connects ${source.display_name} and ${target.display_name}.`,
    sharedAncestors: [],
    pathNodes: [],
    pathEdgeDescriptions: [],
    missingRecords,
    relationshipDetail: incomplete
      ? 'The family graph is disconnected around one or both people.'
      : 'No recorded family path exists between these two people.',
    connectionStatus: incomplete ? 'incomplete' : 'not_found',
    confidence: 'ambiguous',
    relationshipCategory: 'disconnected',
  };
}

function findInLawOrStepRelationship(
  source: FamilyPerson,
  target: FamilyPerson,
  graph: FamilyGraph,
): CalculatedRelationship | null {
  const sourceSpouses = graph.spouseMap.get(source.id) ?? [];
  const sourceParents = bloodParents(graph, source.id);

  const build = (
    pathIds: string[],
    label: string,
    description: string,
    category: CalculatedRelationship['relationshipCategory'],
    detail: string,
    status: RelationshipConnectionStatus = 'verified',
  ): CalculatedRelationship | null => {
    const pathNodes = pathIds
      .map((id) => graph.peopleById.get(id))
      .filter((person): person is FamilyPerson => Boolean(person));
    if (pathNodes.length !== pathIds.length) return null;
    const pathQuality = pathConfidence(pathIds, graph);
    const finalStatus =
      status === 'incomplete' || pathQuality.status === 'incomplete'
        ? 'incomplete'
        : status;
    return {
      sourcePerson: source,
      targetPerson: target,
      primaryLabel: label,
      pathDescription: description,
      sharedAncestors: [],
      pathNodes,
      pathEdgeDescriptions: edgeLabelsForPath(pathIds, graph),
      relationshipDetail: detail,
      missingRecords:
        pathQuality.notes.length > 0 ? pathQuality.notes : undefined,
      connectionStatus: finalStatus,
      confidence: confidenceForStatus(finalStatus),
      relationshipCategory: category,
    };
  };

  // Parent-in-law: target is a parent of source's spouse.
  for (const spouseId of sourceSpouses) {
    const parent = findParentLink(graph, spouseId, target.id);
    if (parent) {
      const label =
        target.gender === 'female'
          ? 'Mother-in-Law'
          : target.gender === 'male'
            ? 'Father-in-Law'
            : 'Parent-in-Law';
      return build(
        [source.id, spouseId, target.id],
        label,
        `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is the parent of ${source.display_name}'s spouse (${graph.peopleById.get(spouseId)?.display_name}).`,
        'in_law',
        'Parent of a recorded spouse.',
        parent.status === 'verified' ? 'verified' : 'incomplete',
      );
    }
  }

  // Child-in-law: target is the spouse of source's child.
  for (const child of bloodChildren(graph, source.id)) {
    if ((graph.spouseMap.get(child.childId) ?? []).includes(target.id)) {
      const label =
        target.gender === 'female'
          ? 'Daughter-in-Law'
          : target.gender === 'male'
            ? 'Son-in-Law'
            : 'Child-in-Law';
      return build(
        [source.id, child.childId, target.id],
        label,
        `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is married to ${source.display_name}'s child (${graph.peopleById.get(child.childId)?.display_name}).`,
        'in_law',
        'Spouse of a recorded child.',
      );
    }
  }

  // Sibling-in-law: target is the sibling of source's spouse.
  for (const spouseId of sourceSpouses) {
    const spouse = graph.peopleById.get(spouseId);
    if (!spouse) continue;
    for (const spouseParent of bloodParents(graph, spouseId)) {
      for (const sibling of bloodChildren(graph, spouseParent.parentId)) {
        if (sibling.childId === spouseId || sibling.childId !== target.id) continue;
        const label =
          target.gender === 'female'
            ? 'Sister-in-Law'
            : target.gender === 'male'
              ? 'Brother-in-Law'
              : 'Sibling-in-Law';
        return build(
          [source.id, spouseId, spouseParent.parentId, target.id],
          label,
          `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is the sibling of ${source.display_name}'s spouse (${spouse.display_name}).`,
          'in_law',
          'Sibling of a recorded spouse.',
        );
      }
    }
  }

  // Sibling-in-law: target is married to source's sibling.
  for (const parent of bloodParents(graph, source.id)) {
    for (const sibling of bloodChildren(graph, parent.parentId)) {
      if (sibling.childId === source.id) continue;
      if (!(graph.spouseMap.get(sibling.childId) ?? []).includes(target.id)) continue;
      const siblingPerson = graph.peopleById.get(sibling.childId);
      const label =
        target.gender === 'female'
          ? 'Sister-in-Law'
          : target.gender === 'male'
            ? 'Brother-in-Law'
            : 'Sibling-in-Law';
      return build(
        [source.id, parent.parentId, sibling.childId, target.id],
        label,
        `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is married to ${source.display_name}'s sibling (${siblingPerson?.display_name}).`,
        'in_law',
        'Spouse of a recorded sibling.',
      );
    }
  }

  // Step-parent: target is married to source's parent but is not source's parent.
  for (const parent of sourceParents) {
    if (!(graph.spouseMap.get(parent.parentId) ?? []).includes(target.id)) continue;
    if (findParentLink(graph, source.id, target.id)) continue;
    const label =
      target.gender === 'female'
        ? 'Step-Mother'
        : target.gender === 'male'
          ? 'Step-Father'
          : 'Step-Parent';
    return build(
      [source.id, parent.parentId, target.id],
      label,
      `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is married to ${source.display_name}'s parent (${graph.peopleById.get(parent.parentId)?.display_name}).`,
      'step',
      'Spouse of a recorded parent.',
    );
  }

  // Step-child: target is the child of source's spouse but is not source's child.
  for (const spouseId of sourceSpouses) {
    if (!findParentLink(graph, target.id, spouseId)) continue;
    if (findParentLink(graph, target.id, source.id)) continue;
    const label =
      target.gender === 'female'
        ? 'Step-Daughter'
        : target.gender === 'male'
          ? 'Step-Son'
          : 'Step-Child';
    return build(
      [source.id, spouseId, target.id],
      label,
      `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is the child of ${source.display_name}'s spouse (${graph.peopleById.get(spouseId)?.display_name}).`,
      'step',
      'Child of a recorded spouse.',
    );
  }

  // Step-sibling: target's parent is married to source's parent.
  for (const parent of sourceParents) {
    for (const stepParentId of graph.spouseMap.get(parent.parentId) ?? []) {
      if (stepParentId === target.id) continue;
      if (!findParentLink(graph, target.id, stepParentId)) continue;
      if (findParentLink(graph, target.id, parent.parentId)) continue;
      const label =
        target.gender === 'female'
          ? 'Step-Sister'
          : target.gender === 'male'
            ? 'Step-Brother'
            : 'Step-Sibling';
      return build(
        [source.id, parent.parentId, stepParentId, target.id],
        label,
        `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name}'s parent (${graph.peopleById.get(stepParentId)?.display_name}) is married to ${source.display_name}'s parent (${graph.peopleById.get(parent.parentId)?.display_name}).`,
        'step',
        'Child of a parent’s spouse.',
      );
    }
  }

  // Aunt/uncle-in-law: target is the sibling of source's spouse's parent.
  for (const spouseId of sourceSpouses) {
    for (const spouseParent of bloodParents(graph, spouseId)) {
      for (const grandParent of bloodParents(graph, spouseParent.parentId)) {
        for (const auntUncle of bloodChildren(graph, grandParent.parentId)) {
          if (auntUncle.childId === spouseParent.parentId) continue;
          if (auntUncle.childId !== target.id) continue;
          const label =
            target.gender === 'female'
              ? 'Aunt-in-Law'
              : target.gender === 'male'
                ? 'Uncle-in-Law'
                : 'Aunt/Uncle-in-Law';
          return build(
            [source.id, spouseId, spouseParent.parentId, grandParent.parentId, target.id],
            label,
            `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is the sibling of ${source.display_name}'s spouse's parent (${graph.peopleById.get(spouseParent.parentId)?.display_name}).`,
            'in_law',
            'Sibling of a spouse’s parent.',
          );
        }
      }
    }
  }

  // Aunt/uncle-in-law: target is married to source's aunt or uncle.
  for (const parent of sourceParents) {
    for (const grandParent of bloodParents(graph, parent.parentId)) {
      for (const auntUncle of bloodChildren(graph, grandParent.parentId)) {
        if (auntUncle.childId === parent.parentId) continue;
        if (!(graph.spouseMap.get(auntUncle.childId) ?? []).includes(target.id)) continue;
        const label =
          target.gender === 'female'
            ? 'Aunt-in-Law'
            : target.gender === 'male'
              ? 'Uncle-in-Law'
              : 'Aunt/Uncle-in-Law';
        return build(
          [source.id, parent.parentId, grandParent.parentId, auntUncle.childId, target.id],
          label,
          `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is married to ${source.display_name}'s ${target.gender === 'female' ? 'aunt' : 'uncle'} (${graph.peopleById.get(auntUncle.childId)?.display_name}).`,
          'in_law',
          'Spouse of an aunt or uncle.',
        );
      }
    }
  }

  // Niece/nephew-in-law: target is the child of source's spouse's sibling.
  for (const spouseId of sourceSpouses) {
    for (const spouseParent of bloodParents(graph, spouseId)) {
      for (const sibling of bloodChildren(graph, spouseParent.parentId)) {
        if (sibling.childId === spouseId) continue;
        for (const child of bloodChildren(graph, sibling.childId)) {
          if (child.childId !== target.id) continue;
          const label =
            target.gender === 'female'
              ? 'Niece-in-Law'
              : target.gender === 'male'
                ? 'Nephew-in-Law'
                : 'Niece/Nephew-in-Law';
          return build(
            [source.id, spouseId, spouseParent.parentId, sibling.childId, target.id],
            label,
            `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is the child of ${source.display_name}'s spouse's sibling (${graph.peopleById.get(sibling.childId)?.display_name}).`,
            'in_law',
            'Niece or nephew of a spouse.',
          );
        }
      }
    }
  }

  // Niece/nephew-in-law: target is married to source's niece or nephew.
  for (const parent of sourceParents) {
    for (const sibling of bloodChildren(graph, parent.parentId)) {
      if (sibling.childId === source.id) continue;
      for (const nieceNephew of bloodChildren(graph, sibling.childId)) {
        if (!(graph.spouseMap.get(nieceNephew.childId) ?? []).includes(target.id)) continue;
        const label =
          target.gender === 'female'
            ? 'Niece-in-Law'
            : target.gender === 'male'
              ? 'Nephew-in-Law'
              : 'Niece/Nephew-in-Law';
        return build(
          [source.id, parent.parentId, sibling.childId, nieceNephew.childId, target.id],
          label,
          `${target.display_name} is the ${label.toLowerCase()} of ${source.display_name} because ${target.display_name} is married to ${source.display_name}'s ${target.gender === 'female' ? 'niece' : 'nephew'} (${graph.peopleById.get(nieceNephew.childId)?.display_name}).`,
          'in_law',
          'Spouse of a niece or nephew.',
        );
      }
    }
  }

  return null;
}

function findShortestGraphPath(
  startId: string,
  endId: string,
  graph: FamilyGraph,
): string[] | null {
  const queue: string[][] = [[startId]];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    if (node === endId) return path;

    for (const neighbor of graph.adjacency.get(node) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push([...path, neighbor]);
    }
  }

  return null;
}
