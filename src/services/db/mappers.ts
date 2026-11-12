import type {
  AppNotification,
  AuditLog,
  ChangeRequest,
  DatePrecision,
  Family,
  FamilyEvent,
  FamilyMembership,
  FamilyPerson,
  Gender,
  Invitation,
  LivingStatus,
  Memory,
  PrivacySettings,
  Relationship,
  RelationshipType,
  Role,
  UserProfile,
} from '../../types';
import { normalizeRole } from '../../types';
import type {
  AuditLogRow,
  ChangeRequestRow,
  EventRow,
  FamilyRow,
  InvitationRow,
  MembershipRow,
  MemoryRow,
  NotificationRow,
  PersonRow,
  ProfileRow,
  RelationshipRow,
} from './rows';

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  hideLivingDates: false,
  hideLivingBiographies: false,
  hidePrivateMemories: false,
  requireAdminApprovalForEdits: true,
  isPubliclySearchable: false,
};

const GENDERS: readonly Gender[] = ['male', 'female', 'other', 'unspecified'];
const DATE_PRECISIONS: readonly DatePrecision[] = [
  'exact',
  'about',
  'estimated',
  'unknown',
];
const LIVING_STATUSES: readonly LivingStatus[] = ['living', 'deceased', 'unknown'];
const MEMBERSHIP_STATUSES: readonly FamilyMembership['status'][] = [
  'active',
  'invited',
  'pending',
  'suspended',
];
const CHANGE_STATUSES: readonly ChangeRequest['status'][] = [
  'pending',
  'approved',
  'rejected',
];

export function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Converts an app date to a Postgres DATE.
 * - "1942"        -> "1942-01-01" (date_precision carries the uncertainty)
 * - "1942-03-04"  -> unchanged
 * - ISO timestamp -> date portion
 * - "" / invalid  -> null
 */
export function toDbDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** Converts a Postgres DATE to the app's optional string shape. */
export function fromDbDate(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

export function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    avatar_path: row.avatar_path ?? undefined,
    preferred_language: row.preferred_language ?? 'en',
    created_at: row.created_at,
  };
}

export function mapFamily(row: FamilyRow): Family {
  const raw =
    row.privacy_settings && typeof row.privacy_settings === 'object'
      ? (row.privacy_settings as Partial<PrivacySettings>)
      : {};

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    avatar_path: row.avatar_path ?? undefined,
    cover_path: row.cover_path ?? undefined,
    owner_id: row.owner_id,
    privacy_settings: {
      hideLivingDates: raw.hideLivingDates ?? false,
      hideLivingBiographies: raw.hideLivingBiographies ?? false,
      hidePrivateMemories: raw.hidePrivateMemories ?? false,
      requireAdminApprovalForEdits:
        raw.requireAdminApprovalForEdits ?? true,
      isPubliclySearchable: raw.isPubliclySearchable ?? false,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapPerson(row: PersonRow): FamilyPerson {
  return {
    id: row.id,
    family_id: row.family_id,
    full_name: row.full_name,
    display_name: row.display_name,
    gender: oneOf(row.gender, GENDERS, 'unspecified'),
    birth_date: fromDbDate(row.birth_date),
    birth_place: row.birth_place ?? undefined,
    death_date: fromDbDate(row.death_date),
    death_place: row.death_place ?? undefined,
    date_precision: oneOf(row.date_precision, DATE_PRECISIONS, 'unknown'),
    living_status: oneOf(row.living_status, LIVING_STATUSES, 'unknown'),
    biography: row.biography ?? undefined,
    avatar_path: row.avatar_path ?? undefined,
    generation_level: row.generation_level ?? 1,
    branch: row.branch ?? undefined,
    created_by: row.created_by ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id,
    family_id: row.family_id,
    source_person_id: row.source_person_id,
    target_person_id: row.target_person_id,
    relationship_type: row.relationship_type as RelationshipType,
    relationship_status: oneOf(
      row.relationship_status,
      ['verified', 'disputed', 'unverified'] as const,
      'unverified',
    ),
    valid_from: fromDbDate(row.valid_from),
    valid_to: fromDbDate(row.valid_to),
    notes: row.notes ?? undefined,
    created_by: row.created_by ?? '',
    verified_at: row.verified_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapMembership(row: MembershipRow): FamilyMembership {
  return {
    id: row.id,
    family_id: row.family_id,
    user_id: row.user_id,
    user_email: row.user_email ?? '',
    user_name: row.user_name ?? '',
    role: normalizeRole(row.role) as Role,
    status: oneOf(row.status, MEMBERSHIP_STATUSES, 'active'),
    created_at: row.created_at,
  };
}

export function mapInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    family_id: row.family_id,
    email: row.email,
    role: normalizeRole(row.role),
    token: row.token,
    expires_at: row.expires_at,
    created_by: row.created_by,
    accepted_at: row.accepted_at ?? undefined,
    revoked_at: row.revoked_at ?? undefined,
    created_at: row.created_at,
  };
}

export function mapChangeRequest(row: ChangeRequestRow): ChangeRequest {
  return {
    id: row.id,
    family_id: row.family_id,
    person_id: row.person_id ?? undefined,
    requested_by: row.requested_by,
    requested_by_name: row.requested_by_name ?? '',
    change_type: row.change_type as ChangeRequest['change_type'],
    payload: row.payload,
    status: oneOf(row.status, CHANGE_STATUSES, 'pending'),
    review_note: row.review_note ?? undefined,
    reviewed_by: row.reviewed_by ?? undefined,
    reviewed_at: row.reviewed_at ?? undefined,
    created_at: row.created_at,
  };
}

export function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    family_id: row.family_id,
    title: row.title,
    description: row.description ?? undefined,
    memory_date: fromDbDate(row.memory_date),
    location: row.location ?? undefined,
    image_url: row.image_url,
    tagged_person_ids: row.tagged_person_ids ?? [],
    album: row.album ?? undefined,
    is_private: row.is_private ?? false,
    created_by: row.created_by,
    created_by_name: row.created_by_name ?? '',
    created_at: row.created_at,
  };
}

export function mapEvent(row: EventRow): FamilyEvent {
  return {
    id: row.id,
    family_id: row.family_id,
    title: row.title,
    event_type: row.event_type as FamilyEvent['event_type'],
    event_date: row.event_date,
    location: row.location ?? undefined,
    description: row.description ?? undefined,
    associated_person_ids: row.associated_person_ids ?? [],
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    user_id: row.user_id,
    family_id: row.family_id ?? '',
    type: row.type as AppNotification['type'],
    title: row.title,
    message: row.message,
    link_tab: row.link_tab ?? undefined,
    link_id: row.link_id ?? undefined,
    is_read: row.is_read,
    created_at: row.created_at,
  };
}

export function mapAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    family_id: row.family_id,
    user_id: row.user_id ?? '',
    user_name: row.user_name ?? '',
    action: row.action,
    target_type: row.target_type as AuditLog['target_type'],
    target_id: row.target_id ?? '',
    target_name: row.target_name ?? '',
    details: row.details ?? undefined,
    created_at: row.created_at,
  };
}

// ─── Write-side normalisation ────────────────────────────────────────────────

export type DbRelationshipType = Exclude<RelationshipType, 'child'>;

/**
 * The database stores parent→child edges. The app also has a 'child' type
 * (meaning "the new person is the current person's child"). Swap the
 * endpoints and store a canonical 'parent' edge.
 */
export function normalizeRelationshipEndpoints(input: {
  source_person_id: string;
  target_person_id: string;
  relationship_type: RelationshipType;
}): {
  source_person_id: string;
  target_person_id: string;
  relationship_type: DbRelationshipType;
} {
  if (input.relationship_type === 'child') {
    return {
      source_person_id: input.target_person_id,
      target_person_id: input.source_person_id,
      relationship_type: 'parent',
    };
  }

  return {
    source_person_id: input.source_person_id,
    target_person_id: input.target_person_id,
    relationship_type: input.relationship_type as DbRelationshipType,
  };
}

/** True for storage object paths, false for external URLs / data URIs. */
export function isStoragePath(value: string): boolean {
  return Boolean(value) && !/^(https?:|data:|blob:)/i.test(value);
}
