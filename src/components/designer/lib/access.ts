import type { Role } from "@/types";

/**
 * Who may read / write a Design row (pure, unit-tested; used by the API and pages).
 * - owner: `ownerId === user` (ADMIN may READ any design, never write someone else's);
 * - anonymous: `ownerId === null && anonId === elba_anon cookie` and not expired.
 */
export interface Actor {
  user: { id: string; role: Role } | null;
  anonId: string | null;
}

export interface DesignAccessRow {
  ownerId: string | null;
  anonId: string | null;
  expiresAt: Date | null;
}

export function canRead(row: DesignAccessRow, actor: Actor, now = new Date()): boolean {
  if (row.ownerId) return !!actor.user && (actor.user.id === row.ownerId || actor.user.role === "ADMIN");
  if (row.expiresAt && row.expiresAt < now) return false;
  return !!actor.anonId && row.anonId === actor.anonId;
}

export function canWrite(row: DesignAccessRow, actor: Actor, now = new Date()): boolean {
  if (row.ownerId) return !!actor.user && actor.user.id === row.ownerId;
  if (row.expiresAt && row.expiresAt < now) return false;
  return !!actor.anonId && row.anonId === actor.anonId;
}
