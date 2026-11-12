import { DbError, db, execute } from './core';
import { isStoragePath } from './mappers';

const PHOTO_BUCKET = 'family-photos';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_SIGNED_URL_TTL = 60 * 60; // 1 hour

/**
 * Uploads a memory photo to the private `family-photos` bucket.
 * Returns the storage path (not a URL), which should be stored in
 * `memories.image_url`. Use `getFamilyPhotoUrl()` to display it.
 */
export async function uploadFamilyPhoto(
  file: File,
  familyId: string,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new DbError('upload photo: only image files are supported');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new DbError('upload photo: image exceeds the 10 MB limit');
  }

  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${familyId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await db()
    .storage.from(PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) throw new DbError('upload photo', error);
  return path;
}

/**
 * Resolves a stored photo path to a short-lived signed URL.
 * External URLs and data URIs are returned unchanged.
 */
export async function getFamilyPhotoUrl(
  pathOrUrl: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL,
): Promise<string> {
  if (!isStoragePath(pathOrUrl)) return pathOrUrl;

  const { data, error } = await db()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrl(pathOrUrl, expiresInSeconds);

  if (error) throw new DbError('load photo', error);
  if (!data?.signedUrl) {
    throw new DbError('load photo: signed URL was not returned');
  }
  return data.signedUrl;
}

export async function deleteFamilyPhoto(path: string): Promise<void> {
  if (!isStoragePath(path)) return;
  await execute(
    db().storage.from(PHOTO_BUCKET).remove([path]),
    'delete photo',
  );
}
