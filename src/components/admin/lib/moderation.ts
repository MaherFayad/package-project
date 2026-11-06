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

/**
 * Bio edits (R6-05 / R4-B-02): ops approves, rejects (with a reason the vendor sees) or cleans a
 * waiting edit. `submittedAt` is the edit the reviewer saw; a newer save by the vendor makes the
 * decision stale instead of approving text nobody read.
 */
export const bioEditDecisionSchema = z.object({
  vendorId: z.string().min(1).max(40),
  decision: z.enum(["APPROVE", "REJECT", "CLEAN"]),
  submittedAt: z.string().max(40).nullable(),
  note: z.string().trim().max(500).optional(),
});
export type BioEditDecision = z.infer<typeof bioEditDecisionSchema>;

/**
 * R5-AD: word-level diff of a bio edit against the live bio, so the reviewer sees what was added
 * (where contact details usually hide) instead of re-reading two paragraphs. LCS on whitespace
 * tokens; above 800 tokens per side it returns the edit unmarked (bios are capped far lower).
 */
export function wordDiff(live: string, next: string): { text: string; added: boolean }[] {
  const a = live.split(/(\s+)/).filter(Boolean);
  const b = next.split(/(\s+)/).filter(Boolean);
  if (!a.length || a.length > 800 || b.length > 800) return [{ text: next, added: !a.length && !!next }];
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: { text: string; added: boolean }[] = [];
  const push = (text: string, added: boolean) => {
    const last = out[out.length - 1];
    // Whitespace between two added words stays inside the mark.
    if (last && (last.added === added || (/^\s+$/.test(text) && last.added))) last.text += text;
    else out.push({ text, added });
  };
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      push(b[j]!, false);
      i++;
      j++;
    } else if (i < a.length && dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else push(b[j++]!, !/^\s+$/.test(b[j - 1]!) || (out[out.length - 1]?.added ?? false));
  }
  return out;
}
