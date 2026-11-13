import type {
  AppNotification,
  AuditLog,
  ChangeRequest,
  Family,
  FamilyEvent,
  FamilyMembership,
  FamilyPerson,
  Memory,
  Relationship,
  Role,
  UserProfile,
} from '../types';
import {
  SAMPLE_AUDIT_LOGS,
  SAMPLE_CHANGE_REQUESTS,
  SAMPLE_EVENTS,
  SAMPLE_FAMILY,
  SAMPLE_MEMBERSHIPS,
  SAMPLE_MEMORIES,
  SAMPLE_NOTIFICATIONS,
  SAMPLE_PEOPLE,
  SAMPLE_RELATIONSHIPS,
} from './sampleData';

/**
 * Public demo identity. It never maps to a real Supabase profile and is always
 * a viewer, so every write path in the UI is hidden.
 */
export const DEMO_USER: UserProfile = {
  id: 'usr_demo_visitor',
  email: 'demo@tiesora.app',
  display_name: 'Demo Visitor',
  preferred_language: 'en',
  created_at: '2025-01-15T10:00:00Z',
};

export const DEMO_ROLE: Role = 'viewer';

export interface DemoSandboxData {
  family: Family;
  people: FamilyPerson[];
  relationships: Relationship[];
  memories: Memory[];
  events: FamilyEvent[];
  memberships: FamilyMembership[];
  changeRequests: ChangeRequest[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
}

/**
 * In-memory snapshot for the public demo. Nothing here is persisted, and the
 * Supabase data layer refuses to run while the sandbox is active.
 */
export function getDemoSandbox(): DemoSandboxData {
  return {
    family: SAMPLE_FAMILY,
    people: SAMPLE_PEOPLE,
    relationships: SAMPLE_RELATIONSHIPS,
    memories: SAMPLE_MEMORIES,
    events: SAMPLE_EVENTS,
    memberships: SAMPLE_MEMBERSHIPS,
    changeRequests: SAMPLE_CHANGE_REQUESTS,
    notifications: SAMPLE_NOTIFICATIONS,
    auditLogs: SAMPLE_AUDIT_LOGS,
  };
}

// Module-level flag used by the Supabase data layer as a hard stop.
let demoActive = false;

export function setDemoSandboxActive(value: boolean): void {
  demoActive = value;
}

export function isDemoSandboxActive(): boolean {
  return demoActive;
}
