import { destroySession } from "@/lib/auth/session";
import { crossSiteResponse, isCrossSiteRequest } from "@/lib/auth/csrf";

/** POST /api/auth/logout -> 200 { ok: true }, deletes the DB session and expires the cookie. */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req.headers)) return crossSiteResponse();
  await destroySession();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
