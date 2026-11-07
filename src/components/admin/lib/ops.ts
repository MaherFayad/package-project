import { z } from "zod";
import { MAX_DB_PIASTERS } from "@/lib/money/input";

/**
 * Disputes, vendor applications, vendor status and PDPL requests: admin rules (pure).
 */

/* ───────────────────────── Disputes ───────────────────────── */

export const DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED_REPRINT", "RESOLVED_REFUND", "REJECTED"] as const;
export type DisputeStatusValue = (typeof DISPUTE_STATUSES)[number];
export const DISPUTE_VIEWS = ["open", "resolved", "all"] as const;
export type DisputeView = (typeof DISPUTE_VIEWS)[number];

export function isOpenDispute(status: string): boolean {
  return status === "OPEN" || status === "UNDER_REVIEW";
}

export function asDisputeView(v: string | null | undefined): DisputeView {
  return (DISPUTE_VIEWS as readonly string[]).includes(v ?? "") ? (v as DisputeView) : "open";
}

export function inDisputeView(status: string, view: DisputeView): boolean {
  if (view === "all") return true;
  return view === "open" ? isOpenDispute(status) : !isOpenDispute(status);
}

export const DISPUTE_DECISIONS = ["REVIEW", "REPRINT", "REFUND", "REJECT"] as const;
export type DisputeDecision = (typeof DISPUTE_DECISIONS)[number];

export const disputeDecisionSchema = z
  .object({
    disputeId: z.string().min(1).max(40),
    decision: z.enum(DISPUTE_DECISIONS),
    note: z.string().trim().max(1000).default(""),
    /** Reprint only: vendor for the reprint (defaults to the original vendor). */
    vendorId: z.string().min(1).max(40).optional(),
    /** Reprint only (R5-JR-09): boxes to redo and the charge-back to the original printer. */
    reprintQuantity: z.number().int().min(1).max(1_000_000).optional(),
    chargeBack: z.enum(["FULL", "PARTIAL", "NONE"]).optional(),
    chargeBackPiasters: z.number().int().min(0).max(MAX_DB_PIASTERS).optional(),
  })
  .refine((d) => d.decision === "REVIEW" || d.note.length >= 3, { message: "NOTE_REQUIRED", path: ["note"] });

/** Which decisions are possible from a dispute status. */
export function allowedDecisions(status: string): DisputeDecision[] {
  if (status === "OPEN") return ["REVIEW", "REPRINT", "REFUND", "REJECT"];
  if (status === "UNDER_REVIEW") return ["REPRINT", "REFUND", "REJECT"];
  return [];
}

export function statusForDecision(d: DisputeDecision): DisputeStatusValue {
  return d === "REVIEW" ? "UNDER_REVIEW" : d === "REPRINT" ? "RESOLVED_REPRINT" : d === "REFUND" ? "RESOLVED_REFUND" : "REJECTED";
}

/* ───────────────────────── Vendor applications ───────────────────────── */

/**
 * Verification checklist (report §4.1 vendor flow; docs/business/vendor-visit-checklist.md).
 * Every required item must be ticked before approval; FOOD_SAFE_EVIDENCE is optional (only
 * needed for the food-safe badge).
 */
export const APPLICATION_CHECKLIST = [
  { id: "COMMERCIAL_REGISTER", required: true },
  { id: "TAX_CARD", required: true },
  { id: "FACTORY_VISIT", required: true },
  { id: "MACHINES_VERIFIED", required: true },
  { id: "TEST_JOB", required: true },
  { id: "PORTFOLIO_PHOTOS", required: true },
  { id: "FRAMEWORK_AGREEMENT", required: true },
  { id: "FOOD_SAFE_EVIDENCE", required: false },
] as const;
export type ChecklistItemId = (typeof APPLICATION_CHECKLIST)[number]["id"];
export const CHECKLIST_IDS = APPLICATION_CHECKLIST.map((c) => c.id) as ChecklistItemId[];

export function missingRequired(checked: string[]): ChecklistItemId[] {
  const set = new Set(checked);
  return APPLICATION_CHECKLIST.filter((c) => c.required && !set.has(c.id)).map((c) => c.id);
}

export function canApprove(checked: string[]): boolean {
  return missingRequired(checked).length === 0;
}

export const applicationDecisionSchema = z
  .object({
    applicationId: z.string().min(1).max(40),
    decision: z.enum(["UNDER_REVIEW", "APPROVE", "REJECT"]),
    checklist: z.array(z.enum(CHECKLIST_IDS as [ChecklistItemId, ...ChecklistItemId[]])).max(CHECKLIST_IDS.length).default([]),
    note: z.string().trim().max(1000).default(""),
  })
  .refine((d) => d.decision !== "REJECT" || d.note.length >= 3, { message: "NOTE_REQUIRED", path: ["note"] })
  .refine((d) => d.decision !== "APPROVE" || canApprove(d.checklist), { message: "CHECKLIST_INCOMPLETE", path: ["checklist"] });

export function canDecideApplication(status: string): boolean {
  return status === "SUBMITTED" || status === "UNDER_REVIEW";
}

/** Review note stored on the application: the ticked checklist plus the free text. */
export function encodeReviewNote(checklist: string[], note: string): string {
  return JSON.stringify({ checklist, note });
}

export function decodeReviewNote(raw: string | null): { checklist: string[]; note: string } {
  if (!raw) return { checklist: [], note: "" };
  try {
    const v = JSON.parse(raw) as { checklist?: unknown; note?: unknown };
    return {
      checklist: Array.isArray(v.checklist) ? v.checklist.filter((x): x is string => typeof x === "string") : [],
      note: typeof v.note === "string" ? v.note : "",
    };
  } catch {
    return { checklist: [], note: raw };
  }
}

/* ───────────────────────── Vendor status ───────────────────────── */

export const vendorStatusSchema = z
  .object({
    vendorId: z.string().min(1).max(40),
    action: z.enum(["SUSPEND", "REINSTATE", "VERIFY", "UNVERIFY"]),
    reason: z.string().trim().max(500).default(""),
  })
  .refine((d) => d.action !== "SUSPEND" || d.reason.length >= 3, { message: "NOTE_REQUIRED", path: ["reason"] });

export function vendorStatusAfter(current: { status: string; verified: boolean }, action: "SUSPEND" | "REINSTATE" | "VERIFY" | "UNVERIFY"): { status: string; verified: boolean } | null {
  switch (action) {
    case "SUSPEND":
      return current.status === "ACTIVE" ? { status: "SUSPENDED", verified: current.verified } : null;
    case "REINSTATE":
      return current.status === "SUSPENDED" ? { status: "ACTIVE", verified: current.verified } : null;
    case "VERIFY":
      return current.status !== "PENDING" && !current.verified ? { status: current.status, verified: true } : null;
    case "UNVERIFY":
      return current.verified ? { status: current.status, verified: false } : null;
  }
}

/* ───────────────────────── PDPL data requests ───────────────────────── */

export const DATA_REQUEST_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "REJECTED"] as const;

export const dataRequestDecisionSchema = z
  .object({
    requestId: z.string().min(1).max(40),
    decision: z.enum(["START", "COMPLETE", "REJECT"]),
    note: z.string().trim().max(1000).default(""),
  })
  .refine((d) => d.decision !== "REJECT" || d.note.length >= 3, { message: "NOTE_REQUIRED", path: ["note"] });

export function canDecideRequest(status: string): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}

/** Order statuses that block account deletion (money or goods still moving). */
export const ACTIVE_ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PROOF_APPROVED", "ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "SHIPPED"];

export function deletionBlockers(orders: { status: string }[], disputes: { status: string }[]): ("ACTIVE_ORDERS" | "OPEN_DISPUTES")[] {
  const out: ("ACTIVE_ORDERS" | "OPEN_DISPUTES")[] = [];
  if (orders.some((o) => ACTIVE_ORDER_STATUSES.includes(o.status))) out.push("ACTIVE_ORDERS");
  if (disputes.some((d) => isOpenDispute(d.status))) out.push("OPEN_DISPUTES");
  return out;
}

/** Phone placeholder that keeps User.phone unique after anonymisation. */
export function anonymisedPhone(userId: string): string {
  return `deleted:${userId}`;
}

/** Mask a phone for lists: +2010****0002. */
export function maskPhone(phone: string): string {
  if (phone.startsWith("deleted:")) return "—";
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 5)}****${phone.slice(-4)}`;
}

/* ───────────── Reprint quantity and charge-back (journeys R5-JR-09) ───────────── */

/**
 * A reprint redoes only the defective boxes, and the printer that caused a print defect pays for
 * it by default. The admin picks per dispute: FULL (default for PRINT_DEFECT), PARTIAL (an amount)
 * or NONE (default for other reasons: late, damaged in transit, wrong item from our side). The
 * policy itself (when to charge back, limits) is a founder decision; this is the mechanism.
 */
export const CHARGE_BACK_MODES = ["FULL", "PARTIAL", "NONE"] as const;
export type ChargeBackMode = (typeof CHARGE_BACK_MODES)[number];

export function defaultChargeBack(reason: string): ChargeBackMode {
  return reason === "PRINT_DEFECT" ? "FULL" : "NONE";
}

export const reprintTermsSchema = z.object({
  quantity: z.number().int().min(1).max(1_000_000),
  chargeBack: z.enum(CHARGE_BACK_MODES),
  /** PARTIAL only: piasters charged back to the original printer. */
  chargeBackPiasters: z.number().int().min(0).max(MAX_DB_PIASTERS).optional(),
});
export type ReprintTerms = z.infer<typeof reprintTermsSchema>;

export interface ReprintPlan {
  quantity: number;
  /** The buy price of the reprinted boxes (pro rata of the original buy price). */
  reprintCostPiasters: number;
  chargeBackPiasters: number;
  /** What Elba pays the reprint printer. */
  reprintVendorCostPiasters: number;
  /** New buy price of the ORIGINAL order (charge-back taken off it) when another printer reprints. */
  originalVendorCostPiasters: number;
  /** Charge-back larger than what is still unpaid on the original: recover off-platform. */
  owedPiasters: number;
}

/**
 * Same printer: it reprints at its own cost for the charged-back part (Elba pays the rest).
 * Another printer: it is paid in full; the charge-back comes off the original printer's buy price,
 * and whatever exceeds its unpaid balance is owed back.
 */
export function planReprint(p: { originalQty: number; originalCostPiasters: number; paidToOriginalPiasters: number; sameVendor: boolean; terms: ReprintTerms }): ReprintPlan | "QTY_RANGE" | "CHARGE_RANGE" {
  const { terms } = p;
  if (terms.quantity < 1 || terms.quantity > p.originalQty) return "QTY_RANGE";
  const reprintCost = Math.round((p.originalCostPiasters * terms.quantity) / p.originalQty);
  const charge = terms.chargeBack === "FULL" ? reprintCost : terms.chargeBack === "NONE" ? 0 : (terms.chargeBackPiasters ?? -1);
  if (charge < 0 || charge > reprintCost) return "CHARGE_RANGE";
  if (p.sameVendor) {
    return { quantity: terms.quantity, reprintCostPiasters: reprintCost, chargeBackPiasters: charge, reprintVendorCostPiasters: reprintCost - charge, originalVendorCostPiasters: p.originalCostPiasters, owedPiasters: 0 };
  }
  const newOriginal = Math.max(p.paidToOriginalPiasters, p.originalCostPiasters - charge);
  const owed = Math.max(0, charge - (p.originalCostPiasters - newOriginal));
  return { quantity: terms.quantity, reprintCostPiasters: reprintCost, chargeBackPiasters: charge, reprintVendorCostPiasters: reprintCost, originalVendorCostPiasters: newOriginal, owedPiasters: owed };
}
