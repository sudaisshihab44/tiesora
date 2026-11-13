/**
 * Tiesora Types & Data Models
 * Grounded in the 11-table relational architecture
 */

/**
 * Exactly two roles are supported:
 *   admin  — full management: add/edit people, manage memberships, invite users
 *   viewer — read-only: browse tree, search, view memories & events
 *
 * Legacy roles (owner, editor, contributor) are migrated → admin by the
 * 20261026_admin_viewer_roles.sql migration and normalized in storage.ts.
 */
export type Role = 'admin' | 'viewer';

/** @deprecated Use Role ('admin' | 'viewer') instead. Kept for migration compatibility. */
export type LegacyRole = 'owner' | 'admin' | 'editor' | 'contributor' | 'viewer';

/** Normalize any legacy role value to the new two-role system. */
export function normalizeRole(role: string): Role {
  if (role === 'viewer') return 'viewer';
  // owner, admin, editor, contributor → admin
  return 'admin';
}

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
  status: 'active' | 'invited' | 'pending' | 'suspended';
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
  target_type:
    | 'person'
    | 'relationship'
    | 'memory'
    | 'membership'
    | 'family'
    | 'invitation'
    | 'event'
    | 'change_request';
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

// ─── Auth routing views ───────────────────────────────────────────────────────

/**
 * Dedicated auth page views rendered outside the main app shell.
 * App.tsx uses this to render the correct standalone page.
 */
export type AuthView =
  | 'landing'            // public landing page
  | 'signin'             // sign-in page
  | 'signup'             // sign-up / create account page
  | 'verify-email'       // post-signup "check your inbox" screen (email confirmation ON)
  | 'onboarding-choice'  // after signup: "Create a Family" vs "Join a Family"
  | 'join-family'        // invitation code / link entry for new viewers
  | 'reset-password'     // password-reset form (token in URL hash)
  | 'app';               // authenticated app shell

// ─── Permission helpers ───────────────────────────────────────────────────────

/** Returns true when the role grants admin-level access. */
export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'admin';
}

/** Returns true when the user has any family membership. */
export function isMember(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'viewer';
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF IMPORT SYSTEM TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ImportJobStatus = 
  | 'uploaded'       // PDF uploaded, not yet processed
  | 'processing'     // AI analysis in progress
  | 'processed'      // Analysis complete, awaiting review
  | 'reviewing'      // Admin is reviewing extracted data
  | 'approved'       // Admin approved, ready to import
  | 'importing'      // Import transaction in progress
  | 'completed'      // Successfully imported to family tree
  | 'failed'         // Processing or import failed
  | 'cancelled';     // Cancelled by admin

export type VerificationStatus = 
  | 'verified'       // Admin confirmed correct
  | 'needs_review'   // Requires admin review
  | 'uncertain'      // Low confidence or ambiguous
  | 'duplicate'      // Potential duplicate of existing person
  | 'rejected';      // Admin marked as incorrect

export type ConflictType = 
  | 'duplicate_person'
  | 'contradictory_dates'
  | 'contradictory_parentage'
  | 'multiple_spouses_unclear'
  | 'missing_parent'
  | 'circular_relationship'
  | 'generation_mismatch';

export type ExtractionMethod = 'text' | 'ocr' | 'vision' | 'hybrid';

export interface FamilyImportJob {
  id: string;
  family_id: string;
  uploaded_by: string;
  
  // File metadata
  file_name: string;
  file_size_bytes: number;
  file_path: string;
  mime_type: string;
  page_count?: number;
  
  // Processing status
  status: ImportJobStatus;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_error?: string;
  
  // Extraction summary
  extracted_person_count: number;
  extracted_relationship_count: number;
  verified_person_count: number;
  uncertain_person_count: number;
  duplicate_person_count: number;
  
  // Review and approval
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  
  // Import completion
  imported_at?: string;
  imported_person_count: number;
  imported_relationship_count: number;
  
  created_at: string;
  updated_at: string;
}

export interface FamilyImportPage {
  id: string;
  import_job_id: string;
  page_number: number;
  
  // Extracted content
  extracted_text?: string;
  ocr_text?: string;
  
  // AI analysis results
  analysis_result?: any;
  extraction_method?: ExtractionMethod;
  
  // Processing metadata
  processed_at?: string;
  processing_duration_ms?: number;
  error_message?: string;
  
  created_at: string;
}

export interface ExtractedFamilyMember {
  id: string;
  import_job_id: string;
  family_id: string;
  
  // Extracted person data
  full_name: string;
  display_name?: string;
  gender?: Gender;
  birth_date?: string;
  birth_year?: number;
  birth_place?: string;
  death_date?: string;
  death_year?: number;
  death_place?: string;
  living_status?: LivingStatus;
  biography?: string;
  
  // Genealogy-specific fields
  generation_label?: string; // 'A', 'B', 'C' or 'I', 'II', 'III'
  generation_level?: number;
  branch?: string;
  child_number?: number; // Position among siblings
  
  // Source and confidence
  source_page_numbers: number[];
  source_text?: string;
  confidence_score?: number; // 0.0 to 1.0
  
  // Verification status
  verification_status: VerificationStatus;
  
  // Duplicate detection
  potential_duplicate_of?: string;
  duplicate_confidence?: number;
  
  // Admin edits
  admin_edited: boolean;
  admin_notes?: string;
  
  // Import tracking
  imported: boolean;
  imported_person_id?: string;
  imported_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface ExtractedRelationship {
  id: string;
  import_job_id: string;
  family_id: string;
  
  // Links to extracted members
  source_extracted_id?: string;
  target_extracted_id?: string;
  
  // Relationship data
  relationship_type: RelationshipType | 'child' | 'sibling' | 'adopted_child';
  
  // Marriage/relationship details
  marriage_date?: string;
  marriage_year?: number;
  marriage_place?: string;
  divorce_date?: string;
  relationship_notes?: string;
  
  // Special cases
  is_adoptive: boolean;
  spouse_number?: number; // 1st wife, 2nd wife, etc.
  
  // Source and confidence
  source_page_numbers: number[];
  source_text?: string;
  confidence_score?: number;
  
  // Verification status
  verification_status: VerificationStatus | 'conflicting';
  
  admin_edited: boolean;
  admin_notes?: string;
  
  // Import tracking
  imported: boolean;
  imported_relationship_id?: string;
  imported_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface ImportConflict {
  id: string;
  import_job_id: string;
  conflict_type: ConflictType;
  
  // Involved records
  extracted_member_ids: string[];
  extracted_relationship_ids: string[];
  
  description: string;
  evidence_pages: number[];
  evidence_text?: string;
  
  // Resolution
  resolution_status: 'pending' | 'resolved' | 'ignored';
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  
  created_at: string;
}

export interface ImportReviewHistory {
  id: string;
  import_job_id: string;
  reviewed_by: string;
  
  action: 
    | 'person_edited'
    | 'person_verified'
    | 'person_rejected'
    | 'person_merged'
    | 'relationship_edited'
    | 'relationship_verified'
    | 'relationship_rejected'
    | 'conflict_resolved'
    | 'job_approved'
    | 'job_cancelled';
  
  target_type?: 'person' | 'relationship' | 'conflict' | 'job';
  target_id?: string;
  
  changes?: any; // Before/after values
  notes?: string;
  
  created_at: string;
}

