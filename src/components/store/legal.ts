/** Legal documents (owner: storefront). Content lives in the dictionaries under legal.<doc>.sections.<id>. */
export const LEGAL_DOCS = {
  privacy: ["controller", "data", "purposes", "legalBasis", "sharing", "transfers", "retention", "rights", "security", "children", "changes"],
  terms: ["service", "accounts", "marketplace", "pricing", "payment", "proof", "artwork", "production", "delivery", "liability", "law"],
  returns: ["custom", "proof", "defects", "howTo", "refunds", "cancellation"],
  cookies: ["essential", "analytics", "choices"],
} as const;

export type LegalDoc = keyof typeof LEGAL_DOCS;
export const LEGAL_DOC_IDS = Object.keys(LEGAL_DOCS) as LegalDoc[];

/** Date of the current drafts (shown as "Last updated"). Bump with every legal text change. */
export const LEGAL_UPDATED = "2026-11-05";

export function isLegalDoc(x: string): x is LegalDoc {
  return Object.prototype.hasOwnProperty.call(LEGAL_DOCS, x);
}

/** Split a dictionary body into paragraphs ("\n\n"). */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
