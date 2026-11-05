import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private file storage for generated files (print PDFs, proof previews). Files are served only
 * through authorised route handlers, never from /public. Dev: ./storage (git-ignored);
 * production: point ELBA_STORAGE_DIR at a mounted volume, or swap this module for S3/R2.
 */
export function storageRoot(): string {
  return process.env.ELBA_STORAGE_DIR || path.join(process.cwd(), "storage");
}

function resolveSafe(rel: string): string {
  if (!/^[\w./-]+$/.test(rel) || rel.includes("..")) throw new Error("INVALID_STORAGE_PATH");
  const root = storageRoot();
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error("INVALID_STORAGE_PATH");
  return full;
}

export async function putFile(rel: string, bytes: Uint8Array | Buffer): Promise<void> {
  const full = resolveSafe(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function getFile(rel: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveSafe(rel));
  } catch {
    return null;
  }
}
