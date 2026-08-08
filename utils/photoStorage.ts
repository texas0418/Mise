/**
 * utils/photoStorage.ts
 *
 * Durable on-device storage for user-supplied photos.
 *
 * expo-image-picker hands back a URI inside the app's *cache* directory, which
 * iOS reclaims under storage pressure. Persisting that URI means continuity
 * stills, scout photos, headshots and mood boards silently turn into broken
 * images (#34).
 *
 * Photos are copied into `<documents>/photos/` and recorded as a path relative
 * to the documents directory — never an absolute URI. iOS assigns a new app
 * container UUID on every install and update, so an absolute
 * `file:///.../Application/<UUID>/Documents/...` path breaks just as reliably
 * as the cache path it replaced. Callers store what `persistPhoto` returns and
 * render what `resolvePhotoUri` returns.
 */

import { Directory, File, Paths } from 'expo-file-system';

const PHOTO_DIR = 'photos';

/** Remote and inline sources are already durable and are stored verbatim. */
function isExternalSource(value: string): boolean {
  return /^(https?:|data:|blob:)/.test(value);
}

/** A value produced by `persistPhoto`: relative to the documents directory. */
function isRelativePhotoPath(value: string): boolean {
  return value.startsWith(`${PHOTO_DIR}/`);
}

function photosDirectory(): Directory {
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function uniqueFileName(extension: string): string {
  const stamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${stamp}-${suffix}${extension || '.jpg'}`;
}

/**
 * Copy a freshly picked photo into durable storage.
 *
 * Returns the value to persist: a documents-relative path on success, or the
 * input unchanged when it is already durable or the copy fails. Failing soft
 * matters here — a photo that renders for this session is better than losing
 * the user's note entirely, and the caller has no useful recovery.
 */
export function persistPhoto(sourceUri: string): string {
  if (!sourceUri) return sourceUri;
  if (isExternalSource(sourceUri) || isRelativePhotoPath(sourceUri)) return sourceUri;

  try {
    const source = new File(sourceUri);
    if (!source.exists) return sourceUri;

    const target = new File(photosDirectory(), uniqueFileName(source.extension));
    source.copy(target);
    return `${PHOTO_DIR}/${target.name}`;
  } catch (e) {
    console.warn('[photoStorage] could not persist photo, keeping source uri:', e);
    return sourceUri;
  }
}

/**
 * Turn a stored value into something an <Image> can render.
 *
 * Handles all three shapes that exist in the wild: documents-relative paths
 * written by `persistPhoto`, remote URLs (sample data, imports), and the legacy
 * absolute cache URIs written before this module existed.
 */
export function resolvePhotoUri(stored: string | null | undefined): string | undefined {
  if (!stored) return undefined;
  if (isExternalSource(stored)) return stored;

  if (isRelativePhotoPath(stored)) {
    try {
      return new File(Paths.document, stored).uri;
    } catch {
      return undefined;
    }
  }

  // Legacy absolute URI. It may still resolve, or the file may be long gone;
  // either way there is nothing better to hand the renderer.
  return stored;
}

/**
 * Rewrite a legacy absolute URI to durable storage.
 *
 * Returns the new relative path when the file still exists and was copied,
 * `null` when the photo is unrecoverable (already reclaimed by the OS), and
 * the input unchanged when it needs no migration.
 */
export function migratePhotoUri(stored: string): string | null {
  if (isExternalSource(stored) || isRelativePhotoPath(stored)) return stored;

  try {
    if (!new File(stored).exists) return null;
  } catch {
    return null;
  }

  const migrated = persistPhoto(stored);
  return isRelativePhotoPath(migrated) ? migrated : null;
}
