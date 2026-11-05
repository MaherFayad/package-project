import { apiRequireRole } from "@/lib/auth";
import { shareDesign } from "@/components/designer/server";

/**
 * POST /api/designs/:id/share — create (or return) the read-only share link token.
 * Soft gate G2: signed-in owners only.
 * 200 { token, path: "/s/<token>" } · 401 UNAUTHENTICATED · 403 FORBIDDEN · 404 NOT_FOUND
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiRequireRole();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const r = await shareDesign(id, auth);
  if (!r.ok) return Response.json({ error: r.status === 403 ? "FORBIDDEN" : "NOT_FOUND" }, { status: r.status });
  return Response.json({ token: r.token, path: `/s/${r.token}` }, { headers: { "Cache-Control": "no-store" } });
}
