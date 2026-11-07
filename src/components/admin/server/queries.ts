import "server-only";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { pick } from "@/i18n";
import type { Dims, Locale, MaterialCode, OrderStatus, QuoteLine, StructureParamLimits, VendorCapabilities } from "@/types";
import {
  bucketDaysFor,
  bucketSeries,
  changePct,
  countsForGmv,
  funnel,
  isReprint,
  marginOf,
  moneyKpis,
  opsKpis,
  rangeWindow,
  scorecard,
  repeatRate90,
  acceptanceRate,
  type MetricOrder,
  type RangeKey,
  type Scorecard,
} from "../lib/metrics";
import { isOpenDispute } from "../lib/ops";
import { modelAvailability, vendorsByPair, withOrderMode } from "../lib/availability";
import { orderModeOf, vendorListsModel } from "@/data/catalogue/order-mode";
import { MODELS, modelByCode } from "@/lib/library";
import { baseOf, vesselPrintMaterials } from "@/lib/library/doc";
import type { AdminOrderRow } from "../lib/orders";
import { adminPayoutStatus, needsAction } from "../lib/payouts";
import { contactFlags } from "../lib/moderation";
import { FUNNEL_STEPS as EVENT_FUNNEL_STEPS, loadShareLoop } from "@/lib/analytics/funnel";
import { cohortFunnel, eventFunnel, visitorToPaid } from "../lib/events";
import { isOverdue, leadState, replyDueAt, type LeadState } from "../lib/quoteLeads";
import { PRICED_FOLLOW_UP_HOURS } from "../lib/quotePricing";
import { listQuoteRequests, QUOTE_ACCEPTED, QUOTE_PRICED, QUOTE_REQUESTED, quoteCheckoutPath } from "@/lib/orders/quote-requests";
import { payoutSchedule, type ScheduleRow } from "@/components/vendor/lib/payouts";

/** Orders whose vendor has earned at least the advance (accepted or later). */
const PAYOUT_EARNING_STATUSES = ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"] as const;

const metricSelect = {
  id: true,
  number: true,
  status: true,
  placedAt: true,
  paidAt: true,
  dueDate: true,
  deliveredAt: true,
  subtotalPiasters: true,
  vatPiasters: true,
  shippingPiasters: true,
  totalPiasters: true,
  vendorCostPiasters: true,
  notes: true,
  vendorId: true,
  buyerId: true,
} as const;

/* ───────────────────────── Overview ───────────────────────── */

/**
 * launch-metrics.md funnel (unique actors per step) without Elba staff and vendor staff (R4-04):
 * the visit beacon runs on every page, so ops opening /admin counted as a "visitor" and skewed
 * visitor-to-paid. Signed-in staff are excluded by user id; anonymous rows always count.
 */
async function loadCustomerEventFunnel(w: { from: Date; to: Date }): Promise<Record<(typeof EVENT_FUNNEL_STEPS)[number], number>> {
  const staff = (await db.user.findMany({ where: { role: { in: ["ADMIN", "VENDOR"] } }, select: { id: true } })).map((u) => u.id);
  // R5-JR-13: one query, then the visitor-cohort rule (see cohortFunnel).
  const rows = await db.event.findMany({
    where: { name: { in: [...EVENT_FUNNEL_STEPS] }, at: { gte: w.from, lt: w.to }, OR: [{ userId: null }, { userId: { notIn: staff } }] },
    select: { name: true, userId: true, anonId: true },
  });
  return cohortFunnel(rows, EVENT_FUNNEL_STEPS) as Record<(typeof EVENT_FUNNEL_STEPS)[number], number>;
}

export async function loadOverview(range: RangeKey, now = new Date()) {
  const { from, to, prevFrom } = rangeWindow(range, now);
  const [orders, disputes, designs, accounts, priceViewers, orderUsers, qcPending, awaitingVendor, applications, dataRequests, payouts, buyerOrders, vendorEvents, moderation, quoteLeads, pricedExpiring, eventSteps, shareLoop] = await Promise.all([
    db.order.findMany({ where: { OR: [{ placedAt: { gte: prevFrom } }, { deliveredAt: { gte: prevFrom } }] }, select: metricSelect }),
    db.dispute.findMany({ select: { createdAt: true, status: true } }),
    db.design.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.user.count({ where: { role: "BUYER", createdAt: { gte: from, lt: to } } }),
    // B-19: price views come from the first-party Event table (price_viewed, written by /api/quote
    // and the checkout price seams). Everyone who placed an order also saw a price, which covers
    // orders from before events were recorded, so the funnel never shows paid above price viewed.
    db.event.findMany({ where: { name: "price_viewed", at: { gte: from, lt: to }, userId: { not: null } }, select: { userId: true }, distinct: ["userId"] }),
    db.order.findMany({ where: { placedAt: { gte: from, lt: to } }, select: { buyerId: true }, distinct: ["buyerId"] }),
    db.order.count({ where: { status: "QC_PENDING" } }),
    // R4-06: paid jobs no vendor has accepted yet (the nav badge counts them too).
    db.order.count({ where: { status: "PAID" } }),
    db.vendorApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.dataRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    countPayoutsToAct(),
    // Kept orders (not reprints) for the 90-day repeat rate; all time, the cohort rule picks who counts.
    db.order.findMany({ where: { status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] }, NOT: { notes: { startsWith: "REPRINT_OF:" } } }, select: { buyerId: true, placedAt: true } }),
    db.productionEvent.findMany({ where: { type: { in: ["VENDOR_ACCEPTED", "VENDOR_DECLINED"] }, createdAt: { gte: from, lt: to } }, select: { type: true } }),
    countModeration(),
    countOpenQuoteLeads(),
    countPricedExpiring(),
    // B-19: launch-metrics.md funnel from the first-party Event table (unique actors per step).
    loadCustomerEventFunnel({ from, to }),
    loadShareLoop({ from, to }),
  ]);
  const priceViewed = new Set([...priceViewers.map((e) => e.userId!), ...orderUsers.map((o) => o.buyerId)]).size;
  const rows = orders as MetricOrder[];
  // R4-03: the funnel counts people at every step, so its last step is paying buyers (distinct),
  // not paid orders; one buyer with five orders read as "500% of price viewed".
  const payingBuyers = new Set(rows.filter((o) => !isReprint(o) && countsForGmv(o) && o.placedAt >= from && o.placedAt < to).map((o) => o.buyerId)).size;
  const money = moneyKpis(rows, from, to);
  const prevMoney = moneyKpis(rows, prevFrom, from);
  const ops = opsKpis(rows, disputes, from, to);
  const bucketDays = bucketDaysFor(range);
  const gmvSeries = bucketSeries(
    rows.filter((o) => !isReprint(o) && countsForGmv(o)),
    (o) => o.placedAt,
    (o) => o.totalPiasters,
    from,
    to,
    bucketDays,
  );
  const marginSeries = bucketSeries(
    rows.filter((o) => !isReprint(o) && countsForGmv(o)),
    (o) => o.placedAt,
    (o) => marginOf(o),
    from,
    to,
    bucketDays,
  );
  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    bucketDays,
    funnel: funnel({ designs, accounts, priceViewed, orders: payingBuyers }),
    money,
    gmvChangePct: changePct(money.gmvPiasters, prevMoney.gmvPiasters),
    marginChangePct: changePct(money.marginPiasters, prevMoney.marginPiasters),
    ops,
    gmvSeries,
    marginSeries,
    repeat: repeatRate90(buyerOrders, now),
    acceptance: acceptanceRate(vendorEvents),
    events: { funnel: eventFunnel(eventSteps), visitorToPaidPct: visitorToPaid(eventSteps), share: shareLoop },
    tasks: { qcPending, awaitingVendor, applications, openDisputes: ops.openDisputes, dataRequests, payouts, moderation, quoteLeads, pricedExpiring },
  };
}

/* ───────────────────────── Orders ───────────────────────── */

export async function loadOrderRows(locale: Locale): Promise<AdminOrderRow[]> {
  const orders = await db.order.findMany({
    orderBy: { placedAt: "desc" },
    take: 1000,
    select: {
      ...metricSelect,
      buyer: { select: { name: true, phone: true } },
      vendor: { select: { nameAr: true, nameEn: true } },
      items: { select: { quantity: true, structureCode: true } },
      payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      disputes: { select: { status: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    placedAt: o.placedAt.toISOString(),
    buyerName: o.buyer.name ?? "",
    buyerPhone: o.buyer.phone,
    vendorId: o.vendorId,
    vendorName: pick(locale, o.vendor.nameAr, o.vendor.nameEn),
    quantity: o.items.reduce((s, i) => s + i.quantity, 0),
    structureCode: o.items[0]?.structureCode ?? "",
    totalPiasters: o.totalPiasters,
    marginPiasters: marginOf(o as MetricOrder),
    paymentStatus: o.payments[0]?.status ?? null,
    openDispute: o.disputes.some((d) => isOpenDispute(d.status)),
    reprint: isReprint(o),
  }));
}

export async function loadOrderDetail(number: string) {
  if (!/^[\w-]{1,64}$/.test(number)) return null;
  const order = await db.order.findFirst({
    where: { OR: [{ number }, { id: number }] },
    include: {
      buyer: { select: { id: true, name: true, phone: true, email: true, locale: true } },
      vendor: { select: { id: true, slug: true, nameAr: true, nameEn: true, status: true } },
      items: true,
      productionEvents: { orderBy: { createdAt: "asc" } },
      qcPhotos: { orderBy: { uploadedAt: "asc" } },
      shipments: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      disputes: { orderBy: { createdAt: "desc" } },
      invoices: true,
      payouts: true,
    },
  });
  if (!order) return null;
  const structureCode = order.items[0]?.structureCode;
  const materialCode = order.items[0]?.materialCode;
  const modelCode = order.items[0]?.modelCode ?? null;
  const [vendors, actors, reprints, auditRows] = await Promise.all([
    db.vendor.findMany({
      where: { status: "ACTIVE" },
      orderBy: { nameEn: "asc" },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        capabilities: true,
        onTimePct: true,
        rating: true,
        leadTimeDays: true,
        rateCards: { where: { active: true, structure: { code: structureCode ?? "" }, material: { code: materialCode ?? "" } }, select: { id: true } },
      },
    }),
    db.user.findMany({ where: { id: { in: order.productionEvents.map((e) => e.actorId).filter((x): x is string => !!x) } }, select: { id: true, name: true, role: true } }),
    db.order.findMany({ where: { notes: { startsWith: `REPRINT_OF:${order.number}` } }, select: { number: true, status: true } }),
    db.auditLog.findMany({ where: { entityType: "ORDER", entityId: order.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    order,
    vendorOptions: vendors.map((v) => ({
      id: v.id,
      nameAr: v.nameAr,
      nameEn: v.nameEn,
      onTimePct: v.onTimePct,
      rating: v.rating,
      leadTimeDays: v.leadTimeDays,
      // Rate card for the style and board, and (B-16, R4-02) for special-gluing library models the
      // vendor must list the model; preview / quote-only models have no capable vendor.
      capable:
        v.rateCards.length > 0 &&
        (fromJson<VendorCapabilities>(v.capabilities).structures ?? []).includes((structureCode ?? "") as never) &&
        vendorListsModel(orderModeOf(modelCode).mode, modelCode ?? "", fromJson<VendorCapabilities>(v.capabilities).models),
    })),
    actors: Object.fromEntries(actors.map((a) => [a.id, a])),
    reprints,
    auditRows,
  };
}

/* ───────────────────────── Vendors ───────────────────────── */

export interface VendorRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  city: string;
  status: string;
  verified: boolean;
  joinedAt: string;
  score: Scorecard;
}

export async function loadVendorRows(): Promise<{ vendors: VendorRow[]; applications: { id: string; vendorId: string; legalName: string; factoryCity: string; status: string; createdAt: string }[] }> {
  const [vendors, orders, disputes, reviews, qc, applications] = await Promise.all([
    db.vendor.findMany({ orderBy: { joinedAt: "asc" } }),
    db.order.findMany({ select: metricSelect }),
    db.dispute.findMany({ select: { status: true, order: { select: { number: true, vendorId: true } } } }),
    db.review.findMany({ select: { vendorId: true, rating: true } }),
    db.qcPhoto.findMany({ select: { status: true, order: { select: { vendorId: true } } } }),
    db.vendorApplication.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return {
    vendors: vendors.map((v) => ({
      id: v.id,
      slug: v.slug,
      nameAr: v.nameAr,
      nameEn: v.nameEn,
      city: v.city,
      status: v.status,
      verified: v.verified,
      joinedAt: v.joinedAt.toISOString(),
      score: scorecard({
        vendorId: v.id,
        orders: (orders as MetricOrder[]).filter((o) => o.vendorId === v.id),
        disputes: disputes.filter((d) => d.order.vendorId === v.id).map((d) => ({ orderNumber: d.order.number, status: d.status })),
        ratings: reviews.filter((r) => r.vendorId === v.id).map((r) => r.rating),
        qc: qc.filter((q) => q.order.vendorId === v.id),
      }),
    })),
    applications: applications.map((a) => ({ id: a.id, vendorId: a.vendorId, legalName: a.legalName, factoryCity: a.factoryCity, status: a.status, createdAt: a.createdAt.toISOString() })),
  };
}

export async function loadVendorDetail(slug: string) {
  if (!/^[\w-]{1,80}$/.test(slug)) return null;
  const vendor = await db.vendor.findUnique({
    where: { slug },
    include: { staff: { select: { id: true, name: true, phone: true } }, rateCards: { include: { structure: { select: { code: true } }, material: { select: { code: true } } } } },
  });
  if (!vendor) return null;
  const [orders, disputes, reviews, qc, application, auditRows] = await Promise.all([
    db.order.findMany({ where: { vendorId: vendor.id }, select: metricSelect, orderBy: { placedAt: "desc" } }),
    db.dispute.findMany({ where: { order: { vendorId: vendor.id } }, select: { status: true, order: { select: { number: true } } } }),
    db.review.findMany({ where: { vendorId: vendor.id }, select: { rating: true } }),
    db.qcPhoto.findMany({ where: { order: { vendorId: vendor.id } }, select: { status: true } }),
    db.vendorApplication.findUnique({ where: { vendorId: vendor.id } }),
    db.auditLog.findMany({ where: { entityType: "VENDOR", entityId: vendor.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const score = scorecard({
    vendorId: vendor.id,
    orders: orders as MetricOrder[],
    disputes: disputes.map((d) => ({ orderNumber: d.order.number, status: d.status })),
    ratings: reviews.map((r) => r.rating),
    qc,
  });
  return { vendor, orders, score, application, auditRows };
}

export async function loadApplication(id: string) {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const app = await db.vendorApplication.findUnique({ where: { id } });
  if (!app) return null;
  const [vendor, applicant] = await Promise.all([
    db.vendor.findUnique({ where: { id: app.vendorId } }),
    db.user.findUnique({ where: { id: app.applicantId }, select: { id: true, name: true, phone: true, role: true } }),
  ]);
  return { app, vendor, applicant };
}

/* ───────────────────────── Catalogue ───────────────────────── */

export interface CatalogModelRow {
  code: string;
  slug: string;
  group: string;
  standard: string;
  nameAr: string;
  nameEn: string;
  /** Styles it is made as (distinct), e.g. ["FEFCO_0201"]. */
  styles: string[];
  boardsPriced: number;
  boardsTotal: number;
  vendorIds: string[];
  instant: boolean;
}

/** The library models (≈370) with whether any active vendor can price them in Egypt today. */
async function loadModelAvailability(): Promise<{ models: CatalogModelRow[]; vendors: { id: string; slug: string; nameAr: string; nameEn: string }[] }> {
  const [cards, vendors] = await Promise.all([
    db.rateCard.findMany({
      where: { active: true, vendor: { status: "ACTIVE" }, structure: { active: true }, material: { active: true } },
      select: { vendorId: true, structure: { select: { code: true } }, material: { select: { code: true } } },
    }),
    db.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, slug: true, nameAr: true, nameEn: true, capabilities: true }, orderBy: { nameEn: "asc" } }),
  ]);
  // Vendors that confirmed special-gluing models (capabilities.models, B-16), per model code.
  const listersOf = (code: string) => new Set(vendors.filter((v) => (fromJson<VendorCapabilities>(v.capabilities)?.models ?? []).includes(code)).map((v) => v.id));
  const pairs = vendorsByPair(cards.map((c) => ({ vendorId: c.vendorId, structureCode: c.structure.code, materialCode: c.material.code })));
  const models = MODELS.map((m) => {
    const boards: MaterialCode[] = m.kind === "box" ? m.materials : [...new Set([...vesselPrintMaterials(m), ...(m.surfaces.includes("SHRINK_SLEEVE") ? vesselPrintMaterials(m, ["SHRINK_SLEEVE"]) : [])])];
    const routes = boards.map((b) => ({ structureCode: baseOf(m, b), materialCode: b }));
    const a = withOrderMode(modelAvailability({ code: m.code, routes }, pairs), orderModeOf(m.code).mode, listersOf(m.code));
    return {
      code: m.code,
      slug: m.slug,
      group: m.group,
      standard: m.standard,
      nameAr: m.name.ar,
      nameEn: m.name.en,
      styles: [...new Set(routes.map((r) => r.structureCode))],
      boardsPriced: a.boardsPriced,
      boardsTotal: a.boardsTotal,
      vendorIds: a.vendorIds,
      instant: a.instant,
    };
  });
  return { models, vendors: vendors.map((v) => ({ id: v.id, slug: v.slug, nameAr: v.nameAr, nameEn: v.nameEn })) };
}

/** How many library models this vendor can price instantly (its rate cards × model routes). */
export async function vendorModelCoverage(vendorId: string): Promise<{ priced: number; total: number }> {
  const { models } = await loadModelAvailability();
  return { priced: models.filter((m) => m.vendorIds.includes(vendorId)).length, total: models.length };
}

export async function loadCatalog() {
  const [structures, materials, finishes, availability, styleVendors] = await Promise.all([
    db.structure.findMany({ orderBy: { sortOrder: "asc" } }),
    db.material.findMany({ orderBy: { sortOrder: "asc" } }),
    db.finish.findMany({ orderBy: { sortOrder: "asc" } }),
    loadModelAvailability(),
    db.rateCard.findMany({ where: { active: true, vendor: { status: "ACTIVE" } }, select: { structureId: true, vendorId: true }, distinct: ["structureId", "vendorId"] }),
  ]);
  const vendorsPerStyle = new Map<string, number>();
  for (const r of styleVendors) vendorsPerStyle.set(r.structureId, (vendorsPerStyle.get(r.structureId) ?? 0) + 1);
  return {
    models: availability.models,
    vendors: availability.vendors,
    structures: structures.map((s) => ({ id: s.id, code: s.code, nameAr: s.nameAr, nameEn: s.nameEn, family: s.family, active: s.active, vendorCount: vendorsPerStyle.get(s.id) ?? 0, params: fromJson<StructureParamLimits>(s.params), defaultDims: fromJson<Dims>(s.defaultDims) })),
    materials: materials.map((m) => ({ id: m.id, code: m.code, nameAr: m.nameAr, nameEn: m.nameEn, family: m.family, gsm: m.gsm, thicknessMm: m.thicknessMm, foodSafe: m.foodSafe, active: m.active })),
    finishes: finishes.map((f) => ({ id: f.id, code: f.code, nameAr: f.nameAr, nameEn: f.nameEn, unitSurchargePiasters: f.unitSurchargePiasters, setupPiasters: f.setupPiasters, active: f.active })),
  };
}

/* ───────────────────────── Disputes ───────────────────────── */

export async function loadDisputes() {
  const rows = await db.dispute.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: { select: { number: true, status: true, totalPiasters: true, vendor: { select: { nameAr: true, nameEn: true } } } }, openedBy: { select: { name: true, phone: true } } },
  });
  return rows.map((d) => ({
    id: d.id,
    reason: d.reason,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    orderNumber: d.order.number,
    orderStatus: d.order.status as OrderStatus,
    totalPiasters: d.order.totalPiasters,
    vendorNameAr: d.order.vendor.nameAr,
    vendorNameEn: d.order.vendor.nameEn,
    buyerName: d.openedBy.name ?? "",
  }));
}

export async function loadDispute(id: string) {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const d = await db.dispute.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, name: true, phone: true } },
      order: { include: { vendor: { select: { id: true, nameAr: true, nameEn: true } }, items: true, payments: true, qcPhotos: true } },
    },
  });
  if (!d) return null;
  const [vendors, reprints, auditRows, paidPayouts] = await Promise.all([
    db.vendor.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        capabilities: true,
        rateCards: { where: { active: true, structure: { code: d.order.items[0]?.structureCode ?? "" }, material: { code: d.order.items[0]?.materialCode ?? "" } }, select: { id: true } },
      },
      orderBy: { nameEn: "asc" },
    }),
    db.order.findMany({ where: { notes: { startsWith: `REPRINT_OF:${d.order.number}` } }, select: { number: true, status: true } }),
    db.auditLog.findMany({ where: { entityType: "DISPUTE", entityId: d.id }, orderBy: { createdAt: "desc" } }),
    db.payout.findMany({ where: { orderId: d.order.id, vendorId: d.order.vendorId, status: "PAID" }, select: { amountPiasters: true } }),
  ]);
  // R5-JR-08: a reprint can only go to a vendor that makes this job (an active rate card for the
  // style and board, and the model where one must be listed), like "Change vendor" on the order.
  // The order's own vendor stays listed (the default), whatever its cards say today.
  const modelCode = d.order.items[0]?.modelCode ?? null;
  const capable = (v: (typeof vendors)[number]) =>
    v.rateCards.length > 0 &&
    (fromJson<VendorCapabilities>(v.capabilities).structures ?? []).includes((d.order.items[0]?.structureCode ?? "") as never) &&
    vendorListsModel(orderModeOf(modelCode).mode, modelCode ?? "", fromJson<VendorCapabilities>(v.capabilities).models);
  return {
    dispute: d,
    vendors: vendors.filter((v) => v.id === d.order.vendorId || capable(v)).map((v) => ({ id: v.id, nameAr: v.nameAr, nameEn: v.nameEn })),
    reprints,
    auditRows,
    paidToVendorPiasters: paidPayouts.reduce((s, p) => s + p.amountPiasters, 0),
  };
}

/* ───────────────────────── Users & privacy ───────────────────────── */

export async function loadUsers() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { id: true, name: true, phone: true, role: true, marketingConsent: true, createdAt: true, lastLoginAt: true, _count: { select: { orders: true, consents: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name ?? "",
    phone: u.phone,
    role: u.role,
    marketingConsent: u.marketingConsent,
    createdAt: u.createdAt.toISOString(),
    orders: u._count.orders,
    consents: u._count.consents,
  }));
}

export async function loadUser(id: string) {
  if (!/^[\w-]{1,40}$/.test(id)) return null;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      consents: { orderBy: { createdAt: "desc" } },
      orders: { select: { id: true, number: true, status: true, totalPiasters: true, placedAt: true }, orderBy: { placedAt: "desc" } },
      disputes: { select: { status: true } },
      vendor: { select: { nameAr: true, nameEn: true, slug: true } },
      _count: { select: { designs: true, sessions: true } },
    },
  });
  if (!user) return null;
  const [requests, auditRows] = await Promise.all([
    db.dataRequest.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ where: { OR: [{ entityType: "USER", entityId: id }, { entityType: "DATA_REQUEST", summary: { contains: id } }] }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return { user, requests, auditRows };
}

export async function loadDataRequests() {
  const rows = await db.dataRequest.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, phone: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: byId.get(r.userId)?.name ?? "",
    userPhone: byId.get(r.userId)?.phone ?? "",
    kind: r.kind,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));
}

/** Everything we hold about a user (PDPL access request). Used by the admin export route. */
export async function exportUserData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      organization: true,
      consents: true,
      designs: { select: { id: true, name: true, structureCode: true, dims: true, createdAt: true, updatedAt: true } },
      orders: { include: { items: true, payments: { select: { method: true, status: true, amountPiasters: true, createdAt: true } }, shipments: { select: { status: true, trackingNumber: true } } } },
      reviews: true,
      disputes: true,
      quotes: { select: { id: true, totalPiasters: true, createdAt: true, status: true } },
    },
  });
  if (!user) return null;
  const requests = await db.dataRequest.findMany({ where: { userId } });
  return { exportedAt: new Date().toISOString(), user, dataRequests: requests };
}

/* ───────────────────────── Audit ───────────────────────── */

export async function loadAudit(filter: { entityType?: string | null; action?: string | null; q?: string | null }) {
  const rows = await db.auditLog.findMany({
    where: {
      ...(filter.entityType ? { entityType: filter.entityType } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.q ? { OR: [{ summary: { contains: filter.q } }, { entityId: filter.q }, { actorPhone: { contains: filter.q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  // R4-CR-13: show who acted by name (phone in a tooltip). No relation on purpose: the row outlives
  // account deletion, so a missing user falls back to the phone kept on the row.
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    actorName: r.actorId ? (names.get(r.actorId) ?? null) : null,
    actorPhone: r.actorPhone,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
    before: r.before,
    after: r.after,
  }));
}

/* ───────────────────────── Payouts ───────────────────────── */

export interface AdminPayoutRow extends ScheduleRow {
  orderStatus: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  /** An open dispute holds the balance. */
  openDispute: boolean;
}

/** Every earned or raised vendor payout part (advance / balance), newest jobs first. */
export async function loadPayoutRows(locale: Locale): Promise<AdminPayoutRow[]> {
  const orders = await db.order.findMany({
    where: { OR: [{ status: { in: [...PAYOUT_EARNING_STATUSES] } }, { payouts: { some: {} } }] },
    orderBy: { placedAt: "desc" },
    take: 1000,
    select: {
      id: true,
      number: true,
      status: true,
      vendorCostPiasters: true,
      deliveredAt: true,
      vendor: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
      payouts: true,
      disputes: { select: { status: true } },
    },
  });
  const out: AdminPayoutRow[] = [];
  for (const o of orders) {
    for (const r of payoutSchedule([o], o.payouts)) {
      out.push({ ...r, status: adminPayoutStatus(r, o.status), orderStatus: o.status, openDispute: o.disputes.some((d) => isOpenDispute(d.status)), vendorId: o.vendor.id, vendorSlug: o.vendor.slug, vendorName: pick(locale, o.vendor.nameAr, o.vendor.nameEn) });
    }
  }
  return out;
}

/** Payout parts ops has to raise, approve or pay (nav badge, overview to-do). */
export async function countPayoutsToAct(): Promise<number> {
  const orders = await db.order.findMany({
    where: { OR: [{ status: { in: [...PAYOUT_EARNING_STATUSES] } }, { payouts: { some: { status: { not: "PAID" } } } }] },
    select: { id: true, number: true, status: true, vendorCostPiasters: true, payouts: true, disputes: { select: { status: true } } },
  });
  let n = 0;
  for (const o of orders) {
    const held = o.disputes.some((d) => isOpenDispute(d.status));
    for (const r of payoutSchedule([o], o.payouts)) if (needsAction(r.status, r.kind, o.status, held)) n++;
  }
  return n;
}

/* ───────────────────────── Moderation (B-08) ───────────────────────── */

export interface ModerationPhoto {
  id: string;
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  imageUrl: string;
  captionAr: string;
  captionEn: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  flags: string[];
}

export interface ModerationBio {
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  bioAr: string;
  bioEn: string;
  flags: string[];
}

/** R6-05 / R4-B-02: a bio edit waiting for review (the live bio stays public until it is approved). */
export interface ModerationBioEdit {
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  liveAr: string;
  liveEn: string;
  pendingAr: string;
  pendingEn: string;
  submittedAt: string | null;
  /** Contact kinds in the waiting text: it cannot be approved until cleaned or rejected. */
  flags: string[];
}

const BIO_EDIT_SELECT = { id: true, slug: true, nameAr: true, nameEn: true, bioAr: true, bioEn: true, bioArPending: true, bioEnPending: true, bioSubmittedAt: true } as const;

export async function loadModeration(locale: Locale): Promise<{ photos: ModerationPhoto[]; bios: ModerationBio[]; bioEdits: ModerationBioEdit[] }> {
  const [items, vendors] = await Promise.all([
    db.vendorPortfolioItem.findMany({
      where: { OR: [{ status: "PENDING" }, { status: "REJECTED" }, { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }] },
      orderBy: { createdAt: "asc" },
      take: 500,
      include: { vendor: { select: { slug: true, nameAr: true, nameEn: true } } },
    }),
    db.vendor.findMany({ select: { id: true, slug: true, nameAr: true, nameEn: true, bioAr: true, bioEn: true } }),
  ]);
  const edits = await db.vendor.findMany({ where: { bioReviewStatus: "PENDING" }, orderBy: { bioSubmittedAt: "asc" }, select: BIO_EDIT_SELECT });
  return {
    bioEdits: edits.map((v) => {
      const pendingAr = v.bioArPending ?? v.bioAr;
      const pendingEn = v.bioEnPending ?? v.bioEn;
      return {
        vendorId: v.id,
        vendorSlug: v.slug,
        vendorName: pick(locale, v.nameAr, v.nameEn),
        liveAr: v.bioAr,
        liveEn: v.bioEn,
        pendingAr,
        pendingEn,
        submittedAt: v.bioSubmittedAt?.toISOString() ?? null,
        flags: contactFlags(pendingAr, pendingEn),
      };
    }),
    photos: items.map((i) => ({
      id: i.id,
      vendorId: i.vendorId,
      vendorSlug: i.vendor.slug,
      vendorName: pick(locale, i.vendor.nameAr, i.vendor.nameEn),
      imageUrl: i.imageUrl,
      captionAr: i.captionAr,
      captionEn: i.captionEn,
      status: i.status,
      reviewNote: i.reviewNote,
      createdAt: i.createdAt.toISOString(),
      flags: contactFlags(i.captionAr, i.captionEn),
    })),
    bios: vendors
      .map((v) => ({ vendorId: v.id, vendorSlug: v.slug, vendorName: pick(locale, v.nameAr, v.nameEn), bioAr: v.bioAr, bioEn: v.bioEn, flags: contactFlags(v.bioAr, v.bioEn) }))
      .filter((v) => v.flags.length > 0),
  };
}

/** Pending photos, bio edits waiting for review and live bios with contact details (nav badge, overview to-do). */
export async function countModeration(): Promise<number> {
  const [pending, edits, vendors] = await Promise.all([
    db.vendorPortfolioItem.count({ where: { status: "PENDING" } }),
    db.vendor.count({ where: { bioReviewStatus: "PENDING" } }),
    db.vendor.findMany({ select: { bioAr: true, bioEn: true } }),
  ]);
  return pending + edits + vendors.filter((v) => contactFlags(v.bioAr, v.bioEn).length > 0).length;
}

/* ───────────────────────── Quote leads (B-15) ───────────────────────── */

export interface AdminQuoteLead {
  quoteId: string;
  createdAt: string;
  dueAt: string;
  validUntil: string;
  quantity: number;
  designId: string | null;
  buyerId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  governorate: string | null;
  neededBy: string | null;
  note: string | null;
  /** Model or style name, standard and size, for the row. */
  modelName: string | null;
  standard: string | null;
  dims: { L: number; W: number; H: number } | null;
  materialCode: string | null;
  source: "checkout" | "catalogue";
  state: LeadState;
  overdue: boolean;
  lastNote: string | null;
  /** Quote.status: REQUESTED, PRICED or ACCEPTED. */
  status: string;
  /** The price the team sent (R4-B-03), for PRICED and ACCEPTED leads. */
  priced: {
    vendorId: string | null;
    vendorName: string | null;
    lines: QuoteLine[];
    subtotalPiasters: number;
    vatPiasters: number;
    totalPiasters: number;
    vendorCostPiasters: number | null;
    deliveryDays: number | null;
    pricedAt: string | null;
    /** Buyer link, in the buyer's language (checkout's quoted path). */
    path: string | null;
    orderNumber: string | null;
  } | null;
  /** Buyer's language, for the link and the message. */
  buyerLocale: Locale;
}

/** Active printers for the "Send price" form. */
export async function loadQuoteVendors(locale: Locale): Promise<{ id: string; name: string; city: string }[]> {
  const vs = await db.vendor.findMany({ where: { status: "ACTIVE" }, orderBy: { nameEn: "asc" }, select: { id: true, nameAr: true, nameEn: true, cityAr: true, cityEn: true } });
  return vs.map((v) => ({ id: v.id, name: pick(locale, v.nameAr, v.nameEn), city: pick(locale, v.cityAr, v.cityEn) }));
}

/** Quote requests with the ops outcome from the audit log (checkout leads and catalogue requests). */
export async function loadQuoteLeads(locale: Locale, now = new Date()): Promise<AdminQuoteLead[]> {
  // R4-B-03: priced leads stay in the inbox for the follow-up, and paid ones show as ordered. Only
  // ACCEPTED quotes the team priced (pricedAt set) are leads; instant engine quotes are not.
  const [requested, priced, accepted] = await Promise.all([
    listQuoteRequests({ take: 300 }),
    listQuoteRequests({ status: QUOTE_PRICED, take: 300 }),
    listQuoteRequests({ status: QUOTE_ACCEPTED, take: 300 }),
  ]);
  const all = [...requested, ...priced, ...accepted];
  if (!all.length) return [];
  const quotes = await db.quote.findMany({
    where: { id: { in: all.map((l) => l.quoteId) } },
    select: { id: true, lines: true, status: true, vendorId: true, subtotalPiasters: true, vatPiasters: true, totalPiasters: true, vendorCostPiasters: true, deliveryDays: true, pricedAt: true, designId: true, user: { select: { locale: true } }, orders: { select: { number: true }, take: 1 } },
  });
  const byId = new Map(quotes.map((q) => [q.id, q]));
  const leads = all.filter((l) => l.status !== QUOTE_ACCEPTED || byId.get(l.quoteId)?.pricedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const ids = leads.map((l) => l.quoteId);
  const vendorIds = [...new Set(quotes.map((q) => q.vendorId).filter((v): v is string => !!v))];
  const [events, vendors] = await Promise.all([
    db.auditLog.findMany({ where: { entityType: "QUOTE", entityId: { in: ids }, action: { in: ["QUOTE_CONTACTED", "QUOTE_CLOSED", "QUOTE_PRICED"] } }, orderBy: { createdAt: "desc" }, select: { entityId: true, action: true, createdAt: true, summary: true } }),
    vendorIds.length ? db.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, nameAr: true, nameEn: true } }) : Promise.resolve([]),
  ]);
  const vendorName = new Map(vendors.map((v) => [v.id, pick(locale, v.nameAr, v.nameEn)]));
  return leads.map((l) => {
    const ev = events.filter((e) => e.entityId === l.quoteId);
    const dueAt = replyDueAt(l.createdAt);
    const row = byId.get(l.quoteId);
    const state = leadState(ev, row?.status);
    const rawLines = fromJson<Record<string, unknown>[]>(row?.lines ?? null) ?? [];
    // A priced quote's lines are engine lines; the request snapshot lives on the audit row (spec).
    const line = row?.status === QUOTE_REQUESTED ? (rawLines[0] ?? {}) : {};
    const buyerLocale: Locale = row?.user?.locale === "en" ? "en" : "ar";
    const isPriced = row && row.status !== QUOTE_REQUESTED;
    const spec = l.spec ?? {};
    const code = (spec.modelCode as string | null) ?? (line.modelCode as string | undefined) ?? (spec.structureCode as string | undefined) ?? null;
    const lib = modelByCode(code);
    const dims = (spec.dims ?? line.dims ?? null) as AdminQuoteLead["dims"];
    return {
      quoteId: l.quoteId,
      createdAt: l.createdAt.toISOString(),
      dueAt: dueAt.toISOString(),
      validUntil: l.validUntil.toISOString(),
      quantity: l.quantity,
      designId: l.designId,
      buyerId: l.buyer.id,
      buyerName: l.buyer.name,
      buyerPhone: l.buyer.phone,
      governorate: l.governorate,
      neededBy: l.neededBy,
      note: l.note ?? ((line.notes as string | undefined) || null),
      modelName: lib ? pick(locale, lib.name.ar, lib.name.en) : typeof spec.name === "string" ? pick(locale, typeof spec.nameAr === "string" ? spec.nameAr : spec.name, spec.name) : code,
      standard: lib?.standard ?? ((line.standard as string | undefined) ?? null),
      dims,
      materialCode: (spec.materialCode as string | undefined) ?? null,
      // Checkout snapshots carry structureCode; catalogue requests carry presetId (and no design at request time).
      source: line.type === "CATALOGUE_REQUEST" || (!("structureCode" in spec) && "presetId" in spec) ? "catalogue" : "checkout",
      state,
      overdue: isOverdue(state, dueAt, now),
      lastNote: ev[0]?.summary ?? null,
      status: row?.status ?? l.status,
      buyerLocale,
      priced: isPriced
        ? {
            vendorId: row.vendorId,
            vendorName: row.vendorId ? (vendorName.get(row.vendorId) ?? null) : null,
            lines: rawLines as unknown as QuoteLine[],
            subtotalPiasters: row.subtotalPiasters,
            vatPiasters: row.vatPiasters,
            totalPiasters: row.totalPiasters,
            vendorCostPiasters: row.vendorCostPiasters,
            deliveryDays: row.deliveryDays,
            pricedAt: row.pricedAt?.toISOString() ?? null,
            path: quoteCheckoutPath(buyerLocale, { id: row.id, designId: row.designId }),
            orderNumber: row.orders[0]?.number ?? null,
          }
        : null,
    };
  });
}

/**
 * Sent prices the buyer has not paid that expire within PRICED_FOLLOW_UP_HOURS and were not closed
 * (overview to-do: call the buyer before the link stops working, R4-B-03).
 */
export async function countPricedExpiring(now = new Date()): Promise<number> {
  const rows = await db.quote.findMany({ where: { status: QUOTE_PRICED, validUntil: { gt: now, lte: new Date(now.getTime() + PRICED_FOLLOW_UP_HOURS * 3_600_000) } }, select: { id: true } });
  if (!rows.length) return 0;
  const closed = await db.auditLog.findMany({ where: { entityType: "QUOTE", action: "QUOTE_CLOSED", entityId: { in: rows.map((r) => r.id) } }, select: { entityId: true }, distinct: ["entityId"] });
  return rows.length - closed.length;
}

/** Open quote requests (nav badge, overview to-do). */
export async function countOpenQuoteLeads(): Promise<number> {
  const leads = await db.quote.findMany({ where: { status: QUOTE_REQUESTED }, select: { id: true } });
  if (!leads.length) return 0;
  const done = await db.auditLog.findMany({ where: { entityType: "QUOTE", entityId: { in: leads.map((l) => l.id) }, action: { in: ["QUOTE_CONTACTED", "QUOTE_CLOSED"] } }, select: { entityId: true }, distinct: ["entityId"] });
  return leads.length - done.length;
}
