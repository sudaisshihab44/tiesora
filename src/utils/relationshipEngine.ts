import { FamilyPerson, Relationship, CalculatedRelationship } from '../types';

interface GraphEdge {
  targetId: string;
  type: Relationship['relationship_type'];
  status: Relationship['relationship_status'];
  direction: 'parent_to_child' | 'child_to_parent' | 'spouse';
}

interface PathStep {
  personId: string;
  edgeLabel: string;
}

export function calculateRelationship(
  sourcePerson: FamilyPerson,
  targetPerson: FamilyPerson,
  allPeople: FamilyPerson[],
  allRelationships: Relationship[]
): CalculatedRelationship {
  if (sourcePerson.id === targetPerson.id) {
    return {
      sourcePerson,
      targetPerson,
      primaryLabel: 'Self',
      pathDescription: 'This is the same individual in the family tree.',
      sharedAncestors: [],
      pathNodes: [sourcePerson],
      pathEdgeDescriptions: [],
      confidence: 'verified',
      relationshipCategory: 'self',
    };
  }

  const peopleMap = new Map<string, FamilyPerson>(allPeople.map(p => [p.id, p]));

  // Build directional lookups
  // parentMap: childId -> array of { parentId, type }
  const parentMap = new Map<string, { parentId: string; type: string }[]>();
  // childMap: parentId -> array of { childId, type }
  const childMap = new Map<string, { childId: string; type: string }[]>();
  // spouseMap: personId -> array of spouseId
  const spouseMap = new Map<string, string[]>();

  allRelationships.forEach(rel => {
    if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationship_type)) {
      // source is parent, target is child
      const parents = parentMap.get(rel.target_person_id) || [];
      parents.push({ parentId: rel.source_person_id, type: rel.relationship_type });
      parentMap.set(rel.target_person_id, parents);

      const children = childMap.get(rel.source_person_id) || [];
      children.push({ childId: rel.target_person_id, type: rel.relationship_type });
      childMap.set(rel.source_person_id, children);
    } else if (['spouse', 'partner'].includes(rel.relationship_type)) {
      const spA = spouseMap.get(rel.source_person_id) || [];
      spA.push(rel.target_person_id);
      spouseMap.set(rel.source_person_id, spA);

      const spB = spouseMap.get(rel.target_person_id) || [];
      spB.push(rel.source_person_id);
      spouseMap.set(rel.target_person_id, spB);
    }
  });

  // 1. Direct Spouse Check
  const directSpouses = spouseMap.get(sourcePerson.id) || [];
  if (directSpouses.includes(targetPerson.id)) {
    const label = targetPerson.gender === 'female' ? 'Wife' : targetPerson.gender === 'male' ? 'Husband' : 'Spouse / Partner';
    return {
      sourcePerson,
      targetPerson,
      primaryLabel: label,
      pathDescription: `${targetPerson.display_name} is the direct spouse or partner of ${sourcePerson.display_name}.`,
      sharedAncestors: [],
      pathNodes: [sourcePerson, targetPerson],
      pathEdgeDescriptions: ['Spouse of'],
      confidence: 'verified',
      relationshipCategory: 'spouse',
    };
  }

  // 2. Direct Parent-Child Check
  const sourceParents = parentMap.get(sourcePerson.id) || [];
  const targetParents = parentMap.get(targetPerson.id) || [];

  // Is target a parent of source?
  const parentEntry = sourceParents.find(p => p.parentId === targetPerson.id);
  if (parentEntry) {
    let label = 'Parent';
    let cat: CalculatedRelationship['relationshipCategory'] = 'parent';
    if (parentEntry.type === 'adoptive_parent') {
      label = targetPerson.gender === 'female' ? 'Adoptive Mother' : targetPerson.gender === 'male' ? 'Adoptive Father' : 'Adoptive Parent';
      cat = 'adoptive';
    } else if (parentEntry.type === 'step_parent') {
      label = targetPerson.gender === 'female' ? 'Step-Mother' : targetPerson.gender === 'male' ? 'Step-Father' : 'Step-Parent';
      cat = 'step';
    } else {
      label = targetPerson.gender === 'female' ? 'Mother' : targetPerson.gender === 'male' ? 'Father' : 'Parent';
    }

    return {
      sourcePerson,
      targetPerson,
      primaryLabel: label,
      pathDescription: `${targetPerson.display_name} is the ${label.toLowerCase()} of ${sourcePerson.display_name}.`,
      sharedAncestors: [],
      pathNodes: [sourcePerson, targetPerson],
      pathEdgeDescriptions: [`${label} of`],
      confidence: 'verified',
      relationshipCategory: cat,
    };
  }

  // Is source a parent of target?
  const childEntry = targetParents.find(p => p.parentId === sourcePerson.id);
  if (childEntry) {
    let label = 'Child';
    let cat: CalculatedRelationship['relationshipCategory'] = 'child';
    if (childEntry.type === 'adoptive_parent') {
      label = targetPerson.gender === 'female' ? 'Adoptive Daughter' : targetPerson.gender === 'male' ? 'Adoptive Son' : 'Adoptive Child';
      cat = 'adoptive';
    } else if (childEntry.type === 'step_parent') {
      label = targetPerson.gender === 'female' ? 'Step-Daughter' : targetPerson.gender === 'male' ? 'Step-Son' : 'Step-Child';
      cat = 'step';
    } else {
      label = targetPerson.gender === 'female' ? 'Daughter' : targetPerson.gender === 'male' ? 'Son' : 'Child';
    }

    return {
      sourcePerson,
      targetPerson,
      primaryLabel: label,
      pathDescription: `${targetPerson.display_name} is the ${label.toLowerCase()} of ${sourcePerson.display_name}.`,
      sharedAncestors: [],
      pathNodes: [sourcePerson, targetPerson],
      pathEdgeDescriptions: [`${label} of`],
      confidence: 'verified',
      relationshipCategory: cat,
    };
  }

  // 3. Ancestor / Descendant Tree Traversal for Common Ancestors
  const getAncestorsWithDistance = (startId: string) => {
    const map = new Map<string, number>(); // id -> distance
    const queue: { id: string; dist: number }[] = [{ id: startId, dist: 0 }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      map.set(id, dist);

      const parents = (parentMap.get(id) || []).filter(p => p.type === 'parent' || p.type === 'adoptive_parent');
      parents.forEach(p => {
        if (!visited.has(p.parentId)) {
          visited.add(p.parentId);
          queue.push({ id: p.parentId, dist: dist + 1 });
        }
      });
    }
    return map;
  };

  const sourceAncestors = getAncestorsWithDistance(sourcePerson.id);
  const targetAncestors = getAncestorsWithDistance(targetPerson.id);

  // Find shared common ancestors
  const sharedAncestorIds: string[] = [];
  sourceAncestors.forEach((_, id) => {
    if (targetAncestors.has(id)) {
      sharedAncestorIds.push(id);
    }
  });

  // If there are shared ancestors, find the lowest common ancestor(s) (LCA)
  if (sharedAncestorIds.length > 0) {
    // Sort by minimum sum of distances (closest common ancestor)
    sharedAncestorIds.sort((a, b) => {
      const sumA = (sourceAncestors.get(a) || 0) + (targetAncestors.get(a) || 0);
      const sumB = (sourceAncestors.get(b) || 0) + (targetAncestors.get(b) || 0);
      return sumA - sumB;
    });

    const lcaId = sharedAncestorIds[0];
    const dA = sourceAncestors.get(lcaId)!;
    const dB = targetAncestors.get(lcaId)!;
    const sharedAncestorPeople = sharedAncestorIds
      .map(id => peopleMap.get(id))
      .filter((p): p is FamilyPerson => Boolean(p));

    const lcaPerson = peopleMap.get(lcaId);

    // Calculate specific genealogical relationship
    let primaryLabel = 'Relative';
    let category: CalculatedRelationship['relationshipCategory'] = 'distant';
    let pathDesc = '';

    // Direct line down/up
    if (dA === 0) {
      // Source is ancestor of Target
      if (dB === 2) {
        primaryLabel = targetPerson.gender === 'female' ? 'Granddaughter' : targetPerson.gender === 'male' ? 'Grandson' : 'Grandchild';
        category = 'grandchild';
      } else if (dB === 3) {
        primaryLabel = targetPerson.gender === 'female' ? 'Great-Granddaughter' : targetPerson.gender === 'male' ? 'Great-Grandson' : 'Great-Grandchild';
        category = 'great_grandchild';
      } else {
        primaryLabel = `${dB}-times Great-Grandchild`;
        category = 'great_grandchild';
      }
      pathDesc = `${targetPerson.display_name} is a direct descendant (${primaryLabel}) of ${sourcePerson.display_name}.`;
    } else if (dB === 0) {
      // Target is ancestor of Source
      if (dA === 2) {
        primaryLabel = targetPerson.gender === 'female' ? 'Grandmother' : targetPerson.gender === 'male' ? 'Grandfather' : 'Grandparent';
        category = 'grandparent';
      } else if (dA === 3) {
        primaryLabel = targetPerson.gender === 'female' ? 'Great-Grandmother' : targetPerson.gender === 'male' ? 'Great-Grandfather' : 'Great-Grandparent';
        category = 'great_grandparent';
      } else {
        primaryLabel = `${dA}-times Great-Grandparent`;
        category = 'great_grandparent';
      }
      pathDesc = `${targetPerson.display_name} is an ancestor (${primaryLabel}) of ${sourcePerson.display_name}.`;
    } else if (dA === 1 && dB === 1) {
      // Siblings! Check if full or half
      const sourceParentIds = (parentMap.get(sourcePerson.id) || [])
        .filter(p => p.type === 'parent' || p.type === 'adoptive_parent')
        .map(p => p.parentId);
      const targetParentIds = (parentMap.get(targetPerson.id) || [])
        .filter(p => p.type === 'parent' || p.type === 'adoptive_parent')
        .map(p => p.parentId);
      const commonParents = sourceParentIds.filter(pid => targetParentIds.includes(pid));

      if (commonParents.length >= 2) {
        primaryLabel = targetPerson.gender === 'female' ? 'Sister' : targetPerson.gender === 'male' ? 'Brother' : 'Full Sibling';
        category = 'sibling';
        pathDesc = `${targetPerson.display_name} and ${sourcePerson.display_name} share both parents.`;
      } else {
        primaryLabel = targetPerson.gender === 'female' ? 'Half-Sister' : targetPerson.gender === 'male' ? 'Half-Brother' : 'Half-Sibling';
        category = 'half_sibling';
        pathDesc = `${targetPerson.display_name} and ${sourcePerson.display_name} share one common parent (${lcaPerson?.display_name}).`;
      }
    } else if (dA === 1 && dB === 2) {
      // Source is sibling to Target's parent -> Target is Niece or Nephew to Source
      primaryLabel = targetPerson.gender === 'female' ? 'Niece' : targetPerson.gender === 'male' ? 'Nephew' : 'Niece / Nephew';
      category = 'niece_nephew';
      pathDesc = `${targetPerson.display_name} is the child of ${sourcePerson.display_name}’s sibling.`;
    } else if (dA === 2 && dB === 1) {
      // Target is sibling to Source's parent -> Target is Aunt or Uncle to Source
      primaryLabel = targetPerson.gender === 'female' ? 'Aunt' : targetPerson.gender === 'male' ? 'Uncle' : 'Aunt / Uncle';
      category = 'aunt_uncle';
      pathDesc = `${targetPerson.display_name} is the sibling of ${sourcePerson.display_name}’s parent (${lcaPerson?.display_name}’s child).`;
    } else if (dA === 1 && dB === 3) {
      // Target is grandchild of Source's sibling
      primaryLabel = targetPerson.gender === 'female' ? 'Grandniece' : targetPerson.gender === 'male' ? 'Grandnephew' : 'Grandniece / Nephew';
      category = 'niece_nephew';
      pathDesc = `${targetPerson.display_name} is the grandchild of ${sourcePerson.display_name}’s sibling.`;
    } else if (dA === 3 && dB === 1) {
      // Target is sibling to Source's grandparent
      primaryLabel = targetPerson.gender === 'female' ? 'Great-Aunt' : targetPerson.gender === 'male' ? 'Great-Uncle' : 'Great-Aunt / Uncle';
      category = 'aunt_uncle';
      pathDesc = `${targetPerson.display_name} is the sibling of ${sourcePerson.display_name}’s grandparent.`;
    } else if (dA === 1 && dB > 3) {
      const g = dB - 2;
      primaryLabel = targetPerson.gender === 'female' ? `${g}x Great-Grandniece` : targetPerson.gender === 'male' ? `${g}x Great-Grandnephew` : `${g}x Great-Grandniece / Nephew`;
      category = 'niece_nephew';
      pathDesc = `${targetPerson.display_name} is a collateral descendant of ${sourcePerson.display_name}’s sibling.`;
    } else if (dA > 3 && dB === 1) {
      const g = dA - 2;
      primaryLabel = targetPerson.gender === 'female' ? `${g}x Great-Aunt` : targetPerson.gender === 'male' ? `${g}x Great-Uncle` : `${g}x Great-Aunt / Uncle`;
      category = 'aunt_uncle';
      pathDesc = `${targetPerson.display_name} is a collateral ancestor (${primaryLabel}) of ${sourcePerson.display_name}.`;
    } else {
      // Collateral cousin calculation
      const cousinDegree = Math.min(dA, dB) - 1;
      const removal = Math.abs(dA - dB);
      const ordinal = getOrdinal(cousinDegree);
      if (removal === 0) {
        primaryLabel = `${ordinal} Cousin`;
        category = cousinDegree === 1 ? 'first_cousin' : cousinDegree === 2 ? 'second_cousin' : 'distant';
        pathDesc = `${sourcePerson.display_name} and ${targetPerson.display_name} are ${primaryLabel}s, sharing ${sharedAncestorPeople.map(p => p.display_name).join(' and ')}.`;
      } else {
        primaryLabel = `${ordinal} Cousin ${getRemovalWord(removal)}`;
        category = cousinDegree === 1 && removal === 1 ? 'first_cousin_once_removed' : 'distant';
        pathDesc = `Connected through common ancestors ${sharedAncestorPeople.map(p => p.display_name).join(', ')} with a ${removal}-generation offset.`;
      }
    }

    // Build the connecting visual path between source and target through LCA
    const pathNodes = buildPathThroughAncestors(sourcePerson.id, targetPerson.id, lcaId, parentMap, peopleMap);

    return {
      sourcePerson,
      targetPerson,
      primaryLabel,
      pathDescription: pathDesc,
      sharedAncestors: sharedAncestorPeople,
      pathNodes,
      pathEdgeDescriptions: generateEdgeLabels(pathNodes, parentMap, childMap, spouseMap),
      confidence: 'verified',
      relationshipCategory: category,
    };
  }

  // 4. In-Law & Step Relationship Graph Search (BFS through whole family graph)
  const generalPath = findShortestGraphPath(sourcePerson.id, targetPerson.id, allPeople, allRelationships);

  if (generalPath && generalPath.length > 1) {
    const pathNodes = generalPath.map(id => peopleMap.get(id)!).filter(Boolean);
    const inLawAnalysis = analyzeInLawPath(pathNodes, parentMap, spouseMap, targetPerson);

    return {
      sourcePerson,
      targetPerson,
      primaryLabel: inLawAnalysis.label,
      pathDescription: inLawAnalysis.description,
      sharedAncestors: [],
      pathNodes,
      pathEdgeDescriptions: generateEdgeLabels(pathNodes, parentMap, childMap, spouseMap),
      alternativeInterpretations: inLawAnalysis.alternatives,
      confidence: inLawAnalysis.isDirectInLaw ? 'verified' : 'inferred',
      relationshipCategory: inLawAnalysis.category,
    };
  }

  // 5. Disconnected
  return {
    sourcePerson,
    targetPerson,
    primaryLabel: 'No Recorded Connection',
    pathDescription: `No relationship records currently link ${sourcePerson.display_name} and ${targetPerson.display_name} in this family tree.`,
    sharedAncestors: [],
    pathNodes: [sourcePerson, targetPerson],
    pathEdgeDescriptions: ['Not directly connected'],
    confidence: 'ambiguous',
    relationshipCategory: 'disconnected',
  };
}

// Helpers for cousin naming
function getOrdinal(n: number): string {
  const words = ['Zero', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
  if (n >= 1 && n < words.length) return words[n];
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getRemovalWord(r: number): string {
  if (r === 1) return 'Once Removed';
  if (r === 2) return 'Twice Removed';
  if (r === 3) return 'Three Times Removed';
  return `${r} Times Removed`;
}

// BFS helper to trace upwards from node to ancestor
function findUpwardPath(
  startId: string,
  ancestorId: string,
  parentMap: Map<string, { parentId: string; type: string }[]>
): string[] {
  if (startId === ancestorId) return [startId];
  const queue: string[][] = [[startId]];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const curr = path[path.length - 1];
    if (curr === ancestorId) return path;

    const parents = (parentMap.get(curr) || []).filter(p => p.type === 'parent' || p.type === 'adoptive_parent');
    for (const p of parents) {
      if (!visited.has(p.parentId)) {
        visited.add(p.parentId);
        queue.push([...path, p.parentId]);
      }
    }
  }
  return [startId];
}

// Helper to construct upward and downward path through LCA
function buildPathThroughAncestors(
  sourceId: string,
  targetId: string,
  lcaId: string,
  parentMap: Map<string, { parentId: string; type: string }[]>,
  peopleMap: Map<string, FamilyPerson>
): FamilyPerson[] {
  const upwardFromSource = findUpwardPath(sourceId, lcaId, parentMap);
  const upwardFromTarget = findUpwardPath(targetId, lcaId, parentMap);
  const downwardFromLCA = [...upwardFromTarget].reverse();

  // Combine source -> ... -> LCA -> ... -> target
  const fullIds = [...upwardFromSource];
  for (let i = 1; i < downwardFromLCA.length; i++) {
    fullIds.push(downwardFromLCA[i]);
  }

  return fullIds.map(id => peopleMap.get(id)!).filter(Boolean);
}

// Generate descriptive link labels between nodes in a chain
function generateEdgeLabels(
  nodes: FamilyPerson[],
  parentMap: Map<string, { parentId: string; type: string }[]>,
  childMap: Map<string, { childId: string; type: string }[]>,
  spouseMap: Map<string, string[]>
): string[] {
  const labels: string[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];

    // Is b parent of a?
    const aParents = parentMap.get(a.id) || [];
    const parentOfA = aParents.find(p => p.parentId === b.id);
    if (parentOfA) {
      labels.push(b.gender === 'female' ? 'Mother' : b.gender === 'male' ? 'Father' : 'Parent');
      continue;
    }

    // Is b child of a?
    const bParents = parentMap.get(b.id) || [];
    const childOfA = bParents.find(p => p.parentId === a.id);
    if (childOfA) {
      labels.push(b.gender === 'female' ? 'Daughter' : b.gender === 'male' ? 'Son' : 'Child');
      continue;
    }

    // Is b spouse of a?
    const aSpouses = spouseMap.get(a.id) || [];
    if (aSpouses.includes(b.id)) {
      labels.push(b.gender === 'female' ? 'Wife' : b.gender === 'male' ? 'Husband' : 'Spouse');
      continue;
    }

    labels.push('Connected to');
  }
  return labels;
}

// Shortest path search across all edge types
function findShortestGraphPath(
  startId: string,
  endId: string,
  people: FamilyPerson[],
  relationships: Relationship[]
): string[] | null {
  const adj = new Map<string, string[]>();
  people.forEach(p => adj.set(p.id, []));

  relationships.forEach(r => {
    const s = r.source_person_id;
    const t = r.target_person_id;
    if (adj.has(s) && adj.has(t)) {
      adj.get(s)!.push(t);
      adj.get(t)!.push(s);
    }
  });

  const queue: string[][] = [[startId]];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];

    if (node === endId) return path;

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return null;
}

// In-law and extended path classification
function analyzeInLawPath(
  pathNodes: FamilyPerson[],
  parentMap: Map<string, { parentId: string; type: string }[]>,
  spouseMap: Map<string, string[]>,
  targetPerson: FamilyPerson
): {
  label: string;
  description: string;
  category: CalculatedRelationship['relationshipCategory'];
  isDirectInLaw: boolean;
  alternatives?: string[];
} {
  const len = pathNodes.length;
  const isFemale = targetPerson.gender === 'female';
  const isMale = targetPerson.gender === 'male';

  // Path length 3: Direct in-law or step relationship
  if (len === 3) {
    const [pA, pB, pC] = pathNodes;
    const pASpouses = spouseMap.get(pA.id) || [];
    const pBSpouses = spouseMap.get(pB.id) || [];
    const pAParents = (parentMap.get(pA.id) || []).map(p => p.parentId);
    const pBParents = (parentMap.get(pB.id) || []).map(p => p.parentId);
    const pCParents = (parentMap.get(pC.id) || []).map(p => p.parentId);

    // 1. pA -> Spouse (pB) -> Parent of Spouse (pC) => Mother/Father-in-Law
    if (pASpouses.includes(pB.id) && pBParents.includes(pC.id)) {
      const label = isFemale ? 'Mother-in-Law' : isMale ? 'Father-in-Law' : 'Parent-in-Law';
      return {
        label,
        description: `${pC.display_name} is the parent of ${pA.display_name}’s spouse (${pB.display_name}).`,
        category: 'in_law',
        isDirectInLaw: true,
      };
    }

    // 2. pA -> Child (pB) -> Spouse of Child (pC) => Daughter/Son-in-Law
    if (pBParents.includes(pA.id) && pBSpouses.includes(pC.id)) {
      const label = isFemale ? 'Daughter-in-Law' : isMale ? 'Son-in-Law' : 'Child-in-Law';
      return {
        label,
        description: `${pC.display_name} is married to ${pA.display_name}’s child (${pB.display_name}).`,
        category: 'in_law',
        isDirectInLaw: true,
      };
    }

    // 3. pA -> Spouse (pB) -> Sibling of Spouse (pC) => Sister/Brother-in-Law
    if (pASpouses.includes(pB.id) && pBParents.length > 0 && pCParents.length > 0 && pBParents.some(id => pCParents.includes(id))) {
      const label = isFemale ? 'Sister-in-Law' : isMale ? 'Brother-in-Law' : 'In-Law';
      return {
        label,
        description: `${pC.display_name} is the sibling of ${pA.display_name}’s spouse (${pB.display_name}).`,
        category: 'in_law',
        isDirectInLaw: true,
      };
    }

    // 4. pA -> Sibling (pB) -> Spouse of Sibling (pC) => Sister/Brother-in-Law
    if (pAParents.length > 0 && pBParents.length > 0 && pAParents.some(id => pBParents.includes(id)) && pBSpouses.includes(pC.id)) {
      const label = isFemale ? 'Sister-in-Law' : isMale ? 'Brother-in-Law' : 'In-Law';
      return {
        label,
        description: `${pC.display_name} is married to ${pA.display_name}’s sibling (${pB.display_name}).`,
        category: 'in_law',
        isDirectInLaw: true,
      };
    }

    // 5. pA -> Parent (pB) -> Spouse of Parent (pC, not biological parent of pA) => Step-Parent
    if (pAParents.includes(pB.id) && pBSpouses.includes(pC.id) && !pAParents.includes(pC.id)) {
      const label = isFemale ? 'Step-Mother' : isMale ? 'Step-Father' : 'Step-Parent';
      return {
        label,
        description: `${pC.display_name} is married to ${pA.display_name}’s parent (${pB.display_name}).`,
        category: 'step',
        isDirectInLaw: true,
      };
    }

    // 6. pA -> Spouse (pB) -> Child of Spouse (pC, not biological child of pA) => Step-Child
    if (pASpouses.includes(pB.id) && pCParents.includes(pB.id) && !pCParents.includes(pA.id)) {
      const label = isFemale ? 'Step-Daughter' : isMale ? 'Step-Son' : 'Step-Child';
      return {
        label,
        description: `${pC.display_name} is the child of ${pA.display_name}’s spouse (${pB.display_name}).`,
        category: 'step',
        isDirectInLaw: true,
      };
    }
  }

  // Extended connection
  return {
    label: 'Extended Family Connection',
    description: `Connected through ${len - 2} intermediate family member(s) (${pathNodes.slice(1, -1).map(p => p.display_name).join(' ➔ ')}).`,
    category: 'in_law',
    isDirectInLaw: false,
    alternatives: ['Marriage Link', 'Multi-Branch Connection'],
  };
}
