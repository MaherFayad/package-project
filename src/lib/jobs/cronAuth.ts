import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Guard for scheduled-job endpoints: `Authorization: Bearer <CRON_SECRET>`.
 * - CRON_SECRET unset: "disabled" in production (the endpoint answers 503 and does nothing);
 *   allowed in development and tests so `curl -X POST localhost:3000/api/jobs/follow-up` works.
 * - Constant-time comparison (both sides hashed to 32 bytes first, so length does not leak).
 */
export type CronAuth = "ok" | "unauthorized" | "disabled";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

export function checkCronAuth(authorization: string | null, secret: string | undefined, prod: boolean): CronAuth {
  if (!secret) return prod ? "disabled" : "ok";
  const m = /^Bearer\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (!m) return "unauthorized";
  return timingSafeEqual(digest(m[1].trim()), digest(secret)) ? "ok" : "unauthorized";
}
