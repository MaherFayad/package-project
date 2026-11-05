import "server-only";
import type { Vendor } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession, requireRole, type SessionUser } from "@/lib/auth/session";
import type { Locale } from "@/types";

export interface VendorContext {
  user: SessionUser;
  vendor: Vendor | null;
}

/**
 * Page guard for the portal: signed-in VENDOR (ADMIN passes requireRole but usually has no
 * vendor linked, in which case `vendor` is null and the portal shows an empty state).
 */
export async function requireVendorContext(locale: Locale, nextPath?: string): Promise<VendorContext> {
  const user = await requireRole("VENDOR", locale, nextPath ?? `/${locale}/vendor`);
  const vendor = user.vendorId ? await db.vendor.findUnique({ where: { id: user.vendorId } }) : null;
  return { user, vendor };
}

export type VendorErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NO_VENDOR"
  | "SUSPENDED"
  | "NOT_FOUND"
  | "NOT_ALLOWED"
  | "STALE"
  | "INVALID"
  | "RATE_LIMITED"
  | "LIMIT";

export class VendorActionError extends Error {
  constructor(public readonly code: VendorErrorCode) {
    super(code);
    this.name = "VendorActionError";
  }
}

/**
 * Mutation guard (server actions and route handlers): the caller must be signed in with role
 * VENDOR (or ADMIN) AND be staff of an ACTIVE vendor. Every mutation also scopes its queries by
 * `vendor.id`, so a vendor can never touch another vendor's rows.
 */
export async function vendorForMutation(opts: { allowSuspended?: boolean } = {}): Promise<{ user: SessionUser; vendor: Vendor }> {
  const s = await getSession();
  if (!s) throw new VendorActionError("UNAUTHENTICATED");
  if (s.user.role !== "VENDOR" && s.user.role !== "ADMIN") throw new VendorActionError("FORBIDDEN");
  if (!s.user.vendorId) throw new VendorActionError("NO_VENDOR");
  const vendor = await db.vendor.findUnique({ where: { id: s.user.vendorId } });
  if (!vendor) throw new VendorActionError("NO_VENDOR");
  if (vendor.status === "SUSPENDED" && !opts.allowSuspended) throw new VendorActionError("SUSPENDED");
  if (vendor.status === "PENDING") throw new VendorActionError("FORBIDDEN");
  return { user: s.user, vendor };
}

export type ActionResponse<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: VendorErrorCode; fieldErrors?: Record<string, string> };

/** Wrap an action body: known errors become `{ ok: false, error }`, unknown ones are logged. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResponse<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof VendorActionError) return { ok: false, error: e.code };
    if (e instanceof FieldErrors) return { ok: false, error: "INVALID", fieldErrors: e.fields };
    console.error("[vendor-portal] action failed", e);
    throw e;
  }
}

export class FieldErrors extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("INVALID");
    this.name = "FieldErrors";
  }
}
