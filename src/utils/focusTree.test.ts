import { computeFocusTree } from './focusTree';
import type { FamilyPerson, Relationship } from '../types';

interface FocusTestResult {
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

const FAMILY = 'fam_focus';

function person(
  id: string,
  displayName: string,
  gender: FamilyPerson['gender'],
  generation: number,
): FamilyPerson {
  return {
    id,
    family_id: FAMILY,
    full_name: displayName,
    display_name: displayName,
    gender,
    date_precision: 'unknown',
    living_status: 'living',
    generation_level: generation,
    created_by: 'test',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function relationship(
  id: string,
  source: string,
  target: string,
  type: Relationship['relationship_type'] = 'parent',
): Relationship {
  return {
    id,
    family_id: FAMILY,
    source_person_id: source,
    target_person_id: target,
    relationship_type: type,
    relationship_status: 'verified',
    created_by: 'test',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const PEOPLE: FamilyPerson[] = [
  person('f', 'Focus Person', 'female', 4),
  person('p1', 'Father', 'male', 3),
  person('p2', 'Mother', 'female', 3),
  person('s1', 'Husband', 'male', 4),
  person('s2', 'Second Husband', 'male', 4),
  person('sib', 'Sibling', 'male', 4),
  person('c1', 'Child One', 'female', 5),
  person('c2', 'Child Two', 'male', 5),
  person('gp1', 'Grandfather', 'male', 2),
  person('gp2', 'Grandmother', 'female', 2),
  person('ggp', 'Great-Grandfather', 'male', 1),
  person('gc1', 'Grandchild One', 'male', 6),
  person('aunt', 'Aunt', 'female', 3),
  person('orphan', 'Orphan', 'unspecified', 8),
];

const RELATIONSHIPS: Relationship[] = [
  relationship('r_p1_f', 'p1', 'f'),
  relationship('r_p2_f', 'p2', 'f'),
  relationship('r_p1_sib', 'p1', 'sib'),
  relationship('r_p2_sib', 'p2', 'sib'),
  relationship('r_f_s1', 'f', 's1', 'spouse'),
  relationship('r_f_s2', 'f', 's2', 'spouse'),
  relationship('r_f_c1', 'f', 'c1'),
  relationship('r_f_c2', 'f', 'c2'),
  relationship('r_gp1_p1', 'gp1', 'p1'),
  relationship('r_gp2_p1', 'gp2', 'p1'),
  relationship('r_ggp_gp1', 'ggp', 'gp1'),
  relationship('r_c1_gc1', 'c1', 'gc1'),
  relationship('r_gp1_aunt', 'gp1', 'aunt'),
];

export function runFocusTreeTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: FocusTestResult[];
} {
  const results: FocusTestResult[] = [];
  const ids = (depthUp: number, depthDown: number) =>
    computeFocusTree(PEOPLE, RELATIONSHIPS, 'f', depthUp, depthDown).people
      .map((item) => item.id)
      .sort();

  {
    const result = computeFocusTree(PEOPLE, RELATIONSHIPS, 'f', 1, 1);
    const visible = result.people.map((item) => item.id).sort();
    const expected = ['c1', 'c2', 'f', 'p1', 'p2', 's1', 's2', 'sib'];
    results.push({
      title: 'Focus default scope includes parents, spouses, siblings and children',
      expected: expected.join(','),
      actual: visible.join(','),
      passed: visible.join(',') === expected.join(','),
      notes: `Counts: ${result.parentCount} parents, ${result.spouseCount} spouses, ${result.siblingCount} siblings, ${result.childCount} children`,
    });
  }

  {
    const result = computeFocusTree(PEOPLE, RELATIONSHIPS, 'f', 1, 1);
    results.push({
      title: 'Focus family counts',
      expected: '2 parents / 2 spouses / 1 sibling / 2 children',
      actual: `${result.parentCount} / ${result.spouseCount} / ${result.siblingCount} / ${result.childCount}`,
      passed:
        result.parentCount === 2 &&
        result.spouseCount === 2 &&
        result.siblingCount === 1 &&
        result.childCount === 2,
    });
  }

  {
    const result = computeFocusTree(PEOPLE, RELATIONSHIPS, 'f', 1, 1);
    results.push({
      title: 'One-generation ancestor expansion cue',
      expected: 'max 3 / next 2',
      actual: `max ${result.maxAncestorDepth} / next ${result.nextAncestorCount}`,
      passed: result.maxAncestorDepth === 3 && result.nextAncestorCount === 2,
    });
  }

  {
    const result = computeFocusTree(PEOPLE, RELATIONSHIPS, 'f', 1, 1);
    results.push({
      title: 'One-generation descendant expansion cue',
      expected: 'max 2 / next 1',
      actual: `max ${result.maxDescendantDepth} / next ${result.nextDescendantCount}`,
      passed: result.maxDescendantDepth === 2 && result.nextDescendantCount === 1,
    });
  }

  {
    const visible = ids(2, 1);
    results.push({
      title: 'Show grandparents adds one ancestor generation only',
      expected: 'grandparents present, great-grandfather absent, grandchild absent',
      actual: `gp1=${visible.includes('gp1')} gp2=${visible.includes('gp2')} ggp=${visible.includes('ggp')} gc1=${visible.includes('gc1')}`,
      passed:
        visible.includes('gp1') &&
        visible.includes('gp2') &&
        !visible.includes('ggp') &&
        !visible.includes('gc1'),
    });
  }

  {
    const visible = ids(1, 2);
    results.push({
      title: 'Show grandchildren adds one descendant generation only',
      expected: 'grandchild present, great-grandfather absent',
      actual: `gc1=${visible.includes('gc1')} ggp=${visible.includes('ggp')}`,
      passed: visible.includes('gc1') && !visible.includes('ggp'),
    });
  }

  {
    const visible = ids(3, 1);
    results.push({
      title: 'Repeated ancestor expansion reaches great-grandfather',
      expected: 'great-grandfather present',
      actual: `ggp=${visible.includes('ggp')}`,
      passed: visible.includes('ggp'),
    });
  }

  {
    const result = computeFocusTree(PEOPLE, RELATIONSHIPS, 'orphan', 1, 1);
    results.push({
      title: 'Focus person without relationships still renders safely',
      expected: '1 person / 0 ancestors / 0 descendants',
      actual: `${result.people.length} person / ${result.maxAncestorDepth} ancestors / ${result.maxDescendantDepth} descendants`,
      passed:
        result.people.length === 1 &&
        result.people[0].id === 'orphan' &&
        result.maxAncestorDepth === 0 &&
        result.maxDescendantDepth === 0,
    });
  }

  {
    const result = computeFocusTree(PEOPLE, RELATIONSHIPS, 'f', 2, 2);
    const unique = new Set(result.people.map((item) => item.id));
    results.push({
      title: 'Expanded focus set contains no duplicate people',
      expected: 'unique count equals array length',
      actual: `${unique.size} unique / ${result.people.length} total`,
      passed: unique.size === result.people.length,
    });
  }

  {
    const result = computeFocusTree(PEOPLE, RELATIONSHIPS, 'f', 1, 1);
    results.push({
      title: 'Aunt is not pulled into the default focus scope',
      expected: 'aunt absent',
      actual: `aunt=${result.people.some((item) => item.id === 'aunt')}`,
      passed: !result.people.some((item) => item.id === 'aunt'),
    });
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
