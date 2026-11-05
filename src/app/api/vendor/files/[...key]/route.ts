import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { canReadFile, parseKey } from "@/components/vendor/lib/files";
import { readUpload } from "@/components/vendor/server/storage";

/**
 * GET /api/vendor/files/<scope>/<ownerId>/<file>
 * Portfolio images are public (storefront). QC photos, certificates and application documents
 * are private: see canReadFile(). Unknown or forbidden keys both return 404 (no existence leak).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const parsed = parseKey(key);
  if (!parsed) return new Response("Not found", { status: 404 });

  let allowed = parsed.scope === "portfolio";
  if (!allowed) {
    const s = await getSession();
    const viewer = s ? { id: s.user.id, role: s.user.role, vendorId: s.user.vendorId } : null;
    let parties: { vendorId: string; buyerId: string } | null = null;
    if (parsed.scope === "qc" && viewer) {
      parties = await db.order.findUnique({ where: { id: parsed.ownerId }, select: { vendorId: true, buyerId: true } });
    }
    allowed = canReadFile(parsed, viewer, parties);
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
      "Cache-Control": parsed.scope === "portfolio" ? "public, max-age=31536000, immutable" : "private, max-age=300",
    },
  });
}
