import { apiRequireRole } from "@/lib/auth";
import { crossSiteResponse, isCrossSiteRequest } from "@/lib/auth/csrf";
import { db } from "@/lib/db";
import { shareDesign } from "@/components/designer/server";
import { deviceOf, track } from "@/lib/analytics/track";

/**
 * POST /api/designs/:id/share — create (or return) the read-only share link token.
 * Soft gate G2: signed-in owners only.
 * 200 { token, path: "/s/<token>" } · 401 UNAUTHENTICATED · 403 FORBIDDEN · 404 NOT_FOUND
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiRequireRole();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const r = await shareDesign(id, auth);
  if (!r.ok) return Response.json({ error: r.status === 403 ? "FORBIDDEN" : "NOT_FOUND" }, { status: r.status });
  // launch-metrics.md §1 `share_link_created`: only when a new link is minted (re-opening the
  // share dialog returns the same token and is not a new link).
  if (r.created) void track("share_link_created", { device: deviceOf(req.headers) }, { userId: auth.id, designId: id });
  return Response.json({ token: r.token, path: `/s/${r.token}` }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * DELETE /api/designs/:id/share — turn the read-only link off (security R5-SEC-08). A share link
 * is a bearer capability: before this, the only way to stop a link that was forwarded too far was
 * to delete the design. The old token stops working everywhere (`/s/<token>` and the
 * `/checkout/<id>?share=` fork); sharing again mints a new one. Owner only.
 * 200 { ok: true, revoked } · 401 UNAUTHENTICATED · 403 FORBIDDEN (cross-site) · 404 NOT_FOUND
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isCrossSiteRequest(req.headers)) return crossSiteResponse();
  const auth = await apiRequireRole();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const row = await db.design.findUnique({ where: { id }, select: { ownerId: true, shareToken: true } });
  // Someone else's design is a 404, so ids are not confirmed (ASVS 4.0.3 V4.2.1).
  if (!row || row.ownerId !== auth.id) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (row.shareToken) await db.design.updateMany({ where: { id, ownerId: auth.id }, data: { shareToken: null } });
  return Response.json({ ok: true, revoked: !!row.shareToken }, { headers: { "Cache-Control": "no-store" } });
}
