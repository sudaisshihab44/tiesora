/**
 * Typed Supabase data layer.
 *
 * This is the future source of truth. Phase 3 switches the UI from
 * `services/storage.ts` to these async functions. Demo mode must branch to the
 * local sample provider before calling anything here.
 */

export * from './core';
export * from './mappers';
export * from './profiles';
export * from './families';
export * from './people';
export * from './relationships';
export * from './memories';
export * from './events';
export * from './memberships';
export * from './invitations';
export * from './changeRequests';
export * from './notifications';
export * from './auditLogs';
export * from './storage';
