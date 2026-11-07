/**
 * The Cloudflare request context (env bindings + ExecutionContext) when running on Workers.
 *
 * The OpenNext worker entry stores it on `globalThis[Symbol.for("__cloudflare-context__")]` for
 * the duration of each request (the same slot `getCloudflareContext()` from
 * @opennextjs/cloudflare reads). Reading the slot directly keeps this module free of that
 * package, so Node (dev, unit tests, e2e, scripts) never loads it. Null everywhere but Workers.
 */
export type CloudflareContext = {
  env: Record<string, unknown>;
  ctx: object;
  cf?: unknown;
};

const SLOT = Symbol.for("__cloudflare-context__");

export function cloudflareContext(): CloudflareContext | null {
  const value = (globalThis as Record<symbol, unknown>)[SLOT] as CloudflareContext | undefined;
  return value && typeof value === "object" && value.env && value.ctx ? value : null;
}

/** A binding from the Workers env, or null off Workers / when it is not configured. */
export function binding<T>(name: string): T | null {
  return (cloudflareContext()?.env[name] as T | undefined) ?? null;
}

/** Minimal R2 bucket surface used by src/lib/storage/blob.ts (kept local: no workers-types dep). */
export interface R2BucketLike {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; onlyIf?: { etagDoesNotMatch?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  head(key: string): Promise<unknown | null>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
}

/** Workers static assets binding (public/ and /_next/static). */
export interface AssetsLike {
  fetch(input: string | Request): Promise<Response>;
}
