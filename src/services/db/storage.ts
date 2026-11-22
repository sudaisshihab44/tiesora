import { DbError, db, execute } from './core';
import { isStoragePath } from './mappers';

const PHOTO_BUCKET = 'family-photos';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_SIGNED_URL_TTL = 60 * 60; // 1 hour

function profilePhotoExtension(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^(jpe?g|png|webp)$/.test(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  return 'jpg';
}

function uploadWithProgress(
  path: string,
  file: File,
  accessToken: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!url || !anonKey) {
      reject(new DbError('upload photo: Supabase environment is missing'));
      return;
    }

    const encodedPath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${url.replace(/\/$/, '')}/storage/v1/object/${PHOTO_BUCKET}/${encodedPath}`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('cache-control', '3600');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        // keep status message
      }
      reject(new DbError(message));
    };
    xhr.onerror = () => reject(new DbError('Upload interrupted. Check your connection and try again.'));
    xhr.onabort = () => reject(new DbError('Upload was cancelled.'));
    xhr.send(file);
  });
}

/**
 * Uploads/replaces a member profile photo at
 * family-id/member-id/profile-photo.<ext>.
 */
export async function uploadProfilePhoto(
  file: File,
  familyId: string,
  memberId: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new DbError('upload profile photo: only image files are supported');
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new DbError('upload profile photo: image exceeds the 5 MB limit');
  }

  const version =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const path = `${familyId}/${memberId}/profile-photo-${version}.${profilePhotoExtension(file)}`;

  if (onProgress) {
    const { data } = await db().auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      await uploadWithProgress(path, file, token, onProgress);
      return path;
    }
  }

  const { error } = await db()
    .storage.from(PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
  if (error) throw new DbError('upload profile photo', error);
  onProgress?.(100);
  return path;
}

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
