import { db } from "@/lib/db";
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
  const requests = await db.dataRequest.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  const now = new Date();
  const doc = buildDataExport({ user, organization: user.organization, consents: user.consents, designs: user.designs, orders: user.orders, reviews: user.reviews, requests }, now);
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
