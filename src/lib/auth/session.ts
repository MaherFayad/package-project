import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { isProd } from "@/lib/env";
import type { Locale, Role } from "@/types";
import { DEFAULT_LOCALE } from "@/types";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "./constants";
import { randomToken, sha256 } from "./crypto";

/** What server code gets about the signed-in user. Serialisable; safe to pass to client components. */
export interface SessionUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  locale: Locale;
  vendorId: string | null;
  marketingConsent: boolean;
}

export interface Session {
  id: string;
  user: SessionUser;
  expiresAt: Date;
}

/**
 * Current session from the httpOnly cookie, or null. Works in Server Components,
 * Server Actions and Route Handlers. Cached per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!row || row.expiresAt < new Date()) return null;
  const u = row.user;
  return {
    id: row.id,
    expiresAt: row.expiresAt,
    user: {
      id: u.id,
      phone: u.phone,
      name: u.name,
      role: u.role as Role,
      locale: (u.locale as Locale) ?? DEFAULT_LOCALE,
      vendorId: u.vendorId,
      marketingConsent: u.marketingConsent,
    },
  };
});

/** Page guard: redirects to /{locale}/login?next=... when signed out. */
export async function requireUser(locale: Locale, nextPath?: string): Promise<SessionUser> {
  const s = await getSession();
  if (!s) {
    const next = nextPath ?? `/${locale}`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }
  return s.user;
}

/**
 * Page guard for role-restricted areas (vendor portal, admin).
 * Signed out -> login redirect; wrong role -> /{locale}?denied=1.
 * ADMIN passes every role check.
 */
export async function requireRole(
  roles: Role | Role[],
  locale: Locale,
  nextPath?: string,
): Promise<SessionUser> {
  const user = await requireUser(locale, nextPath);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (user.role !== "ADMIN" && !allowed.includes(user.role)) redirect(`/${locale}?denied=1`);
  return user;
}

/**
 * Route-handler guard. Returns the user, or a Response to return directly:
 *   const auth = await apiRequireRole(["VENDOR"]); if (auth instanceof Response) return auth;
 */
export async function apiRequireRole(roles?: Role | Role[]): Promise<SessionUser | Response> {
  const s = await getSession();
  if (!s) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (s.user.role !== "ADMIN" && !allowed.includes(s.user.role)) {
      return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }
  return s.user;
}

/** Create a DB session and set the cookie. Call only from Route Handlers / Server Actions. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const h = await headers();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd && !process.env.E2E_INSECURE_COOKIES,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}
