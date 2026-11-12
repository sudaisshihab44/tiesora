import type { FamilyPerson } from '../../types';
import { db, defined, execute, queryMany, queryOne } from './core';
import { mapPerson, toDbDate } from './mappers';
import type { PersonRow } from './rows';

export type NewPerson = Omit<
  FamilyPerson,
  'id' | 'created_at' | 'updated_at' | 'created_by'
>;

export type PersonUpdates = Partial<Omit<NewPerson, 'family_id'>>;

export async function listPeople(familyId: string): Promise<FamilyPerson[]> {
  const rows = await queryMany<PersonRow>(
    db()
      .from('family_people')
      .select('*')
      .eq('family_id', familyId)
      .order('generation_level', { ascending: true })
      .order('created_at', { ascending: true }),
    'load people',
  );
  return rows.map(mapPerson);
}

export async function getPerson(personId: string): Promise<FamilyPerson> {
  const row = await queryOne<PersonRow>(
    db().from('family_people').select('*').eq('id', personId).single(),
    'load person',
  );
  return mapPerson(row);
}

export async function createPerson(
  input: NewPerson,
  actorId: string,
): Promise<FamilyPerson> {
  const row = {
    family_id: input.family_id,
    full_name: input.full_name.trim(),
    display_name: input.display_name.trim() || input.full_name.trim(),
    gender: input.gender ?? 'unspecified',
    birth_date: toDbDate(input.birth_date),
    birth_place: input.birth_place?.trim() || null,
    death_date: toDbDate(input.death_date),
    death_place: input.death_place?.trim() || null,
    date_precision: input.date_precision ?? 'unknown',
    living_status: input.living_status ?? 'living',
    biography: input.biography?.trim() || null,
    avatar_path: input.avatar_path || null,
    generation_level: input.generation_level ?? 1,
    branch: input.branch?.trim() || null,
    created_by: actorId,
  };

  const created = await queryOne<PersonRow>(
    db().from('family_people').insert(row).select('*').single(),
    'create person',
  );
  return mapPerson(created);
}

export async function updatePerson(
  personId: string,
  updates: PersonUpdates,
): Promise<FamilyPerson> {
  const row = defined({
    full_name: updates.full_name?.trim(),
    display_name: updates.display_name?.trim(),
    gender: updates.gender,
    birth_date:
      updates.birth_date === undefined
        ? undefined
        : toDbDate(updates.birth_date),
    birth_place:
      updates.birth_place === undefined
        ? undefined
        : updates.birth_place.trim() || null,
    death_date:
      updates.death_date === undefined
        ? undefined
        : toDbDate(updates.death_date),
    death_place:
      updates.death_place === undefined
        ? undefined
        : updates.death_place.trim() || null,
    date_precision: updates.date_precision,
    living_status: updates.living_status,
    biography:
      updates.biography === undefined
        ? undefined
        : updates.biography.trim() || null,
    avatar_path:
      updates.avatar_path === undefined
        ? undefined
        : updates.avatar_path || null,
    generation_level: updates.generation_level,
    branch:
      updates.branch === undefined
        ? undefined
        : updates.branch.trim() || null,
  });

  if (Object.keys(row).length === 0) {
    return getPerson(personId);
  }

  const updated = await queryOne<PersonRow>(
    db()
      .from('family_people')
      .update(row)
      .eq('id', personId)
      .select('*')
      .single(),
    'update person',
  );
  return mapPerson(updated);
}

export async function deletePerson(personId: string): Promise<void> {
  await execute(
    db().from('family_people').delete().eq('id', personId),
    'delete person',
  );
}
