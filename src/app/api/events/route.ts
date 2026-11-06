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
 * 204 · 400 INVALID_BODY · 403 FORBIDDEN (cross-site) · 413 TOO_LARGE · 429 RATE_LIMITED
 */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req.headers)) return crossSiteResponse();
  const jar = await cookies();
  const rawAnon = jar.get(ANON_COOKIE)?.value ?? null;
  const anonId = rawAnon && ANON_ID_RE.test(rawAnon) ? rawAnon : null;
  const rl = rateLimit("events:client", anonId ?? `ip:${clientIp(req.headers)}`, 60, 60_000);
  if (!rl.ok) {
    return Response.json({ error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }
  const json = await readJsonCapped(req, 2_048);
  if (json instanceof Response) return json;
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY" }, { status: 400 });

  const session = await getSession().catch(() => null);
  void track(parsed.data.name, { ...parsed.data.props, device: deviceOf(req.headers) }, { userId: session?.user.id ?? null, anonId });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
