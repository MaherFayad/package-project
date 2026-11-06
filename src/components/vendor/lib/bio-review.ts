/**
 * Bio review (B-08 / round 5): a vendor's bio is public text, so an edit goes live only after Elba
 * ops approves it. The live bio (`bioAr` / `bioEn`) keeps showing on the public profile meanwhile.
 * Pure helpers shared by the vendor portal (save) and the admin moderation queue (decide).
 */
import { findContactDetails } from "./contact";

export type BioReviewStatus = "PENDING" | "REJECTED";

export interface BioState {
  bioAr: string;
  bioEn: string;
  bioArPending: string | null;
  bioEnPending: string | null;
  bioReviewStatus: string | null;
  bioReviewNote?: string | null;
}

/**
 * Data to write when the vendor saves `next`. Same text as live: nothing waits (a pending edit is
 * withdrawn). Different: the edit waits for review (a rejected edit goes back to PENDING).
 */
export function bioSaveData(cur: BioState, next: { bioAr: string; bioEn: string }, now = new Date()) {
  if (next.bioAr === cur.bioAr && next.bioEn === cur.bioEn) {
    return { bioArPending: null, bioEnPending: null, bioReviewStatus: null, bioReviewNote: null, bioSubmittedAt: null };
  }
  const unchangedPending = cur.bioReviewStatus === "PENDING" && cur.bioArPending === next.bioAr && cur.bioEnPending === next.bioEn;
  return {
    bioArPending: next.bioAr,
    bioEnPending: next.bioEn,
    bioReviewStatus: "PENDING" as const,
    bioReviewNote: null,
    ...(unchangedPending ? {} : { bioSubmittedAt: now }),
  };
}

/** The text the vendor edits: the waiting (or rejected) edit if there is one, else the live bio. */
export function bioForEditing(cur: BioState): { bioAr: string; bioEn: string } {
  return cur.bioReviewStatus ? { bioAr: cur.bioArPending ?? cur.bioAr, bioEn: cur.bioEnPending ?? cur.bioEn } : { bioAr: cur.bioAr, bioEn: cur.bioEn };
}

/** Ops may approve only a waiting edit that passes the contact filter. */
export function canApproveBio(cur: BioState): boolean {
  return cur.bioReviewStatus === "PENDING" && findContactDetails(cur.bioArPending).length === 0 && findContactDetails(cur.bioEnPending).length === 0;
}

/** Data the admin queue writes for a decision. A rejection keeps the text so the vendor can fix it. */
export function bioReviewData(decision: "APPROVE" | "REJECT", cur: BioState, note?: string) {
  if (decision === "APPROVE") {
    return {
      bioAr: cur.bioArPending ?? cur.bioAr,
      bioEn: cur.bioEnPending ?? cur.bioEn,
      bioArPending: null,
      bioEnPending: null,
      bioReviewStatus: null,
      bioReviewNote: null,
      bioSubmittedAt: null,
    };
  }
  return { bioReviewStatus: "REJECTED" as const, bioReviewNote: (note ?? "").trim() || null };
}
