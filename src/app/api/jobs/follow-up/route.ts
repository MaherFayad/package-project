import { isProd } from "@/lib/env";
import { checkCronAuth } from "@/lib/jobs/cronAuth";
import { runDailyJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/follow-up — the daily job: retention purges (OTP > 24 h, expired sessions,
 * expired anonymous designs without proofs, analytics events > 13 months) then the B-23 WhatsApp
 * follow-up on saved designs (src/lib/jobs). Call it from the platform scheduler once a day.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` (constant-time compare). Without CRON_SECRET the
 * endpoint is disabled in production (503) and open in development.
 *
 * 200 { ok, retention, followUp: { considered, sent: designId[], skipped } } · 401 UNAUTHORIZED · 503 DISABLED
 */
export async function POST(req: Request) {
  const auth = checkCronAuth(req.headers.get("authorization"), process.env.CRON_SECRET, isProd);
  if (auth === "disabled") return Response.json({ error: "DISABLED" }, { status: 503 });
  if (auth !== "ok") return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  const report = await runDailyJobs(new Date());
  return Response.json({ ok: true, ...report }, { headers: { "Cache-Control": "no-store" } });
}
