import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalJson, fromJson, toJson } from "@/lib/json";
import type { SessionUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import {
  QTY_TIERS,
  type DesignDoc,
  type DisputeReason,
  type Dims,
  type Locale,
  type OrderStatus,
  type PaymentMethod,
  type ProductionEventType,
  type QuoteLine,
  type ShipmentStatus,
  type ShippingAddress,
} from "@/types";
import { rowToDoc } from "@/components/designer/server";
import { designQuoteFields, priceTable, quote, toPublicOffer, zoneForGovernorate, type PublicVendorOffer, type QuoteOutcome, type VendorOffer } from "@/lib/pricing";
import { loadPricingData } from "@/lib/pricing/server";
import { loadPricingConfig } from "@/components/admin/server/settings";
import { HEADLINE_DEFAULTS } from "@/lib/pricing/headline";
import { loadCheckoutSettings } from "./checkout-settings";
import { SAMPLE_LINE_LABEL, SAMPLE_ORDER_NOTE, applySampleCredit, sampleOffer } from "./sample";
import { claimSampleCredit, sampleCreditInUse, type SampleCreditClient } from "./sample-credit";
import { isPngOrJpeg } from "./image-magic";
import { getPaymentProvider, mockPaymentsEnabled, paymentConfig, type Intention, type WebhookOutcome, type WebhookRequest } from "@/lib/payments";
import { getShippingProvider, type TrackingEvent } from "@/lib/shipping";
import { notify } from "@/lib/notify";
import { track } from "@/lib/analytics/track";
import { rateLimit } from "@/lib/rate-limit";
import { isReprint } from "@/components/admin/lib/metrics";
import { generatePrintPdf } from "./pdf/print";
import { putFile, getFile } from "./storage";
import { assertTransition, canBuyerCancel, canViewBuyerOrder, canViewOrder, canOpenDispute, canReview, isPaidStatus, type Actor } from "./state";
import { isQuoteValid, nextSequence, orderTotals } from "./totals";
import { decidePaymentOutcome, storedGatewayRef } from "./payment-rules";
import { preflightBlocks, proofPreflight, type ProofPreflight } from "./preflight";
import { instantOrderBlock } from "./order-guard";
import { formatDateTime, formatMoney } from "@/lib/format";
import { parseKey as parseUploadKey } from "@/components/vendor/lib/files";
import { QUOTE_PRICED } from "./quote-status";

/**
 * Order service (owner: checkout). Every order mutation in the app goes through here so the
 * state machine, authorisation and side effects (events, notifications, PDFs) stay in one place.
 * Vendor portal and admin should call `transitionOrder()` / `shipOrder()` rather than updating
 * Order.status directly.
 */

export class OrderError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "OFFER_UNAVAILABLE"
      | "QUOTE_EXPIRED"
      | "INVALID_STATE"
      | "AMOUNT_MISMATCH"
      | "MANUAL_QUOTE"
      | "PAYMENT_UNAVAILABLE"
      | "PREFLIGHT_BLOCKED"
      | "NOT_ALLOWED",
  ) {
    super(code);
    this.name = "OrderError";
  }
}

// Same inputs as the public pages and the designer badge for anything the buyer has not chosen (B-26).
const DEFAULT_COLOURS = HEADLINE_DEFAULTS.colours;

// ───────────────────────── designs & quotes ─────────────────────────

/** A design the user may check out: their own (ADMIN may check out any). */
export async function loadCheckoutDesign(designId: string, user: SessionUser): Promise<{ doc: DesignDoc; thumbnailUrl: string | null } | null> {
  if (!/^[\w-]{1,64}$/.test(designId)) return null;
  const row = await db.design.findUnique({ where: { id: designId }, include: { material: true } });
  if (!row) return null;
  if (row.ownerId !== user.id && user.role !== "ADMIN") return null;
  const doc = rowToDoc(row);
  return doc ? { doc, thumbnailUrl: row.thumbnailUrl } : null;
}

/**
 * Rate cards, vendors, materials and pricing settings for this request, read in parallel and only
 * once per request (`react.cache`: the checkout page prices the chosen quantity AND the tier table,
 * which used to read everything twice, PERF-20). Deliberately NOT cached across requests: prices
 * that become an order must come from the database as it is now.
 */
const pricingInputs = cache(async () => {
  const [data, config] = await Promise.all([loadPricingData(), loadPricingConfig()]);
  return { data, config };
});

/** Smallest run any active printer takes (R4-CR-07: the one minimum checkout states and checks). */
export async function minOrderQuantity(): Promise<number> {
  const { data } = await pricingInputs();
  const mins = data.vendors.map((v) => v.minOrderQty).filter((n) => Number.isFinite(n) && n > 0);
  return mins.length ? Math.min(...mins) : 1;
}

/** Instant quote for a design (internal: includes vendor cost; never send to the browser). */
export async function quoteDesign(doc: DesignDoc, opts: { quantity: number; governorate?: string; vendorId?: string }): Promise<QuoteOutcome> {
  const zone = (opts.governorate && zoneForGovernorate(opts.governorate)) || HEADLINE_DEFAULTS.zone;
  const { data, config } = await pricingInputs();
  return quote(
    {
      ...designQuoteFields(doc),
      colours: DEFAULT_COLOURS,
      quantity: opts.quantity,
      vendorId: opts.vendorId,
      zone,
    },
    data,
    { config },
  );
}

/** Buyer-safe offers plus the totals the buyer will actually pay (prepay discount applied). */
export interface CheckoutOffer extends PublicVendorOffer {
  pay: ReturnType<typeof orderTotals>;
}

/**
 * `prepayDiscountPct` comes from `loadCheckoutSettings()` (admin setting, default 3%, B-11).
 * Samples pay their fixed price (no prepay discount); a regular order can carry a sample credit (B-05).
 */
export function toCheckoutOffer(o: VendorOffer | PublicVendorOffer, prepayDiscountPct: number, opts: { sample?: boolean; creditPiasters?: number } = {}): CheckoutOffer {
  const pub = "internal" in o ? toPublicOffer(o as VendorOffer) : o;
  return { ...pub, pay: buyerTotals(pub.lines, prepayDiscountPct, opts) };
}

function buyerTotals(lines: QuoteLine[], prepayDiscountPct: number, opts: { sample?: boolean; creditPiasters?: number }) {
  if (opts.sample) return orderTotals(lines, 0);
  return applySampleCredit(orderTotals(lines, prepayDiscountPct), opts.creditPiasters ?? 0);
}

// ───────────────────────── samples (B-05) ─────────────────────────

export interface SampleCredit {
  piasters: number;
  sampleOrderId: string;
  sampleNumber: string;
  expiresAt: Date;
}

/**
 * The buyer's unused sample credit for this design: a paid (not cancelled or refunded) sample
 * order of the same design, paid within `creditDays`, whose credit is not used by a live order.
 */
export async function sampleCreditFor(userId: string, designId: string, now = new Date()): Promise<SampleCredit | null> {
  const settings = (await loadCheckoutSettings()).sample;
  if (settings.creditDays <= 0) return null;
  const since = new Date(now.getTime() - settings.creditDays * 86_400_000);
  const rows = await db.order.findMany({
    where: {
      buyerId: userId,
      paidAt: { gte: since },
      status: { notIn: ["CANCELLED", "REFUNDED", "PENDING_PAYMENT"] },
      productionEvents: { some: { type: "NOTE", note: SAMPLE_ORDER_NOTE } },
      items: { some: { proof: { designId } } },
    },
    orderBy: { paidAt: "asc" },
    select: { id: true, number: true, paidAt: true, quote: { select: { lines: true } }, productionEvents: { where: { type: "NOTE", note: { startsWith: "SAMPLE_CREDITED:" } }, select: { note: true } } },
    take: 10,
  });
  for (const r of rows) {
    if (await sampleCreditInUse(db as unknown as SampleCreditClient, r.productionEvents, now)) continue;
    const lines = r.quote ? fromJson<QuoteLine[]>(r.quote.lines) : null;
    const goods = (lines ?? []).filter((l) => l.labelKey === SAMPLE_LINE_LABEL).reduce((sum, l) => sum + l.totalPiasters, 0);
    if (goods <= 0 || !r.paidAt) continue;
    return { piasters: goods, sampleOrderId: r.id, sampleNumber: r.number, expiresAt: new Date(r.paidAt.getTime() + settings.creditDays * 86_400_000) };
  }
  return null;
}

/** Samples ordered this calendar month (Cairo time is close enough for a cap), platform-wide. */
async function samplesThisMonth(now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return db.productionEvent.count({ where: { type: "NOTE", note: SAMPLE_ORDER_NOTE, createdAt: { gte: start } } });
}

/** Sample offers for a design: each capable printer's delivery, the fixed sample price. */
export async function sampleOffers(doc: DesignDoc, governorate?: string): Promise<{ offers: VendorOffer[]; pieces: number } | null> {
  const settings = (await loadCheckoutSettings()).sample;
  if (!settings.enabled) return null;
  if (settings.monthlyCap > 0 && (await samplesThisMonth()) >= settings.monthlyCap) return null;
  const outcome = await quoteDesign(doc, { quantity: QTY_TIERS[0], governorate });
  if (outcome.mode !== "instant" || outcome.offers.length === 0) return null;
  return { offers: outcome.offers.map((o) => sampleOffer(o, settings.maxPieces, settings.pricePiasters)), pieces: settings.maxPieces };
}

// ───────────────────────── numbering ─────────────────────────

async function nextOrderNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const prefix = `ELB-${String(now.getUTCFullYear()).slice(2)}`;
  const rows = await tx.order.findMany({ where: { number: { startsWith: prefix } }, select: { number: true }, orderBy: { placedAt: "desc" }, take: 200 });
  return nextSequence(prefix, rows.map((r) => r.number));
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const prefix = `INV-${String(now.getUTCFullYear()).slice(2)}`;
  const rows = await tx.invoice.findMany({ where: { number: { startsWith: prefix } }, select: { number: true }, orderBy: { issuedAt: "desc" }, take: 200 });
  return nextSequence(prefix, rows.map((r) => r.number));
}

/** Retry on unique-number races (two orders placed in the same instant). */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2002" || i >= tries - 1) throw e;
    }
  }
}

// ───────────────────────── placing an order (proof approval) ─────────────────────────

export function proofHash(snapshot: DesignDoc): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

export interface PlaceOrderInput {
  designId: string;
  quantity: number;
  vendorId: string;
  address: ShippingAddress;
  approval: { ip: string; userAgent?: string };
  /** 3D render (PNG/JPEG bytes) captured in the browser at approval time. */
  preview?: Buffer | null;
  locale: Locale;
  /** Paid sample (B-05): `quantity` is ignored, the sample pieces and price come from settings. */
  sample?: boolean;
  /** The buyer saw the red preflight issues and approves anyway (recorded on the proof). */
  acknowledgePreflight?: boolean;
  /** R4-B-03: order at the price the team sent for this price request (quantity and printer come from it). */
  quoteId?: string;
}

/**
 * The buyer approved the proof: freeze the design into an immutable Proof (snapshot + sha256
 * hash + time + IP), re-price on the server (never trust browser prices) and create the order
 * awaiting payment, with its Quote (valid 72 h).
 */
export async function placeOrder(user: SessionUser, input: PlaceOrderInput): Promise<{ orderId: string; number: string }> {
  const design = await loadCheckoutDesign(input.designId, user);
  if (!design) throw new OrderError("NOT_FOUND");
  // B-04: production preflight on the exact snapshot being approved (same rules as the designer).
  const preflight = proofPreflight({ ...design.doc, id: input.designId }, input.acknowledgePreflight === true);
  if (preflightBlocks(preflight)) throw new OrderError("PREFLIGHT_BLOCKED");
  if (input.quoteId) {
    const priced = await loadPricedQuote(input.quoteId, user, input.designId);
    if (!priced) throw new OrderError("QUOTE_EXPIRED");
    return createOrderFromOffer(user, {
      doc: { ...design.doc, id: input.designId },
      offer: priced.offer,
      quoteId: priced.id,
      address: input.address,
      approval: input.approval,
      preview: input.preview ?? null,
      locale: input.locale,
      preflight,
    });
  }
  if (input.sample) {
    const samples = await sampleOffers(design.doc, input.address.governorate);
    const offer = samples?.offers.find((o) => o.vendorId === input.vendorId);
    if (!offer) throw new OrderError("OFFER_UNAVAILABLE");
    return createOrderFromOffer(user, {
      doc: { ...design.doc, id: input.designId },
      offer,
      sample: true,
      preflight,
      address: input.address,
      approval: input.approval,
      preview: input.preview ?? null,
      locale: input.locale,
    });
  }
  const outcome = await quoteDesign(design.doc, { quantity: input.quantity, governorate: input.address.governorate, vendorId: input.vendorId });
  if (outcome.mode !== "instant") throw new OrderError("MANUAL_QUOTE");
  const offer = outcome.offers.find((o) => o.vendorId === input.vendorId);
  if (!offer) throw new OrderError("OFFER_UNAVAILABLE");
  return createOrderFromOffer(user, {
    doc: { ...design.doc, id: input.designId },
    offer,
    credit: await sampleCreditFor(user.id, input.designId),
    address: input.address,
    approval: input.approval,
    preview: input.preview ?? null,
    locale: input.locale,
    preflight,
  });
}

async function createOrderFromOffer(
  user: SessionUser,
  p: {
    /** Set only when the order comes from a price the team sent for a price request (R4-B-03). */
    quoteId?: string | null;
    doc: DesignDoc;
    offer: OrderOffer;
    address: ShippingAddress;
    approval?: { ip: string; userAgent?: string };
    existingProofId?: string;
    preview: Buffer | null;
    locale: Locale;
    note?: string;
    sample?: boolean;
    credit?: SampleCredit | null;
    preflight?: ProofPreflight;
  },
): Promise<{ orderId: string; number: string }> {
  // B-16 / R4-B-01: the last check before any order is written (checkout, sample, reorder).
  if (instantOrderBlock(p.doc, p.offer, p.quoteId)) throw new OrderError("MANUAL_QUOTE");
  // A price the team sent is final: no prepay discount on top (R4-B-03, agreed with admin).
  const totals = p.quoteId ? orderTotals(p.offer.lines, 0) : buyerTotals(p.offer.lines, (await loadCheckoutSettings()).prepayDiscountPct, { sample: p.sample, creditPiasters: p.credit?.piasters });
  const product = p.offer.lines.find((l) => l.kind === "PRODUCT");
  const now = new Date();
  // Admin's quote validity (clamped to 1 to 72 h in makeConfig), the same value the designer and
  // the public pages promise (B-14). The offer's own validUntil already used it; this is the cap.
  const validityHours = (await loadPricingConfig()).quoteValidityHours;
  const validUntil = p.quoteId ? new Date(p.offer.validUntil) : new Date(Math.min(new Date(p.offer.validUntil).getTime(), now.getTime() + validityHours * 3_600_000));
  const designId = p.doc.id!;

  const result = await withRetry(() =>
    db.$transaction(async (tx) => {
      // R4-02: claim the credit atomically (see ./sample-credit); a lost claim means re-price.
      if (p.credit && !(await claimSampleCredit(tx as unknown as SampleCreditClient, p.credit.sampleOrderId, now))) throw new OrderError("QUOTE_EXPIRED");
      let proofId = p.existingProofId;
      if (!proofId) {
        const version = (await tx.proof.count({ where: { designId } })) + 1;
        const snapshot: DesignDoc = { ...p.doc, id: designId };
        const proof = await tx.proof.create({
          data: {
            designId,
            version,
            snapshot: toJson(snapshot),
            hash: proofHash(snapshot),
            approvedAt: now,
            approvedIp: p.approval?.ip ?? null,
            approvedById: user.id,
            ...(p.preflight ? { preflight: toJson(p.preflight) } : {}),
          },
        });
        proofId = proof.id;
      }
      // A sent price is used once: PRICED -> ACCEPTED in the same transaction as the order.
      const q = p.quoteId
        ? await (async () => {
            const claimed = await tx.quote.updateMany({ where: { id: p.quoteId!, userId: user.id, status: QUOTE_PRICED, validUntil: { gt: now } }, data: { status: "ACCEPTED" } });
            if (claimed.count !== 1) throw new OrderError("QUOTE_EXPIRED");
            return { id: p.quoteId! };
          })()
        : await tx.quote.create({
        data: {
          userId: user.id,
          designId,
          vendorId: p.offer.vendorId,
          lines: toJson(totals.lines),
          subtotalPiasters: totals.subtotalPiasters,
          vatPiasters: totals.vatPiasters,
          shippingPiasters: totals.shippingPiasters,
          totalPiasters: totals.totalPiasters,
          validUntil,
          status: "OPEN",
        },
      });
      const number = await nextOrderNumber(tx, now);
      const order = await tx.order.create({
        data: {
          number,
          buyerId: user.id,
          vendorId: p.offer.vendorId,
          quoteId: q.id,
          status: "PENDING_PAYMENT",
          subtotalPiasters: totals.subtotalPiasters,
          vatPiasters: totals.vatPiasters,
          shippingPiasters: totals.shippingPiasters,
          totalPiasters: totals.totalPiasters,
          vendorCostPiasters: p.offer.internal.vendorCostPiasters,
          shippingAddress: toJson(p.address),
          notes: p.note ?? null,
          placedAt: now,
          // Estimate until payment; re-based on paidAt when the payment lands.
          dueDate: new Date(now.getTime() + p.offer.deliveryDays * 86_400_000),
          items: {
            create: [
              {
                proofId,
                structureCode: p.doc.structureCode,
                modelCode: p.doc.modelCode ?? null,
                ...(p.doc.features || p.doc.finishes?.length || p.doc.vessel
                  ? { config: toJson({ ...(p.doc.features ? { features: p.doc.features } : {}), ...(p.doc.finishes?.length ? { finishes: p.doc.finishes } : {}), ...(p.doc.vessel ? { vessel: p.doc.vessel } : {}) }) }
                  : {}),
                dims: toJson(p.doc.dims),
                materialCode: p.doc.materialCode,
                finishCode: p.doc.finishCode,
                printSides: p.doc.printSides,
                quantity: p.offer.quantity,
                unitPiasters: product?.unitPiasters ?? p.offer.unitPiasters,
                lineTotalPiasters: product?.totalPiasters ?? p.offer.subtotalPiasters,
              },
            ],
          },
          productionEvents: {
            create: [
              { type: "ORDER_PLACED", actorId: user.id, note: p.note ?? null, createdAt: now },
              {
                type: "PROOF_APPROVED",
                actorId: user.id,
                createdAt: now,
                // Vendor and ops see what was approved: e.g. "PREFLIGHT:1E/2W:ACK".
                note: p.preflight?.ran ? `PREFLIGHT:${p.preflight.errors}E/${p.preflight.warnings}W${p.preflight.acknowledged && p.preflight.errors ? ":ACK" : ""}` : null,
              },
              ...(p.sample ? [{ type: "NOTE", actorId: user.id, note: SAMPLE_ORDER_NOTE, createdAt: now }] : []),
              ...(p.credit ? [{ type: "NOTE", actorId: user.id, note: `SAMPLE_CREDIT:${p.credit.sampleNumber}`, createdAt: now }] : []),
            ],
          },
        },
      });
      if (p.credit) {
        await tx.productionEvent.create({ data: { orderId: p.credit.sampleOrderId, type: "NOTE", actorId: user.id, note: `SAMPLE_CREDITED:${number}`, createdAt: now } });
      }
      return { orderId: order.id, number, proofId };
    }),
  );

  // R4-11: only a real PNG or JPEG is kept (the data-URL prefix is checked by the action, the bytes
  // were not): anything else is dropped, so the private preview route can only ever serve an image.
  if (p.preview && !p.existingProofId && isPngOrJpeg(p.preview)) {
    try {
      await putFile(`proofs/${result.proofId}.img`, p.preview);
      await db.proof.update({ where: { id: result.proofId }, data: { previewUrl: `/api/orders/proofs/${result.proofId}/preview` } });
    } catch (e) {
      console.warn("[orders] could not store proof preview", e);
    }
  }
  if (!p.existingProofId) {
    await db.proof.update({ where: { id: result.proofId }, data: { pdfUrl: `/api/orders/${result.orderId}/proof-pdf` } });
  }

  // launch-metrics.md §1 `proof_approved`: the buyer approved the frozen 3D + PDF proof (the legal
  // record is the Proof row; this is the funnel step). A reorder reuses the approved proof.
  if (!p.existingProofId) {
    void track(
      "proof_approved",
      { locale: p.locale, structure_code: p.doc.structureCode, model_code: p.doc.modelCode ?? null, quantity: p.offer.quantity },
      { userId: user.id, designId, orderId: result.orderId },
    );
  }
  if (p.quoteId) {
    await db.auditLog
      .create({ data: { actorId: user.id, action: "QUOTE_ACCEPTED", entityType: "QUOTE", entityId: p.quoteId, summary: `Price accepted: order ${result.number}`, after: toJson({ orderId: result.orderId, number: result.number }) } })
      .catch((e) => console.warn("[orders] quote audit failed", e));
  }
  await notify({ to: { phone: user.phone }, locale: p.locale, template: "ORDER_PLACED", params: { number: result.number, url: buyerLink(p.locale, `/checkout/pay/${result.orderId}`) } });
  return { orderId: result.orderId, number: result.number };
}

// ───────────────────────── team-priced quotes (R4-B-03) ─────────────────────────

/** Fields of an offer that order creation reads; instant offers and team-priced quotes both fit. */
export type OrderOffer = Pick<VendorOffer, "vendorId" | "quantity" | "lines" | "subtotalPiasters" | "unitPiasters" | "validUntil" | "deliveryDays"> & {
  internal: Pick<VendorOffer["internal"], "vendorCostPiasters">;
};

export interface PricedQuote {
  id: string;
  quantity: number;
  validUntil: Date;
  /** Buyer-safe offer for the checkout page (no vendor cost). */
  publicOffer: PublicVendorOffer;
  offer: OrderOffer;
}

/**
 * A price the team sent for this buyer's price request on this design, still valid, from an
 * active printer, with the printer's agreed price recorded. Null otherwise (expired, used,
 * someone else's, another design, or not priced yet).
 */
export async function loadPricedQuote(quoteId: string, user: SessionUser, designId: string, now = new Date()): Promise<PricedQuote | null> {
  if (!/^[\w-]{1,64}$/.test(quoteId)) return null;
  const q = await db.quote.findFirst({ where: { id: quoteId, userId: user.id, designId, status: QUOTE_PRICED, validUntil: { gt: now } } });
  if (!q || !q.vendorId || q.vendorCostPiasters == null || q.totalPiasters <= 0) return null;
  const lines = fromJson<QuoteLine[]>(q.lines);
  const product = Array.isArray(lines) ? lines.find((l) => l.kind === "PRODUCT") : undefined;
  if (!product || product.quantity < 1) return null;
  const vendor = await db.vendor.findFirst({ where: { id: q.vendorId, status: "ACTIVE" } });
  if (!vendor) return null;
  const totals = orderTotals(lines, 0);
  const deliveryDays = q.deliveryDays ?? 14;
  const base = {
    vendorId: vendor.id,
    quantity: product.quantity,
    lines,
    subtotalPiasters: totals.subtotalPiasters,
    vatPiasters: totals.vatPiasters,
    totalPiasters: totals.totalPiasters,
    unitPiasters: Math.round(totals.subtotalPiasters / product.quantity),
    leadTimeDays: deliveryDays,
    deliveryDays,
    standardSize: false,
    validUntil: q.validUntil.toISOString(),
  };
  const publicOffer = {
    ...base,
    vendor: { id: vendor.id, slug: vendor.slug, name: { ar: vendor.nameAr, en: vendor.nameEn }, city: vendor.city, rating: vendor.rating, ratingCount: vendor.ratingCount, onTimePct: vendor.onTimePct, verified: vendor.verified },
    printMethod: "OFFSET",
    shippingPiasters: totals.shippingPiasters,
    shipping: null,
    score: 1,
    badges: [],
  } as unknown as PublicVendorOffer;
  return { id: q.id, quantity: product.quantity, validUntil: q.validUntil, publicOffer, offer: { ...base, internal: { vendorCostPiasters: q.vendorCostPiasters } } };
}

// ───────────────────────── reading orders ─────────────────────────

const orderInclude = {
  vendor: true,
  buyer: { select: { id: true, name: true, phone: true, email: true, organization: true, locale: true } },
  items: { include: { proof: true } },
  productionEvents: { orderBy: { createdAt: "asc" } },
  qcPhotos: { orderBy: { uploadedAt: "asc" } },
  shipments: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
  invoices: { orderBy: { issuedAt: "asc" } },
  reviews: true,
  disputes: { orderBy: { createdAt: "desc" } },
  quote: true,
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/** Buyer, ADMIN, or the order's vendor staff once it was paid (pure rule in ./state). */
export { canViewOrder };

export async function getOrderForViewer(idOrNumber: string, user: SessionUser): Promise<OrderDetail | null> {
  if (!/^[\w-]{1,64}$/.test(idOrNumber)) return null;
  const order = await db.order.findFirst({ where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] }, include: orderInclude });
  // Buyer-side pages: never vendor staff (R5-SEC-01); they use the vendor portal job page.
  if (!order || !canViewBuyerOrder(order, user)) return null;
  return order;
}

export async function listBuyerOrders(userId: string) {
  return db.order.findMany({
    where: { buyerId: userId },
    orderBy: { placedAt: "desc" },
    include: { vendor: { select: { nameAr: true, nameEn: true, slug: true } }, items: { select: { quantity: true, structureCode: true } }, payments: { select: { status: true } } },
  });
}

/**
 * Money breakdown for display. Orders created by checkout store subtotal INCLUDING shipping
 * (VAT on everything, like the pricing engine); older rows (seed) stored it excluding shipping.
 */
export function moneyOf(order: { subtotalPiasters: number; vatPiasters: number; shippingPiasters: number; totalPiasters: number; quote?: { lines: Prisma.JsonValue } | null }) {
  const lines = order.quote ? fromJson<QuoteLine[]>(order.quote.lines) : null;
  const shippingIncluded = order.totalPiasters === order.subtotalPiasters + order.vatPiasters;
  const net = shippingIncluded ? order.subtotalPiasters : order.subtotalPiasters + order.shippingPiasters;
  const discount = lines ? -lines.filter((l) => l.kind === "DISCOUNT").reduce((s, l) => s + l.totalPiasters, 0) : 0;
  return {
    lines,
    goodsPiasters: net - order.shippingPiasters + discount,
    shippingPiasters: order.shippingPiasters,
    discountPiasters: discount,
    netPiasters: net,
    vatPiasters: order.vatPiasters,
    totalPiasters: order.totalPiasters,
  };
}

// ───────────────────────── state changes ─────────────────────────

export interface TransitionActor {
  role: Actor;
  userId?: string | null;
  vendorId?: string | null;
}

export function actorOf(user: SessionUser): TransitionActor {
  return { role: user.role, userId: user.id, vendorId: user.vendorId };
}

const EVENT_TIMESTAMPS: Partial<Record<OrderStatus, "paidAt" | "deliveredAt" | "cancelledAt">> = {
  PAID: "paidAt",
  DELIVERED: "deliveredAt",
  CANCELLED: "cancelledAt",
  REFUNDED: "cancelledAt",
};

/**
 * Move an order along the state machine. Checks the edge and the actor (vendors only for their
 * own orders, buyers only for their own), writes the timeline event and notifies the buyer.
 */
export async function transitionOrder(orderId: string, to: OrderStatus, actor: TransitionActor, note?: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { buyer: true } });
  if (!order) throw new OrderError("NOT_FOUND");
  if (actor.role === "VENDOR" && actor.vendorId !== order.vendorId) throw new OrderError("FORBIDDEN");
  if (actor.role === "BUYER" && actor.userId !== order.buyerId) throw new OrderError("FORBIDDEN");
  const rule = assertTransition(order.status as OrderStatus, to, actor.role);
  const stamp = EVENT_TIMESTAMPS[to];
  const now = new Date();
  // Status + timeline event commit together; the conditional update makes concurrent moves
  // (double "accept", two tabs) lose the race instead of writing two events.
  const changed = await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to, ...(stamp ? { [stamp]: now } : {}) },
    });
    if (updated.count !== 1) return false;
    await tx.productionEvent.create({ data: { orderId, type: rule.event, note: note ?? null, actorId: actor.userId ?? null, createdAt: now } });
    if (to === "REFUNDED") await issueCreditNote(tx, orderId, now);
    return true;
  });
  if (!changed) throw new OrderError("INVALID_STATE");
  // launch-metrics.md §1 `order_delivered` (courier sync or vendor/admin confirmation).
  if (to === "DELIVERED") {
    const onTime = order.dueDate ? now.getTime() <= order.dueDate.getTime() : null;
    void track("order_delivered", { by: actor.role, on_time: onTime, reprint: isReprint(order) }, { userId: order.buyerId, orderId });
  }
  await notifyStatus(order, to);
}

/**
 * A refunded sale needs a credit note that reverses its tax invoice (Egyptian VAT Law 67/2016 and
 * the ETA e-invoicing system: an issued invoice is never edited or deleted, it is cancelled by a
 * credit note "C" document referencing it). Same amounts as the SALE invoice, positive, numbered
 * CN-YYnnn. Idempotent; runs inside the REFUNDED transition so both commit together.
 */
async function issueCreditNote(tx: Prisma.TransactionClient, orderId: string, now: Date): Promise<void> {
  const sale = await tx.invoice.findFirst({ where: { orderId, kind: "SALE" }, orderBy: { issuedAt: "asc" } });
  if (!sale) return; // never invoiced (not paid): nothing to reverse
  if (await tx.invoice.count({ where: { orderId, kind: "CREDIT_NOTE" } })) return;
  const prefix = `CN-${String(now.getUTCFullYear()).slice(2)}`;
  const rows = await tx.invoice.findMany({ where: { number: { startsWith: prefix } }, select: { number: true }, orderBy: { issuedAt: "desc" }, take: 200 });
  await tx.invoice.create({
    data: {
      orderId,
      number: nextSequence(prefix, rows.map((r) => r.number)),
      kind: "CREDIT_NOTE",
      subtotalPiasters: sale.subtotalPiasters,
      vatPiasters: sale.vatPiasters,
      totalPiasters: sale.totalPiasters,
      issuedAt: now,
    },
  });
}

/** R9: every buyer message links to the page it talks about. */
function buyerLink(locale: Locale, path: string): string {
  return `${siteUrl()}/${locale}${path}`;
}

async function notifyStatus(order: { id: string; number: string; buyer: { locale: string; phone: string; email: string | null } }, to: OrderStatus, tracking?: string): Promise<void> {

  const locale = (order.buyer.locale === "en" ? "en" : "ar") as Locale;
  let template: "SHIPPED" | "DELIVERED" | "REFUNDED" | "STATUS_CHANGED" = to === "SHIPPED" ? "SHIPPED" : to === "DELIVERED" ? "DELIVERED" : "STATUS_CHANGED";
  const { getT } = await import("@/i18n");
  // R10-04: a refund says how much went back and where.
  let refund: { amount: string; method: string } | null = null;
  if (to === "REFUNDED") {
    const p = await db.payment.findFirst({ where: { orderId: order.id, status: { in: ["REFUNDED", "PAID"] } }, orderBy: { createdAt: "desc" }, select: { amountPiasters: true, method: true } });
    if (p) {
      refund = { amount: formatMoney(p.amountPiasters, locale, { alwaysDecimals: true }), method: getT(locale)(`paymentMethods.${p.method}` as never) };
      template = "REFUNDED";
    }
  }
  await notify({
    to: { phone: order.buyer.phone, email: order.buyer.email },
    locale,
    template,
    params: { number: order.number, status: getT(locale)(`orderStatus.${to}`), url: buyerLink(locale, `/orders/${order.id}`), tracking: tracking ?? "", amount: refund?.amount ?? "", method: refund?.method ?? "" },
  });
}

/** Buyer cancels an unpaid order. */
export async function cancelOrder(orderId: string, user: SessionUser): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== user.id) throw new OrderError("NOT_FOUND");
  if (!canBuyerCancel(order.status as OrderStatus)) throw new OrderError("INVALID_STATE");
  await transitionOrder(orderId, "CANCELLED", { role: "BUYER", userId: user.id });
  await db.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED" } });
}

// ───────────────────────── payments ─────────────────────────

export interface PaymentView {
  paymentId: string;
  method: PaymentMethod;
  status: string;
  amountPiasters: number;
  redirectUrl?: string;
  fawry?: { referenceCode: string; expiresAt: string };
  instapay?: { address: string; reference: string };
}

export function paymentView(p: { id: string; method: string; status: string; amountPiasters: number; fawryRef: string | null; raw: Prisma.JsonValue }): PaymentView {
  const raw = (p.raw ?? {}) as { intention?: Pick<Intention, "redirectUrl" | "fawry" | "instapay"> };
  return {
    paymentId: p.id,
    method: p.method as PaymentMethod,
    status: p.status,
    amountPiasters: p.amountPiasters,
    redirectUrl: raw.intention?.redirectUrl,
    fawry: raw.intention?.fawry,
    instapay: raw.intention?.instapay,
  };
}

/** Start (or resume) paying an order with a method. Returns what the payment page needs. */
export async function startPayment(orderId: string, user: SessionUser, method: PaymentMethod, locale: Locale): Promise<PaymentView> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { quote: true, payments: true, buyer: true } });
  if (!order || order.buyerId !== user.id) throw new OrderError("NOT_FOUND");
  if (order.status !== "PENDING_PAYMENT") throw new OrderError("INVALID_STATE");
  if (order.quote && !isQuoteValid(order.quote.validUntil)) throw new OrderError("QUOTE_EXPIRED");
  const cfg = paymentConfig();
  if (!cfg.methods.includes(method)) throw new OrderError("PAYMENT_UNAVAILABLE");
  if (cfg.provider === "mock" && !mockPaymentsEnabled()) throw new OrderError("PAYMENT_UNAVAILABLE");

  // Resume an open payment of the same method (keeps the same Fawry code until it expires).
  const open = order.payments.find((p) => p.status === "PENDING" && p.method === method && p.amountPiasters === order.totalPiasters);
  if (open) {
    const v = paymentView(open);
    const expired = v.fawry && new Date(v.fawry.expiresAt).getTime() < Date.now();
    if (!expired) return v;
    await db.payment.update({ where: { id: open.id }, data: { status: "FAILED" } });
  }

  const provider = getPaymentProvider();
  const payment = await db.payment.create({
    data: { orderId, provider: provider.name, method, status: "PENDING", amountPiasters: order.totalPiasters },
  });
  let intention: Intention;
  try {
    intention = await provider.createIntention({
      paymentId: payment.id,
      orderNumber: order.number,
      amountPiasters: order.totalPiasters,
      method,
      customer: { name: order.buyer.name ?? "", phone: order.buyer.phone, email: order.buyer.email ?? undefined },
      returnUrl: `${siteUrl()}/${locale}/orders/${order.id}`,
      webhookUrl: `${siteUrl()}/api/payments/webhook?provider=${provider.name}`,
      locale,
    });
  } catch (e) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", raw: toJson({ error: String((e as Error).message) }) } });
    throw new OrderError("PAYMENT_UNAVAILABLE");
  }
  const stored = { intention: { redirectUrl: intention.redirectUrl, fawry: intention.fawry, instapay: intention.instapay, gatewayOrderId: intention.gatewayOrderId ?? null } };
  const saved = await db.payment.update({
    where: { id: payment.id },
    data: { providerRef: intention.providerRef, fawryRef: intention.fawry?.referenceCode ?? null, raw: toJson(stored) },
  });
  if (intention.fawry) {
    await notify({
      to: { phone: order.buyer.phone },
      locale,
      template: "FAWRY_CODE",
      // R9: the outlet needs the amount, and the buyer the deadline.
      params: {
        number: order.number,
        code: intention.fawry.referenceCode,
        amount: formatMoney(order.totalPiasters, locale, { alwaysDecimals: true }),
        date: formatDateTime(intention.fawry.expiresAt, locale),
      },
    });
  }
  return paymentView(saved);
}

/** Buyer says "I sent the InstaPay transfer": ops will match it by hand. */
export async function markInstapaySent(paymentId: string, user: SessionUser): Promise<void> {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!p || p.order.buyerId !== user.id || p.method !== "INSTAPAY" || p.status !== "PENDING") throw new OrderError("NOT_FOUND");
  await db.productionEvent.create({ data: { orderId: p.orderId, type: "NOTE", note: "INSTAPAY_SENT", actorId: user.id } });
  await notify({ to: { phone: user.phone }, locale: user.locale, template: "INSTAPAY_PENDING", params: { number: p.order.number } });
}

/** Verify a gateway webhook and apply it. The ONLY path that marks an order paid. */
export async function processPaymentWebhook(providerName: "mock" | "paymob", req: WebhookRequest): Promise<WebhookOutcome & { applied?: string }> {
  const outcome = await getPaymentProvider(providerName).handleWebhook(req);
  if (!outcome.ok) return outcome;
  const applied = await applyPaymentOutcome(outcome);
  return { ...outcome, applied };
}

export async function applyPaymentOutcome(o: Extract<WebhookOutcome, { ok: true }>): Promise<string> {
  if (!/^[\w-]{1,64}$/.test(o.paymentId)) return "UNKNOWN_PAYMENT";
  const payment = await db.payment.findUnique({ where: { id: o.paymentId }, include: { order: { include: { buyer: true, vendor: true } } } });
  if (!payment) return "UNKNOWN_PAYMENT";
  const order = payment.order;
  const locale = (order.buyer.locale === "en" ? "en" : "ar") as Locale;
  const decision = decidePaymentOutcome(
    { provider: payment.provider, status: payment.status, amountPiasters: payment.amountPiasters, gatewayRef: storedGatewayRef(payment) },
    order.status as OrderStatus,
    o,
  );
  const lastRaw = toJson({ ...((payment.raw as object) ?? {}), last: o.raw });

  if (decision.action === "IGNORE") return decision.result;
  if (decision.action === "REJECT") {
    // Signed but not about this payment / not this amount: record for ops, change nothing.
    console.warn(`[payments] webhook rejected for payment ${payment.id}: ${decision.result}`);
    await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: `${decision.result}:${o.amountPiasters}` } });
    return decision.result;
  }

  if (decision.action === "PARTIAL_REFUND") {
    await db.payment.update({ where: { id: payment.id }, data: { raw: lastRaw } });
    await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: "PARTIAL_REFUND_REPORTED" } });
    return "PARTIAL_REFUND";
  }

  if (decision.action === "PENDING") {
    await db.payment.update({ where: { id: payment.id }, data: { raw: lastRaw } });
    return "PENDING";
  }

  if (decision.action === "FAILED") {
    // Conditional: never downgrade a payment that turned PAID concurrently.
    const upd = await db.payment.updateMany({ where: { id: payment.id, status: payment.status }, data: { status: "FAILED", raw: lastRaw } });
    if (upd.count !== 1) return "DUPLICATE";
    await notify({ to: { phone: order.buyer.phone }, locale, template: "PAYMENT_FAILED", params: { number: order.number, url: buyerLink(locale, `/checkout/pay/${order.id}`) } });
    return "FAILED";
  }

  if (decision.action === "REFUNDED") {
    const upd = await db.payment.updateMany({ where: { id: payment.id, status: "PAID" }, data: { status: "REFUNDED", raw: lastRaw } });
    if (upd.count !== 1) return "DUPLICATE";
    if (order.status !== "REFUNDED" && order.status !== "CANCELLED") {
      try {
        await transitionOrder(order.id, "REFUNDED", { role: "SYSTEM" }, "REFUND_CONFIRMED");
      } catch {
        /* not refundable from this state; payment row still records it */
      }
    }
    return "REFUNDED";
  }

  const now = new Date();
  const paidRaw = lastRaw;
  // Paid after cancel/expiry, or a second attempt captured after another one won: keep the money
  // on record and flag it for a refund by ops. Never drop a capture silently.
  const recordLatePayment = async (): Promise<string> => {
    const upd = await db.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID", providerRef: o.providerRef || payment.providerRef, raw: paidRaw },
    });
    if (upd.count !== 1) return "ALREADY_PAID";
    await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: "PAID_AFTER_CANCEL_REFUND_NEEDED" } });
    return "NEEDS_REFUND";
  };
  if (decision.action === "PAID_LATE") return recordLatePayment();
  const leadMs = order.dueDate ? Math.max(0, order.dueDate.getTime() - order.placedAt.getTime()) : 7 * 86_400_000;
  const changed = await db
    .$transaction(async (tx) => {
    const upd = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "PAID", paidAt: now, dueDate: new Date(now.getTime() + leadMs) },
    });
    if (upd.count !== 1) return false;
    assertTransition("PENDING_PAYMENT", "PAID", "SYSTEM");
    const pay = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID", providerRef: o.providerRef || payment.providerRef, raw: paidRaw },
    });
    if (pay.count !== 1) throw new OrderError("INVALID_STATE"); // rolls the order back too
    // Other open attempts for this order are void now.
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING", id: { not: payment.id } }, data: { status: "FAILED" } });
    await tx.productionEvent.create({ data: { orderId: order.id, type: "PAYMENT_CONFIRMED", note: payment.method, createdAt: now } });
    if (order.quoteId) await tx.quote.update({ where: { id: order.quoteId }, data: { status: "ACCEPTED" } });
    const existing = await tx.invoice.count({ where: { orderId: order.id, kind: "SALE" } });
    if (!existing) {
      await tx.invoice.create({
        data: {
          orderId: order.id,
          number: await nextInvoiceNumber(tx, now),
          kind: "SALE",
          subtotalPiasters: order.subtotalPiasters,
          vatPiasters: order.vatPiasters,
          totalPiasters: order.totalPiasters,
        },
      });
    }
    return true;
  })
    .catch((e) => {
      if (e instanceof OrderError) return false;
      throw e;
    });
  if (!changed) {
    // Lost the race: another payment of this order (two tabs, two methods) was confirmed between
    // our read and our write. If THIS payment was captured too, it is a double charge: record it
    // and flag the refund instead of dropping it (money integrity; ASVS V11.1.6).
    const fresh = await db.payment.findUnique({ where: { id: payment.id }, select: { status: true } });
    if (fresh && fresh.status !== "PAID") return recordLatePayment();
    return "ALREADY_PAID";
  }
  // launch-metrics.md §1 `payment_succeeded`: the source of truth for "paid order" is this
  // verified gateway webhook, after the PAID transition committed.
  void trackPaymentSucceeded(order, payment);

  // Side effects after commit: print files, then messages. Failures never undo the payment.
  try {
    await ensurePrintPdfs(order.id);
  } catch (e) {
    console.error("[orders] print PDF generation failed", e);
    await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: "PRINT_PDF_FAILED" } });
  }
  await notify({ to: { phone: order.buyer.phone, email: order.buyer.email }, locale, template: "PAYMENT_RECEIVED", params: { number: order.number, url: buyerLink(locale, `/orders/${order.id}`) } });
  const staff = await db.user.findMany({ where: { vendorId: order.vendorId, role: "VENDOR" }, select: { phone: true, locale: true } });
  for (const s of staff) {
    await notify({ to: { phone: s.phone }, locale: s.locale === "en" ? "en" : "ar", template: "VENDOR_NEW_JOB", params: { number: order.number } });
  }
  return "PAID";
}

async function trackPaymentSucceeded(
  order: { id: string; buyerId: string; totalPiasters: number },
  payment: { method: string; provider: string },
): Promise<void> {
  let firstOrder: boolean | null = null;
  try {
    firstOrder = (await db.order.count({ where: { buyerId: order.buyerId, paidAt: { not: null } } })) <= 1;
  } catch {
    /* analytics only */
  }
  await track(
    "payment_succeeded",
    { method: payment.method, provider: payment.provider, total_piasters: order.totalPiasters, first_order: firstOrder },
    { userId: order.buyerId, orderId: order.id },
  );
}

// ───────────────────────── print files ─────────────────────────

function storageKey(orderNumber: string, itemId: string) {
  return `print/${orderNumber}-${itemId}.pdf`;
}

/** Generate print-ready PDFs for every item of a PAID order (idempotent). */
export async function ensurePrintPdfs(orderId: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { proof: true } } } });
  if (!order || !isPaidStatus(order.status as OrderStatus)) throw new OrderError("INVALID_STATE");
  for (const item of order.items) {
    if (!item.proof) continue;
    const key = storageKey(order.number, item.id);
    if (item.printPdfUrl && (await getFile(key))) continue;
    const doc = fromJson<DesignDoc>(item.proof.snapshot);
    const { bytes, warnings } = await generatePrintPdf(doc, {
      orderNumber: order.number,
      itemId: item.id,
      quantity: item.quantity,
      proofHash: item.proof.hash,
    });
    await putFile(key, bytes);
    await db.orderItem.update({ where: { id: item.id }, data: { printPdfUrl: `/api/orders/${order.id}/print-pdf?item=${item.id}` } });
    if (warnings.length) {
      await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: `PREPRESS_CHECK:${warnings.join(",").slice(0, 400)}` } });
    }
  }
}

/** Bytes of an item's print PDF, generating it if needed. Only for paid orders. */
export async function printPdfBytes(orderId: string, itemId: string): Promise<{ bytes: Buffer; filename: string } | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !isPaidStatus(order.status as OrderStatus)) return null;
  const item = order.items.find((i) => i.id === itemId);
  if (!item) return null;
  const key = storageKey(order.number, item.id);
  let bytes = await getFile(key);
  if (!bytes) {
    await ensurePrintPdfs(order.id);
    bytes = await getFile(key);
  }
  return bytes ? { bytes, filename: `${order.number}-print.pdf` } : null;
}

/** Watermarked proof PDF (flat dieline + artwork) for the buyer's records. Not print-ready. */
export async function proofPdfBytes(orderId: string, watermark: string): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { proof: true } } } });
  const proof = order?.items[0]?.proof;
  if (!order || !proof) return null;
  const { bytes } = await generatePrintPdf(fromJson<DesignDoc>(proof.snapshot), { orderNumber: order.number, proofHash: proof.hash, watermark });
  return { bytes, filename: `${order.number}-proof-v${proof.version}.pdf` };
}

// ───────────────────────── shipping ─────────────────────────

/**
 * Vendor/ops hand the bundles to the courier: claim the order (READY_TO_SHIP -> SHIPPED with a
 * conditional update, so a double click or two staff members cannot book two couriers), book the
 * courier, then record the shipment. If the booking fails the claim is released.
 */
export async function shipOrder(orderId: string, actor: TransitionActor): Promise<{ trackingNumber: string }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { vendor: true, items: true, buyer: true } });
  if (!order) throw new OrderError("NOT_FOUND");
  if (actor.role === "VENDOR" && actor.vendorId !== order.vendorId) throw new OrderError("FORBIDDEN");
  const rule = assertTransition(order.status as OrderStatus, "SHIPPED", actor.role);
  const claimed = await db.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: "SHIPPED" } });
  if (claimed.count !== 1) throw new OrderError("INVALID_STATE");

  const provider = getShippingProvider();
  const qty = order.items.reduce((s, i) => s + i.quantity, 0);
  let created: Awaited<ReturnType<typeof provider.createShipment>>;
  try {
    created = await provider.createShipment({
      orderNumber: order.number,
      pickupCity: order.vendor.city,
      dropOff: fromJson<ShippingAddress>(order.shippingAddress),
      bundles: Math.max(1, Math.ceil(qty / 100)),
      weightKg: Math.max(1, Math.round(qty * 0.08)),
      description: `${qty} flat-packed printed boxes`,
    });
  } catch (e) {
    await db.order.updateMany({ where: { id: orderId, status: "SHIPPED" }, data: { status: order.status } });
    console.error("[orders] courier booking failed", e);
    throw new OrderError("NOT_ALLOWED");
  }
  const now = new Date();
  await db.$transaction([
    db.shipment.create({
      data: {
        orderId,
        provider: provider.name,
        trackingNumber: created.trackingNumber,
        status: created.status,
        labelUrl: created.labelUrl ?? null,
        events: toJson([{ status: created.status, at: now.toISOString() }]),
      },
    }),
    db.productionEvent.create({ data: { orderId, type: rule.event, note: created.trackingNumber, actorId: actor.userId ?? null, createdAt: now } }),
  ]);
  await notifyStatus(order, "SHIPPED", created.trackingNumber);
  return { trackingNumber: created.trackingNumber };
}

/** Refresh tracking for a shipped order; marks it delivered when the courier says so. */
export async function syncShipments(orderId: string): Promise<void> {
  // R4-14: the order page calls this on every view of a SHIPPED order. One courier poll per order
  // per minute (per process) is enough; reloads no longer fan out to the courier API, each call
  // bounded only by its 15 s timeout (ASVS V12/V13 resource limits on outbound calls).
  if (!rateLimit("shipments:sync", orderId, 1, 60_000).ok) return;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { shipments: true } });
  if (!order || order.status !== "SHIPPED") return;
  for (const s of order.shipments) {
    if (!s.trackingNumber || s.status === "DELIVERED" || s.status === "RETURNED") continue;
    try {
      const provider = getShippingProvider(s.provider === "bosta" ? "bosta" : "mock");
      const r = await provider.track(s.trackingNumber, s.createdAt);
      const events: TrackingEvent[] = r.events;
      if (r.status !== s.status || events.length !== fromJson<TrackingEvent[]>(s.events).length) {
        await db.shipment.update({ where: { id: s.id }, data: { status: r.status as ShipmentStatus, events: toJson(events) } });
      }
      if (r.status === "DELIVERED") await transitionOrder(orderId, "DELIVERED", { role: "SYSTEM" }, s.trackingNumber);
    } catch (e) {
      console.warn("[orders] tracking failed", e);
    }
  }
}

// ───────────────────────── after-sale ─────────────────────────

/** One-click reorder: same approved proof, same vendor (or best match), same quantity and address. */
export async function reorder(orderId: string, user: SessionUser, locale: Locale): Promise<{ orderId: string; number: string }> {
  const original = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { proof: true } } } });
  if (!original || original.buyerId !== user.id) throw new OrderError("NOT_FOUND");
  const item = original.items[0];
  if (!item?.proof) throw new OrderError("NOT_ALLOWED");
  const doc = fromJson<DesignDoc>(item.proof.snapshot);
  const address = fromJson<ShippingAddress>(original.shippingAddress);
  let outcome = await quoteDesign(doc, { quantity: item.quantity, governorate: address.governorate, vendorId: original.vendorId });
  if (outcome.mode === "instant" && outcome.offers.length === 0) {
    outcome = await quoteDesign(doc, { quantity: item.quantity, governorate: address.governorate });
  }
  if (outcome.mode !== "instant" || !outcome.offers[0]) throw new OrderError("OFFER_UNAVAILABLE");
  return createOrderFromOffer(user, {
    doc: { ...doc, id: item.proof.designId },
    offer: outcome.offers[0],
    address,
    existingProofId: item.proof.id,
    preview: null,
    locale,
    note: `REORDER:${original.number}`,
  });
}

export async function submitReview(orderId: string, user: SessionUser, rating: number, body: string | null): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { reviews: true } });
  if (!order || order.buyerId !== user.id) throw new OrderError("NOT_FOUND");
  if (!canReview(order.status as OrderStatus, order.reviews.some((r) => r.authorId === user.id))) throw new OrderError("NOT_ALLOWED");
  if (!Number.isFinite(rating)) throw new OrderError("NOT_ALLOWED");
  const r = Math.round(Math.min(5, Math.max(1, rating)));
  try {
    await db.$transaction(async (tx) => {
      await tx.review.create({ data: { orderId, vendorId: order.vendorId, authorId: user.id, rating: r, body: body?.slice(0, 2000) || null } });
      // Recomputed from the review rows, not read-modify-write on the vendor: two buyers reviewing
      // the same vendor at once cannot lose an update, and any earlier drift heals itself.
      const agg = await tx.review.aggregate({ where: { vendorId: order.vendorId }, _avg: { rating: true }, _count: { _all: true } });
      await tx.vendor.update({
        where: { id: order.vendorId },
        data: { ratingCount: agg._count._all, rating: Math.round((agg._avg.rating ?? r) * 100) / 100 },
      });
    });
  } catch (e) {
    // @@unique([orderId, authorId]): a double submit loses the race instead of double-counting.
    if ((e as { code?: string }).code === "P2002") throw new OrderError("NOT_ALLOWED");
    throw e;
  }
  // The vendor's public rating and reviews are served from the catalogue cache (store/data.ts).
  try {
    revalidateTag("catalog");
  } catch {
    /* outside a request (scripts, tests): nothing cached to purge */
  }
  await notify({ to: { phone: user.phone }, locale: user.locale, template: "REVIEW_THANKS", params: { number: order.number } });
}

/** Photos a buyer may attach to one report (checkout round 9). */
export const MAX_DISPUTE_PHOTOS = 5;

export async function openDispute(orderId: string, user: SessionUser, reason: DisputeReason, description: string, photoKeys: string[] = []): Promise<void> {
  // Only this order's own report uploads, each at most once (keys come from the upload route).
  const photos = [...new Set(photoKeys)].filter((k) => parseUploadKey(k)?.scope === "dispute" && parseUploadKey(k)?.ownerId === orderId);
  if (photos.length !== new Set(photoKeys).size || photos.length > MAX_DISPUTE_PHOTOS) throw new OrderError("NOT_ALLOWED");
  const order = await db.order.findUnique({ where: { id: orderId }, include: { disputes: true } });
  if (!order || order.buyerId !== user.id) throw new OrderError("NOT_FOUND");
  const hasOpen = order.disputes.some((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  if (!canOpenDispute(order.status as OrderStatus, order.deliveredAt, new Date(), hasOpen)) throw new OrderError("NOT_ALLOWED");
  // `seq` = how many disputes the order already had; @@unique([orderId, seq]) makes two
  // simultaneous submits (double click, two tabs) collide instead of opening two disputes
  // (portable to SQLite and Postgres, unlike a partial unique index on status). T-28.
  try {
    await db.$transaction(async (tx) => {
      // Serialised writers (SQLite) see the first dispute here; concurrent ones (Postgres) both
      // read the same seq and the unique index rejects the second.
      if (await tx.dispute.count({ where: { orderId, status: { in: ["OPEN", "UNDER_REVIEW"] } } })) throw new OrderError("NOT_ALLOWED");
      const seq = await tx.dispute.count({ where: { orderId } });
      await tx.dispute.create({ data: { orderId, openedById: user.id, reason, description: description.slice(0, 4000), seq, ...(photos.length ? { photos: toJson(photos) } : {}) } });
      await tx.productionEvent.create({ data: { orderId, type: "NOTE" as ProductionEventType, note: `DISPUTE_OPENED:${reason}`, actorId: user.id } });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new OrderError("NOT_ALLOWED");
    throw e;
  }
  // launch-metrics.md §1 `dispute_opened` (reason only; the free-text description stays out of
  // analytics). After the transaction, so a rejected duplicate is never counted.
  void track("dispute_opened", { reason }, { userId: user.id, orderId });
  await notify({ to: { phone: user.phone }, locale: user.locale, template: "DISPUTE_OPENED", params: { number: order.number } });
}

/** Inner size of an order item (for display). */
export function itemDims(item: { dims: Prisma.JsonValue }): Dims {
  return fromJson<Dims>(item.dims);
}

/** Best price per quantity tier (buyer-safe numbers only) for the quantity picker. */
export async function tierPrices(doc: DesignDoc, governorate?: string): Promise<{ quantity: number; unitPiasters: number | null; totalPiasters: number | null }[]> {
  const zone = (governorate && zoneForGovernorate(governorate)) || HEADLINE_DEFAULTS.zone;
  const { data, config } = await pricingInputs();
  const rows = priceTable(
    {
      ...designQuoteFields(doc),
      colours: DEFAULT_COLOURS,
      zone,
    },
    data,
    { config },
  );
  const pct = (await loadCheckoutSettings()).prepayDiscountPct;
  return rows.map((r) => {
    if (!r.best) return { quantity: r.quantity, unitPiasters: null, totalPiasters: null };
    const t = orderTotals(r.best.lines, pct);
    return { quantity: r.quantity, unitPiasters: Math.round(t.subtotalPiasters / r.quantity), totalPiasters: t.totalPiasters };
  });
}
