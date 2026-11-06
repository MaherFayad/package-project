import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { canOpenDispute } from "@/lib/orders/state";
import type { OrderStatus } from "@/types";
import { fileUrl, parseKey, UPLOAD_RULES } from "@/components/vendor/lib/files";
import { deleteUpload, saveUpload } from "@/components/vendor/server/storage";
import { readFormCapped } from "../../../_lib/body";

/**
 * POST /api/orders/<id>/dispute-photos  (multipart/form-data, field `file`)
 * One photo for "Report a problem" (checkout round 9). Buyer of the order only, while a report can
 * be opened (delivered, within 30 days, no open report). Same pipeline as the vendor uploads:
 * type by magic bytes (PNG, JPEG, WebP; never SVG), 10 MB, metadata stripped, stored privately as
 * `dispute/<orderId>/…`. Returns the key; the report (disputeAction) attaches up to 5 of them.
 * Route handler, not a server action: server action bodies are capped at 1 MB.
 */
const MAX_BODY_BYTES = 11 * 1024 * 1024;
const err = (error: string, status: number) => Response.json({ ok: false, error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err("UNAUTHENTICATED", 401);
  const { id } = await params;
  if (!/^[\w-]{1,40}$/.test(id)) return err("NOT_FOUND", 404);
  // 5 photos per report; a few retries and replacements on top.
  if (!rateLimit("dispute-photo", s.user.id, 20, 60 * 60_000).ok) return err("RATE_LIMITED", 429);

  const order = await db.order.findUnique({ where: { id }, select: { buyerId: true, status: true, deliveredAt: true, disputes: { select: { status: true } } } });
  if (!order || order.buyerId !== s.user.id) return err("NOT_FOUND", 404);
  const hasOpen = order.disputes.some((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  if (!canOpenDispute(order.status as OrderStatus, order.deliveredAt, new Date(), hasOpen)) return err("NOT_ALLOWED", 409);

  const form = await readFormCapped(req, MAX_BODY_BYTES);
  if (form instanceof Response) return form;
  const file = form.get("file");
  if (!(file instanceof File)) return err("INVALID", 400);
  if (file.size > UPLOAD_RULES.dispute.maxBytes) return err("TOO_LARGE", 413);
  const saved = await saveUpload("dispute", id, new Uint8Array(await file.arrayBuffer()));
  if (!saved.ok) return err(saved.error, saved.error === "TOO_LARGE" ? 413 : 400);
  return Response.json({ ok: true, key: saved.key, url: fileUrl(saved.key) }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * DELETE /api/orders/<id>/dispute-photos?key=dispute/<id>/…  (R10-03)
 * The buyer removed a photo before sending: delete the stored file (PDPL data minimisation).
 * Only this order's own report uploads that no report uses yet.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err("UNAUTHENTICATED", 401);
  const { id } = await params;
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const parsed = parseKey(key);
  if (!/^[\w-]{1,40}$/.test(id) || !parsed || parsed.scope !== "dispute" || parsed.ownerId !== id) return err("NOT_FOUND", 404);
  const order = await db.order.findUnique({ where: { id }, select: { buyerId: true, disputes: { select: { photos: true } } } });
  if (!order || order.buyerId !== s.user.id) return err("NOT_FOUND", 404);
  const used = order.disputes.some((d) => Array.isArray(d.photos) && (d.photos as unknown[]).includes(key));
  if (used) return err("NOT_ALLOWED", 409);
  await deleteUpload(key);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
