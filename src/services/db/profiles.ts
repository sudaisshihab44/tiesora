import type { UserProfile } from '../../types';
import { db, defined, queryOne } from './core';
import { mapProfile } from './mappers';
import type { ProfileRow } from './rows';

export async function getProfile(userId: string): Promise<UserProfile> {
  const row = await queryOne<ProfileRow>(
    db().from('profiles').select('*').eq('id', userId).single(),
    'load profile',
  );
  return mapProfile(row);
}

export async function updateProfile(
  userId: string,
  updates: {
    display_name?: string;
    avatar_path?: string;
    preferred_language?: string;
  },
): Promise<UserProfile> {
  const row = defined({
    display_name: updates.display_name?.trim(),
    avatar_path:
      updates.avatar_path === undefined
        ? undefined
        : updates.avatar_path || null,
    preferred_language: updates.preferred_language,
  });

  if (Object.keys(row).length === 0) {
    return getProfile(userId);
  }

  const updated = await queryOne<ProfileRow>(
    db()
      .from('profiles')
      .update(row)
      .eq('id', userId)
      .select('*')
      .single(),
    'update profile',
  );
  return mapProfile(updated);
}
