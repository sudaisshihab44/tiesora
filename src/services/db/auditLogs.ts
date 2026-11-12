import type { AuditLog } from '../../types';
import { db, queryMany, queryOne } from './core';
import { mapAuditLog } from './mappers';
import type { AuditLogRow } from './rows';

export type NewAuditLog = Omit<
  AuditLog,
  'id' | 'created_at' | 'user_id' | 'user_name'
>;

export async function listAuditLogs(
  familyId: string,
  limit = 100,
): Promise<AuditLog[]> {
  const rows = await queryMany<AuditLogRow>(
    db()
      .from('audit_logs')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(limit),
    'load audit logs',
  );
  return rows.map(mapAuditLog);
}

export async function logAudit(
  input: NewAuditLog,
  actor: { id: string; display_name: string },
): Promise<AuditLog> {
  const row = {
    family_id: input.family_id,
    user_id: actor.id,
    user_name: actor.display_name,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id || null,
    target_name: input.target_name || null,
    details: input.details?.trim() || null,
  };

  const created = await queryOne<AuditLogRow>(
    db().from('audit_logs').insert(row).select('*').single(),
    'write audit log',
  );
  return mapAuditLog(created);
}
