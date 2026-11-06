import { z } from "zod";
import { apiRequireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { toJson } from "@/lib/json";
import { catalogueEntry } from "@/data/catalogue";
import { readJsonCapped } from "../../_lib/body";

const Body = z.object({
  code: z.string().min(1).max(64),
  presetId: z.string().min(1).max(64).optional(),
  quantity: z.number().int().min(100).max(1_000_000),
  /** Free text for the converter (material, colours, delivery city). Not personal data. */
  notes: z.string().trim().max(1000).optional(),
}).strict();

/**
 * POST /api/catalogue/quote-request — a buyer asks for a price on a catalogue model that no
 * printer prices instantly (cups, moulded pulp, bags, labels, imported formats). Signed-in
 * users only (the reply goes to the account phone, collected with consent at sign-up under
 * Egypt PDPL 151/2020). Stored as a Quote row with status REQUESTED and zero totals until a
 * converter prices it.
 *
 * Like checkout's request (B-15) it also writes a QUOTE_REQUEST audit row with a spec snapshot,
 * so the admin quote-leads inbox shows the model, standard and size, and the same request sent
 * again within 14 days returns the open one instead of a duplicate lead.
 *
 * 201 { id } | 200 { id, repeat: true } | 400 { error: "INVALID_BODY" | "UNKNOWN_MODEL" } | 401 | 403 | 429 { retryAfterSec }
 */
export async function POST(req: Request) {
  // Buyers (and ops testing the flow). Vendor staff accounts are portal accounts: their requests
  // would only add noise to the admin quote-leads inbox (R4-06).
  const auth = await apiRequireRole(["BUYER", "ADMIN"]);
  if (auth instanceof Response) return auth;
  const rl = rateLimit("catalogue-quote", auth.id, 5, 60_000);
  if (!rl.ok) return Response.json({ error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  // Capped while streaming (ASVS V12.1.1): the body is a few fields, never more than 4 KB.
  const json = await readJsonCapped(req, 4_096);
  if (json instanceof Response) return json;
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code })) }, { status: 400 });
  const b = parsed.data;
  const e = catalogueEntry(b.code);
  if (!e) return Response.json({ error: "UNKNOWN_MODEL" }, { status: 400 });
  const preset = b.presetId ? e.presets.find((p) => p.id === b.presetId) : undefined;

  const dims = preset?.dims ?? e.defaultDims;
  const now = new Date();
  const open = await db.quote.findMany({ where: { userId: auth.id, designId: null, status: "REQUESTED", validUntil: { gt: now } }, select: { id: true, lines: true }, take: 50 });
  const same = open.find((q) => {
    const l = (Array.isArray(q.lines) ? q.lines : [])[0] as { type?: string; modelCode?: string; presetId?: string | null; quantity?: number } | undefined;
    return l?.type === "CATALOGUE_REQUEST" && l.modelCode === e.code && (l.presetId ?? null) === (preset?.id ?? null) && l.quantity === b.quantity;
  });
  if (same) return Response.json({ id: same.id, repeat: true }, { status: 200 });

  const row = await db.$transaction(async (tx) => {
    const q = await tx.quote.create({
      data: {
        userId: auth.id,
        lines: [
          {
            type: "CATALOGUE_REQUEST",
            modelCode: e.code,
            slug: e.slug,
            // Both names, so the buyer's account and the admin inbox can label the request.
            name: { ar: e.name.ar, en: e.name.en },
            family: e.subFamily,
            standard: e.standard.label,
            presetId: preset?.id ?? null,
            dims,
            quantity: b.quantity,
            notes: b.notes ?? "",
          },
        ],
        subtotalPiasters: 0,
        vatPiasters: 0,
        totalPiasters: 0,
        validUntil: new Date(now.getTime() + 14 * 24 * 3600_000),
        status: "REQUESTED",
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: auth.id,
        actorPhone: auth.phone,
        action: "QUOTE_REQUEST",
        entityType: "QUOTE",
        entityId: q.id,
        summary: `${b.quantity.toLocaleString("en-US")} x ${e.code} · catalogue`,
        after: toJson({
          designId: null,
          quantity: b.quantity,
          governorate: null,
          neededBy: null,
          note: b.notes || null,
          phone: auth.phone,
          spec: { name: e.name.en, nameAr: e.name.ar, modelCode: e.code, standard: e.standard.label || null, presetId: preset?.id ?? null, dims },
        }),
        ip: clientIp(req.headers),
      },
    });
    return q;
  });
  return Response.json({ id: row.id }, { status: 201 });
}
