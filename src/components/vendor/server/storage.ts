import "server-only";
import { randomBytes } from "node:crypto";
import { deleteBlob, getBlob, hasBlob, listBlobs, putBlob } from "@/lib/storage/blob";
import { buildKey, checkUpload, parseKey, stripImageMetadata, type UploadCheck, type UploadScope } from "../lib/files";

/**
 * Vendor and buyer uploads (vendor documents, dispute photos, artwork). Private: served only
 * through the access check in /api/vendor/files. Backed by src/lib/storage/blob.ts (R2 on
 * Cloudflare Workers, var/uploads or ELBA_UPLOAD_DIR on disk elsewhere) under "uploads/<key>".
 */
function blobKey(key: string): string {
  if (!parseKey(key)) throw new Error("invalid key");
  return `uploads/${key}`;
}

export type SaveResult = { ok: true; key: string; type: string; size: number } | { ok: false; error: Exclude<UploadCheck, { ok: true }>["error"] };

/** Validate by magic bytes and store. Returns the private key. */
export async function saveUpload(scope: UploadScope, ownerId: string, bytes: Uint8Array): Promise<SaveResult> {
  const check = checkUpload(scope, bytes);
  if (!check.ok) return { ok: false, error: check.error };
  // R4: no EXIF / XMP / text chunks (GPS, hidden contact details) in stored images.
  const clean = check.type === "application/pdf" ? bytes : stripImageMetadata(bytes, check.type);
  if (!clean) return { ok: false, error: "TYPE" };
  const key = buildKey(scope, ownerId, randomBytes(12).toString("base64url"), check.ext);
  await putBlob(blobKey(key), clean, { contentType: check.type, createOnly: true });
  return { ok: true, key, type: check.type, size: clean.length };
}

export async function readUpload(key: string): Promise<Buffer | null> {
  if (!parseKey(key)) return null;
  return getBlob(blobKey(key));
}

/** Whether an upload exists (vendor application documents are re-checked on submit). */
export async function uploadExists(key: string): Promise<boolean> {
  if (!parseKey(key)) return false;
  return hasBlob(blobKey(key));
}

export async function deleteUpload(key: string): Promise<void> {
  if (!parseKey(key)) return;
  await deleteBlob(blobKey(key));
}

/** Keys stored under one scope and owner (R6-SEC-06: caps unsent dispute photos per order). */
export async function listUploads(scope: UploadScope, ownerId: string): Promise<string[]> {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(ownerId)) return [];
  const keys = await listBlobs(`uploads/${scope}/${ownerId}`);
  return keys.map((k) => k.slice("uploads/".length)).filter((k) => parseKey(k) !== null);
}
