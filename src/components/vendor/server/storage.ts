import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildKey, checkUpload, parseKey, stripImageMetadata, type UploadCheck, type UploadScope } from "../lib/files";

/**
 * Local disk storage for vendor uploads (dev and single-server deployments).
 * Files live OUTSIDE /public (Next only serves files present at build time, and private files
 * must go through the access check in /api/vendor/files). Production should swap this module
 * for object storage (S3/R2) with the same three functions.
 */
export function uploadRoot(): string {
  return process.env.ELBA_UPLOAD_DIR || path.join(process.cwd(), "var", "uploads");
}

function pathFor(key: string): string {
  const parsed = parseKey(key);
  if (!parsed) throw new Error("invalid key");
  const root = uploadRoot();
  const full = path.join(root, parsed.scope, parsed.ownerId, parsed.file);
  if (!full.startsWith(root + path.sep)) throw new Error("invalid key");
  return full;
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
  const full = pathFor(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, clean, { flag: "wx" });
  return { ok: true, key, type: check.type, size: clean.length };
}

export async function readUpload(key: string): Promise<Buffer | null> {
  try {
    return await readFile(pathFor(key));
  } catch {
    return null;
  }
}

export async function deleteUpload(key: string): Promise<void> {
  try {
    await rm(pathFor(key), { force: true });
  } catch {
    /* already gone */
  }
}
