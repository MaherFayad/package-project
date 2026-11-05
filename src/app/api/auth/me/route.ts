import { getSession } from "@/lib/auth/session";

/** GET /api/auth/me -> 200 { user: SessionUser | null } (never cached). */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  return Response.json({ user: s?.user ?? null }, { headers: { "Cache-Control": "no-store" } });
}
