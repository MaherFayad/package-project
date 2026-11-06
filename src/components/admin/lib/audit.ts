/** Audit log action codes (pure, shared by server and client). Labels: admin.audit.actions.<CODE>. */
export const AUDIT_ACTIONS = [
  "ORDER_REASSIGN",
  "ORDER_OVERRIDE",
  "ORDER_REFUND",
  "ORDER_QC_APPROVE",
  "ORDER_QC_REJECT",
  "ORDER_SHIP",
  "ORDER_NOTE",
  "ORDER_REPRINT",
  "VENDOR_SUSPEND",
  "VENDOR_REINSTATE",
  "VENDOR_VERIFY",
  "VENDOR_UNVERIFY",
  "APPLICATION_REVIEW",
  "APPLICATION_APPROVE",
  "APPLICATION_REJECT",
  "DISPUTE_REVIEW",
  "DISPUTE_REPRINT",
  "DISPUTE_REFUND",
  "DISPUTE_REJECT",
  "PRICING_SETTINGS",
  "PRICING_INDEX",
  "STRUCTURE_UPDATE",
  "MATERIAL_UPDATE",
  "FINISH_UPDATE",
  "DATA_EXPORT",
  "DATA_REQUEST_START",
  "DATA_REQUEST_COMPLETE",
  "DATA_REQUEST_REJECT",
  "USER_ANONYMISE",
  "PAYOUT_RAISE",
  "PAYOUT_APPROVE",
  "PAYOUT_PAY",
  "PORTFOLIO_APPROVE",
  "PORTFOLIO_REJECT",
  "VENDOR_BIO_CLEAN",
  "VENDOR_BIO_APPROVE",
  "VENDOR_BIO_REJECT",
  "CHECKOUT_SETTINGS",
  "QUOTE_REQUEST",
  "QUOTE_CONTACTED",
  "QUOTE_CLOSED",
  "QUOTE_PRICED",
  "QUOTE_ACCEPTED",
  "VENDOR_METRICS_SETTINGS",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * R4-CR-13: older rows embed raw record ids ("… photo cmw4ogi87000…"). The id stays in Changes
 * and in search; the summary line drops it. New rows store the caption instead.
 */
export function readableSummary(s: string): string {
  return s.replace(/\s*\bc(?=[a-z0-9]*\d)[a-z0-9]{20,30}\b/g, "").replace(/\s{2,}/g, " ").trim();
}
