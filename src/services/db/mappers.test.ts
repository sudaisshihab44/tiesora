import {
  isStoragePath,
  mapChangeRequest,
  mapFamily,
  mapMembership,
  mapMemory,
  mapNotification,
  mapPerson,
  mapRelationship,
  normalizeRelationshipEndpoints,
  toDbDate,
} from './mappers';
import type {
  ChangeRequestRow,
  FamilyRow,
  MembershipRow,
  MemoryRow,
  NotificationRow,
  PersonRow,
  RelationshipRow,
} from './rows';

export interface TestResult {
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

const personRow: PersonRow = {
  id: 'p1',
  family_id: 'f1',
  full_name: 'Jane Doe',
  display_name: 'Jane',
  gender: 'female',
  birth_date: '1942-01-01',
  birth_place: null,
  death_date: null,
  death_place: null,
  date_precision: 'about',
  living_status: 'living',
  biography: null,
  avatar_path: null,
  generation_level: 2,
  branch: null,
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const familyRow: FamilyRow = {
  id: 'f1',
  name: 'Test Family',
  description: null,
  avatar_path: null,
  cover_path: null,
  owner_id: 'u1',
  privacy_settings: { hideLivingDates: true },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const membershipRow: MembershipRow = {
  id: 'm1',
  family_id: 'f1',
  user_id: 'u1',
  user_email: 'jane@example.com',
  user_name: 'Jane',
  role: 'owner',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const memoryRow: MemoryRow = {
  id: 'mem1',
  family_id: 'f1',
  title: 'A memory',
  description: null,
  memory_date: null,
  location: null,
  image_url: 'f1/photo.jpg',
  tagged_person_ids: null,
  album: null,
  is_private: null,
  created_by: 'u1',
  created_by_name: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const relationshipRow: RelationshipRow = {
  id: 'r1',
  family_id: 'f1',
  source_person_id: 'p1',
  target_person_id: 'p2',
  relationship_type: 'parent',
  relationship_status: 'verified',
  valid_from: null,
  valid_to: null,
  notes: null,
  created_by: 'u1',
  verified_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const changeRequestRow: ChangeRequestRow = {
  id: 'cr1',
  family_id: 'f1',
  person_id: null,
  requested_by: 'u2',
  requested_by_name: null,
  change_type: 'edit_person',
  payload: { biography: 'Updated' },
  status: 'pending',
  review_note: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

const notificationRow: NotificationRow = {
  id: 'n1',
  user_id: 'u1',
  family_id: null,
  type: 'new_memory',
  title: 'New memory',
  message: 'A memory was added.',
  link_tab: null,
  link_id: null,
  is_read: false,
  created_at: '2026-01-01T00:00:00Z',
};

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function runDbMapperTestSuite(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  const check = (
    title: string,
    actual: unknown,
    expected: unknown,
    notes?: string,
  ) => {
    const actualText = stringify(actual);
    const expectedText = stringify(expected);
    results.push({
      title,
      expected: expectedText,
      actual: actualText,
      passed: actualText === expectedText,
      notes,
    });
  };

  // ── Date normalisation ───────────────────────────────────────────────────
  check('Year-only date -> Jan 1', toDbDate('1942'), '1942-01-01');
  check('Full date stays unchanged', toDbDate('1942-03-04'), '1942-03-04');
  check('ISO timestamp -> date portion', toDbDate('1942-03-04T12:00:00Z'), '1942-03-04');
  check('Empty date -> null', toDbDate(''), null);
  check('Invalid date -> null', toDbDate('not-a-date'), null);
  check('Undefined date -> null', toDbDate(undefined), null);

  // ── Relationship direction ───────────────────────────────────────────────
  {
    const normalized = normalizeRelationshipEndpoints({
      source_person_id: 'parent',
      target_person_id: 'child',
      relationship_type: 'child',
    });
    check('child edge is swapped', normalized, {
      source_person_id: 'child',
      target_person_id: 'parent',
      relationship_type: 'parent',
    });
  }
  {
    const normalized = normalizeRelationshipEndpoints({
      source_person_id: 'parent',
      target_person_id: 'child',
      relationship_type: 'parent',
    });
    check('parent edge is unchanged', normalized, {
      source_person_id: 'parent',
      target_person_id: 'child',
      relationship_type: 'parent',
    });
  }

  // ── Row mappers ──────────────────────────────────────────────────────────
  {
    const person = mapPerson(personRow);
    check('person null birth_place -> undefined', person.birth_place, undefined);
    check('person null death_date -> undefined', person.death_date, undefined);
    check('person null biography -> undefined', person.biography, undefined);
    check('person generation preserved', person.generation_level, 2);
    check('person date precision preserved', person.date_precision, 'about');
  }

  {
    const family = mapFamily(familyRow);
    check('family privacy defaults merge', family.privacy_settings, {
      hideLivingDates: true,
      hideLivingBiographies: false,
      hidePrivateMemories: false,
      requireAdminApprovalForEdits: true,
      isPubliclySearchable: false,
    });
    check('family null description -> undefined', family.description, undefined);
  }

  {
    const membership = mapMembership(membershipRow);
    check('legacy owner role -> admin', membership.role, 'admin');
    check('membership email mapped', membership.user_email, 'jane@example.com');
  }

  {
    const memory = mapMemory(memoryRow);
    check('memory null tags -> empty array', memory.tagged_person_ids, []);
    check('memory null is_private -> false', memory.is_private, false);
    check('memory null created_by_name -> empty', memory.created_by_name, '');
  }

  {
    const relationship = mapRelationship(relationshipRow);
    check('relationship null valid_from -> undefined', relationship.valid_from, undefined);
    check('relationship status preserved', relationship.relationship_status, 'verified');
  }

  {
    const request = mapChangeRequest(changeRequestRow);
    check('change request null person_id -> undefined', request.person_id, undefined);
    check('change request null requester name -> empty', request.requested_by_name, '');
    check('change request null review note -> undefined', request.review_note, undefined);
  }

  {
    const notification = mapNotification(notificationRow);
    check('notification null family_id -> empty', notification.family_id, '');
    check('notification null link_tab -> undefined', notification.link_tab, undefined);
  }

  // ── Storage path detection ───────────────────────────────────────────────
  check('storage path detected', isStoragePath('f1/photo.jpg'), true);
  check('https URL is not a storage path', isStoragePath('https://example.com/a.jpg'), false);
  check('data URI is not a storage path', isStoragePath('data:image/png;base64,abc'), false);

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
