import { db } from "@/lib/db";
import { isEventName, type EventName, type EventProps } from "./events";

export { ANALYTICS_EVENTS, CLIENT_EVENTS, OPS_EVENTS, type AnalyticsEvent, type EventName, type EventProps } from "./events";

/**
 * Server-side first-party analytics (B-19). One call per real action, from the seam where it
 * happens:
 *
 *   void track("price_viewed", { structure_code: "FEFCO_0427", quantity: 500 }, { userId });
 *
 * - `name` is typed to the 17 events of docs/business/launch-metrics.md §1 (+ ops events) and
 *   re-checked at runtime: an unknown name is logged and dropped.
 * - NEVER throws into the caller and never rejects: a broken analytics write must not break a
 *   checkout, a webhook or a sign-in. Safe to fire-and-forget (`void track(...)`) in route handlers.
 * - PDPL data minimisation (Law 151/2020): rows carry pseudonymous ids only (User.id, the
 *   elba_anon cookie id). Property keys that name personal data (phone, email, name, address, ip,
 *   token, user agent...) and values that look like a phone number, an email or an IP address are
 *   dropped before the write, so a careless caller cannot leak them into analytics.
 * - No third-party pixels or SDKs: the rows live in our own database (Event table), deleted after
 *   13 months by the daily retention job (src/lib/jobs/retention.ts).
 */
export interface TrackContext {
  userId?: string | null;
  anonId?: string | null;
  designId?: string | null;
  orderId?: string | null;
  /** Event time (default: now). The job passes its own `now`. */
  at?: Date;
}

const MAX_KEYS = 24;
const MAX_STRING = 120;
const ID_RE = /^[\w-]{1,64}$/;

/** Keys that name personal data. Matched on `_`-separated words, so `structure_code` is fine. */
const BLOCKED_KEY = /(^|_)(phone|mobile|msisdn|whatsapp|email|mail|ip|ipaddress|address|street|building|apartment|landmark|name|fullname|token|password|otp|code_hash|useragent|user_agent|ua)($|_)/i;
/** Values that look like personal data even under an innocent key. */
const PHONE_VALUE = /(\+?\d[\d\s().-]{6,}\d)/;
const EMAIL_VALUE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const IPV4_VALUE = /\b\d{1,3}(\.\d{1,3}){3}\b/;
const IPV6_VALUE = /(?:[0-9a-f]{1,4}:){2,}|::[0-9a-f]{1,4}/i;

function looksPersonal(v: string): boolean {
  return PHONE_VALUE.test(v) || EMAIL_VALUE.test(v) || IPV4_VALUE.test(v) || IPV6_VALUE.test(v);
}

/** Pure: the props that may be stored (exported for tests). */
export function sanitizeProps(props: EventProps | null | undefined): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!props || typeof props !== "object") return out;
  let n = 0;
  for (const [rawKey, v] of Object.entries(props)) {
    if (n >= MAX_KEYS) break;
    const key = rawKey.trim().slice(0, 40);
    if (!/^[a-z][\w]*$/i.test(key) || BLOCKED_KEY.test(key)) continue;
    if (v === undefined) continue;
    if (v === null || typeof v === "boolean") out[key] = v;
    else if (typeof v === "number") {
      if (!Number.isFinite(v)) continue;
      out[key] = v;
    } else if (typeof v === "string") {
      const s = v.slice(0, MAX_STRING);
      if (looksPersonal(s)) continue;
      out[key] = s;
    } else continue;
    n++;
  }
  return out;
}

const cleanId = (v: string | null | undefined) => (typeof v === "string" && ID_RE.test(v) ? v : null);

export async function track(name: EventName, props: EventProps = {}, ctx: TrackContext = {}): Promise<void> {
  try {
    if (!isEventName(name)) {
      console.warn("[analytics] dropped unknown event", String(name).slice(0, 40));
      return;
    }
    await db.event.create({
      data: {
        name,
        at: ctx.at ?? new Date(),
        userId: cleanId(ctx.userId),
        anonId: cleanId(ctx.anonId),
        designId: cleanId(ctx.designId),
        orderId: cleanId(ctx.orderId),
        props: sanitizeProps(props),
      },
    });
  } catch (e) {
    // Log and swallow: analytics never breaks the caller.
    console.error("[analytics] track failed", name, e instanceof Error ? e.message : e);
  }
}

/** "mobile" | "desktop" from a User-Agent header (the UA itself is never stored). */
export function deviceOf(headers: Headers | null | undefined): "mobile" | "desktop" {
  const ua = headers?.get("user-agent") ?? "";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop";
}
