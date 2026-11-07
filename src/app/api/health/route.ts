import { db } from "@/lib/db";
import { workersBuildFacts } from "@/lib/runtime/build-facts";
import { cloudflareContext } from "@/lib/runtime/cloudflare";

export const dynamic = "force-dynamic";

/**
 * GET /api/health: deploy check (docs/DEPLOY-CLOUDFLARE.md). Says which runtime answered,
 * whether the build facts loaded (Workers) and whether the database answers. No secrets, no data.
 * 200 { ok: true, runtime, facts, db: "ok" } · 503 { ok: false, ..., db: "down" }
 */
export async function GET() {
  const cf = cloudflareContext();
  let dbOk = false;
  try {
    await db.$queryRawUnsafe("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const body = { ok: dbOk, runtime: cf ? "workers" : "node", facts: cf ? !!workersBuildFacts() : null, db: dbOk ? "ok" : "down" };
  return Response.json(body, { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
