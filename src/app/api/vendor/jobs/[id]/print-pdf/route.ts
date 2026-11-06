import { fromJson } from "@/lib/json";
import { generatePrintPdf } from "@/lib/orders/pdf/print";
import type { DesignDoc, OrderStatus } from "@/types";
import { PRINT_FILES_UNLOCKED } from "@/lib/orders/state";
import { loadJobItem, safeFilename } from "../../_shared";

/** The print-ready PDF (buyer artwork) unlocks only once the vendor has accepted the job. */
const UNLOCKED = PRINT_FILES_UNLOCKED;

/**
 * GET /api/vendor/jobs/<orderId>/print-pdf[?item=<itemId>]
 * Uses the stored OrderItem.printPdfUrl when checkout generated one; otherwise renders it now
 * from the approved proof snapshot with the shared generator (src/lib/orders/pdf/print.ts).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  const r = await loadJobItem((await params).id, url.searchParams.get("item"));
  if (r instanceof Response) return r;
  const { order, item, user } = r;
  if (user.role !== "ADMIN" && !UNLOCKED.includes(order.status as OrderStatus)) {
    return Response.json({ error: "NOT_ALLOWED" }, { status: 409 });
  }
  // Only our own stored route; never follow a stored value off-site ("//host" is protocol-relative).
  if (item.printPdfUrl && item.printPdfUrl.startsWith("/api/orders/")) {
    return Response.redirect(new URL(item.printPdfUrl, url.origin), 302);
  }
  if (!item.proof) return Response.json({ error: "NO_PROOF" }, { status: 404 });
  const doc = fromJson<DesignDoc>(item.proof.snapshot);
  const pdf = await generatePrintPdf(doc, { orderNumber: order.number, itemId: item.id, quantity: item.quantity, proofHash: item.proof.hash });
  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename(`${order.number}-print.pdf`)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
