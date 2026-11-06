import { z } from "zod";

/**
 * Quote leads inbox (B-15, admin half). A lead is a Quote with status REQUESTED (above the
 * 2,000-unit instant cap, or a catalogue model without an instant price). Ops follow-up is kept
 * in the audit log (QUOTE_CONTACTED, QUOTE_CLOSED) so the Quote row, which checkout and the buyer's
 * account read, keeps its status. SLA: a reply within one working day (24 h), research report §4.1.
 */

/**
 * PRICED (R4-B-03): ops sent a fixed price (QUOTE_PRICED audit row, Quote.status PRICED); ops
 * follows it up before it expires. ORDERED: the buyer paid the sent price (Quote.status ACCEPTED).
 */
export type LeadState = "OPEN" | "CONTACTED" | "PRICED" | "ORDERED" | "CLOSED";
export const LEAD_VIEWS = ["open", "overdue", "contacted", "priced", "closed", "all"] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];

export const leadStepSchema = z.object({
  quoteId: z.string().min(1).max(40),
  step: z.enum(["CONTACTED", "CLOSED"]),
  note: z.string().trim().min(3).max(500),
});

const STEP_STATE: Record<string, LeadState> = { QUOTE_CONTACTED: "CONTACTED", QUOTE_PRICED: "PRICED", QUOTE_CLOSED: "CLOSED" };

/**
 * Latest admin outcome wins; no outcome = OPEN. A quote the buyer accepted is ORDERED whatever
 * came before (`quoteStatus` ACCEPTED), and a closed lead stays closed.
 */
export function leadState(events: { action: string; createdAt: Date }[], quoteStatus?: string): LeadState {
  if (quoteStatus === "ACCEPTED") return "ORDERED";
  const last = [...events].filter((e) => Object.hasOwn(STEP_STATE, e.action)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const state = last ? STEP_STATE[last.action]! : "OPEN";
  // A PRICED row is priced whatever the log says (a price written by another path has no
  // QUOTE_PRICED row); only a later close ends it.
  return quoteStatus === "PRICED" && state !== "CLOSED" ? "PRICED" : state;
}

/**
 * Reply due for a request (R4-07): one working day = 24 hours counted on Egyptian working days
 * (Sunday to Thursday, Africa/Cairo); Friday and Saturday do not run the clock. A Thursday 17:00
 * request is due Sunday 17:00, a Friday request Monday 00:00, instead of turning red on the weekend.
 */
export function replyDueAt(createdAt: Date, hours = 24): Date {
  let t = createdAt.getTime();
  let left = hours * 3_600_000;
  for (let guard = 0; left > 0 && guard < 60; guard++) {
    const { weekday, msIntoDay } = cairoClock(new Date(t));
    const toMidnight = 86_400_000 - msIntoDay;
    if (weekday === 5 || weekday === 6) {
      t += toMidnight; // Friday / Saturday: jump to the next Cairo midnight
      continue;
    }
    const step = Math.min(left, toMidnight);
    t += step;
    left -= step;
  }
  return new Date(t);
}

const CAIRO = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Weekday (0 = Sunday) and time since local midnight in Cairo (DST-aware). */
export function cairoClock(d: Date): { weekday: number; msIntoDay: number } {
  const parts = Object.fromEntries(CAIRO.formatToParts(d).map((p) => [p.type, p.value]));
  const ms = ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 + d.getUTCMilliseconds();
  return { weekday: WEEKDAYS[parts.weekday!] ?? 0, msIntoDay: ms };
}

/** Hours left to the 24 h reply target (negative = overdue). Only open leads run the clock. */
export function slaHoursLeft(dueAt: Date, now: Date): number {
  return Math.round(((dueAt.getTime() - now.getTime()) / 3_600_000) * 10) / 10;
}

export function isOverdue(state: LeadState, dueAt: Date, now: Date): boolean {
  return state === "OPEN" && dueAt.getTime() < now.getTime();
}

export function inLeadView(r: { state: LeadState; overdue: boolean }, view: LeadView): boolean {
  switch (view) {
    case "open":
      return r.state === "OPEN";
    case "overdue":
      return r.overdue;
    case "contacted":
      return r.state === "CONTACTED";
    case "priced":
      return r.state === "PRICED";
    case "closed":
      return r.state === "CLOSED" || r.state === "ORDERED";
    default:
      return true;
  }
}

export function asLeadView(v: string | null | undefined): LeadView {
  return (LEAD_VIEWS as readonly string[]).includes(v ?? "") ? (v as LeadView) : "open";
}
