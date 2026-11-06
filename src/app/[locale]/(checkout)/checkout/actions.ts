"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { MAX_INSTANT_QTY, type Locale, type PaymentMethod } from "@/types";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { toGovernorateKey } from "@/lib/orders/governorates";
import { loadCheckoutSettings } from "@/lib/orders/checkout-settings";
import { isValidTaxId, normalizeTaxId } from "@/lib/orders/company";
import { QUOTE_NOTE_MAX, QUOTE_REQUESTED } from "./quote-request";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { addressSchema, idSchema, paymentMethodSchema } from "@/lib/orders/schemas";
import {
  OrderError,
  cancelOrder,
  loadCheckoutDesign,
  markInstapaySent,
  placeOrder,
  quoteDesign,
  sampleCreditFor,
  sampleOffers,
  startPayment,
  toCheckoutOffer,
  type CheckoutOffer,
  type PaymentView,
} from "@/lib/orders/service";
import type { StandardSizeSuggestion } from "@/lib/pricing";

/**
 * Checkout server actions (owner: checkout). Every action re-checks the session and ownership,
 * validates input with zod and re-prices on the server. Errors come back as codes that the UI
 * maps to `checkout.errors.<CODE>`.
 */
export type ActionError = { ok: false; error: string; fields?: string[] };

const locale = z.enum(["ar", "en"]);

export type OffersResult =
  | {
      ok: true;
      mode: "instant";
      quantity: number;
      offers: CheckoutOffer[];
      suggestion: StandardSizeSuggestion | null;
      validUntil: string;
      /** Paid sample offers (B-05). */
      sample?: boolean;
      /** Unused sample credit applied to these totals (B-05). */
      credit?: { piasters: number; sampleNumber: string; expiresAt: string } | null;
    }
  | { ok: true; mode: "manual_quote"; quantity: number; max: number }
  | ActionError;

export async function getOffersAction(input: { designId: string; quantity: number; governorate?: string; sample?: boolean }): Promise<OffersResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "FORBIDDEN" };
  const p = z
    .object({ designId: idSchema, quantity: z.number().int().min(1).max(1_000_000), governorate: z.string().max(40).optional(), sample: z.boolean().optional() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "INVALID" };
  const rl = rateLimit("checkout:offers", s.user.id, 120, 60_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED" };
  const design = await loadCheckoutDesign(p.data.designId, s.user);
  if (!design) return { ok: false, error: "NOT_FOUND" };
  try {
    const prepay = (await loadCheckoutSettings()).prepayDiscountPct;
    if (p.data.sample) {
      const samples = await sampleOffers(design.doc, p.data.governorate);
      if (!samples) return { ok: false, error: "SAMPLE_UNAVAILABLE" };
      const offers = samples.offers.map((o) => toCheckoutOffer(o, prepay, { sample: true }));
      return { ok: true, mode: "instant", quantity: samples.pieces, offers, suggestion: null, validUntil: offers[0]?.validUntil ?? new Date().toISOString(), sample: true };
    }
    const outcome = await quoteDesign(design.doc, { quantity: p.data.quantity, governorate: p.data.governorate });
    if (outcome.mode === "manual_quote") return { ok: true, mode: "manual_quote", quantity: outcome.quantity, max: MAX_INSTANT_QTY };
    const credit = await sampleCreditFor(s.user.id, p.data.designId);
    return {
      ok: true,
      mode: "instant",
      quantity: outcome.quantity,
      offers: outcome.offers.map((o) => toCheckoutOffer(o, prepay, { creditPiasters: credit?.piasters })),
      suggestion: outcome.suggestion,
      validUntil: outcome.validUntil,
      credit: credit ? { piasters: credit.piasters, sampleNumber: credit.sampleNumber, expiresAt: credit.expiresAt.toISOString() } : null,
    };
  } catch (e) {
    console.error("[checkout] offers failed", e);
    return { ok: false, error: "generic" };
  }
}

const placeSchema = z.object({
  designId: idSchema,
  quantity: z.number().int().min(1).max(MAX_INSTANT_QTY),
  vendorId: idSchema,
  address: addressSchema,
  approved: z.literal(true),
  sample: z.boolean().optional(),
  /** B-04: approve despite red preflight issues (the "Print it as it is" box; recorded on the proof). */
  acknowledgePreflight: z.boolean().optional(),
  // Company invoice (B-13): stored on the buyer's Organization, printed on the invoice.
  company: z
    .object({
      name: z.string().trim().min(2).max(120),
      taxId: z.string().max(20).refine(isValidTaxId),
      commercialRegister: z.string().trim().max(40).optional().default(""),
    })
    .nullable()
    .optional(),
  preview: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
    .nullable()
    .optional(),
  locale,
});

export async function placeOrderAction(input: unknown): Promise<{ ok: true; orderId: string; number: string } | ActionError> {
  const s = await getSession();
  if (!s) return { ok: false, error: "FORBIDDEN" };
  const p = placeSchema.safeParse(input);
  if (!p.success) {
    const fields = [...new Set(p.error.issues.map((i) => i.path.join(".")))];
    return { ok: false, error: "INVALID", fields };
  }
  const h = await headers();
  const rl = rateLimit("checkout:place", s.user.id, 10, 600_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED" };
  const preview = p.data.preview ? Buffer.from(p.data.preview.split(",")[1], "base64") : null;
  try {
    if (p.data.company) await saveCompany(s.user.id, p.data.company);
    const r = await placeOrder(s.user, {
      designId: p.data.designId,
      quantity: p.data.quantity,
      vendorId: p.data.vendorId,
      address: p.data.address,
      approval: { ip: clientIp(h), userAgent: h.get("user-agent") ?? undefined },
      preview,
      locale: p.data.locale as Locale,
      sample: p.data.sample,
      acknowledgePreflight: p.data.acknowledgePreflight === true,
    });
    return { ok: true, orderId: r.orderId, number: r.number };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code };
    console.error("[checkout] place order failed", e);
    return { ok: false, error: "generic" };
  }
}

export async function startPaymentAction(input: { orderId: string; method: PaymentMethod; locale: Locale }): Promise<{ ok: true; payment: PaymentView } | ActionError> {
  const s = await getSession();
  if (!s) return { ok: false, error: "FORBIDDEN" };
  const p = z.object({ orderId: idSchema, method: paymentMethodSchema, locale }).safeParse(input);
  if (!p.success) return { ok: false, error: "INVALID" };
  const rl = rateLimit("checkout:pay", s.user.id, 30, 600_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED" };
  try {
    return { ok: true, payment: await startPayment(p.data.orderId, s.user, p.data.method, p.data.locale) };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code };
    console.error("[checkout] start payment failed", e);
    return { ok: false, error: "generic" };
  }
}

export async function instapaySentAction(paymentId: string): Promise<{ ok: true } | ActionError> {
  const s = await getSession();
  if (!s) return { ok: false, error: "FORBIDDEN" };
  if (!idSchema.safeParse(paymentId).success) return { ok: false, error: "INVALID" };
  try {
    await markInstapaySent(paymentId, s.user);
    return { ok: true };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code };
    return { ok: false, error: "generic" };
  }
}

export async function cancelOrderAction(orderId: string): Promise<{ ok: true } | ActionError> {
  const s = await getSession();
  if (!s) return { ok: false, error: "FORBIDDEN" };
  if (!idSchema.safeParse(orderId).success) return { ok: false, error: "INVALID" };
  try {
    await cancelOrder(orderId, s.user);
    return { ok: true };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code };
    return { ok: false, error: "generic" };
  }
}

const quoteRequestSchema = z.object({
  designId: idSchema,
  quantity: z.number().int().min(MAX_INSTANT_QTY + 1).max(1_000_000),
  // Stored as the governorate code (CAIRO, GIZA…); the client sends the address name or a code.
  governorate: z
    .string()
    .max(40)
    .transform((g, ctx) => toGovernorateKey(g) ?? (ctx.addIssue({ code: z.ZodIssueCode.custom, message: "INVALID_GOVERNORATE" }), z.NEVER))
    .optional(),
  note: z.string().trim().max(QUOTE_NOTE_MAX).optional(),
  /** Date the boxes are needed by (YYYY-MM-DD), optional. */
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Manual quote request (above the 2,000-box instant cap). Stored as a `Quote` with status
 * REQUESTED and zero totals (nothing is priced yet), plus a QUOTE_REQUEST audit entry so the
 * operations team sees it in the admin activity log. Re-sending the same request within 72 h
 * returns the open one instead of creating a duplicate.
 */
export async function requestQuoteAction(input: unknown): Promise<{ ok: true; quoteId: string; repeat: boolean } | ActionError> {
  const s = await getSession();
  if (!s) return { ok: false, error: "FORBIDDEN" };
  const p = quoteRequestSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "INVALID", fields: [...new Set(p.error.issues.map((i) => i.path.join(".")))] };
  const rl = rateLimit("checkout:quote-request", s.user.id, 5, 3_600_000);
  if (!rl.ok) return { ok: false, error: "RATE_LIMITED" };
  const design = await loadCheckoutDesign(p.data.designId, s.user);
  if (!design) return { ok: false, error: "NOT_FOUND" };
  const { designId, quantity } = p.data;
  const now = new Date();
  try {
    const open = await db.quote.findMany({
      where: { userId: s.user.id, designId, status: QUOTE_REQUESTED, validUntil: { gt: now } },
      select: { id: true, lines: true },
      take: 20,
    });
    const same = open.find((q) => {
      const lines = Array.isArray(q.lines) ? (q.lines as { quantity?: number }[]) : [];
      return lines[0]?.quantity === quantity;
    });
    if (same) return { ok: true, quoteId: same.id, repeat: true };
    const h = await headers();
    const q = await db.$transaction(async (tx) => {
      const row = await tx.quote.create({
        data: {
          userId: s.user.id,
          designId,
          lines: [{ kind: "PRODUCT", labelKey: "pricing.line.product", quantity, unitPiasters: 0, totalPiasters: 0 }],
          subtotalPiasters: 0,
          vatPiasters: 0,
          totalPiasters: 0,
          validUntil: new Date(now.getTime() + 72 * 3_600_000),
          status: QUOTE_REQUESTED,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: s.user.id,
          actorPhone: s.user.phone,
          action: "QUOTE_REQUEST",
          entityType: "QUOTE",
          entityId: row.id,
          summary: `${quantity.toLocaleString("en-US")} x ${design.doc.structureCode} · ${design.doc.name.slice(0, 80)}`,
          after: toJson({
            designId,
            quantity,
            governorate: p.data.governorate ?? null,
            neededBy: p.data.neededBy ?? null,
            note: p.data.note || null,
            phone: s.user.phone,
            // Spec snapshot: the lead stays readable if the design changes later.
            spec: {
              name: design.doc.name,
              structureCode: design.doc.structureCode,
              modelCode: design.doc.modelCode ?? null,
              dims: design.doc.dims,
              materialCode: design.doc.materialCode,
              finishCode: design.doc.finishCode,
              finishes: design.doc.finishes ?? [],
              printSides: design.doc.printSides,
            },
          }),
          ip: clientIp(h),
        },
      });
      return row;
    });
    return { ok: true, quoteId: q.id, repeat: false };
  } catch (e) {
    console.error("[checkout] quote request failed", e);
    return { ok: false, error: "generic" };
  }
}

async function saveCompany(userId: string, c: { name: string; taxId: string; commercialRegister: string }) {
  const data = { name: c.name, taxId: normalizeTaxId(c.taxId), commercialRegister: c.commercialRegister || null };
  const u = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (u?.organizationId) await db.organization.update({ where: { id: u.organizationId }, data });
  else await db.user.update({ where: { id: userId }, data: { organization: { create: data } } });
}
