import "server-only";
import { getBlob, putBlob } from "@/lib/storage/blob";

/**
 * Private file storage for generated files (print PDFs, proof previews). Files are served only
 * through authorised route handlers, never from /public. Backed by src/lib/storage/blob.ts:
 * R2 on Cloudflare Workers, ./storage (or ELBA_STORAGE_DIR) on disk elsewhere.
 */
function keyFor(rel: string): string {
  if (!/^[\w./-]+$/.test(rel) || rel.includes("..")) throw new Error("INVALID_STORAGE_PATH");
  return `storage/${rel}`;
}

export async function putFile(rel: string, bytes: Uint8Array | Buffer): Promise<void> {
  await putBlob(keyFor(rel), bytes);
}

export async function getFile(rel: string): Promise<Buffer | null> {
  return getBlob(keyFor(rel));
}
