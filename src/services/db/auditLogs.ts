import type { AuditLog } from '../../types';
import { db, queryMany, queryOne } from './core';
import { mapAuditLog } from './mappers';
import type { AuditLogRow } from './rows';

export type NewAuditLog = Omit<
  AuditLog,
  'id' | 'created_at' | 'user_id' | 'user_name' | 'target_id' | 'target_name'
> & {
  target_id?: string;
  target_name?: string;
};

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

/**
 * Best-effort audit write for the signed-in user. Never throws: a failed audit
 * entry must not discard a mutation that already succeeded.
 */
export async function recordAudit(input: NewAuditLog): Promise<void> {
  try {
    const { data } = await db().auth.getSession();
    const user = data.session?.user;
    if (!user) {
      console.warn('[audit] skipped — no signed-in user');
      return;
    }

    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    const displayName =
      (typeof metadata?.display_name === 'string' && metadata.display_name) ||
      (typeof metadata?.full_name === 'string' && metadata.full_name) ||
      user.email ||
      'Signed-in user';

    await logAudit(input, { id: user.id, display_name: displayName });
  } catch (error) {
    console.warn('[audit] could not write entry:', error);
  }
}
