import { clientIp } from "@/lib/rate-limit";
import { currentActor, loadDesign, saveDesign } from "@/components/designer/server";
import { SaveBody, limitWrites, readJson } from "../_shared";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/designs/:id — the design if the caller owns it (account or anonymous cookie).
 * 200 { doc, owned, shareToken } · 404 NOT_FOUND (also when not allowed, to avoid leaking ids)
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await currentActor();
  const d = await loadDesign(id, actor);
  if (!d) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json(
    { doc: d.doc, owned: !!d.ownerId, shareToken: d.ownerId === actor.user?.id ? d.shareToken : null, updatedAt: d.updatedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * PUT /api/designs/:id — save changes. Only the owner (or the anonymous browser that made it).
 * Body: { doc, thumbnail?, baseUpdatedAt?, force? } · 200 { id, owned, updatedAt } · 403 FORBIDDEN ·
 * 404 NOT_FOUND · 409 { error: "CONFLICT", updatedAt, doc } when the design changed since
 * `baseUpdatedAt` (R10-R1; `force: true` overwrites on purpose).
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const actor = await currentActor();
  const limited = limitWrites(actor, clientIp(req.headers));
  if (limited) return limited;
  const json = await readJson(req);
  if (json instanceof Response) return json;
  const parsed = SaveBody.safeParse(json);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY", issues: parsed.error.issues.slice(0, 10) }, { status: 400 });
  const r = await saveDesign(parsed.data.doc, actor, { id, thumbnail: parsed.data.thumbnail, baseUpdatedAt: parsed.data.baseUpdatedAt, force: parsed.data.force });
  if (!r.ok && r.status === 409) return Response.json({ error: r.error, updatedAt: r.updatedAt, doc: r.doc }, { status: 409, headers: { "Cache-Control": "no-store" } });
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ id: r.id, owned: r.owned, updatedAt: r.updatedAt }, { headers: { "Cache-Control": "no-store" } });
}
