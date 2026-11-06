import { z } from "zod";
import { apiRequireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
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
 * 201 { id } | 400 { error: "INVALID_BODY" | "UNKNOWN_MODEL" } | 401 | 429 { retryAfterSec }
 */
export async function POST(req: Request) {
  const auth = await apiRequireRole();
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

  const row = await db.quote.create({
    data: {
      userId: auth.id,
      lines: [
        {
          type: "CATALOGUE_REQUEST",
          modelCode: e.code,
          slug: e.slug,
          family: e.subFamily,
          standard: e.standard.label,
          presetId: preset?.id ?? null,
          dims: preset?.dims ?? e.defaultDims,
          quantity: b.quantity,
          notes: b.notes ?? "",
        },
      ],
      subtotalPiasters: 0,
      vatPiasters: 0,
      totalPiasters: 0,
      validUntil: new Date(Date.now() + 14 * 24 * 3600_000),
      status: "REQUESTED",
    },
    select: { id: true },
  });
  return Response.json({ id: row.id }, { status: 201 });
}
