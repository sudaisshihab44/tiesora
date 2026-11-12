/**
 * Mode-aware write actions.
 *
 * Supabase configured -> the typed data layer.
 * Demo mode           -> the local sample storage.
 *
 * Components call these instead of `storage.*` directly. Read paths are owned
 * by App.tsx / the data provider; these functions only mutate.
 */
import type {
  ChangeRequest,
  Family,
  FamilyEvent,
  FamilyMembership,
  FamilyPerson,
  Invitation,
  Memory,
  Relationship,
  Role,
} from '../types';
import { isSupabaseConfigured } from './supabase';
import { storage } from './storage';
import * as db from './db';
import type {
  NewChangeRequest,
  NewEvent,
  NewFamily,
  NewMemory,
  NewPerson,
  NewRelationship,
  EventUpdates,
  MemoryUpdates,
  PersonUpdates,
  RelationshipUpdates,
} from './db';

export interface Actor {
  id: string;
  display_name: string;
}

const supabaseMode = () => isSupabaseConfigured;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ─── People ──────────────────────────────────────────────────────────────────
export async function createPersonAction(
  input: NewPerson,
  actor: Actor,
): Promise<FamilyPerson> {
  if (!supabaseMode()) {
    return storage.addPerson({ ...input, created_by: actor.id });
  }
  return db.createPerson(input, actor.id);
}

export async function updatePersonAction(
  personId: string,
  updates: PersonUpdates,
): Promise<FamilyPerson> {
  if (!supabaseMode()) {
    return storage.updatePerson(personId, updates);
  }
  return db.updatePerson(personId, updates);
}

export async function deletePersonAction(personId: string): Promise<void> {
  if (!supabaseMode()) {
    storage.deletePerson(personId);
    return;
  }
  await db.deletePerson(personId);
}

// ─── Relationships ───────────────────────────────────────────────────────────
export async function createRelationshipAction(
  input: NewRelationship,
  actor: Actor,
): Promise<Relationship> {
  if (!supabaseMode()) {
    return storage.addRelationship({ ...input, created_by: actor.id });
  }
  return db.createRelationship(input, actor.id);
}

export async function updateRelationshipAction(
  relationshipId: string,
  updates: RelationshipUpdates,
): Promise<Relationship> {
  if (!supabaseMode()) {
    // The local storage layer has no partial relationship update; delete and
    // recreate is not safe for IDs, so this path is only used in Supabase mode.
    throw new Error('Relationship editing is only available with Supabase.');
  }
  return db.updateRelationship(relationshipId, updates);
}

export async function deleteRelationshipAction(
  relationshipId: string,
): Promise<void> {
  if (!supabaseMode()) {
    storage.deleteRelationship(relationshipId);
    return;
  }
  await db.deleteRelationship(relationshipId);
}

// ─── Families ────────────────────────────────────────────────────────────────
export async function createFamilyAction(
  input: NewFamily,
  actor: Actor,
): Promise<Family> {
  if (!supabaseMode()) {
    return storage.createFamily({
      name: input.name,
      description: input.description,
      owner_id: actor.id,
      privacy_settings: {
        ...db.DEFAULT_PRIVACY_SETTINGS,
        ...input.privacy_settings,
      },
    });
  }
  return db.createFamilyWithAdmin(input);
}

export async function updateFamilyAction(
  familyId: string,
  updates: {
    name?: string;
    description?: string;
    privacy_settings?: Family['privacy_settings'];
  },
): Promise<Family> {
  if (!supabaseMode()) {
    return storage.updateFamily(familyId, updates);
  }
  return db.updateFamily(familyId, updates);
}

// ─── Memberships ─────────────────────────────────────────────────────────────
export async function updateMemberRoleAction(
  membershipId: string,
  role: Role,
): Promise<FamilyMembership | void> {
  if (!supabaseMode()) {
    storage.updateMemberRole(membershipId, role);
    return;
  }
  return db.updateMemberRole(membershipId, role);
}

export async function revokeMembershipAction(
  membershipId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!supabaseMode()) {
    return storage.revokeMembership(membershipId);
  }

  try {
    await db.revokeMembership(membershipId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Invitations ─────────────────────────────────────────────────────────────
export async function createInvitationAction(
  familyId: string,
  email: string,
  role: Role,
  expiresInDays = 7,
): Promise<string> {
  if (!supabaseMode()) {
    const token = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .substring(2, 14)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    storage.addInvitation({
      family_id: familyId,
      email,
      role,
      token,
      expires_at: expiresAt.toISOString(),
      created_by: storage.getCurrentUser().id,
    });
    return token;
  }
  return db.createInvitationToken(familyId, email, role, expiresInDays);
}

export async function validateInvitationAction(
  token: string,
): Promise<db.ValidatedInvitation> {
  if (!supabaseMode()) {
    const invitation = storage.validateInvitation(token);
    if (!invitation) {
      throw new db.DbError('Invalid or expired invitation.');
    }
    const family = storage.getFamilies().find((f) => f.id === invitation.family_id);
    return {
      familyId: invitation.family_id,
      familyName: family?.name ?? 'Your Family',
      role: invitation.role,
    };
  }
  return db.validateInvitationToken(token);
}

export async function acceptInvitationAction(
  token: string,
  actor: Actor & { email: string },
): Promise<string> {
  if (!supabaseMode()) {
    const result = storage.acceptInvitation(token, actor.id, actor.display_name);
    if (!result.success || !result.familyId) {
      throw new db.DbError(result.error ?? 'Could not accept invitation.');
    }
    return result.familyId;
  }
  return db.acceptInvitationToken(
    token,
    actor.id,
    actor.email,
    actor.display_name,
  );
}

export async function revokeInvitationAction(
  invitationId: string,
): Promise<Invitation> {
  if (!supabaseMode()) {
    throw new db.DbError('Revoking invitations is only available with Supabase.');
  }
  return db.revokeInvitation(invitationId);
}

// ─── Memories ────────────────────────────────────────────────────────────────
export async function createMemoryAction(
  input: NewMemory,
  actor: Actor,
): Promise<Memory> {
  if (!supabaseMode()) {
    return storage.addMemory({
      ...input,
      created_by: actor.id,
      created_by_name: actor.display_name,
    });
  }
  return db.createMemory(input, actor);
}

export async function updateMemoryAction(
  memoryId: string,
  updates: MemoryUpdates,
): Promise<Memory> {
  if (!supabaseMode()) {
    const updated = storage.updateMemory(memoryId, updates);
    if (!updated) throw new db.DbError('Memory not found.');
    return updated;
  }
  return db.updateMemory(memoryId, updates);
}

export async function deleteMemoryAction(memoryId: string): Promise<void> {
  if (!supabaseMode()) {
    storage.deleteMemory(memoryId);
    return;
  }
  await db.deleteMemory(memoryId);
}

export async function uploadFamilyPhotoAction(
  file: File,
  familyId: string,
): Promise<string> {
  if (!supabaseMode()) {
    return fileToDataUrl(file);
  }
  return db.uploadFamilyPhoto(file, familyId);
}

export async function getFamilyPhotoUrlAction(pathOrUrl: string): Promise<string> {
  if (!supabaseMode()) return pathOrUrl;
  return db.getFamilyPhotoUrl(pathOrUrl);
}

// ─── Events ──────────────────────────────────────────────────────────────────
export async function createEventAction(
  input: NewEvent,
  actor: Actor,
): Promise<FamilyEvent> {
  if (!supabaseMode()) {
    return storage.addEvent({ ...input, created_by: actor.id });
  }
  return db.createEvent(input, actor.id);
}

export async function updateEventAction(
  eventId: string,
  updates: EventUpdates,
): Promise<FamilyEvent> {
  if (!supabaseMode()) {
    const updated = storage.updateEvent(eventId, updates);
    if (!updated) throw new db.DbError('Event not found.');
    return updated;
  }
  return db.updateEvent(eventId, updates);
}

export async function deleteEventAction(eventId: string): Promise<void> {
  if (!supabaseMode()) {
    storage.deleteEvent(eventId);
    return;
  }
  await db.deleteEvent(eventId);
}

// ─── Change requests ─────────────────────────────────────────────────────────
export async function submitChangeRequestAction(
  input: NewChangeRequest,
  actor: Actor,
): Promise<ChangeRequest> {
  if (!supabaseMode()) {
    return storage.submitChangeRequest({
      ...input,
      requested_by: actor.id,
      requested_by_name: actor.display_name,
    });
  }
  return db.submitChangeRequest(input, actor);
}

export async function reviewChangeRequestAction(
  changeRequestId: string,
  decision: 'approved' | 'rejected',
  reviewNote: string | undefined,
  actor: Actor,
): Promise<ChangeRequest | void> {
  if (!supabaseMode()) {
    storage.reviewChangeRequest(changeRequestId, decision, reviewNote);
    return;
  }
  return db.reviewChangeRequest(changeRequestId, decision, reviewNote, actor);
}

// ─── Notifications ───────────────────────────────────────────────────────────
export async function markNotificationReadAction(
  notificationId: string,
): Promise<void> {
  if (!supabaseMode()) {
    storage.markNotificationAsRead(notificationId);
    return;
  }
  await db.markNotificationRead(notificationId);
}

export async function markAllNotificationsReadAction(
  userId: string,
): Promise<void> {
  if (!supabaseMode()) {
    storage.markAllNotificationsAsRead();
    return;
  }
  await db.markAllNotificationsRead(userId);
}
