import { apiRequireRole } from "@/lib/auth";
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
