/**
 * Vendor job state machine (pure, no DB). A "job" is an Order seen from the vendor's side.
 *
 *   PAID / PROOF_APPROVED (paid)  --accept-->  ACCEPTED  --startProduction-->  IN_PRODUCTION
 *   IN_PRODUCTION  --submitQc (first-sheet + packed-bundle photos)-->  QC_PENDING
 *   QC_PENDING  --(ops approves, QC_APPROVED)-->  READY_TO_SHIP   (admin)
 *   QC_PENDING  --(ops rejects, QC_REJECTED)-->  IN_PRODUCTION   (admin; vendor re-uploads, submits again)
 *   awaiting  --decline (reason)-->  VENDOR_DECLINED event; status unchanged, ops re-routes the order.
 *
 * Status edges are the shared graph in src/lib/orders/state.ts (checkout owner); the server
 * re-checks every move with assertTransition(from, to, "VENDOR"). Shipping, delivery,
 * cancellation and refunds belong to ops / checkout.
 */
import type { OrderStatus } from "@/types";
import { PROBLEM_TONE, statusTone } from "@/lib/orders/status-tone";

export const DUE_SOON_DAYS = 3;
const DAY_MS = 86_400_000;

/** Statuses in which a paid job waits for the vendor's accept/decline. */
export const AWAITING_STATUSES: readonly OrderStatus[] = ["PAID", "PROOF_APPROVED"];
/** Statuses the vendor is working on. */
export const ACTIVE_STATUSES: readonly OrderStatus[] = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING"];
/** Statuses that count as "not yet out of the factory". */
export const OPEN_STATUSES: readonly OrderStatus[] = [...AWAITING_STATUSES, ...ACTIVE_STATUSES, "READY_TO_SHIP"];
/** Statuses the vendor can see at all (pending payment is never routed to a vendor). */
export const VENDOR_VISIBLE_STATUSES: readonly OrderStatus[] = [
  ...OPEN_STATUSES,
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

export const DECLINE_REASONS = [
  "CAPACITY",
  "MATERIAL_UNAVAILABLE",
  "SPEC_NOT_SUPPORTED",
  "ARTWORK_ISSUE",
  "LEAD_TIME",
  "OTHER",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const QC_PHOTO_KINDS = ["FIRST_SHEET", "PACKED_BUNDLE", "OTHER"] as const;
export type QcPhotoKind = (typeof QC_PHOTO_KINDS)[number];
export type QcPhotoStatus = "PENDING" | "APPROVED" | "REJECTED";

export type JobAction =
  | "accept"
  | "decline"
  | "startProduction"
  | "uploadQc"
  | "submitQc"
  | "addNote";

export const JOB_VIEWS = ["all", "awaiting", "active", "qc", "ready", "done", "declined"] as const;
export type JobView = (typeof JOB_VIEWS)[number];

export type QcState = "none" | "submitted" | "approved" | "rejected";
export type DueState = "overdue" | "dueSoon" | "onTrack" | "none";

export interface JobEventLike {
  type: string;
  createdAt: Date | string;
}

export interface JobStateInput {
  status: OrderStatus | string;
  paidAt: Date | string | null;
  events: JobEventLike[];
  qcPhotos: { kind: string; status: string }[];
}

const time = (d: Date | string) => (typeof d === "string" ? new Date(d) : d).getTime();

/** Latest event among `types` (ties: later in the array wins, matching insertion order). */
export function latestEvent<E extends JobEventLike>(events: E[], types: readonly string[]): E | null {
  let best: E | null = null;
  for (const e of events) {
    if (!types.includes(e.type)) continue;
    if (!best || time(e.createdAt) >= time(best.createdAt)) best = e;
  }
  return best;
}

/** The vendor declined and ops has not re-routed it back yet (status still awaiting). */
export function isDeclined(job: JobStateInput): boolean {
  if (!AWAITING_STATUSES.includes(job.status as OrderStatus)) return false;
  return latestEvent(job.events, ["VENDOR_ACCEPTED", "VENDOR_DECLINED"])?.type === "VENDOR_DECLINED";
}

/** Paid, routed to this vendor and waiting for accept/decline. */
export function isAwaitingAcceptance(job: JobStateInput): boolean {
  return AWAITING_STATUSES.includes(job.status as OrderStatus) && job.paidAt !== null && !isDeclined(job);
}

export function qcState(job: JobStateInput): QcState {
  const e = latestEvent(job.events, ["QC_UPLOADED", "QC_APPROVED", "QC_REJECTED"]);
  if (!e) return "none";
  if (e.type === "QC_APPROVED") return "approved";
  if (e.type === "QC_REJECTED") return "rejected";
  return "submitted";
}

/** Ops needs at least one first-printed-sheet photo and one packed-bundle photo (not rejected). */
export function hasRequiredQcPhotos(photos: { kind: string; status: string }[]): boolean {
  const ok = photos.filter((p) => p.status !== "REJECTED");
  return ok.some((p) => p.kind === "FIRST_SHEET") && ok.some((p) => p.kind === "PACKED_BUNDLE");
}

/** What the vendor may do right now. The server re-checks this on every mutation. */
export function allowedActions(job: JobStateInput): JobAction[] {
  const s = job.status as OrderStatus;
  const out: JobAction[] = [];
  if (isAwaitingAcceptance(job)) out.push("accept", "decline");
  if (s === "ACCEPTED") out.push("startProduction");
  if (s === "IN_PRODUCTION") {
    out.push("uploadQc");
    if (hasRequiredQcPhotos(job.qcPhotos)) out.push("submitQc");
  }
  if (s !== "CANCELLED" && s !== "REFUNDED") out.push("addNote");
  return out;
}

export function can(job: JobStateInput, action: JobAction): boolean {
  return allowedActions(job).includes(action);
}

/** Target status of a status-changing action (null when the action keeps the status). */
export function nextStatus(action: JobAction): OrderStatus | null {
  switch (action) {
    case "accept":
      return "ACCEPTED";
    case "startProduction":
      return "IN_PRODUCTION";
    case "submitQc":
      return "QC_PENDING";
    default:
      return null;
  }
}

/** Production event written for an action. */
export function eventFor(action: JobAction): string | null {
  switch (action) {
    case "accept":
      return "VENDOR_ACCEPTED";
    case "decline":
      return "VENDOR_DECLINED";
    case "startProduction":
      return "PRODUCTION_STARTED";
    case "submitQc":
      return "QC_UPLOADED";
    case "addNote":
      return "NOTE";
    default:
      return null;
  }
}

/** Index-table view bucket for a job. */
export function jobView(job: JobStateInput): Exclude<JobView, "all"> {
  const s = job.status as OrderStatus;
  if (isDeclined(job)) return "declined";
  if (isAwaitingAcceptance(job)) return "awaiting";
  if (s === "QC_PENDING") return "qc";
  if (s === "ACCEPTED" || s === "IN_PRODUCTION") return "active";
  if (s === "READY_TO_SHIP") return "ready";
  return "done";
}

export function dueState(dueDate: Date | string | null, status: OrderStatus | string, now: Date = new Date()): DueState {
  if (!dueDate || !OPEN_STATUSES.includes(status as OrderStatus)) return "none";
  const diff = time(dueDate) - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= DUE_SOON_DAYS * DAY_MS) return "dueSoon";
  return "onTrack";
}

/** Whole days until due (negative when overdue), rounded towards "less time left". */
export function daysUntil(dueDate: Date | string, now: Date = new Date()): number {
  return Math.floor((time(dueDate) - now.getTime()) / DAY_MS);
}

export type BadgeToneLite = "neutral" | "info" | "success" | "attention" | "warning" | "critical";
export type BadgeProgress = "incomplete" | "partiallyComplete" | "complete";

/** Pill badge for a job's status (colour + progress pip; label comes from orderStatus.* or vendorPortal.views.*). */
export function statusBadge(job: JobStateInput): { tone: BadgeToneLite; progress: BadgeProgress } {
  // Vendor-only states (declined, QC sent back) are problems; everything else uses the shared map (CR-08).
  if (jobView(job) === "declined") return PROBLEM_TONE;
  if (job.status === "IN_PRODUCTION" && qcState(job) === "rejected") return { tone: "critical", progress: "partiallyComplete" };
  return statusTone(job.status);
}

/* ───────────── Filtering / sorting for the jobs index ───────────── */

export interface JobRow extends JobStateInput {
  id: string;
  number: string;
  buyerName: string;
  structureCode: string;
  /** Exact library model (search matches its reference and both names). */
  model?: { code: string; standard: string; name: { ar: string; en: string } } | null;
  quantity: number;
  dueDate: Date | string | null;
  placedAt: Date | string;
  vendorCostPiasters: number;
}

export const JOB_SORTS = ["due", "newest", "oldest", "value"] as const;
export type JobSort = (typeof JOB_SORTS)[number];

export interface JobFilter {
  view?: JobView;
  query?: string;
  structure?: string | null;
  dueSoonOnly?: boolean;
  sort?: JobSort;
  now?: Date;
}

/** Normalise Arabic-Indic digits and case for search. */
export function normaliseQuery(q: string): string {
  return q
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .trim()
    .toLowerCase();
}

export function filterJobs<T extends JobRow>(rows: T[], f: JobFilter = {}): T[] {
  const q = normaliseQuery(f.query ?? "");
  const now = f.now ?? new Date();
  const out = rows.filter((r) => {
    if (f.view && f.view !== "all" && jobView(r) !== f.view) return false;
    if (f.structure && r.structureCode !== f.structure) return false;
    if (f.dueSoonOnly) {
      const d = dueState(r.dueDate, r.status, now);
      if (d !== "dueSoon" && d !== "overdue") return false;
    }
    if (q) {
      const m = r.model;
      const hay = `${r.number} ${r.buyerName} ${m ? `${m.code} ${m.standard} ${m.name.ar} ${m.name.en}` : ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const sort = f.sort ?? "due";
  const far = Number.MAX_SAFE_INTEGER;
  out.sort((a, b) => {
    switch (sort) {
      case "newest":
        return time(b.placedAt) - time(a.placedAt);
      case "oldest":
        return time(a.placedAt) - time(b.placedAt);
      case "value":
        return b.vendorCostPiasters - a.vendorCostPiasters;
      default: {
        // Open jobs first by due date, then everything else newest first.
        const ao = OPEN_STATUSES.includes(a.status as OrderStatus) ? 0 : 1;
        const bo = OPEN_STATUSES.includes(b.status as OrderStatus) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        if (ao === 0) return (a.dueDate ? time(a.dueDate) : far) - (b.dueDate ? time(b.dueDate) : far);
        return time(b.placedAt) - time(a.placedAt);
      }
    }
  });
  return out;
}

export function countByView(rows: JobStateInput[]): Record<JobView, number> {
  const c = Object.fromEntries(JOB_VIEWS.map((v) => [v, 0])) as Record<JobView, number>;
  for (const r of rows) {
    c.all += 1;
    c[jobView(r)] += 1;
  }
  return c;
}

/** Build the note stored on a VENDOR_DECLINED event: "REASON: free text". */
export function declineNote(reason: DeclineReason, detail: string): string {
  // One line: buyer timelines show only the reason code of a "REASON: detail" note, and a line
  // break would make the note read as free text there (R4).
  const d = detail.replace(/\s+/g, " ").trim();
  return d ? `${reason}: ${d}` : reason;
}

export function parseDeclineNote(note: string | null | undefined): { reason: DeclineReason | null; detail: string } {
  if (!note) return { reason: null, detail: "" };
  const m = /^([A-Z_]+)(?::\s?([\s\S]*))?$/.exec(note);
  if (m && (DECLINE_REASONS as readonly string[]).includes(m[1]!)) {
    return { reason: m[1] as DeclineReason, detail: (m[2] ?? "").trim() };
  }
  return { reason: null, detail: note };
}
