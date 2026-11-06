"use client";

import { CLIENT_EVENTS, GATE_COOKIE, GATE_REASONS, type ClientEvent, type EventProps } from "./events";

/**
 * Browser half of the first-party analytics (B-19). Only the names in CLIENT_EVENTS can be sent
 * (POST /api/events enforces the same allowlist). Uses navigator.sendBeacon so it survives page
 * navigation and never blocks the UI; it never throws.
 *
 * Do not put personal data in `props` (the server drops it anyway): small enums and numbers only.
 */
export function trackClient(name: ClientEvent, props: EventProps = {}): void {
  try {
    if (typeof window === "undefined" || !(CLIENT_EVENTS as readonly string[]).includes(name)) return;
    const body = JSON.stringify({ name, props: { ...props, path: window.location.pathname.slice(0, 120) } });
    if (name === "gate_shown") rememberGateReason(props.gate_reason);
    const blob = new Blob([body], { type: "application/json" });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/events", blob)) return;
    void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
  } catch {
    /* analytics never breaks the page */
  }
}

/**
 * The gate reason travels to /api/auth/verify-otp in a 30-minute cookie scoped to /api/auth so
 * `account_created` can record which gate converted. It holds an enum value only (no identifier).
 */
function rememberGateReason(reason: unknown) {
  if (typeof reason !== "string" || !(GATE_REASONS as readonly string[]).includes(reason)) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${GATE_COOKIE}=${reason}; Max-Age=1800; Path=/api/auth; SameSite=Lax${secure}`;
}

const VISIT_KEY = "elba_visit";
/** A visit ends after 30 minutes without a page view (the common web-analytics session rule). */
export const VISIT_IDLE_MS = 30 * 60_000;

/**
 * Pure: whether this page view starts a new visit, given the stored last-seen time. Exported for
 * tests. A missing, unreadable or future value starts a visit.
 */
export function startsVisit(lastSeen: string | null, now: number): boolean {
  const t = lastSeen === null ? NaN : Number(lastSeen);
  return !Number.isFinite(t) || t > now || now - t >= VISIT_IDLE_MS;
}

/**
 * `visit` = first page view of a browsing session (launch-metrics.md §1). The last-seen time lives
 * in localStorage (shared by every tab, holds a timestamp only, no identifier), so opening links
 * in new tabs does not count new visits; sessionStorage did, because it is per tab.
 */
export function trackVisitOnce(props: EventProps = {}): void {
  try {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const isNew = startsVisit(window.localStorage.getItem(VISIT_KEY), now);
    window.localStorage.setItem(VISIT_KEY, String(now));
    if (!isNew) return;
  } catch {
    return; // storage blocked: skip rather than count every page
  }
  const ref = document.referrer ? safeHost(document.referrer) : null;
  const params = new URLSearchParams(window.location.search);
  const utm: EventProps = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 60);
  }
  trackClient("visit", { ...props, ...utm, referrer_type: referrerType(ref, window.location.host, window.location.pathname, utm) });
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** launch-metrics.md §1 referrer_type: search, social, share link, ads, direct (designer referral: Phase 3). */
export function referrerType(refHost: string | null, selfHost: string, path: string, utm: EventProps): string {
  if (/\/s\/[\w-]+/.test(path)) return "share_link";
  if (utm.utm_medium && /cpc|paid|ads?/i.test(String(utm.utm_medium))) return "ads";
  if (!refHost || refHost === selfHost) return utm.utm_source ? "campaign" : "direct";
  if (/google\.|bing\.|yahoo\.|duckduckgo\.|yandex\./i.test(refHost)) return "search";
  if (/facebook\.|fb\.|instagram\.|t\.co|twitter\.|x\.com|tiktok\.|linkedin\.|whatsapp\.|wa\.me|snapchat\./i.test(refHost)) return "social";
  return "other";
}
