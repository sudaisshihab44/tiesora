import { calculateRelationship } from './relationshipEngine';
import { SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS } from '../services/sampleData';
import { FamilyPerson, Relationship } from '../types';

export interface TestResult {
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

function makePerson(
  id: string,
  familyId: string,
  displayName: string,
  gender: FamilyPerson['gender'],
  generationLevel: number,
): FamilyPerson {
  return {
    id,
    family_id: familyId,
    full_name: displayName,
    display_name: displayName,
    gender,
    date_precision: 'unknown',
    living_status: 'living',
    generation_level: generationLevel,
    created_by: 'test',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function makeRelationship(
  id: string,
  familyId: string,
  sourceId: string,
  targetId: string,
  type: Relationship['relationship_type'] = 'parent',
): Relationship {
  return {
    id,
    family_id: familyId,
    source_person_id: sourceId,
    target_person_id: targetId,
    relationship_type: type,
    relationship_status: 'verified',
    created_by: 'test',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const SYNTH_FAMILY = 'fam_synthetic';
const OTHER_FAMILY = 'fam_other';
const SYNTH_PEOPLE: FamilyPerson[] = [
  makePerson('s_gf', SYNTH_FAMILY, 'Synthetic Grandfather', 'male', 1),
  makePerson('s_gm', SYNTH_FAMILY, 'Synthetic Grandmother', 'female', 1),
  makePerson('s_father', SYNTH_FAMILY, 'Synthetic Father', 'male', 2),
  makePerson('s_mother', SYNTH_FAMILY, 'Synthetic Mother', 'female', 2),
  makePerson('s_second_wife', SYNTH_FAMILY, 'Second Wife', 'female', 2),
  makePerson('s_mother_parent', SYNTH_FAMILY, 'Mother Parent', 'male', 1),
  makePerson('s_mother_sister', SYNTH_FAMILY, 'Mother Sister', 'female', 2),
  makePerson('s_father_sister', SYNTH_FAMILY, 'Father Sister', 'female', 2),
  makePerson('s_child_a', SYNTH_FAMILY, 'Child A', 'female', 3),
  makePerson('s_child_a_spouse', SYNTH_FAMILY, 'Child A Spouse', 'male', 3),
  makePerson('s_step_grandma', SYNTH_FAMILY, 'Step Grandma', 'female', 1),
  makePerson('s_step_child', SYNTH_FAMILY, 'Step Child', 'male', 2),
  makePerson('s_half_a', SYNTH_FAMILY, 'Half A', 'male', 5),
  makePerson('s_half_b', SYNTH_FAMILY, 'Half B', 'female', 5),
  makePerson('s_half_parent_1', SYNTH_FAMILY, 'Half Parent One', 'male', 4),
  makePerson('s_half_parent_2', SYNTH_FAMILY, 'Half Parent Two', 'female', 4),
  makePerson('s_half_parent_3', SYNTH_FAMILY, 'Half Parent Three', 'female', 4),
  makePerson('s_gg1', SYNTH_FAMILY, 'Great-Great Root', 'male', 1),
  makePerson('s_gg2', SYNTH_FAMILY, 'Great-Great Child', 'male', 2),
  makePerson('s_gg3', SYNTH_FAMILY, 'Great-Great Grandchild', 'male', 3),
  makePerson('s_gg4', SYNTH_FAMILY, 'Great-Great Great-Grandchild', 'male', 4),
  makePerson('s_gg5', SYNTH_FAMILY, 'Great-Great Great-Great-Grandchild', 'male', 5),
  makePerson('s_missing', SYNTH_FAMILY, 'Missing Parent Child', 'male', 5),
  makePerson('s_outsider', OTHER_FAMILY, 'Other Family Member', 'male', 1),
];

const SYNTH_RELATIONSHIPS: Relationship[] = [
  makeRelationship('sr_gf_father', SYNTH_FAMILY, 's_gf', 's_father'),
  makeRelationship('sr_gm_father', SYNTH_FAMILY, 's_gm', 's_father'),
  makeRelationship('sr_gf_sister', SYNTH_FAMILY, 's_gf', 's_father_sister'),
  makeRelationship('sr_gm_sister', SYNTH_FAMILY, 's_gm', 's_father_sister'),
  makeRelationship('sr_father_mother', SYNTH_FAMILY, 's_father', 's_mother', 'spouse'),
  makeRelationship('sr_father_second', SYNTH_FAMILY, 's_father', 's_second_wife', 'spouse'),
  makeRelationship('sr_father_child_a', SYNTH_FAMILY, 's_father', 's_child_a'),
  makeRelationship('sr_mother_child_a', SYNTH_FAMILY, 's_mother', 's_child_a'),
  makeRelationship('sr_child_a_spouse', SYNTH_FAMILY, 's_child_a', 's_child_a_spouse', 'spouse'),
  makeRelationship('sr_mother_parent_mother', SYNTH_FAMILY, 's_mother_parent', 's_mother'),
  makeRelationship('sr_mother_parent_sister', SYNTH_FAMILY, 's_mother_parent', 's_mother_sister'),
  makeRelationship('sr_gf_step_grandma', SYNTH_FAMILY, 's_gf', 's_step_grandma', 'spouse'),
  makeRelationship('sr_step_grandma_step_child', SYNTH_FAMILY, 's_step_grandma', 's_step_child'),
  makeRelationship('sr_half_parent_1_a', SYNTH_FAMILY, 's_half_parent_1', 's_half_a'),
  makeRelationship('sr_half_parent_2_a', SYNTH_FAMILY, 's_half_parent_2', 's_half_a'),
  makeRelationship('sr_half_parent_1_b', SYNTH_FAMILY, 's_half_parent_1', 's_half_b'),
  makeRelationship('sr_half_parent_3_b', SYNTH_FAMILY, 's_half_parent_3', 's_half_b'),
  makeRelationship('sr_gg1_2', SYNTH_FAMILY, 's_gg1', 's_gg2'),
  makeRelationship('sr_gg2_3', SYNTH_FAMILY, 's_gg2', 's_gg3'),
  makeRelationship('sr_gg3_4', SYNTH_FAMILY, 's_gg3', 's_gg4'),
  makeRelationship('sr_gg4_5', SYNTH_FAMILY, 's_gg4', 's_gg5'),
];

export function runRelationshipTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const peopleMap = new Map<string, FamilyPerson>(SAMPLE_PEOPLE.map(p => [p.id, p]));
  const results: TestResult[] = [];

  const getPerson = (id: string) => {
    const p = peopleMap.get(id);
    if (!p) throw new Error(`Person ${id} not found`);
    return p;
  };

  // 1. Self Test
  {
    const p = getPerson('p_thomas');
    const res = calculateRelationship(p, p, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Self Relationship Check',
      expected: 'Self',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Self',
    });
  }

  // 2. Direct Parent & Child
  {
    const father = getPerson('p_robert');
    const son = getPerson('p_thomas');
    const res = calculateRelationship(son, father, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Biological Parent Test (Thomas ➔ Robert)',
      expected: 'Father',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Father',
    });
  }

  // 3. Full Siblings (Thomas & Sarah share both Robert & Diana)
  {
    const thomas = getPerson('p_thomas');
    const sarah = getPerson('p_sarah');
    const res = calculateRelationship(thomas, sarah, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Full Sibling Test (Thomas ➔ Sarah)',
      expected: 'Sister',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Sister',
      notes: `Shares both parents (${res.pathDescription})`,
    });
  }

  // 4. One shared parent, but Leo's other biological parent is missing.
  // The engine must not claim "half" unless both other parents are recorded.
  {
    const leo = getPerson('p_leo');
    const william = getPerson('p_william');
    const res = calculateRelationship(leo, william, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Ambiguous Sibling Test (Leo ➔ William)',
      expected: 'Brother (incomplete records)',
      actual: `${res.primaryLabel} (${res.connectionStatus})`,
      passed: res.primaryLabel === 'Brother' && res.connectionStatus === 'incomplete',
      notes: res.pathDescription,
    });
  }

  // 5. First Cousins (Thomas Montgomery & Julian Chen via grandparents Jonathan & Eleanor)
  {
    const thomas = getPerson('p_thomas');
    const julian = getPerson('p_julian');
    const res = calculateRelationship(thomas, julian, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'First Cousins Test (Thomas ➔ Julian)',
      expected: 'First Cousin',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'First Cousin',
      notes: `Common ancestors: ${res.sharedAncestors.map(a => a.display_name).join(', ')}`,
    });
  }

  // 6. Maternal Grandmother (Thomas Montgomery ➔ Eleanor Ward)
  {
    const thomas = getPerson('p_thomas');
    const grandmother = getPerson('p_eleanor');
    const res = calculateRelationship(thomas, grandmother, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Grandparent Test (Thomas ➔ Eleanor)',
      expected: 'Grandmother',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Grandmother',
    });
  }

  // 7. Second Cousins (Maya Montgomery ➔ Oliver Chen)
  {
    const maya = getPerson('p_maya');
    const oliver = getPerson('p_oliver');
    const res = calculateRelationship(maya, oliver, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Second Cousins Test (Maya ➔ Oliver)',
      expected: 'Second Cousin',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Second Cousin',
      notes: `Shared Great-Grandparents: ${res.sharedAncestors.map(a => a.display_name).join(', ')}`,
    });
  }

  // 8. Step-Parent (Leo Montgomery ➔ Helena Rostova)
  {
    const leo = getPerson('p_leo');
    const helena = getPerson('p_helena');
    const res = calculateRelationship(leo, helena, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Step-Parent Test (Leo ➔ Helena)',
      expected: 'Step-Mother',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Step-Mother',
    });
  }

  // 9. Adoptive Parent (Chloe Vance ➔ Patricia Vance)
  {
    const chloe = getPerson('p_chloe');
    const patricia = getPerson('p_patricia');
    const res = calculateRelationship(chloe, patricia, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Adoptive Parent Test (Chloe ➔ Patricia)',
      expected: 'Adoptive Mother',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Adoptive Mother',
    });
  }

  // 10. Direct Spouse (Robert & Diana)
  {
    const robert = getPerson('p_robert');
    const diana = getPerson('p_diana');
    const res = calculateRelationship(robert, diana, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Spouse Test (Robert ➔ Diana)',
      expected: 'Wife',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Wife',
    });
  }

  // 11. Disconnected individual
  {
    const stranger: FamilyPerson = {
      id: 'p_stranger',
      family_id: 'fam_montgomery_chen',
      full_name: 'Unconnected Relative',
      display_name: 'Stranger',
      gender: 'male',
      date_precision: 'exact',
      living_status: 'living',
      generation_level: 2,
      created_by: 'usr_thomas',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const thomas = getPerson('p_thomas');
    const res = calculateRelationship(thomas, stranger, [...SAMPLE_PEOPLE, stranger], SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Disconnected Node Test',
      expected: 'No Verified Relationship Found',
      actual: `${res.primaryLabel} (${res.connectionStatus})`,
      passed:
        res.primaryLabel === 'No Verified Relationship Found' &&
        res.connectionStatus === 'incomplete' &&
        res.pathNodes.length === 0,
      notes: res.pathDescription,
    });
  }

  // 12. Uncle Test (Thomas ➔ Marcus)
  {
    const thomas = getPerson('p_thomas');
    const marcus = getPerson('p_marcus');
    const res = calculateRelationship(thomas, marcus, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Paternal Uncle Test (Thomas ➔ Marcus)',
      expected: 'Paternal Uncle',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Paternal Uncle',
      notes: res.pathDescription,
    });
  }

  // 13. Nephew Test (Marcus ➔ Thomas)
  {
    const marcus = getPerson('p_marcus');
    const thomas = getPerson('p_thomas');
    const res = calculateRelationship(marcus, thomas, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Nephew Test (Marcus ➔ Thomas)',
      expected: 'Nephew',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Nephew',
      notes: res.pathDescription,
    });
  }

  // 14. Great-Aunt Test (Oliver Chen ➔ Diana Vance)
  {
    const oliver = getPerson('p_oliver');
    const diana = getPerson('p_diana');
    const res = calculateRelationship(oliver, diana, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Great-Aunt Test (Oliver ➔ Diana)',
      expected: 'Great-Aunt',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Great-Aunt',
      notes: res.pathDescription,
    });
  }

  // 15. Grandnephew Test (Diana Vance ➔ Oliver Chen)
  {
    const diana = getPerson('p_diana');
    const oliver = getPerson('p_oliver');
    const res = calculateRelationship(diana, oliver, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Grandnephew Test (Diana ➔ Oliver)',
      expected: 'Grandnephew',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Grandnephew',
      notes: res.pathDescription,
    });
  }

  // 16. Mother-in-Law Test (Robert Montgomery ➔ Eleanor Ward)
  {
    const robert = getPerson('p_robert');
    const eleanor = getPerson('p_eleanor');
    const res = calculateRelationship(robert, eleanor, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Mother-in-Law Test (Robert ➔ Eleanor)',
      expected: 'Mother-in-Law',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Mother-in-Law',
      notes: res.pathDescription,
    });
  }

  // 17. First Cousin Once Removed (Thomas Montgomery ➔ Oliver Chen)
  {
    const thomas = getPerson('p_thomas');
    const oliver = getPerson('p_oliver');
    const res = calculateRelationship(thomas, oliver, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'First Cousin Once Removed (Thomas ➔ Oliver)',
      expected: 'First Cousin Once Removed',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'First Cousin Once Removed',
      notes: res.pathDescription,
    });
  }

  const synth = (id: string) => {
    const person = SYNTH_PEOPLE.find((candidate) => candidate.id === id);
    if (!person) throw new Error(`Synthetic person ${id} not found`);
    return person;
  };
  const calculateSynth = (aId: string, bId: string) =>
    calculateRelationship(synth(aId), synth(bId), SYNTH_PEOPLE, SYNTH_RELATIONSHIPS);

  // 18. Half-sibling with both other parents recorded.
  {
    const res = calculateSynth('s_half_a', 's_half_b');
    results.push({
      title: 'Verified Half-Sibling Test (Half A ➔ Half B)',
      expected: 'Half-Sister (verified)',
      actual: `${res.primaryLabel} (${res.connectionStatus})`,
      passed: res.primaryLabel === 'Half-Sister' && res.connectionStatus === 'verified',
      notes: res.pathDescription,
    });
  }

  // 19. Paternal aunt.
  {
    const res = calculateSynth('s_child_a', 's_father_sister');
    results.push({
      title: 'Paternal Aunt Test (Child A ➔ Father Sister)',
      expected: 'Paternal Aunt',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Paternal Aunt',
      notes: res.pathDescription,
    });
  }

  // 20. Maternal aunt.
  {
    const res = calculateSynth('s_child_a', 's_mother_sister');
    results.push({
      title: 'Maternal Aunt Test (Child A ➔ Mother Sister)',
      expected: 'Maternal Aunt',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Maternal Aunt',
      notes: res.pathDescription,
    });
  }

  // 21. Sister-in-law through a spouse's sibling.
  {
    const res = calculateSynth('s_father', 's_mother_sister');
    results.push({
      title: 'Sister-in-Law Test (Father ➔ Mother Sister)',
      expected: 'Sister-in-Law',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Sister-in-Law',
      notes: res.pathDescription,
    });
  }

  // 22. Son-in-law through a child's spouse.
  {
    const res = calculateSynth('s_father', 's_child_a_spouse');
    results.push({
      title: 'Son-in-Law Test (Father ➔ Child A Spouse)',
      expected: 'Son-in-Law',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Son-in-Law',
      notes: res.pathDescription,
    });
  }

  // 23. Father-in-law through a spouse's parent.
  {
    const res = calculateSynth('s_father', 's_mother_parent');
    results.push({
      title: 'Father-in-Law Test (Father ➔ Mother Parent)',
      expected: 'Father-in-Law',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Father-in-Law',
      notes: res.pathDescription,
    });
  }

  // 24. Step-brother through a parent's spouse's child.
  {
    const res = calculateSynth('s_father', 's_step_child');
    results.push({
      title: 'Step-Brother Test (Father ➔ Step Child)',
      expected: 'Step-Brother',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Step-Brother',
      notes: res.pathDescription,
    });
  }

  // 25. Four generations below a common ancestor.
  {
    const res = calculateSynth('s_gg1', 's_gg5');
    results.push({
      title: 'Great-Great-Grandson Test (Great-Great Root ➔ Generation 5)',
      expected: '2x Great-Grandson',
      actual: res.primaryLabel,
      passed:
        res.primaryLabel === '2x Great-Grandson' &&
        res.generationDistance?.totalSteps === 4,
      notes: `${res.pathDescription} (${res.generationDistance?.totalSteps ?? 0} steps)`,
    });
  }

  // 26. People from different families.
  {
    const res = calculateRelationship(
      synth('s_father'),
      synth('s_outsider'),
      SYNTH_PEOPLE,
      SYNTH_RELATIONSHIPS,
    );
    results.push({
      title: 'Different Family Invalid Selection',
      expected: 'Invalid Selection (invalid)',
      actual: `${res.primaryLabel} (${res.connectionStatus})`,
      passed:
        res.primaryLabel === 'Invalid Selection' &&
        res.connectionStatus === 'invalid' &&
        res.pathNodes.length === 0,
    });
  }

  // 27. Same family, but one person has no recorded relationships.
  {
    const res = calculateSynth('s_father', 's_missing');
    results.push({
      title: 'Incomplete Disconnected Records Test',
      expected: 'No Verified Relationship Found (incomplete)',
      actual: `${res.primaryLabel} (${res.connectionStatus})`,
      passed:
        res.primaryLabel === 'No Verified Relationship Found' &&
        res.connectionStatus === 'incomplete' &&
        res.pathNodes.length === 0 &&
        Boolean(res.missingRecords?.length),
      notes: res.missingRecords?.join(' '),
    });
  }

  // 28. Multiple spouses remain independently addressable.
  {
    const wife = calculateSynth('s_father', 's_second_wife');
    const husband = calculateSynth('s_second_wife', 's_father');
    const mother = calculateSynth('s_father', 's_mother');
    results.push({
      title: 'Multiple Spouses Test',
      expected: 'Wife / Husband / Wife',
      actual: `${wife.primaryLabel} / ${husband.primaryLabel} / ${mother.primaryLabel}`,
      passed:
        wife.primaryLabel === 'Wife' &&
        husband.primaryLabel === 'Husband' &&
        mother.primaryLabel === 'Wife',
    });
  }

  // 29. Full sibling status and explanation.
  {
    const thomas = getPerson('p_thomas');
    const sarah = getPerson('p_sarah');
    const res = calculateRelationship(thomas, sarah, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Full Sibling Status Test',
      expected: 'Sister (verified, full sibling)',
      actual: `${res.primaryLabel} (${res.connectionStatus})`,
      passed:
        res.primaryLabel === 'Sister' &&
        res.connectionStatus === 'verified' &&
        Boolean(res.relationshipDetail?.includes('Full sibling')),
      notes: res.relationshipDetail,
    });
  }

  // 30. Grandparent generation distance.
  {
    const thomas = getPerson('p_thomas');
    const eleanor = getPerson('p_eleanor');
    const res = calculateRelationship(thomas, eleanor, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    const distance = res.generationDistance;
    results.push({
      title: 'Grandparent Generation Distance Test',
      expected: '2-up / 0-down / 2 total',
      actual: distance
        ? `${distance.sourceToCommonAncestor}-up / ${distance.targetToCommonAncestor}-down / ${distance.totalSteps} total`
        : 'missing',
      passed:
        res.primaryLabel === 'Grandmother' &&
        distance?.sourceToCommonAncestor === 2 &&
        distance?.targetToCommonAncestor === 0 &&
        distance?.totalSteps === 2,
    });
  }

  const passed = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
