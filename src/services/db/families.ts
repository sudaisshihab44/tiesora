import type { Family, PrivacySettings } from '../../types';
import { DbError, db, defined, execute, queryMany, queryOne } from './core';
import { recordAudit } from './auditLogs';
import { DEFAULT_PRIVACY_SETTINGS, mapFamily } from './mappers';
import type { FamilyRow } from './rows';

export interface NewFamily {
  name: string;
  description?: string;
  privacy_settings?: Partial<PrivacySettings>;
}

export async function listFamilies(): Promise<Family[]> {
  const rows = await queryMany<FamilyRow>(
    db()
      .from('families')
      .select('*')
      .order('created_at', { ascending: true }),
    'load families',
  );
  return rows.map(mapFamily);
}

export async function getFamily(familyId: string): Promise<Family> {
  const row = await queryOne<FamilyRow>(
    db().from('families').select('*').eq('id', familyId).single(),
    'load family',
  );
  return mapFamily(row);
}

/**
 * Creates a family and its first admin membership atomically via the
 * SECURITY DEFINER RPC. The client never inserts the membership directly.
 */
export async function createFamilyWithAdmin(input: NewFamily): Promise<Family> {
  const familyId = crypto.randomUUID();
  const privacy: PrivacySettings = {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...input.privacy_settings,
  };

  const { data, error } = await db().rpc('create_family_with_admin', {
    p_family_id: familyId,
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
    p_privacy_settings: privacy,
  });

  if (error) throw new DbError('create family', error);

  const createdId = typeof data === 'string' && data ? data : familyId;
  const family = await getFamily(createdId);

  await recordAudit({
    family_id: family.id,
    action: 'created family',
    target_type: 'family',
    target_id: family.id,
    target_name: family.name,
    details: `Created the family workspace "${family.name}".`,
  });

  return family;
}

export async function updateFamily(
  familyId: string,
  updates: {
    name?: string;
    description?: string;
    privacy_settings?: Partial<PrivacySettings>;
  },
): Promise<Family> {
  const current = await getFamily(familyId);
  const row = defined({
    name: updates.name?.trim(),
    description:
      updates.description === undefined ? undefined : updates.description.trim() || null,
    privacy_settings: updates.privacy_settings
      ? { ...current.privacy_settings, ...updates.privacy_settings }
      : undefined,
  });

  const updated = await queryOne<FamilyRow>(
    db()
      .from('families')
      .update(row)
      .eq('id', familyId)
      .select('*')
      .single(),
    'update family',
  );
  const family = mapFamily(updated);

  await recordAudit({
    family_id: family.id,
    action: 'updated family settings',
    target_type: 'family',
    target_id: family.id,
    target_name: family.name,
    details: `Changed ${Object.keys(row).join(', ')}.`,
  });

  return family;
}

export async function deleteFamily(familyId: string): Promise<void> {
  await execute(
    db().from('families').delete().eq('id', familyId),
    'delete family',
  );
}
