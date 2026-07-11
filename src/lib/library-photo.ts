import { del, put } from "@vercel/blob";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { LIBRARY_PHOTO_MAX_BYTES } from "./library-photo-constants";

export { LIBRARY_PHOTO_MAX_BYTES } from "./library-photo-constants";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "libraries");
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function useBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function localFilePath(userId: string, ext: string) {
  return path.join(UPLOAD_DIR, `${userId}.${ext}`);
}

function assertValidPhoto(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (file.size > LIBRARY_PHOTO_MAX_BYTES) {
    throw new Error("Image must be 4 MB or smaller.");
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new Error("Unsupported image type.");
  return ext;
}

async function removeLocalPhotoFiles(userId: string) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  for (const ext of Object.values(EXT_BY_TYPE)) {
    try {
      await unlink(localFilePath(userId, ext));
    } catch {
      // Missing file is fine.
    }
  }
}

async function removeBlobPhoto(photoUrl: string | null | undefined) {
  if (!photoUrl || !photoUrl.includes("blob.vercel-storage.com")) return;
  try {
    await del(photoUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // Blob may already be gone.
  }
}

/** Remove prior files for this user (local disk and/or previous blob URL). */
export async function removeLibraryPhotoFiles(userId: string, previousUrl?: string | null) {
  if (useBlobStorage()) {
    await removeBlobPhoto(previousUrl);
  }
  await removeLocalPhotoFiles(userId);
}

export async function saveLibraryPhoto(
  userId: string,
  file: File,
  previousUrl?: string | null,
): Promise<string> {
  const ext = assertValidPhoto(file);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (useBlobStorage()) {
    await removeBlobPhoto(previousUrl);
    await removeLocalPhotoFiles(userId);
    const blob = await put(`libraries/${userId}.${ext}`, buffer, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await removeLocalPhotoFiles(userId);
  await writeFile(localFilePath(userId, ext), buffer);
  return `/uploads/libraries/${userId}.${ext}`;
}

export async function deleteLibraryPhoto(userId: string, previousUrl?: string | null) {
  await removeLibraryPhotoFiles(userId, previousUrl);
}
