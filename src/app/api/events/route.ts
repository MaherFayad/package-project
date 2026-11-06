import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { ANON_COOKIE } from "@/lib/auth/constants";
import { crossSiteResponse, isCrossSiteRequest } from "@/lib/auth/csrf";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CLIENT_EVENTS } from "@/lib/analytics/events";
import { deviceOf, track } from "@/lib/analytics/track";
import { readJsonCapped } from "../_lib/body";

const Scalar = z.union([z.string().max(120), z.number().finite(), z.boolean(), z.null()]);

const Body = z
  .object({
    name: z.enum(CLIENT_EVENTS),
    props: z
      .record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), Scalar)
      .refine((p) => Object.keys(p).length <= 16, { message: "TOO_MANY_PROPS" })
      .optional(),
  })
  .strict();

const ANON_ID_RE = /^[\w-]{16,64}$/;

/**
 * POST /api/events — first-party analytics for actions that only happen in the browser (B-19).
 * Body: { name: one of CLIENT_EVENTS, props?: { key: scalar } } (sent by trackClient via sendBeacon).
 *
 * Strict allowlist: server-truth events (account_created, price_viewed, payment_succeeded, ...)
 * are rejected here; they are written where they happen. Same-origin only (CSRF check as in
 * /api/auth/*), 60 events per minute per client, 2 KB body cap. The IP is used for the rate
 * limit only and is never stored; personal data in props is dropped by track().
 *
 * Integrity (R4-B-04): the elba_anon cookie is not signed, so a script could rotate it to look like
 * many browsers. Limits therefore also key on what a script cannot rotate for free:
 * - 120 events per minute per IP, on top of 60 per minute per browser;
 * - `visit`: at most one per browser fingerprint (IP + User-Agent, hashed in memory, never stored)
 *   per 30 minutes, and at most 30 per IP per 30 minutes (shared office or carrier NAT);
 * - every other client event: at most 30 per name per IP per 10 minutes.
 * Over those caps the event is dropped silently (204), so a script learns nothing.
 *
 * 204 · 400 INVALID_BODY · 403 FORBIDDEN (cross-site) · 413 TOO_LARGE · 429 RATE_LIMITED
 */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req.headers)) return crossSiteResponse();
  const jar = await cookies();
  const rawAnon = jar.get(ANON_COOKIE)?.value ?? null;
  const anonId = rawAnon && ANON_ID_RE.test(rawAnon) ? rawAnon : null;
  const ip = clientIp(req.headers);
  const rl = rateLimit("events:client", anonId ?? `ip:${ip}`, 60, 60_000);
  const limited = !rl.ok ? rl : rateLimit("events:ip", ip, 120, 60_000);
  if (!limited.ok) {
    return Response.json({ error: "RATE_LIMITED", retryAfterSec: limited.retryAfterSec }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }
  const json = await readJsonCapped(req, 2_048);
  if (json instanceof Response) return json;
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY" }, { status: 400 });

  if (!countable(parsed.data.name, ip, req.headers.get("user-agent") ?? "")) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

  const session = await getSession().catch(() => null);
  void track(parsed.data.name, { ...parsed.data.props, device: deviceOf(req.headers) }, { userId: session?.user.id ?? null, anonId });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

const MIN = 60_000;

/** Server-side dedupe and per-IP caps that cookie rotation cannot get around (R4-B-04). */
function countable(name: string, ip: string, ua: string): boolean {
  if (name === "visit") {
    const fingerprint = createHash("sha256").update(`${ip}|${ua}`).digest("base64url");
    // Same browser again within the session window: not a new visit (and it uses no IP quota).
    if (!rateLimit("events:visit:fp", fingerprint, 1, 30 * MIN).ok) return false;
    return rateLimit("events:visit:ip", ip, 30, 30 * MIN).ok;
  }
  return rateLimit(`events:${name}:ip`, ip, 30, 10 * MIN).ok;
}
