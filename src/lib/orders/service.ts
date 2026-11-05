import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalJson, fromJson, toJson } from "@/lib/json";
import type { SessionUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import {
  QUOTE_VALIDITY_HOURS,
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
import { priceTable, quote, toPublicOffer, zoneForGovernorate, type PublicVendorOffer, type QuoteOutcome, type VendorOffer } from "@/lib/pricing";
import { loadPricingData } from "@/lib/pricing/server";
import { getPaymentProvider, mockPaymentsEnabled, paymentConfig, type Intention, type WebhookOutcome, type WebhookRequest } from "@/lib/payments";
import { getShippingProvider, type TrackingEvent } from "@/lib/shipping";
import { notify } from "@/lib/notify";
import { generatePrintPdf } from "./pdf/print";
import { putFile, getFile } from "./storage";
import { assertTransition, canBuyerCancel, canOpenDispute, canReview, isPaidStatus, type Actor } from "./state";
import { isQuoteValid, nextSequence, orderTotals } from "./totals";

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
      | "NOT_ALLOWED",
  ) {
    super(code);
    this.name = "OrderError";
  }
}

const DEFAULT_COLOURS = 4;

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

/** Instant quote for a design (internal: includes vendor cost; never send to the browser). */
export async function quoteDesign(doc: DesignDoc, opts: { quantity: number; governorate?: string; vendorId?: string }): Promise<QuoteOutcome> {
  const zone = (opts.governorate && zoneForGovernorate(opts.governorate)) || "GREATER_CAIRO";
  return quote(
    {
      structureCode: doc.structureCode,
      dims: doc.dims,
      materialId: doc.materialCode,
      finishes: doc.finishCode === "NONE" ? [] : [doc.finishCode],
      printSides: doc.printSides,
      colours: DEFAULT_COLOURS,
      quantity: opts.quantity,
      vendorId: opts.vendorId,
      zone,
    },
    await loadPricingData(),
  );
}

/** Buyer-safe offers plus the totals the buyer will actually pay (prepay discount applied). */
export interface CheckoutOffer extends PublicVendorOffer {
  pay: ReturnType<typeof orderTotals>;
}

export function toCheckoutOffer(o: VendorOffer | PublicVendorOffer): CheckoutOffer {
  const pub = "internal" in o ? toPublicOffer(o as VendorOffer) : o;
  return { ...pub, pay: orderTotals(pub.lines, paymentConfig().prepayDiscountPct) };
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
}

/**
 * The buyer approved the proof: freeze the design into an immutable Proof (snapshot + sha256
 * hash + time + IP), re-price on the server (never trust browser prices) and create the order
 * awaiting payment, with its Quote (valid 72 h).
 */
export async function placeOrder(user: SessionUser, input: PlaceOrderInput): Promise<{ orderId: string; number: string }> {
  const design = await loadCheckoutDesign(input.designId, user);
  if (!design) throw new OrderError("NOT_FOUND");
  const outcome = await quoteDesign(design.doc, { quantity: input.quantity, governorate: input.address.governorate, vendorId: input.vendorId });
  if (outcome.mode !== "instant") throw new OrderError("MANUAL_QUOTE");
  const offer = outcome.offers.find((o) => o.vendorId === input.vendorId);
  if (!offer) throw new OrderError("OFFER_UNAVAILABLE");
  return createOrderFromOffer(user, {
    doc: { ...design.doc, id: input.designId },
    offer,
    address: input.address,
    approval: input.approval,
    preview: input.preview ?? null,
    locale: input.locale,
  });
}

async function createOrderFromOffer(
  user: SessionUser,
  p: {
    doc: DesignDoc;
    offer: VendorOffer;
    address: ShippingAddress;
    approval?: { ip: string; userAgent?: string };
    existingProofId?: string;
    preview: Buffer | null;
    locale: Locale;
    note?: string;
  },
): Promise<{ orderId: string; number: string }> {
  const cfg = paymentConfig();
  const totals = orderTotals(p.offer.lines, cfg.prepayDiscountPct);
  const product = p.offer.lines.find((l) => l.kind === "PRODUCT");
  const now = new Date();
  const validUntil = new Date(Math.min(new Date(p.offer.validUntil).getTime(), now.getTime() + QUOTE_VALIDITY_HOURS * 3_600_000));
  const designId = p.doc.id!;

  const result = await withRetry(() =>
    db.$transaction(async (tx) => {
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
          },
        });
        proofId = proof.id;
      }
      const q = await tx.quote.create({
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
              { type: "PROOF_APPROVED", actorId: user.id, createdAt: now },
            ],
          },
        },
      });
      return { orderId: order.id, number, proofId };
    }),
  );

  if (p.preview && !p.existingProofId) {
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

  await notify({ to: { phone: user.phone }, locale: p.locale, template: "ORDER_PLACED", params: { number: result.number } });
  return { orderId: result.orderId, number: result.number };
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

/** Buyer owns it, vendor staff of its vendor, or ADMIN. */
export function canViewOrder(order: { buyerId: string; vendorId: string }, user: SessionUser): boolean {
  if (user.role === "ADMIN") return true;
  if (order.buyerId === user.id) return true;
  return user.role === "VENDOR" && !!user.vendorId && user.vendorId === order.vendorId;
}

export async function getOrderForViewer(idOrNumber: string, user: SessionUser): Promise<OrderDetail | null> {
  if (!/^[\w-]{1,64}$/.test(idOrNumber)) return null;
  const order = await db.order.findFirst({ where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] }, include: orderInclude });
  if (!order || !canViewOrder(order, user)) return null;
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
  const updated = await db.order.updateMany({
    where: { id: orderId, status: order.status }, // optimistic: lose the race, not the data
    data: { status: to, ...(stamp ? { [stamp]: now } : {}) },
  });
  if (updated.count !== 1) throw new OrderError("INVALID_STATE");
  await db.productionEvent.create({ data: { orderId, type: rule.event, note: note ?? null, actorId: actor.userId ?? null } });

  const locale = (order.buyer.locale === "en" ? "en" : "ar") as Locale;
  const template = to === "SHIPPED" ? "SHIPPED" : to === "DELIVERED" ? "DELIVERED" : "STATUS_CHANGED";
  const { getT } = await import("@/i18n");
  await notify({
    to: { phone: order.buyer.phone, email: order.buyer.email },
    locale,
    template,
    params: { number: order.number, status: getT(locale)(`orderStatus.${to}`) },
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
  const stored = { intention: { redirectUrl: intention.redirectUrl, fawry: intention.fawry, instapay: intention.instapay } };
  const saved = await db.payment.update({
    where: { id: payment.id },
    data: { providerRef: intention.providerRef, fawryRef: intention.fawry?.referenceCode ?? null, raw: toJson(stored) },
  });
  if (intention.fawry) {
    await notify({
      to: { phone: order.buyer.phone },
      locale,
      template: "FAWRY_CODE",
      params: { number: order.number, code: intention.fawry.referenceCode },
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
  const payment = await db.payment.findUnique({ where: { id: o.paymentId }, include: { order: { include: { buyer: true, vendor: true } } } });
  if (!payment) return "UNKNOWN_PAYMENT";
  if (payment.status === o.status) return "DUPLICATE";
  if (payment.status === "PAID" && o.status !== "REFUNDED") return "ALREADY_PAID";
  const order = payment.order;
  const locale = (order.buyer.locale === "en" ? "en" : "ar") as Locale;

  if (o.status === "PENDING") {
    await db.payment.update({ where: { id: payment.id }, data: { raw: toJson({ ...((payment.raw as object) ?? {}), last: o.raw }) } });
    return "PENDING";
  }

  if (o.status === "FAILED") {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", raw: toJson({ ...((payment.raw as object) ?? {}), last: o.raw }) } });
    await notify({ to: { phone: order.buyer.phone }, locale, template: "PAYMENT_FAILED", params: { number: order.number } });
    return "FAILED";
  }

  if (o.status === "REFUNDED") {
    await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    if (order.status !== "REFUNDED" && order.status !== "CANCELLED") {
      try {
        await transitionOrder(order.id, "REFUNDED", { role: "SYSTEM" }, "REFUND_CONFIRMED");
      } catch {
        /* not refundable from this state; payment row still records it */
      }
    }
    return "REFUNDED";
  }

  // PAID
  if (o.amountPiasters !== payment.amountPiasters) {
    await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: `AMOUNT_MISMATCH:${o.amountPiasters}` } });
    return "AMOUNT_MISMATCH";
  }
  const now = new Date();
  const paidRaw = toJson({ ...((payment.raw as object) ?? {}), last: o.raw });
  if (order.status !== "PENDING_PAYMENT") {
    // Paid after cancel/expiry: keep the money on record and flag for a refund by ops.
    await db.payment.update({ where: { id: payment.id }, data: { status: "PAID", providerRef: o.providerRef || payment.providerRef, raw: paidRaw } });
    await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: "PAID_AFTER_CANCEL_REFUND_NEEDED" } });
    return "NEEDS_REFUND";
  }
  const leadMs = order.dueDate ? Math.max(0, order.dueDate.getTime() - order.placedAt.getTime()) : 7 * 86_400_000;
  const changed = await db.$transaction(async (tx) => {
    const upd = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "PAID", paidAt: now, dueDate: new Date(now.getTime() + leadMs) },
    });
    if (upd.count !== 1) return false;
    assertTransition("PENDING_PAYMENT", "PAID", "SYSTEM");
    await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", providerRef: o.providerRef || payment.providerRef, raw: paidRaw } });
    // Other open attempts for this order are void now.
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING", id: { not: payment.id } }, data: { status: "FAILED" } });
    await tx.productionEvent.create({ data: { orderId: order.id, type: "PAYMENT_CONFIRMED", note: payment.method } });
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
  });
  if (!changed) return "ALREADY_PAID";

  // Side effects after commit: print files, then messages. Failures never undo the payment.
  try {
    await ensurePrintPdfs(order.id);
  } catch (e) {
    console.error("[orders] print PDF generation failed", e);
    await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: "PRINT_PDF_FAILED" } });
  }
  await notify({ to: { phone: order.buyer.phone, email: order.buyer.email }, locale, template: "PAYMENT_RECEIVED", params: { number: order.number } });
  const staff = await db.user.findMany({ where: { vendorId: order.vendorId, role: "VENDOR" }, select: { phone: true, locale: true } });
  for (const s of staff) {
    await notify({ to: { phone: s.phone }, locale: s.locale === "en" ? "en" : "ar", template: "VENDOR_NEW_JOB", params: { number: order.number } });
  }
  return "PAID";
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

/** Vendor/ops hand the bundles to the courier: create the shipment and mark the order shipped. */
export async function shipOrder(orderId: string, actor: TransitionActor): Promise<{ trackingNumber: string }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { vendor: true, items: true } });
  if (!order) throw new OrderError("NOT_FOUND");
  if (actor.role === "VENDOR" && actor.vendorId !== order.vendorId) throw new OrderError("FORBIDDEN");
  assertTransition(order.status as OrderStatus, "SHIPPED", actor.role);
  const provider = getShippingProvider();
  const qty = order.items.reduce((s, i) => s + i.quantity, 0);
  const created = await provider.createShipment({
    orderNumber: order.number,
    pickupCity: order.vendor.city,
    dropOff: fromJson<ShippingAddress>(order.shippingAddress),
    bundles: Math.max(1, Math.ceil(qty / 100)),
    weightKg: Math.max(1, Math.round(qty * 0.08)),
    description: `${qty} flat-packed printed boxes`,
  });
  await db.shipment.create({
    data: {
      orderId,
      provider: provider.name,
      trackingNumber: created.trackingNumber,
      status: created.status,
      labelUrl: created.labelUrl ?? null,
      events: toJson([{ status: created.status, at: new Date().toISOString() }]),
    },
  });
  await transitionOrder(orderId, "SHIPPED", actor, created.trackingNumber);
  return { trackingNumber: created.trackingNumber };
}

/** Refresh tracking for a shipped order; marks it delivered when the courier says so. */
export async function syncShipments(orderId: string): Promise<void> {
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
  const r = Math.round(Math.min(5, Math.max(1, rating)));
  await db.$transaction(async (tx) => {
    await tx.review.create({ data: { orderId, vendorId: order.vendorId, authorId: user.id, rating: r, body: body || null } });
    const v = await tx.vendor.findUniqueOrThrow({ where: { id: order.vendorId }, select: { rating: true, ratingCount: true } });
    const count = v.ratingCount + 1;
    await tx.vendor.update({ where: { id: order.vendorId }, data: { ratingCount: count, rating: Math.round(((v.rating * v.ratingCount + r) / count) * 100) / 100 } });
  });
  await notify({ to: { phone: user.phone }, locale: user.locale, template: "REVIEW_THANKS", params: { number: order.number } });
}

export async function openDispute(orderId: string, user: SessionUser, reason: DisputeReason, description: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { disputes: true } });
  if (!order || order.buyerId !== user.id) throw new OrderError("NOT_FOUND");
  const hasOpen = order.disputes.some((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  if (!canOpenDispute(order.status as OrderStatus, order.deliveredAt, new Date(), hasOpen)) throw new OrderError("NOT_ALLOWED");
  await db.dispute.create({ data: { orderId, openedById: user.id, reason, description } });
  await db.productionEvent.create({ data: { orderId, type: "NOTE" as ProductionEventType, note: `DISPUTE_OPENED:${reason}`, actorId: user.id } });
  await notify({ to: { phone: user.phone }, locale: user.locale, template: "DISPUTE_OPENED", params: { number: order.number } });
}

/** Inner size of an order item (for display). */
export function itemDims(item: { dims: Prisma.JsonValue }): Dims {
  return fromJson<Dims>(item.dims);
}

/** Best price per quantity tier (buyer-safe numbers only) for the quantity picker. */
export async function tierPrices(doc: DesignDoc, governorate?: string): Promise<{ quantity: number; unitPiasters: number | null; totalPiasters: number | null }[]> {
  const zone = (governorate && zoneForGovernorate(governorate)) || "GREATER_CAIRO";
  const rows = priceTable(
    {
      structureCode: doc.structureCode,
      dims: doc.dims,
      materialId: doc.materialCode,
      finishes: doc.finishCode === "NONE" ? [] : [doc.finishCode],
      printSides: doc.printSides,
      colours: DEFAULT_COLOURS,
      zone,
    },
    await loadPricingData(),
  );
  const pct = paymentConfig().prepayDiscountPct;
  return rows.map((r) => {
    if (!r.best) return { quantity: r.quantity, unitPiasters: null, totalPiasters: null };
    const t = orderTotals(r.best.lines, pct);
    return { quantity: r.quantity, unitPiasters: Math.round(t.subtotalPiasters / r.quantity), totalPiasters: t.totalPiasters };
  });
}
