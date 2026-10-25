/**
 * Tiesora Types & Data Models
 * Grounded in the 11-table relational architecture
 */

export type Role = 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer';

export type RelationshipType = 
  | 'parent'          // source is parent of target
  | 'child'           // source is child of target
  | 'spouse'          // source and target are spouses/partners
  | 'adoptive_parent' // source is adoptive parent of target
  | 'step_parent'     // source is step-parent of target
  | 'partner'         // domestic partners
  | 'guardian';       // legal guardian

export type RelationshipStatus = 'verified' | 'disputed' | 'unverified';

export type Gender = 'male' | 'female' | 'other' | 'unspecified';

export type LivingStatus = 'living' | 'deceased' | 'unknown';

export type DatePrecision = 'exact' | 'about' | 'estimated' | 'unknown';

export interface PrivacySettings {
  hideLivingDates: boolean;
  hideLivingBiographies: boolean;
  hidePrivateMemories: boolean;
  requireAdminApprovalForEdits: boolean;
  isPubliclySearchable: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_path?: string;
  preferred_language: string;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  description?: string;
  avatar_path?: string;
  cover_path?: string;
  owner_id: string;
  privacy_settings: PrivacySettings;
  created_at: string;
  updated_at: string;
}

export interface FamilyMembership {
  id: string;
  family_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role: Role;
  status: 'active' | 'invited' | 'pending';
  created_at: string;
}

export interface FamilyPerson {
  id: string;
  family_id: string;
  full_name: string;
  display_name: string;
  gender: Gender;
  birth_date?: string; // YYYY-MM-DD or YYYY
  birth_place?: string;
  death_date?: string; // YYYY-MM-DD or YYYY
  death_place?: string;
  date_precision: DatePrecision;
  living_status: LivingStatus;
  biography?: string;
  avatar_path?: string;
  generation_level: number; // 1 for great-grandparents, 2 for grandparents, etc.
  branch?: string; // e.g. "Paternal", "Maternal", etc.
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Relationship {
  id: string;
  family_id: string;
  source_person_id: string; // The parent / spouse A
  target_person_id: string; // The child / spouse B
  relationship_type: RelationshipType;
  relationship_status: RelationshipStatus;
  valid_from?: string; // e.g. marriage date
  valid_to?: string;   // e.g. divorce date or null
  notes?: string;
  created_by: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  family_id: string;
  email: string;
  role: Role;
  token: string;
  expires_at: string;
  created_by: string;
  accepted_at?: string;
  revoked_at?: string;
  created_at: string;
}

export interface ChangeRequest {
  id: string;
  family_id: string;
  person_id?: string;
  requested_by: string;
  requested_by_name: string;
  change_type: 'add_person' | 'edit_person' | 'delete_person' | 'add_relationship' | 'edit_relationship';
  payload: any;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface Memory {
  id: string;
  family_id: string;
  title: string;
  description?: string;
  memory_date?: string;
  location?: string;
  image_url: string;
  tagged_person_ids: string[];
  album?: string;
  is_private: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface FamilyEvent {
  id: string;
  family_id: string;
  title: string;
  event_type: 'birthday' | 'anniversary' | 'reunion' | 'memorial' | 'gathering' | 'other';
  event_date: string; // YYYY-MM-DD
  location?: string;
  description?: string;
  associated_person_ids: string[];
  created_by: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  family_id: string;
  type: 
    | 'invitation'
    | 'change_request_submitted'
    | 'change_request_approved'
    | 'change_request_rejected'
    | 'birthday_reminder'
    | 'event_reminder'
    | 'new_memory';
  title: string;
  message: string;
  link_tab?: string;
  link_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  family_id: string;
  user_id: string;
  user_name: string;
  action: string;
  target_type: 'person' | 'relationship' | 'memory' | 'membership' | 'family' | 'invitation';
  target_id: string;
  target_name: string;
  details?: string;
  created_at: string;
}

// Tree view specific types
export type TreeViewMode = 'tree' | 'ancestors' | 'descendants' | 'list';

export interface TreeCoordinateNode {
  person: FamilyPerson;
  x: number;
  y: number;
  parents: FamilyPerson[];
  spouses: FamilyPerson[];
  children: FamilyPerson[];
  collapsed?: boolean;
}

// Relationship Engine types
export interface CalculatedRelationship {
  sourcePerson: FamilyPerson;
  targetPerson: FamilyPerson;
  primaryLabel: string;
  pathDescription: string;
  sharedAncestors: FamilyPerson[];
  pathNodes: FamilyPerson[];
  pathEdgeDescriptions: string[];
  alternativeInterpretations?: string[];
  confidence: 'verified' | 'inferred' | 'ambiguous';
  relationshipCategory: 
    | 'self'
    | 'parent'
    | 'child'
    | 'sibling'
    | 'half_sibling'
    | 'grandparent'
    | 'grandchild'
    | 'great_grandparent'
    | 'great_grandchild'
    | 'aunt_uncle'
    | 'niece_nephew'
    | 'first_cousin'
    | 'first_cousin_once_removed'
    | 'second_cousin'
    | 'spouse'
    | 'in_law'
    | 'step'
    | 'adoptive'
    | 'distant'
    | 'disconnected';
}
