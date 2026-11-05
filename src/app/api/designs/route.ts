import { clientIp } from "@/lib/rate-limit";
import { currentActor, saveDesign } from "@/components/designer/server";
import { SaveBody, limitWrites, readJson } from "./_shared";

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
  return Response.json({ id: r.id, owned: r.owned, updatedAt: r.updatedAt }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
