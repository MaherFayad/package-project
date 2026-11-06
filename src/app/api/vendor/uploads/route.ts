import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { fileUrl, UPLOAD_RULES, UPLOAD_SCOPES } from "@/components/vendor/lib/files";
import { can, QC_PHOTO_KINDS } from "@/components/vendor/lib/jobs";
import { MAX_PORTFOLIO_ITEMS } from "@/components/vendor/lib/profile";
import { saveUpload, deleteUpload } from "@/components/vendor/server/storage";
import { readFormCapped } from "../../_lib/body";

/**
 * POST /api/vendor/uploads  (multipart/form-data)
 *   file   the file (type checked by magic bytes: PNG/JPEG/WebP, PDF where allowed; never SVG)
 *   scope  qc | portfolio | cert | apply
 *   orderId, kind   (scope=qc) the job and photo kind FIRST_SHEET | PACKED_BUNDLE | OTHER
 *
 * qc        vendor staff of the order's vendor, job IN_PRODUCTION  -> creates a QcPhoto (PENDING)
 * portfolio vendor staff                                           -> creates a VendorPortfolioItem
 * cert      vendor staff                                           -> returns the key (saved with the profile)
 * apply     any signed-in user without a vendor                    -> returns the key (saved with the application)
 *
 * Route handler rather than a server action: server action bodies are capped at 1 MB.
 */
const MAX_QC_PHOTOS = 20;
/** Largest multipart body: the biggest per-scope file (10 MB) plus form overhead. */
const MAX_BODY_BYTES = 11 * 1024 * 1024;
/** cert/apply files are not rows until a form is saved, so cap them per user and day (disk abuse). */
const DAILY_LOOSE_FILES = 30;

const fields = z.object({
  scope: z.enum(UPLOAD_SCOPES),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  kind: z.enum(QC_PHOTO_KINDS).optional(),
});

const err = (error: string, status: number, extra: Record<string, unknown> = {}) => Response.json({ ok: false, error, ...extra }, { status });

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return err("UNAUTHENTICATED", 401);
  const user = s.user;
  if (!rateLimit("vendor-upload", user.id, 60, 10 * 60_000).ok) return err("RATE_LIMITED", 429);

  // Capped while streaming: a chunked request without Content-Length cannot make us buffer
  // an unbounded body (OWASP ASVS 4.0.3 V12.1.1).
  const form = await readFormCapped(req, MAX_BODY_BYTES);
  if (form instanceof Response) return form;
  const parsed = fields.safeParse({
    scope: form.get("scope") ?? undefined,
    orderId: form.get("orderId") ?? undefined,
    kind: form.get("kind") ?? undefined,
  });
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File)) return err("INVALID", 400);
  const { scope, orderId, kind } = parsed.data;
  if (file.size > UPLOAD_RULES[scope].maxBytes) return err("TOO_LARGE", 413);
  if ((scope === "apply" || scope === "cert") && !rateLimit("vendor-upload:loose", user.id, DAILY_LOOSE_FILES, 86_400_000).ok) return err("RATE_LIMITED", 429);

  // ── Authorisation per scope
  let vendorId: string | null = null;
  if (scope !== "apply") {
    if ((user.role !== "VENDOR" && user.role !== "ADMIN") || !user.vendorId) return err("FORBIDDEN", 403);
    const vendor = await db.vendor.findUnique({ where: { id: user.vendorId }, select: { id: true, status: true } });
    if (!vendor || vendor.status !== "ACTIVE") return err(vendor?.status === "SUSPENDED" ? "SUSPENDED" : "FORBIDDEN", 403);
    vendorId = vendor.id;
  } else if (user.vendorId) {
    return err("FORBIDDEN", 403);
  }

  let order: { id: string } | null = null;
  if (scope === "qc") {
    if (!orderId || !kind) return err("INVALID", 400);
    const o = await db.order.findFirst({
      where: { id: orderId, vendorId: vendorId! },
      include: { productionEvents: { select: { type: true, createdAt: true } }, qcPhotos: { select: { kind: true, status: true } } },
    });
    if (!o) return err("NOT_FOUND", 404);
    if (!can({ status: o.status, paidAt: o.paidAt, events: o.productionEvents, qcPhotos: o.qcPhotos }, "uploadQc")) return err("NOT_ALLOWED", 409);
    if (o.qcPhotos.length >= MAX_QC_PHOTOS) return err("LIMIT", 409);
    order = o;
  }
  if (scope === "portfolio") {
    const count = await db.vendorPortfolioItem.count({ where: { vendorId: vendorId! } });
    if (count >= MAX_PORTFOLIO_ITEMS) return err("LIMIT", 409);
  }

  // ── Store (validated by magic bytes)
  const bytes = new Uint8Array(await file.arrayBuffer());
  const owner = scope === "qc" ? order!.id : scope === "apply" ? user.id : vendorId!;
  const saved = await saveUpload(scope, owner, bytes);
  if (!saved.ok) return err(saved.error, saved.error === "TOO_LARGE" ? 413 : 415);
  const url = fileUrl(saved.key);
  const name = file.name.slice(0, 200) || "file";

  try {
    if (scope === "qc") {
      const photo = await db.qcPhoto.create({ data: { orderId: order!.id, url, kind: kind!, status: "PENDING" } });
      revalidatePath("/[locale]/vendor", "layout");
      return Response.json({ ok: true, key: saved.key, url, photo: { id: photo.id, url, kind: photo.kind, status: photo.status, reviewNote: null, uploadedAt: photo.uploadedAt.toISOString() } });
    }
    if (scope === "portfolio") {
      const vendor = await db.vendor.findUniqueOrThrow({ where: { id: vendorId! }, select: { nameAr: true, nameEn: true } });
      const last = await db.vendorPortfolioItem.aggregate({ where: { vendorId: vendorId! }, _max: { sortOrder: true } });
      const item = await db.vendorPortfolioItem.create({
        data: { vendorId: vendorId!, imageUrl: url, captionAr: vendor.nameAr, captionEn: vendor.nameEn, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      });
      revalidatePath("/[locale]", "layout");
      return Response.json({ ok: true, key: saved.key, url, item: { id: item.id, imageUrl: url, captionAr: item.captionAr, captionEn: item.captionEn, structureCode: null } });
    }
    return Response.json({ ok: true, key: saved.key, url, name, size: saved.size, type: saved.type });
  } catch (e) {
    await deleteUpload(saved.key);
    console.error("[vendor-upload]", e);
    return err("FAILED", 500);
  }
}
