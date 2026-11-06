/**
 * Egyptian Tax Authority e-invoicing / e-receipt seam (B-13). Documented stub, like
 * `src/lib/payments`: nothing is sent to the ETA yet, and invoices keep `etaStatus` "PENDING".
 *
 * To go live, implement `EtaAdapter` for an accredited provider (or the ETA API directly with a
 * signing token), select it with ETA_PROVIDER, and call `submitInvoice` after an invoice is
 * issued (service: payment confirmed). B2B invoices carry the buyer's 9-digit tax registration
 * number (Organization.taxId, entered at checkout); B2C sales above the ETA threshold go out as
 * e-receipts. Item codes (EGS) per structure are still to be assigned.
 */
export interface EtaInvoiceInput {
  invoiceNumber: string;
  issuedAt: Date;
  /** "B" = business buyer with a tax registration number, "P" = person (e-receipt). */
  receiverType: "B" | "P";
  receiver: { name: string; taxId?: string | null; address?: string };
  lines: { description: string; itemCode: string | null; quantity: number; unitPiasters: number; totalPiasters: number }[];
  subtotalPiasters: number;
  vatPiasters: number;
  totalPiasters: number;
}

export interface EtaSubmission {
  status: "PENDING" | "SUBMITTED" | "VALID" | "INVALID";
  uuid: string | null;
  error?: string;
}

export interface EtaAdapter {
  readonly name: string;
  submitInvoice(input: EtaInvoiceInput): Promise<EtaSubmission>;
}

/** Default: records nothing remotely, leaves the invoice pending submission. */
export const pendingEtaAdapter: EtaAdapter = {
  name: "pending",
  async submitInvoice() {
    return { status: "PENDING", uuid: null };
  },
};

export function getEtaAdapter(): EtaAdapter {
  return pendingEtaAdapter;
}

/** Receiver type from the buyer's company details. */
export function receiverTypeFor(taxId: string | null | undefined): "B" | "P" {
  return taxId && /^\d{9}$/.test(taxId) ? "B" : "P";
}
