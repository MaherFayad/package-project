import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { canReadFile, fileUrl, parseKey } from "@/components/vendor/lib/files";
import { readUpload } from "@/components/vendor/server/storage";

/**
 * GET /api/vendor/files/<scope>/<ownerId>/<file>
 * Portfolio images are public once approved (B-08), otherwise owner vendor + admins only. QC photos, certificates and application documents
 * are private: see canReadFile(). Unknown or forbidden keys both return 404 (no existence leak).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const parsed = parseKey(key);
  if (!parsed) return new Response("Not found", { status: 404 });

  // B-08: portfolio photos are public only once approved; look the row up by its stored URL.
  let portfolioStatus: string | null = null;
  if (parsed.scope === "portfolio") {
    const item = await db.vendorPortfolioItem.findFirst({ where: { imageUrl: fileUrl(key), vendorId: parsed.ownerId }, select: { status: true } });
    portfolioStatus = item?.status ?? null;
  }
  const publicFile = parsed.scope === "portfolio" && portfolioStatus === "APPROVED";
  let allowed = publicFile;
  if (!allowed) {
    const s = await getSession();
    const viewer = s ? { id: s.user.id, role: s.user.role, vendorId: s.user.vendorId } : null;
    let parties: { vendorId: string; buyerId: string } | null = null;
    if (parsed.scope === "qc" && viewer) {
      parties = await db.order.findUnique({ where: { id: parsed.ownerId }, select: { vendorId: true, buyerId: true } });
    }
    allowed = canReadFile(parsed, viewer, parties, portfolioStatus);
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const bytes = await readUpload(key);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": parsed.type,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": `inline; filename="${parsed.file}"`,
      // Approved photos can be cached, but not "immutable": a photo Elba later rejects must drop out
      // of shared caches within the hour. Anything under review is never stored by shared caches.
      "Cache-Control": publicFile ? "public, max-age=3600" : parsed.scope === "portfolio" ? "private, no-store" : "private, max-age=300",
    },
  });
}
