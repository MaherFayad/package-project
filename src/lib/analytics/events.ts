/**
 * First-party analytics event names (B-19). Shared by the server `track()` and the browser
 * `trackClient()`, so this file must stay free of server imports.
 *
 * ANALYTICS_EVENTS is exactly the 17 events of docs/business/launch-metrics.md §1 (the designer
 * programme pair `designer_account_created` / `referral_order_paid` is Phase 3 and not emitted:
 * there are no designer accounts yet, see Order.referrerId).
 *
 * OPS_EVENTS are operational events that are not funnel steps but feed a §3 metric
 * ("WhatsApp follow-up conversion"); they are only ever written by server jobs.
 */
export const ANALYTICS_EVENTS = [
  "visit",
  "design_started",
  "artwork_uploaded",
  "design_completed",
  "gate_shown",
  "account_created",
  "price_viewed",
  "export_png",
  "design_saved",
  "share_link_created",
  "share_link_visit",
  "order_started",
  "proof_approved",
  "payment_succeeded",
  "order_delivered",
  "reprint_opened",
  "dispute_opened",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const OPS_EVENTS = ["whatsapp_followup_sent"] as const;
export type OpsEvent = (typeof OPS_EVENTS)[number];

export type EventName = AnalyticsEvent | OpsEvent;

/**
 * The only names POST /api/events accepts: actions that happen purely in the browser. Everything
 * else is emitted from the server seam where it really happens (a browser cannot claim a payment,
 * an account or a price view).
 */
export const CLIENT_EVENTS = ["visit", "artwork_uploaded", "design_completed", "gate_shown", "export_png", "design_saved"] as const satisfies readonly AnalyticsEvent[];
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

/** Soft-gate reasons (designer Modals.tsx GateReason). */
export const GATE_REASONS = ["price", "save", "export", "share", "order"] as const;
export type GateReasonCode = (typeof GATE_REASONS)[number];

/** Short-lived cookie carrying the last gate reason to verify-otp (enum value only, no identifier). */
export const GATE_COOKIE = "elba_gate";

/** A flat property bag: small scalars only. */
export type EventProps = Record<string, string | number | boolean | null | undefined>;

export const isEventName = (n: unknown): n is EventName =>
  typeof n === "string" && ((ANALYTICS_EVENTS as readonly string[]).includes(n) || (OPS_EVENTS as readonly string[]).includes(n));
