import "server-only";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { binding, type R2BucketLike } from "@/lib/runtime/cloudflare";

/**
 * Private file storage behind one interface:
 *  - Cloudflare Workers (production): the R2 bucket bound as `ELBA_FILES` (wrangler.jsonc);
 *  - Node (dev, e2e, local `next start`): a directory on disk.
 *
 * Keys are relative POSIX paths ("uploads/vendor-doc/<owner>/<file>", "storage/orders/..."),
 * validated here so no caller can escape its area. Files are never public: they are served only
 * through the authorised route handlers.
 */
export const R2_BINDING = "ELBA_FILES";

const KEY = /^[\w-]+(\/[\w.-]+)+$/;

/** Whether a storage key is well formed (pure, unit-tested). */
export function validKey(key: string): boolean {
  return KEY.test(key) && !key.split("/").some((p) => p === "." || p === "..");
}

function check(key: string): void {
  if (!validKey(key)) throw new Error("INVALID_STORAGE_KEY");
}

function bucket(): R2BucketLike | null {
  return binding<R2BucketLike>(R2_BINDING);
}

/** Disk root for a key area ("uploads" -> ELBA_UPLOAD_DIR, "storage" -> ELBA_STORAGE_DIR). */
function diskPath(key: string): string {
  const [area, ...rest] = key.split("/");
  const root =
    area === "uploads"
      ? process.env.ELBA_UPLOAD_DIR || path.join(process.cwd(), "var", "uploads")
      : area === "storage"
        ? process.env.ELBA_STORAGE_DIR || path.join(process.cwd(), "storage")
        : null;
  if (!root) throw new Error("INVALID_STORAGE_KEY");
  const full = path.resolve(root, ...rest);
  if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error("INVALID_STORAGE_KEY");
  return full;
}

/** Store bytes. `createOnly` refuses to overwrite an existing key (random upload names). */
export async function putBlob(key: string, bytes: Uint8Array, opts: { contentType?: string; createOnly?: boolean } = {}): Promise<void> {
  check(key);
  const r2 = bucket();
  if (r2) {
    if (opts.createOnly && (await r2.head(key))) throw new Error("STORAGE_KEY_EXISTS");
    await r2.put(key, bytes, opts.contentType ? { httpMetadata: { contentType: opts.contentType } } : undefined);
    return;
  }
  const full = diskPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, opts.createOnly ? { flag: "wx" } : undefined);
}

export async function getBlob(key: string): Promise<Buffer | null> {
  check(key);
  const r2 = bucket();
  try {
    if (r2) {
      const obj = await r2.get(key);
      return obj ? Buffer.from(await obj.arrayBuffer()) : null;
    }
    return await readFile(diskPath(key));
  } catch {
    return null;
  }
}

export async function hasBlob(key: string): Promise<boolean> {
  if (!validKey(key)) return false;
  const r2 = bucket();
  try {
    if (r2) return (await r2.head(key)) !== null;
    return (await stat(diskPath(key))).isFile();
  } catch {
    return false;
  }
}

export async function deleteBlob(key: string): Promise<void> {
  if (!validKey(key)) return;
  const r2 = bucket();
  try {
    if (r2) await r2.delete(key);
    else await rm(diskPath(key), { force: true });
  } catch {
    /* already gone */
  }
}

/** Keys directly under a folder prefix ("uploads/dispute-photo/<owner>"), at most `limit`. */
export async function listBlobs(prefix: string, limit = 1000): Promise<string[]> {
  if (!validKey(prefix)) return [];
  const r2 = bucket();
  try {
    if (r2) {
      const out: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await r2.list({ prefix: `${prefix}/`, cursor, limit: Math.min(1000, limit - out.length) });
        for (const o of page.objects) if (!o.key.slice(prefix.length + 1).includes("/")) out.push(o.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor && out.length < limit);
      return out;
    }
    const names = await readdir(diskPath(prefix));
    return names.slice(0, limit).map((n) => `${prefix}/${n}`);
  } catch {
    return [];
  }
}
