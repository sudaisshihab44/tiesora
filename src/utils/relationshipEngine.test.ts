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

  // 4. Half Siblings (Leo & William share Marcus Montgomery, different mothers)
  {
    const leo = getPerson('p_leo');
    const william = getPerson('p_william');
    const res = calculateRelationship(leo, william, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Half Sibling Test (Leo ➔ William)',
      expected: 'Half-Brother',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Half-Brother',
      notes: `Shares one biological parent (${res.pathDescription})`,
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
      expected: 'No Recorded Connection',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'No Recorded Connection',
    });
  }

  // 12. Uncle Test (Thomas ➔ Marcus)
  {
    const thomas = getPerson('p_thomas');
    const marcus = getPerson('p_marcus');
    const res = calculateRelationship(thomas, marcus, SAMPLE_PEOPLE, SAMPLE_RELATIONSHIPS);
    results.push({
      title: 'Uncle Test (Thomas ➔ Marcus)',
      expected: 'Uncle',
      actual: res.primaryLabel,
      passed: res.primaryLabel === 'Uncle',
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

  const passed = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
