import { destroySession } from "@/lib/auth/session";

/** POST /api/auth/logout -> 200 { ok: true }, clears the session cookie. */
export async function POST() {
  await destroySession();
  return Response.json({ ok: true });
}
