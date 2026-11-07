import { z } from "zod";
import { FINISH_CODES, MATERIAL_CODES, STRUCTURE_CODES } from "@/types";
import { getSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buyerPrice, DEFAULT_PRICING_CONFIG, DELIVERY_ZONES, QuoteInputError, quote, toPublicOutcome, zoneForGovernorate } from "@/lib/pricing";
import { loadPricingData } from "@/lib/pricing/server";
import type { QuoteModel } from "@/lib/pricing";
import { designConfigSchema } from "@/components/designer/lib/doc";
import { loadPricingConfig } from "@/components/admin/server/settings";
import { readJsonCapped } from "../_lib/body";
import { loadCheckoutSettings } from "@/lib/orders/checkout-settings";
import { deviceOf, track } from "@/lib/analytics/track";

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
    /** Added by 3D integration: library model priced through `structureCode` (its base). */
    model: z
      .object({
        code: z.string().min(1).max(64),
        features: designConfigSchema.shape.features,
        vessel: designConfigSchema.shape.vessel,
      })
      .optional(),
  })
  .refine((b) => b.materialId || b.materialCode, { message: "MATERIAL_REQUIRED", path: ["materialId"] });

/**
 * POST /api/quote — instant price for a box across all eligible vendors. R1-01: open to anonymous
 * visitors (the public pages already show the same numbers); the phone is asked for only when
 * the buyer orders, saves or shares. Rate limited per user, or per IP when signed out. Body: { structureCode, dims, materialId|materialCode, finishes[], printSides,
 * colours, quantity, vendorId?, zone|governorate }.
 *
 * 200 { mode: "instant", offers (best match first, each with `pay`: the buyer price checkout
 *       charges, see `buyerPrice`), suggestion, validUntil, prepayDiscountPct, ... }
 *   | { mode: "manual_quote", quantity, maxInstantQty }      (quantity above 2,000)
 * 400 { error: "INVALID_BODY", issues } | { error: "INVALID_DIMS" | "UNKNOWN_MATERIAL" | ..., details? }
 * 429 { error: "RATE_LIMITED", retryAfterSec }
 * Offers never include vendor buy prices or the platform margin.
 */
export async function POST(req: Request) {
  const user = (await getSession())?.user ?? null;
  const who = user ? user.id : `ip:${clientIp(req.headers)}`;

  const rl = rateLimit("quote", who, 60, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const json = await readJsonCapped(req, 16_384);
  if (json instanceof Response) return json;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_BODY", issues: parsed.error.issues.slice(0, 10) }, { status: 400 });
  }
  const b = parsed.data;
  const zone = b.zone ?? (b.governorate ? zoneForGovernorate(b.governorate) : "GREATER_CAIRO");
  if (!zone) return Response.json({ error: "UNKNOWN_GOVERNORATE" }, { status: 400 });

  try {
    const [data, config] = await Promise.all([loadPricingData(), loadPricingConfig()]);
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
        ...(b.model ? { model: b.model as QuoteModel } : {}),
      },
      data,
      { config },
    );
    // launch-metrics.md §1 `price_viewed`: the instant price table shown in the designer (badge
    // and price sheet both come through here; signed-out visitors count by IP key, no user id). The badge re-prices on every
    // edit, so one event per user and structure per 10 minutes is enough for the funnel.
    if (outcome.mode === "instant" && rateLimit("analytics:price_viewed", `${who}:${b.structureCode}`, 1, 600_000).ok) {
      void track(
        "price_viewed",
        { source: "designer", structure_code: b.structureCode, model_code: b.model?.code ?? null, quantity: b.quantity, offers: outcome.offers.length, device: deviceOf(req.headers) },
        { userId: user?.id ?? null },
      );
    }
    // R1-02: every offer carries `pay`, the buyer price checkout charges (online-payment discount
    // included), so the designer shows the same per-box price and total as checkout.
    const { prepayDiscountPct } = await loadCheckoutSettings();
    const pub = toPublicOutcome(outcome);
    const body = pub.mode === "instant" ? { ...pub, offers: pub.offers.map((o) => ({ ...o, pay: buyerPrice(o, prepayDiscountPct) })) } : pub;
    return Response.json({ ...body, prepayDiscountPct }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof QuoteInputError) {
      return Response.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
