import type { Prisma } from "@prisma/client";

/**
 * Prisma Json columns don't accept TS interfaces directly (no index signature).
 * Write:  data: { dims: toJson(dims) }
 * Read:   const dims = fromJson<Dims>(row.dims)
 * Validate untrusted JSON with zod before trusting `fromJson` casts.
 */
export function toJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export function fromJson<T>(value: Prisma.JsonValue): T {
  return value as unknown as T;
}

/** Canonical JSON (sorted keys) for hashing proofs. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}
