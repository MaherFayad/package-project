/**
 * R4-B-07 / R4-CR-12: Elba may only title a document "Tax invoice" once the seller's tax
 * registration number is configured (VAT Law 67/2016, ETA e-invoicing). Until then the buyer gets
 * an "Order receipt (not a tax invoice)" with the same lines and VAT, and no ETA block.
 */
export function sellerTaxReady(env: Record<string, string | undefined> = process.env): boolean {
  return /^\d{9}$/.test((env.ELBA_TAX_ID ?? "").replace(/[\s-]/g, ""));
}
