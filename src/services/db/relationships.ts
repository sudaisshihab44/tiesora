import type { Relationship, RelationshipType } from '../../types';
import { db, defined, execute, queryMany, queryOne } from './core';
import { recordAudit } from './auditLogs';
import {
  mapRelationship,
  normalizeRelationshipEndpoints,
  toDbDate,
} from './mappers';
import type { RelationshipRow } from './rows';

export type NewRelationship = Omit<
  Relationship,
  'id' | 'created_at' | 'updated_at' | 'created_by'
>;

export type RelationshipUpdates = Partial<Omit<NewRelationship, 'family_id'>>;

const relationshipLabel = (type: string) => type.replace(/_/g, ' ');

export async function listRelationships(
  familyId: string,
): Promise<Relationship[]> {
  const rows = await queryMany<RelationshipRow>(
    db()
      .from('relationships')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true }),
    'load relationships',
  );
  return rows.map(mapRelationship);
}

export async function createRelationship(
  input: NewRelationship,
  actorId: string,
): Promise<Relationship> {
  const normalized = normalizeRelationshipEndpoints({
    source_person_id: input.source_person_id,
    target_person_id: input.target_person_id,
    relationship_type: input.relationship_type,
  });

  const row = {
    family_id: input.family_id,
    source_person_id: normalized.source_person_id,
    target_person_id: normalized.target_person_id,
    relationship_type: normalized.relationship_type,
    relationship_status: input.relationship_status ?? 'verified',
    valid_from: toDbDate(input.valid_from),
    valid_to: toDbDate(input.valid_to),
    notes: input.notes?.trim() || null,
    created_by: actorId,
  };

  const created = await queryOne<RelationshipRow>(
    db().from('relationships').insert(row).select('*').single(),
    'create relationship',
  );
  const relationship = mapRelationship(created);

  await recordAudit({
    family_id: relationship.family_id,
    action: 'created relationship',
    target_type: 'relationship',
    target_id: relationship.id,
    target_name: relationshipLabel(relationship.relationship_type),
    details: `Added a ${relationshipLabel(relationship.relationship_type)} link between two family members.`,
  });

  return relationship;
}

export async function updateRelationship(
  relationshipId: string,
  updates: RelationshipUpdates,
): Promise<Relationship> {
  const current = await queryOne<RelationshipRow>(
    db()
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .single(),
    'load relationship',
  );

  const nextType = (updates.relationship_type ??
    current.relationship_type) as RelationshipType;
  const nextSource = updates.source_person_id ?? current.source_person_id;
  const nextTarget = updates.target_person_id ?? current.target_person_id;

  const normalized =
    updates.relationship_type !== undefined ||
    updates.source_person_id !== undefined ||
    updates.target_person_id !== undefined
      ? normalizeRelationshipEndpoints({
          source_person_id: nextSource,
          target_person_id: nextTarget,
          relationship_type: nextType,
        })
      : null;

  const row = defined({
    source_person_id: normalized?.source_person_id,
    target_person_id: normalized?.target_person_id,
    relationship_type: normalized?.relationship_type,
    relationship_status: updates.relationship_status,
    valid_from:
      updates.valid_from === undefined
        ? undefined
        : toDbDate(updates.valid_from),
    valid_to:
      updates.valid_to === undefined
        ? undefined
        : toDbDate(updates.valid_to),
    notes:
      updates.notes === undefined
        ? undefined
        : updates.notes.trim() || null,
  });

  if (Object.keys(row).length === 0) {
    return mapRelationship(current);
  }

  const updated = await queryOne<RelationshipRow>(
    db()
      .from('relationships')
      .update(row)
      .eq('id', relationshipId)
      .select('*')
      .single(),
    'update relationship',
  );
  const relationship = mapRelationship(updated);

  await recordAudit({
    family_id: relationship.family_id,
    action: 'updated relationship',
    target_type: 'relationship',
    target_id: relationship.id,
    target_name: relationshipLabel(relationship.relationship_type),
    details: `Changed ${Object.keys(row).join(', ')}.`,
  });

  return relationship;
}

export async function deleteRelationship(
  relationshipId: string,
): Promise<void> {
  const current = await queryOne<RelationshipRow>(
    db()
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .single(),
    'load relationship',
  );

  await execute(
    db().from('relationships').delete().eq('id', relationshipId),
    'delete relationship',
  );

  await recordAudit({
    family_id: current.family_id,
    action: 'deleted relationship',
    target_type: 'relationship',
    target_id: relationshipId,
    target_name: relationshipLabel(current.relationship_type),
    details: `Removed a ${relationshipLabel(current.relationship_type)} link.`,
  });
}
