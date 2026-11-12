/**
 * Database row shapes.
 *
 * These mirror the Postgres columns after
 * `supabase/migrations/20261112_supabase_source_of_truth.sql`.
 * Keep nullable DB columns as `T | null` and convert to the app's optional
 * fields in `mappers.ts`.
 */

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  full_name: string | null;
  avatar_path: string | null;
  preferred_language: string | null;
  email_verified: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyRow {
  id: string;
  name: string;
  description: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  owner_id: string;
  privacy_settings: unknown;
  created_at: string;
  updated_at: string;
}

export interface MembershipRow {
  id: string;
  family_id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PersonRow {
  id: string;
  family_id: string;
  full_name: string;
  display_name: string;
  gender: string | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  death_place: string | null;
  date_precision: string | null;
  living_status: string | null;
  biography: string | null;
  avatar_path: string | null;
  generation_level: number;
  branch: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelationshipRow {
  id: string;
  family_id: string;
  source_person_id: string;
  target_person_id: string;
  relationship_type: string;
  relationship_status: string;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
  created_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvitationRow {
  id: string;
  family_id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_by: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ChangeRequestRow {
  id: string;
  family_id: string;
  person_id: string | null;
  requested_by: string;
  requested_by_name: string | null;
  change_type: string;
  payload: unknown;
  status: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface MemoryRow {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  memory_date: string | null;
  location: string | null;
  image_url: string;
  tagged_person_ids: string[] | null;
  album: string | null;
  is_private: boolean | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  family_id: string;
  title: string;
  event_type: string;
  event_date: string;
  location: string | null;
  description: string | null;
  associated_person_ids: string[] | null;
  created_by: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  family_id: string | null;
  type: string;
  title: string;
  message: string;
  link_tab: string | null;
  link_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  family_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  created_at: string;
}
