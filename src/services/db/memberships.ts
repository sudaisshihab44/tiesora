import type { FamilyMembership, Role } from '../../types';
import { normalizeRole } from '../../types';
import { db, execute, queryMany, queryOne } from './core';
import { recordAudit } from './auditLogs';
import { mapMembership } from './mappers';
import type { MembershipRow } from './rows';

export async function listMemberships(
  familyId: string,
): Promise<FamilyMembership[]> {
  const rows = await queryMany<MembershipRow>(
    db()
      .from('family_memberships')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true }),
    'load memberships',
  );
  return rows.map(mapMembership);
}

/** Memberships for the signed-in user. Used by the family switcher. */
export async function getMyMemberships(
  userId: string,
  activeOnly = true,
): Promise<FamilyMembership[]> {
  let query = db()
    .from('family_memberships')
    .select('*')
    .eq('user_id', userId);

  if (activeOnly) {
    query = query.eq('status', 'active');
  }

  const rows = await queryMany<MembershipRow>(
    query.order('created_at', { ascending: true }),
    'load my memberships',
  );
  return rows.map(mapMembership);
}

export async function getMembershipForFamily(
  userId: string,
  familyId: string,
): Promise<FamilyMembership | null> {
  const rows = await queryMany<MembershipRow>(
    db()
      .from('family_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('family_id', familyId)
      .limit(1),
    'load membership',
  );
  return rows.length > 0 ? mapMembership(rows[0]) : null;
}

export async function getUserRoleInFamily(
  userId: string,
  familyId: string,
): Promise<Role | null> {
  const membership = await getMembershipForFamily(userId, familyId);
  return membership ? normalizeRole(membership.role) : null;
}

/**
 * Promotes/demotes a member. The DB trigger `ensure_family_has_admin` rejects
 * demoting the last administrator, so the UI can rely on the thrown DbError.
 */
export async function updateMemberRole(
  membershipId: string,
  role: Role,
): Promise<FamilyMembership> {
  const updated = await queryOne<MembershipRow>(
    db()
      .from('family_memberships')
      .update({ role })
      .eq('id', membershipId)
      .select('*')
      .single(),
    'update member role',
  );
  const membership = mapMembership(updated);

  await recordAudit({
    family_id: membership.family_id,
    action: 'changed member role',
    target_type: 'membership',
    target_id: membership.id,
    target_name: membership.user_name || membership.user_email,
    details: `Role changed to ${membership.role}.`,
  });

  return membership;
}

/** Revokes access without deleting the audit trail. */
export async function revokeMembership(
  membershipId: string,
): Promise<FamilyMembership> {
  const updated = await queryOne<MembershipRow>(
    db()
      .from('family_memberships')
      .update({ status: 'suspended' })
      .eq('id', membershipId)
      .select('*')
      .single(),
    'revoke membership',
  );
  const membership = mapMembership(updated);

  await recordAudit({
    family_id: membership.family_id,
    action: 'revoked member access',
    target_type: 'membership',
    target_id: membership.id,
    target_name: membership.user_name || membership.user_email,
    details: `Suspended ${membership.user_name || membership.user_email}'s access.`,
  });

  return membership;
}

export async function deleteMembership(membershipId: string): Promise<void> {
  const current = await queryOne<MembershipRow>(
    db()
      .from('family_memberships')
      .select('*')
      .eq('id', membershipId)
      .single(),
    'load membership',
  );

  await execute(
    db().from('family_memberships').delete().eq('id', membershipId),
    'delete membership',
  );

  await recordAudit({
    family_id: current.family_id,
    action: 'deleted membership',
    target_type: 'membership',
    target_id: membershipId,
    target_name: current.user_name || current.user_email || 'Former member',
    details: `Removed the membership for ${current.user_name || current.user_email || 'a family member'}.`,
  });
}
