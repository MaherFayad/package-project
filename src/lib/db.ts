import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the server. Import as `import { db } from "@/lib/db"`.
 * Server-only: never import from a client component.
 */
const globalForPrisma = globalThis as unknown as { __elbaPrisma?: PrismaClient };

/**
 * SQLite (dev, e2e, local `next start`) allows one writer. With Prisma's default pool, two
 * interactive transactions (e.g. two payment callbacks or two "accept" clicks at once) each take a
 * read lock, then both wait to upgrade it: the requests hang until the socket timeout and fail
 * with P1008/P2028, so none of them is applied. One connection makes them queue instead.
 * Postgres URLs (production) are left untouched. An explicit `connection_limit` always wins.
 */
export function databaseUrl(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("file:") || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

const url = databaseUrl(process.env.ELBA_DATABASE_URL);

export const db: PrismaClient =
  globalForPrisma.__elbaPrisma ??
  new PrismaClient({
    ...(url ? { datasourceUrl: url } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__elbaPrisma = db;
