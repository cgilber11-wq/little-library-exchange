export const LIBRARY_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export const LIBRARY_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

const SEED_LIBRARY_PHOTO_PREFIX = "/seed-libraries/";

/** Demo pixel-art placeholders shipped in public/seed-libraries/. */
export function isSeedLibraryPhoto(url: string | null | undefined): boolean {
  return Boolean(url?.startsWith(SEED_LIBRARY_PHOTO_PREFIX));
}
