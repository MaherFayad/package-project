import { z } from "zod";

/**
 * Quote leads inbox (B-15, admin half). A lead is a Quote with status REQUESTED (above the
 * 2,000-unit instant cap, or a catalogue model without an instant price). Ops follow-up is kept
 * in the audit log (QUOTE_CONTACTED, QUOTE_CLOSED) so the Quote row, which checkout and the buyer's
 * account read, keeps its status. SLA: a reply within one working day (24 h), research report §4.1.
 */

export type LeadState = "OPEN" | "CONTACTED" | "CLOSED";
export const LEAD_VIEWS = ["open", "overdue", "contacted", "closed", "all"] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];

export const leadStepSchema = z.object({
  quoteId: z.string().min(1).max(40),
  step: z.enum(["CONTACTED", "CLOSED"]),
  note: z.string().trim().min(3).max(500),
});

/** Latest admin outcome wins; no outcome = OPEN. */
export function leadState(events: { action: string; createdAt: Date }[]): LeadState {
  const last = [...events].filter((e) => e.action === "QUOTE_CONTACTED" || e.action === "QUOTE_CLOSED").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return last ? (last.action === "QUOTE_CLOSED" ? "CLOSED" : "CONTACTED") : "OPEN";
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
    case "closed":
      return r.state === "CLOSED";
    default:
      return true;
  }
}

export function asLeadView(v: string | null | undefined): LeadView {
  return (LEAD_VIEWS as readonly string[]).includes(v ?? "") ? (v as LeadView) : "open";
}
