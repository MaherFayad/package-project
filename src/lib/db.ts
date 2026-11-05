import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the server. Import as `import { db } from "@/lib/db"`.
 * Server-only: never import from a client component.
 */
const globalForPrisma = globalThis as unknown as { __elbaPrisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.__elbaPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.__elbaPrisma = db;
