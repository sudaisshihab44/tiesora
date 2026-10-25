import {
  Family,
  FamilyPerson,
  Relationship,
  Memory,
  FamilyEvent,
  FamilyMembership,
  ChangeRequest,
  AppNotification,
  AuditLog,
  UserProfile,
  Role,
  Invitation
} from '../types';
import { 
  SAMPLE_FAMILY, 
  SAMPLE_PEOPLE, 
  SAMPLE_RELATIONSHIPS, 
  SAMPLE_MEMORIES, 
  SAMPLE_EVENTS, 
  SAMPLE_MEMBERSHIPS, 
  SAMPLE_CHANGE_REQUESTS, 
  SAMPLE_NOTIFICATIONS, 
  SAMPLE_AUDIT_LOGS,
  CURRENT_USER
} from './sampleData';

const STORAGE_KEYS = {
  CURRENT_USER: 'kinroots_user_v1',
  FAMILIES: 'kinroots_families_v1',
  CURRENT_FAMILY_ID: 'kinroots_current_family_id_v1',
  PEOPLE: 'kinroots_people_v1',
  RELATIONSHIPS: 'kinroots_relationships_v1',
  MEMORIES: 'kinroots_memories_v1',
  EVENTS: 'kinroots_events_v1',
  MEMBERSHIPS: 'kinroots_memberships_v1',
  CHANGE_REQUESTS: 'kinroots_change_requests_v1',
  NOTIFICATIONS: 'kinroots_notifications_v1',
  AUDIT_LOGS: 'kinroots_audit_logs_v1',
  INVITATIONS: 'kinroots_invitations_v1',
};

class TiesoraStorage {
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initializeIfEmpty();
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error notifying storage listener:', err);
      }
    });
  }

  public resetToSampleData() {
    localStorage.removeItem(STORAGE_KEYS.FAMILIES);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_FAMILY_ID);
    localStorage.removeItem(STORAGE_KEYS.PEOPLE);
    localStorage.removeItem(STORAGE_KEYS.RELATIONSHIPS);
    localStorage.removeItem(STORAGE_KEYS.MEMORIES);
    localStorage.removeItem(STORAGE_KEYS.EVENTS);
    localStorage.removeItem(STORAGE_KEYS.MEMBERSHIPS);
    localStorage.removeItem(STORAGE_KEYS.CHANGE_REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.INVITATIONS);
    this.initializeIfEmpty(true);
    this.notify();
  }

  private initializeIfEmpty(force = false) {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || force) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(CURRENT_USER));
    }
    if (!localStorage.getItem(STORAGE_KEYS.FAMILIES) || force) {
      localStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify([SAMPLE_FAMILY]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_FAMILY_ID) || force) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_FAMILY_ID, SAMPLE_FAMILY.id);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PEOPLE) || force) {
      localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(SAMPLE_PEOPLE));
    }
    if (!localStorage.getItem(STORAGE_KEYS.RELATIONSHIPS) || force) {
      localStorage.setItem(STORAGE_KEYS.RELATIONSHIPS, JSON.stringify(SAMPLE_RELATIONSHIPS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MEMORIES) || force) {
      localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(SAMPLE_MEMORIES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.EVENTS) || force) {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(SAMPLE_EVENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS) || force) {
      localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(SAMPLE_MEMBERSHIPS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CHANGE_REQUESTS) || force) {
      localStorage.setItem(STORAGE_KEYS.CHANGE_REQUESTS, JSON.stringify(SAMPLE_CHANGE_REQUESTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || force) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(SAMPLE_NOTIFICATIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || force) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(SAMPLE_AUDIT_LOGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.INVITATIONS) || force) {
      localStorage.setItem(STORAGE_KEYS.INVITATIONS, JSON.stringify([]));
    }
  }

  // --- Auth & User Profile ---
  public getCurrentUser(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : CURRENT_USER;
    } catch {
      return CURRENT_USER;
    }
  }

  public updateCurrentUser(updates: Partial<UserProfile>): UserProfile {
    const user = { ...this.getCurrentUser(), ...updates };
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    this.notify();
    return user;
  }

  // --- Family ---
  public getFamilies(): Family[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAMILIES);
      return data ? JSON.parse(data) : [SAMPLE_FAMILY];
    } catch {
      return [SAMPLE_FAMILY];
    }
  }

  public getCurrentFamilyId(): string {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_FAMILY_ID) || SAMPLE_FAMILY.id;
  }

  public setCurrentFamilyId(id: string) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_FAMILY_ID, id);
    this.notify();
  }

  public getCurrentFamily(): Family {
    const families = this.getFamilies();
    const currentId = this.getCurrentFamilyId();
    return families.find(f => f.id === currentId) || families[0] || SAMPLE_FAMILY;
  }

  public createFamily(family: Omit<Family, 'id' | 'created_at' | 'updated_at'>): Family {
    const newFamily: Family = {
      ...family,
      id: `fam_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const families = [...this.getFamilies(), newFamily];
    localStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(families));
    this.setCurrentFamilyId(newFamily.id);

    // Add current user as owner membership
    const user = this.getCurrentUser();
    this.addMembership({
      family_id: newFamily.id,
      user_id: user.id,
      user_email: user.email,
      user_name: user.display_name,
      role: 'owner',
      status: 'active',
    });

    this.logAudit({
      family_id: newFamily.id,
      action: 'Created Family',
      target_type: 'family',
      target_id: newFamily.id,
      target_name: newFamily.name,
      details: 'Initialized family workspace.',
    });

    this.notify();
    return newFamily;
  }

  public updateFamily(familyId: string, updates: Partial<Family>): Family {
    const families = this.getFamilies().map(f => {
      if (f.id === familyId) {
        return { ...f, ...updates, updated_at: new Date().toISOString() };
      }
      return f;
    });
    localStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(families));
    this.notify();
    return this.getCurrentFamily();
  }

  // --- People ---
  public getPeople(familyId?: string): FamilyPerson[] {
    try {
      const fid = familyId || this.getCurrentFamilyId();
      const data = localStorage.getItem(STORAGE_KEYS.PEOPLE);
      const all: FamilyPerson[] = data ? JSON.parse(data) : SAMPLE_PEOPLE;
      return all.filter(p => p.family_id === fid);
    } catch {
      return SAMPLE_PEOPLE;
    }
  }

  public getPersonById(id: string): FamilyPerson | undefined {
    const people = this.getPeople();
    return people.find(p => p.id === id);
  }

  public addPerson(person: Omit<FamilyPerson, 'id' | 'created_at' | 'updated_at'>): FamilyPerson {
    const all = this.getAllPeopleRaw();
    const newPerson: FamilyPerson = {
      ...person,
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    all.push(newPerson);
    localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(all));

    this.logAudit({
      family_id: newPerson.family_id,
      action: 'Added Person',
      target_type: 'person',
      target_id: newPerson.id,
      target_name: newPerson.full_name,
      details: `Added ${newPerson.display_name} to generation ${newPerson.generation_level}.`,
    });

    this.notify();
    return newPerson;
  }

  public updatePerson(id: string, updates: Partial<FamilyPerson>): FamilyPerson {
    const all = this.getAllPeopleRaw().map(p => {
      if (p.id === id) {
        return { ...p, ...updates, updated_at: new Date().toISOString() };
      }
      return p;
    });
    localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(all));

    const updated = all.find(p => p.id === id)!;
    this.logAudit({
      family_id: updated.family_id,
      action: 'Updated Person',
      target_type: 'person',
      target_id: updated.id,
      target_name: updated.full_name,
      details: 'Updated profile record information.',
    });

    this.notify();
    return updated;
  }

  public deletePerson(id: string) {
    const target = this.getPersonById(id);
    const fid = target ? target.family_id : this.getCurrentFamilyId();

    const people = this.getAllPeopleRaw().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(people));

    // Remove relationships linked to this person
    const relationships = this.getAllRelationshipsRaw().filter(
      r => r.source_person_id !== id && r.target_person_id !== id
    );
    localStorage.setItem(STORAGE_KEYS.RELATIONSHIPS, JSON.stringify(relationships));

    if (target) {
      this.logAudit({
        family_id: fid,
        action: 'Deleted Person',
        target_type: 'person',
        target_id: id,
        target_name: target.full_name,
        details: 'Removed person and related connections.',
      });
    }

    this.notify();
  }

  private getAllPeopleRaw(): FamilyPerson[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PEOPLE);
      return data ? JSON.parse(data) : [...SAMPLE_PEOPLE];
    } catch {
      return [...SAMPLE_PEOPLE];
    }
  }

  // --- Relationships ---
  public getRelationships(familyId?: string): Relationship[] {
    try {
      const fid = familyId || this.getCurrentFamilyId();
      const data = localStorage.getItem(STORAGE_KEYS.RELATIONSHIPS);
      const all: Relationship[] = data ? JSON.parse(data) : SAMPLE_RELATIONSHIPS;
      return all.filter(r => r.family_id === fid);
    } catch {
      return SAMPLE_RELATIONSHIPS;
    }
  }

  public addRelationship(rel: Omit<Relationship, 'id' | 'created_at' | 'updated_at'>): Relationship {
    const all = this.getAllRelationshipsRaw();
    const newRel: Relationship = {
      ...rel,
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    all.push(newRel);
    localStorage.setItem(STORAGE_KEYS.RELATIONSHIPS, JSON.stringify(all));

    const source = this.getPersonById(newRel.source_person_id);
    const target = this.getPersonById(newRel.target_person_id);

    this.logAudit({
      family_id: newRel.family_id,
      action: 'Created Relationship',
      target_type: 'relationship',
      target_id: newRel.id,
      target_name: `${source?.display_name || 'Person A'} ➔ ${target?.display_name || 'Person B'}`,
      details: `Defined ${newRel.relationship_type} connection (${newRel.relationship_status}).`,
    });

    this.notify();
    return newRel;
  }

  public deleteRelationship(id: string) {
    const all = this.getAllRelationshipsRaw().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.RELATIONSHIPS, JSON.stringify(all));
    this.notify();
  }

  private getAllRelationshipsRaw(): Relationship[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RELATIONSHIPS);
      return data ? JSON.parse(data) : [...SAMPLE_RELATIONSHIPS];
    } catch {
      return [...SAMPLE_RELATIONSHIPS];
    }
  }

  // --- Memories ---
  public getMemories(familyId?: string): Memory[] {
    try {
      const fid = familyId || this.getCurrentFamilyId();
      const data = localStorage.getItem(STORAGE_KEYS.MEMORIES);
      const all: Memory[] = data ? JSON.parse(data) : SAMPLE_MEMORIES;
      return all.filter(m => m.family_id === fid);
    } catch {
      return SAMPLE_MEMORIES;
    }
  }

  public addMemory(memory: Omit<Memory, 'id' | 'created_at'>): Memory {
    const data = localStorage.getItem(STORAGE_KEYS.MEMORIES);
    const all: Memory[] = data ? JSON.parse(data) : [...SAMPLE_MEMORIES];
    const newMem: Memory = {
      ...memory,
      id: `mem_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    all.unshift(newMem);
    localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(all));

    this.logAudit({
      family_id: newMem.family_id,
      action: 'Added Family Memory',
      target_type: 'memory',
      target_id: newMem.id,
      target_name: newMem.title,
      details: `Added memory with ${newMem.tagged_person_ids.length} tagged relatives.`,
    });

    this.notify();
    return newMem;
  }

  public updateMemory(id: string, updates: Partial<Memory>): Memory | undefined {
    const data = localStorage.getItem(STORAGE_KEYS.MEMORIES);
    const all: Memory[] = data ? JSON.parse(data) : [...SAMPLE_MEMORIES];
    const index = all.findIndex(m => m.id === id);
    if (index === -1) return undefined;

    all[index] = { ...all[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(all));
    this.notify();
    return all[index];
  }

  public deleteMemory(id: string) {
    const data = localStorage.getItem(STORAGE_KEYS.MEMORIES);
    const all: Memory[] = data ? JSON.parse(data) : [...SAMPLE_MEMORIES];
    const filtered = all.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(filtered));
    this.notify();
  }

  // --- Events ---
  public getEvents(familyId?: string): FamilyEvent[] {
    try {
      const fid = familyId || this.getCurrentFamilyId();
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const all: FamilyEvent[] = data ? JSON.parse(data) : SAMPLE_EVENTS;
      return all.filter(e => e.family_id === fid);
    } catch {
      return SAMPLE_EVENTS;
    }
  }

  public addEvent(event: Omit<FamilyEvent, 'id' | 'created_at'>): FamilyEvent {
    const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const all: FamilyEvent[] = data ? JSON.parse(data) : [...SAMPLE_EVENTS];
    const newEvt: FamilyEvent = {
      ...event,
      id: `evt_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    all.push(newEvt);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(all));
    this.notify();
    return newEvt;
  }

  public updateEvent(id: string, updates: Partial<FamilyEvent>): FamilyEvent | undefined {
    const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const all: FamilyEvent[] = data ? JSON.parse(data) : [...SAMPLE_EVENTS];
    const index = all.findIndex(e => e.id === id);
    if (index === -1) return undefined;

    all[index] = { ...all[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(all));
    this.notify();
    return all[index];
  }

  public deleteEvent(id: string) {
    const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const all: FamilyEvent[] = data ? JSON.parse(data) : [...SAMPLE_EVENTS];
    const filtered = all.filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filtered));
    this.notify();
  }

  // --- Memberships & Roles ---
  public getMemberships(familyId?: string): FamilyMembership[] {
    try {
      const fid = familyId || this.getCurrentFamilyId();
      const data = localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS);
      const all: FamilyMembership[] = data ? JSON.parse(data) : SAMPLE_MEMBERSHIPS;
      return all.filter(m => m.family_id === fid);
    } catch {
      return SAMPLE_MEMBERSHIPS;
    }
  }

  public addMembership(membership: Omit<FamilyMembership, 'id' | 'created_at'>): FamilyMembership {
    const data = localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS);
    const all: FamilyMembership[] = data ? JSON.parse(data) : [...SAMPLE_MEMBERSHIPS];
    const newMem: FamilyMembership = {
      ...membership,
      id: `mem_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    all.push(newMem);
    localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(all));
    this.notify();
    return newMem;
  }

  public updateMemberRole(membershipId: string, newRole: Role) {
    const data = localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS);
    const all: FamilyMembership[] = data ? JSON.parse(data) : [...SAMPLE_MEMBERSHIPS];
    const updated = all.map(m => m.id === membershipId ? { ...m, role: newRole } : m);
    localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(updated));

    const target = all.find(m => m.id === membershipId);
    if (target) {
      this.logAudit({
        family_id: target.family_id,
        action: 'Updated Member Role',
        target_type: 'membership',
        target_id: target.id,
        target_name: target.user_name,
        details: `Assigned ${newRole} role to ${target.user_email}.`,
      });
    }

    this.notify();
  }

  public getUserRoleInFamily(userId: string, familyId: string): Role {
    const memberships = this.getMemberships(familyId);
    const member = memberships.find(m => m.user_id === userId);
    return member ? member.role : 'viewer';
  }

  // --- Invitations ---
  public getInvitations(familyId?: string): Invitation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INVITATIONS);
      const all: Invitation[] = data ? JSON.parse(data) : [];
      if (familyId) return all.filter(i => i.family_id === familyId);
      return all;
    } catch {
      return [];
    }
  }

  public addInvitation(inv: Omit<Invitation, 'id' | 'created_at'>): Invitation {
    const data = localStorage.getItem(STORAGE_KEYS.INVITATIONS);
    const all: Invitation[] = data ? JSON.parse(data) : [];
    const newInv: Invitation = {
      ...inv,
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    all.push(newInv);
    localStorage.setItem(STORAGE_KEYS.INVITATIONS, JSON.stringify(all));
    this.notify();
    return newInv;
  }

  public validateInvitation(token: string): Invitation | null {
    const all = this.getInvitations();
    const inv = all.find(i => i.token === token);
    if (!inv) return null;
    if (inv.accepted_at) return null; // already used
    if (inv.revoked_at) return null; // revoked
    const isExpired = new Date(inv.expires_at) < new Date();
    if (isExpired) return null;
    return inv;
  }

  public acceptInvitation(token: string, userId: string, userName: string): { success: boolean; familyId?: string; role?: Role; error?: string } {
    const inv = this.validateInvitation(token);
    if (!inv) return { success: false, error: 'Invalid or expired invitation token.' };

    // Mark invitation as accepted
    const data = localStorage.getItem(STORAGE_KEYS.INVITATIONS);
    const all: Invitation[] = data ? JSON.parse(data) : [];
    const idx = all.findIndex(i => i.token === token);
    if (idx >= 0) {
      all[idx].accepted_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.INVITATIONS, JSON.stringify(all));
    }

    // Create membership for the accepting user
    this.addMembership({
      family_id: inv.family_id,
      user_id: userId,
      user_email: inv.email,
      user_name: userName,
      role: inv.role,
      status: 'active',
    });

    this.logAudit({
      family_id: inv.family_id,
      action: 'Invitation Accepted',
      target_type: 'invitation',
      target_id: inv.id,
      target_name: inv.email,
      details: `${userName} joined as ${inv.role}.`,
    });

    this.notify();
    return { success: true, familyId: inv.family_id, role: inv.role };
  }

  // --- Change Requests (Collaboration approval workflow) ---
  public getChangeRequests(familyId?: string): ChangeRequest[] {
    try {
      const fid = familyId || this.getCurrentFamilyId();
      const data = localStorage.getItem(STORAGE_KEYS.CHANGE_REQUESTS);
      const all: ChangeRequest[] = data ? JSON.parse(data) : SAMPLE_CHANGE_REQUESTS;
      return all.filter(cr => cr.family_id === fid);
    } catch {
      return SAMPLE_CHANGE_REQUESTS;
    }
  }

  public submitChangeRequest(cr: Omit<ChangeRequest, 'id' | 'created_at' | 'status'>): ChangeRequest {
    const data = localStorage.getItem(STORAGE_KEYS.CHANGE_REQUESTS);
    const all: ChangeRequest[] = data ? JSON.parse(data) : [...SAMPLE_CHANGE_REQUESTS];
    const newCr: ChangeRequest = {
      ...cr,
      id: `cr_${Date.now()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    all.unshift(newCr);
    localStorage.setItem(STORAGE_KEYS.CHANGE_REQUESTS, JSON.stringify(all));

    // Notify family admins
    this.addNotification({
      user_id: 'usr_thomas_montgomery',
      family_id: newCr.family_id,
      type: 'change_request_submitted',
      title: 'New Edit Suggestion',
      message: `${newCr.requested_by_name} suggested a change to family records.`,
      link_tab: 'collaboration',
      is_read: false,
    });

    this.notify();
    return newCr;
  }

  public reviewChangeRequest(id: string, decision: 'approved' | 'rejected', reviewNote?: string) {
    const data = localStorage.getItem(STORAGE_KEYS.CHANGE_REQUESTS);
    const all: ChangeRequest[] = data ? JSON.parse(data) : [...SAMPLE_CHANGE_REQUESTS];
    const currentUser = this.getCurrentUser();

    const targetIndex = all.findIndex(cr => cr.id === id);
    if (targetIndex === -1) return;

    const cr = all[targetIndex];
    cr.status = decision;
    cr.reviewed_by = currentUser.display_name;
    cr.reviewed_at = new Date().toISOString();
    cr.review_note = reviewNote;

    // If approved and has payload for person edit
    if (decision === 'approved' && cr.person_id && cr.change_type === 'edit_person') {
      this.updatePerson(cr.person_id, cr.payload);
    }

    localStorage.setItem(STORAGE_KEYS.CHANGE_REQUESTS, JSON.stringify(all));

    this.logAudit({
      family_id: cr.family_id,
      action: `${decision === 'approved' ? 'Approved' : 'Rejected'} Change Request`,
      target_type: 'person',
      target_id: cr.person_id || cr.id,
      target_name: `Request by ${cr.requested_by_name}`,
      details: reviewNote || `Status changed to ${decision}.`,
    });

    this.notify();
  }

  // --- Notifications ---
  public getNotifications(userId?: string): AppNotification[] {
    try {
      const uid = userId || this.getCurrentUser().id;
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const all: AppNotification[] = data ? JSON.parse(data) : SAMPLE_NOTIFICATIONS;
      return all.filter(n => n.user_id === uid);
    } catch {
      return SAMPLE_NOTIFICATIONS;
    }
  }

  public addNotification(notif: Omit<AppNotification, 'id' | 'created_at'>): AppNotification {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const all: AppNotification[] = data ? JSON.parse(data) : [...SAMPLE_NOTIFICATIONS];
    const newNotif: AppNotification = {
      ...notif,
      id: `notif_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    all.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
    this.notify();
    return newNotif;
  }

  public markNotificationAsRead(id: string) {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const all: AppNotification[] = data ? JSON.parse(data) : [...SAMPLE_NOTIFICATIONS];
    const updated = all.map(n => n.id === id ? { ...n, is_read: true } : n);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
    this.notify();
  }

  public markAllNotificationsAsRead() {
    const uid = this.getCurrentUser().id;
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const all: AppNotification[] = data ? JSON.parse(data) : [...SAMPLE_NOTIFICATIONS];
    const updated = all.map(n => n.user_id === uid ? { ...n, is_read: true } : n);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
    this.notify();
  }

  // --- Audit Logs ---
  public getAuditLogs(familyId?: string): AuditLog[] {
    try {
      const fid = familyId || this.getCurrentFamilyId();
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const all: AuditLog[] = data ? JSON.parse(data) : SAMPLE_AUDIT_LOGS;
      return all.filter(a => a.family_id === fid);
    } catch {
      return SAMPLE_AUDIT_LOGS;
    }
  }

  private logAudit(entry: Omit<AuditLog, 'id' | 'created_at' | 'user_id' | 'user_name'>) {
    const user = this.getCurrentUser();
    const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    const all: AuditLog[] = data ? JSON.parse(data) : [...SAMPLE_AUDIT_LOGS];
    const log: AuditLog = {
      ...entry,
      id: `aud_${Date.now()}`,
      user_id: user.id,
      user_name: user.display_name,
      created_at: new Date().toISOString(),
    };
    all.unshift(log);
    // Keep last 100 entries
    if (all.length > 100) all.pop();
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(all));
  }

  // --- Export and Backup ---
  public exportFullFamilyJSON(familyId?: string): string {
    const fid = familyId || this.getCurrentFamilyId();
    const payload = {
      app: 'Tiesora',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      family: this.getCurrentFamily(),
      people: this.getPeople(fid),
      relationships: this.getRelationships(fid),
      memories: this.getMemories(fid),
      events: this.getEvents(fid),
      memberships: this.getMemberships(fid),
      audit_logs: this.getAuditLogs(fid),
    };
    return JSON.stringify(payload, null, 2);
  }

  public importFullFamilyJSON(
    jsonString: string,
    mode: 'restore' | 'import_as_new' = 'restore'
  ): {
    success: boolean;
    familyName: string;
    peopleCount: number;
    relationshipsCount: number;
    memoriesCount: number;
    error?: string;
  } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { success: false, familyName: '', peopleCount: 0, relationshipsCount: 0, memoriesCount: 0, error: 'Invalid JSON format.' };
      }

      // Check required family structure
      if (!data.family || !data.family.name || !Array.isArray(data.people)) {
        return { success: false, familyName: '', peopleCount: 0, relationshipsCount: 0, memoriesCount: 0, error: 'Backup is missing required family or people records.' };
      }

      const importedFamily: Family = { ...data.family };
      let targetFamilyId = importedFamily.id || `fam_${Date.now()}`;
      
      if (mode === 'import_as_new') {
        const newFamId = `fam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        importedFamily.id = newFamId;
        importedFamily.name = `${importedFamily.name} (Imported)`;
        targetFamilyId = newFamId;
      }

      // Map people
      const idMap = new Map<string, string>();
      const importedPeople: FamilyPerson[] = (data.people || []).map((p: FamilyPerson) => {
        let newPersonId = p.id;
        if (mode === 'import_as_new') {
          newPersonId = `p_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          idMap.set(p.id, newPersonId);
        }
        return {
          ...p,
          id: newPersonId,
          family_id: targetFamilyId,
        };
      });

      // Map relationships
      const importedRelationships: Relationship[] = (data.relationships || []).map((r: Relationship) => {
        let newRelId = r.id;
        const sourceId = mode === 'import_as_new' ? (idMap.get(r.source_person_id) || r.source_person_id) : r.source_person_id;
        const targetId = mode === 'import_as_new' ? (idMap.get(r.target_person_id) || r.target_person_id) : r.target_person_id;
        if (mode === 'import_as_new') {
          newRelId = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }
        return {
          ...r,
          id: newRelId,
          family_id: targetFamilyId,
          source_person_id: sourceId,
          target_person_id: targetId,
        };
      });

      // Map memories
      const importedMemories: Memory[] = (data.memories || []).map((m: Memory) => {
        let newMemId = m.id;
        const taggedIds = (m.tagged_person_ids || []).map(pid => mode === 'import_as_new' ? (idMap.get(pid) || pid) : pid);
        if (mode === 'import_as_new') {
          newMemId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }
        return {
          ...m,
          id: newMemId,
          family_id: targetFamilyId,
          tagged_person_ids: taggedIds,
        };
      });

      // Map events
      const importedEvents: FamilyEvent[] = (data.events || []).map((e: FamilyEvent) => {
        let newEvtId = e.id;
        const assocIds = (e.associated_person_ids || []).map(pid => mode === 'import_as_new' ? (idMap.get(pid) || pid) : pid);
        if (mode === 'import_as_new') {
          newEvtId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        }
        return {
          ...e,
          id: newEvtId,
          family_id: targetFamilyId,
          associated_person_ids: assocIds,
        };
      });

      // Map memberships
      const currentUser = this.getCurrentUser();
      let importedMemberships: FamilyMembership[] = (data.memberships || []).map((m: FamilyMembership) => ({
        ...m,
        id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        family_id: targetFamilyId,
      }));

      // Ensure current user is owner in imported memberships
      if (!importedMemberships.some(m => m.user_id === currentUser.id)) {
        importedMemberships.push({
          id: `mem_${Date.now()}_cur`,
          family_id: targetFamilyId,
          user_id: currentUser.id,
          user_email: currentUser.email,
          user_name: currentUser.display_name,
          role: 'owner',
          status: 'active',
          created_at: new Date().toISOString(),
        });
      }

      // 1. Update families
      const currentFamilies = this.getFamilies();
      const existingFamIndex = currentFamilies.findIndex(f => f.id === targetFamilyId);
      let updatedFamilies: Family[];
      if (existingFamIndex >= 0) {
        updatedFamilies = currentFamilies.map(f => f.id === targetFamilyId ? importedFamily : f);
      } else {
        updatedFamilies = [...currentFamilies, importedFamily];
      }
      localStorage.setItem(STORAGE_KEYS.FAMILIES, JSON.stringify(updatedFamilies));

      // 2. Update people (remove previous records for this target family if restoring, then append)
      const allPeople = this.getAllPeopleRaw().filter(p => p.family_id !== targetFamilyId);
      allPeople.push(...importedPeople);
      localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(allPeople));

      // 3. Update relationships
      const allRels = this.getAllRelationshipsRaw().filter(r => r.family_id !== targetFamilyId);
      allRels.push(...importedRelationships);
      localStorage.setItem(STORAGE_KEYS.RELATIONSHIPS, JSON.stringify(allRels));

      // 4. Update memories
      const allMemsRaw = localStorage.getItem(STORAGE_KEYS.MEMORIES);
      const allMems: Memory[] = allMemsRaw ? JSON.parse(allMemsRaw) : [];
      const filteredMems = allMems.filter(m => m.family_id !== targetFamilyId);
      filteredMems.push(...importedMemories);
      localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(filteredMems));

      // 5. Update events
      const allEvtsRaw = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const allEvts: FamilyEvent[] = allEvtsRaw ? JSON.parse(allEvtsRaw) : [];
      const filteredEvts = allEvts.filter(e => e.family_id !== targetFamilyId);
      filteredEvts.push(...importedEvents);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(filteredEvts));

      // 6. Update memberships
      const allMembRaw = localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS);
      const allMemb: FamilyMembership[] = allMembRaw ? JSON.parse(allMembRaw) : [];
      const filteredMemb = allMemb.filter(m => m.family_id !== targetFamilyId);
      filteredMemb.push(...importedMemberships);
      localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(filteredMemb));

      // Set as active family
      this.setCurrentFamilyId(targetFamilyId);

      this.logAudit({
        family_id: targetFamilyId,
        action: mode === 'restore' ? 'Restored Family Backup' : 'Imported New Family Tree',
        target_type: 'family',
        target_id: targetFamilyId,
        target_name: importedFamily.name,
        details: `Imported ${importedPeople.length} people, ${importedRelationships.length} relationships, ${importedMemories.length} memories.`,
      });

      this.notify();

      return {
        success: true,
        familyName: importedFamily.name,
        peopleCount: importedPeople.length,
        relationshipsCount: importedRelationships.length,
        memoriesCount: importedMemories.length,
      };
    } catch (err: any) {
      console.error('Failed to import JSON backup:', err);
      return {
        success: false,
        familyName: '',
        peopleCount: 0,
        relationshipsCount: 0,
        memoriesCount: 0,
        error: err.message || 'Failed to parse JSON file.',
      };
    }
  }
}

export const storage = new TiesoraStorage();
