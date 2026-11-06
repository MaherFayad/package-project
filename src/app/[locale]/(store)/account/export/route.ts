import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { getSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buildDataExport, exportFileName } from "@/components/store/account-logic";

export const dynamic = "force-dynamic";

/**
 * GET /{locale}/account/export: PDPL right of access. Streams the signed-in user's own data as
 * a JSON download and logs a completed EXPORT DataRequest. 401 when signed out.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const userId = session.user.id;
  const rl = rateLimit("account:export", userId, 5, 60 * 60_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      organization: { select: { name: true, taxId: true, commercialRegister: true, city: true } },
      consents: { orderBy: { createdAt: "asc" } },
      designs: { orderBy: { createdAt: "asc" } },
      orders: { orderBy: { placedAt: "asc" }, include: { items: true } },
      reviews: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const [requests, quotes, disputes, payments] = await Promise.all([
    db.dataRequest.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.quote.findMany({ where: { userId, NOT: { status: "OPEN" } }, orderBy: { createdAt: "asc" } }),
    db.dispute.findMany({ where: { openedById: userId }, orderBy: { createdAt: "asc" }, include: { order: { select: { number: true } } } }),
    db.payment.findMany({ where: { order: { buyerId: userId } }, orderBy: { createdAt: "asc" }, include: { order: { select: { number: true } } } }),
  ]);
  // R8-03: what the buyer typed on a price request (note, needed-by date, governorate) is kept on
  // its audit row; it is their personal data too.
  const quoteAudits = quotes.length
    ? await db.auditLog.findMany({ where: { action: "QUOTE_REQUEST", entityType: "QUOTE", entityId: { in: quotes.map((q) => q.id) } }, select: { entityId: true, after: true } })
    : [];
  const detail = new Map(quoteAudits.map((a) => [a.entityId, fromJson<Record<string, unknown>>(a.after) ?? {}]));
  const now = new Date();
  const doc = {
    ...buildDataExport({ user, organization: user.organization, consents: user.consents, designs: user.designs, orders: user.orders, reviews: user.reviews, requests }, now),
    // R8-03 (PDPL right of access): price requests, problem reports and payments were missing.
    priceRequests: quotes.map((q) => {
      const d = detail.get(q.id) ?? {};
      const lines = fromJson<{ quantity?: number }[]>(q.lines);
      return {
        status: q.status,
        quantity: Array.isArray(lines) ? (lines[0]?.quantity ?? null) : null,
        designId: q.designId,
        governorate: typeof d.governorate === "string" ? d.governorate : null,
        neededBy: typeof d.neededBy === "string" ? d.neededBy : null,
        note: typeof d.note === "string" ? d.note : null,
        totalPiasters: q.totalPiasters || null,
        createdAt: q.createdAt.toISOString(),
      };
    }),
    problemReports: disputes.map((d) => ({ order: d.order.number, reason: d.reason, description: d.description, status: d.status, resolution: d.resolution, createdAt: d.createdAt.toISOString(), resolvedAt: d.resolvedAt?.toISOString() ?? null })),
    // Method, amount and status only: Elba never sees or stores card numbers.
    payments: payments.map((p) => ({ order: p.order.number, method: p.method, status: p.status, amountPiasters: p.amountPiasters, createdAt: p.createdAt.toISOString() })),
  };
  await db.dataRequest.create({ data: { userId, kind: "EXPORT", status: "COMPLETED", completedAt: now, ip: clientIp(req.headers) } });

  return new Response(JSON.stringify(doc, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(user.phone, now)}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
