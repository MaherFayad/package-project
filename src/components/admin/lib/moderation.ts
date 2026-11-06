import { z } from "zod";
import { findContactDetails, type ContactKind } from "@/components/vendor/lib/contact";

/**
 * Vendor profile moderation (B-08, managed marketplace: research report §0 and §9 risk #1).
 * Portfolio photos go public only after ops approves them; captions and bios are checked with the
 * vendor portal's contact filter (phones, emails, URLs, handles, messenger names) so text saved
 * before the filter existed is caught too.
 */

export const portfolioReviewSchema = z.object({
  itemId: z.string().min(1).max(40),
  decision: z.enum(["APPROVE", "REJECT"]),
  /** Required for a rejection: the vendor sees it next to the photo. */
  note: z.string().trim().max(500).optional(),
});
export type PortfolioReview = z.infer<typeof portfolioReviewSchema>;

export const bioCleanSchema = z.object({ vendorId: z.string().min(1).max(40) });

export function reviewNoteRequired(decision: PortfolioReview["decision"], note: string | undefined): boolean {
  return decision === "REJECT" && (note ?? "").trim().length < 3;
}

/** Contact kinds found in any of the texts (deduplicated, stable order). */
export function contactFlags(...texts: (string | null | undefined)[]): ContactKind[] {
  const out = new Set<ContactKind>();
  for (const t of texts) for (const k of findContactDetails(t)) out.add(k);
  return [...out].sort();
}

/** A caption with contact details cannot be approved as is: ops rejects it with a note. */
export function canApprovePortfolio(item: { status: string; captionAr: string; captionEn: string }): boolean {
  return item.status === "PENDING" && contactFlags(item.captionAr, item.captionEn).length === 0;
}
