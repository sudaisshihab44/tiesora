import type { Invitation, Role } from '../../types';
import { normalizeRole } from '../../types';
import { DbError, db, execute, queryMany, queryOne } from './core';
import { mapInvitation } from './mappers';
import type { InvitationRow } from './rows';

export interface ValidatedInvitation {
  familyId: string;
  familyName: string;
  role: Role;
}

export async function listInvitations(
  familyId: string,
): Promise<Invitation[]> {
  const rows = await queryMany<InvitationRow>(
    db()
      .from('invitations')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false }),
    'load invitations',
  );
  return rows.map(mapInvitation);
}

/** Creates an invitation via the SECURITY DEFINER RPC and returns its token. */
export async function createInvitationToken(
  familyId: string,
  email: string,
  role: Role,
  expiresInDays = 7,
): Promise<string> {
  const { data, error } = await db().rpc('create_invitation', {
    p_family_id: familyId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
    p_expires_in_days: expiresInDays,
  });

  if (error) throw new DbError('create invitation', error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.token) {
    throw new DbError('create invitation: the RPC did not return a token');
  }
  return row.token as string;
}

/** Read-only validation used by the join screen. */
export async function validateInvitationToken(
  token: string,
): Promise<ValidatedInvitation> {
  const { data, error } = await db().rpc('validate_invitation', {
    p_token: token,
  });

  if (error) throw new DbError('validate invitation', error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new DbError('Invalid, expired, or already-used invitation.');
  }

  return {
    familyId: row.family_id as string,
    familyName: row.family_name as string,
    role: normalizeRole(row.role as string),
  };
}

/** Accepts an invitation and creates the membership row server-side. */
export async function acceptInvitationToken(
  token: string,
  userId: string,
  email: string,
  userName: string,
): Promise<string> {
  const { data, error } = await db().rpc('accept_invitation', {
    p_token: token,
    p_user_id: userId,
    p_email: email,
    p_user_name: userName,
  });

  if (error) throw new DbError('accept invitation', error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.family_id) {
    throw new DbError('accept invitation: the RPC did not return a family id');
  }
  return row.family_id as string;
}

export async function revokeInvitation(
  invitationId: string,
): Promise<Invitation> {
  const updated = await queryOne<InvitationRow>(
    db()
      .from('invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invitationId)
      .select('*')
      .single(),
    'revoke invitation',
  );
  return mapInvitation(updated);
}

export async function deleteInvitation(invitationId: string): Promise<void> {
  await execute(
    db().from('invitations').delete().eq('id', invitationId),
    'delete invitation',
  );
}
