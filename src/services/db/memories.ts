import type { Memory } from '../../types';
import { db, defined, execute, queryMany, queryOne } from './core';
import { mapMemory, toDbDate } from './mappers';
import type { MemoryRow } from './rows';

export type NewMemory = Omit<
  Memory,
  'id' | 'created_at' | 'created_by' | 'created_by_name'
>;

export type MemoryUpdates = Partial<Omit<NewMemory, 'family_id'>>;

export async function listMemories(familyId: string): Promise<Memory[]> {
  const rows = await queryMany<MemoryRow>(
    db()
      .from('memories')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false }),
    'load memories',
  );
  return rows.map(mapMemory);
}

export async function createMemory(
  input: NewMemory,
  actor: { id: string; display_name: string },
): Promise<Memory> {
  const row = {
    family_id: input.family_id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    memory_date: toDbDate(input.memory_date),
    location: input.location?.trim() || null,
    image_url: input.image_url,
    tagged_person_ids: input.tagged_person_ids ?? [],
    album: input.album?.trim() || null,
    is_private: input.is_private ?? false,
    created_by: actor.id,
    created_by_name: actor.display_name,
  };

  const created = await queryOne<MemoryRow>(
    db().from('memories').insert(row).select('*').single(),
    'create memory',
  );
  return mapMemory(created);
}

export async function updateMemory(
  memoryId: string,
  updates: MemoryUpdates,
): Promise<Memory> {
  const row = defined({
    title: updates.title?.trim(),
    description:
      updates.description === undefined
        ? undefined
        : updates.description.trim() || null,
    memory_date:
      updates.memory_date === undefined
        ? undefined
        : toDbDate(updates.memory_date),
    location:
      updates.location === undefined
        ? undefined
        : updates.location.trim() || null,
    image_url: updates.image_url,
    tagged_person_ids: updates.tagged_person_ids,
    album:
      updates.album === undefined
        ? undefined
        : updates.album.trim() || null,
    is_private: updates.is_private,
  });

  if (Object.keys(row).length === 0) {
    const current = await queryOne<MemoryRow>(
      db().from('memories').select('*').eq('id', memoryId).single(),
      'load memory',
    );
    return mapMemory(current);
  }

  const updated = await queryOne<MemoryRow>(
    db()
      .from('memories')
      .update(row)
      .eq('id', memoryId)
      .select('*')
      .single(),
    'update memory',
  );
  return mapMemory(updated);
}

export async function deleteMemory(memoryId: string): Promise<void> {
  await execute(
    db().from('memories').delete().eq('id', memoryId),
    'delete memory',
  );
}
