import { clientIp } from "@/lib/rate-limit";
import { currentActor, saveDesign } from "@/components/designer/server";
import { SaveBody, limitWrites, readJson } from "./_shared";
import { deviceOf, track } from "@/lib/analytics/track";

/**
 * POST /api/designs — create a design. No account needed (soft gate G2 lets anyone design):
 * anonymous designs are tied to the `elba_anon` cookie (set here if missing) and expire after
 * 30 days; signed-in users own theirs.
 * Body: { doc: DesignDoc, thumbnail?: dataURL | null }
 * 201 { id, owned, updatedAt } · 400 INVALID_BODY · 413 TOO_LARGE · 429 RATE_LIMITED
 */
export async function POST(req: Request) {
  const actor = await currentActor();
  const limited = limitWrites(actor, clientIp(req.headers));
  if (limited) return limited;
  const json = await readJson(req);
  if (json instanceof Response) return json;
  const parsed = SaveBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY", issues: parsed.error.issues.slice(0, 10) }, { status: 400 });
  const r = await saveDesign(parsed.data.doc, actor, { thumbnail: parsed.data.thumbnail });
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  // launch-metrics.md §1 `design_started`: the designer creates the row on the first autosave,
  // which only runs after the visitor changed something (opening the page alone does not count).
  const d = parsed.data.doc;
  void track(
    "design_started",
    { structure_code: d.structureCode, model_code: d.modelCode ?? null, signed_in: !!actor.user, device: deviceOf(req.headers) },
    { userId: actor.user?.id ?? null, anonId: actor.anonId, designId: r.id },
  );
  return Response.json({ id: r.id, owned: r.owned, updatedAt: r.updatedAt }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
