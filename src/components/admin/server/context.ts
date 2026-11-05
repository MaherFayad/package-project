import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { clientIp } from "@/lib/rate-limit";
import { toJson } from "@/lib/json";

/**
 * Admin mutation guard, action wrapper and the audit log. Every admin server action and route
 * handler calls `adminForMutation()` first (page layouts use requireRole too, but actions are
 * public endpoints and must check on their own).
 */

export type AdminErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "NOT_ALLOWED" | "STALE" | "INVALID" | "PAYMENT_FAILED" | "BLOCKED";

export class AdminActionError extends Error {
  constructor(public readonly code: AdminErrorCode, public readonly detail?: string) {
    super(code);
    this.name = "AdminActionError";
  }
}

export async function adminForMutation(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new AdminActionError("UNAUTHENTICATED");
  if (s.user.role !== "ADMIN") throw new AdminActionError("FORBIDDEN");
  return s.user;
}

export type AdminActionResponse<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: AdminErrorCode; detail?: string; fieldErrors?: Record<string, string> };

export class AdminFieldErrors extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("INVALID");
    this.name = "AdminFieldErrors";
  }
}

/** Zod issues → { "path.to.field": "CODE" }. */
export function issuesToFields(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function runAdminAction<T>(fn: () => Promise<T>): Promise<AdminActionResponse<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AdminActionError) return { ok: false, error: e.code, detail: e.detail };
    if (e instanceof AdminFieldErrors) return { ok: false, error: "INVALID", fieldErrors: e.fields };
    if (e && typeof e === "object" && "name" in e && (e.name === "OrderTransitionError" || e.name === "OrderError")) {
      return { ok: false, error: "NOT_ALLOWED", detail: String((e as { code?: string }).code ?? "") };
    }
    console.error("[admin] action failed", e);
    throw e;
  }
}

export type AuditEntity = "ORDER" | "VENDOR" | "VENDOR_APPLICATION" | "DISPUTE" | "USER" | "DATA_REQUEST" | "STRUCTURE" | "MATERIAL" | "FINISH" | "SETTINGS";

import { AUDIT_ACTIONS, type AuditAction } from "../lib/audit";
export { AUDIT_ACTIONS, type AuditAction };

export interface AuditEntry {
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Append one audit row. Pass `tx` to write it in the same transaction as the change. */
export async function audit(actor: SessionUser, entry: AuditEntry, tx: Prisma.TransactionClient | typeof db = db): Promise<void> {
  let ip: string | null = null;
  try {
    ip = clientIp(await headers());
  } catch {
    ip = null;
  }
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      actorPhone: actor.phone,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary ?? null,
      before: entry.before === undefined ? undefined : toJson(entry.before),
      after: entry.after === undefined ? undefined : toJson(entry.after),
      ip,
    },
  });
}
