import { z } from "zod";
import { FINISH_CODES, MATERIAL_CODES, STRUCTURE_CODES } from "@/types";
import { apiRequireRole } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_PRICING_CONFIG, DELIVERY_ZONES, QuoteInputError, quote, toPublicOutcome, zoneForGovernorate } from "@/lib/pricing";
import { loadPricingData } from "@/lib/pricing/server";

const Mm = z.number().finite().positive().max(5000);

const Body = z
  .object({
    structureCode: z.enum(STRUCTURE_CODES),
    dims: z.object({ L: Mm, W: Mm, H: Mm }),
    /** Material row id or material code. `materialCode` is accepted as an alias. */
    materialId: z.string().min(1).max(64).optional(),
    materialCode: z.enum(MATERIAL_CODES).optional(),
    finishes: z.array(z.enum(FINISH_CODES)).max(FINISH_CODES.length).default([]),
    /** Alias for a single finish (shared QuoteRequest contract). */
    finishCode: z.enum(FINISH_CODES).optional(),
    printSides: z.enum(["OUTSIDE", "BOTH"]),
    colours: z.number().int().min(1).max(DEFAULT_PRICING_CONFIG.maxColours).default(4),
    quantity: z.number().int().min(1).max(1_000_000),
    vendorId: z.string().min(1).max(64).optional(),
    zone: z.enum(DELIVERY_ZONES).optional(),
    /** Alternative to `zone`: governorate name (English or Arabic). */
    governorate: z.string().min(2).max(64).optional(),
  })
  .refine((b) => b.materialId || b.materialCode, { message: "MATERIAL_REQUIRED", path: ["materialId"] });

/**
 * POST /api/quote — instant price for a box across all eligible vendors (soft gate G2: signed-in
 * users only). Body: { structureCode, dims, materialId|materialCode, finishes[], printSides,
 * colours, quantity, vendorId?, zone|governorate }.
 *
 * 200 { mode: "instant", offers (best match first), suggestion, validUntil, ... }
 *   | { mode: "manual_quote", quantity, maxInstantQty }      (quantity above 2,000)
 * 400 { error: "INVALID_BODY", issues } | { error: "INVALID_DIMS" | "UNKNOWN_MATERIAL" | ..., details? }
 * 401 { error: "UNAUTHENTICATED" }   429 { error: "RATE_LIMITED", retryAfterSec }
 * Offers never include vendor buy prices or the platform margin.
 */
export async function POST(req: Request) {
  const auth = await apiRequireRole();
  if (auth instanceof Response) return auth;

  const rl = rateLimit("quote", auth.id, 60, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "INVALID_BODY", issues: parsed.error.issues }, { status: 400 });
  }
  const b = parsed.data;
  const zone = b.zone ?? (b.governorate ? zoneForGovernorate(b.governorate) : "GREATER_CAIRO");
  if (!zone) return Response.json({ error: "UNKNOWN_GOVERNORATE" }, { status: 400 });

  try {
    const data = await loadPricingData();
    const outcome = quote(
      {
        structureCode: b.structureCode,
        dims: b.dims,
        materialId: (b.materialId ?? b.materialCode)!,
        finishes: b.finishCode ? [...b.finishes, b.finishCode] : b.finishes,
        printSides: b.printSides,
        colours: b.colours,
        quantity: b.quantity,
        vendorId: b.vendorId,
        zone,
      },
      data,
    );
    return Response.json(toPublicOutcome(outcome), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof QuoteInputError) {
      return Response.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
