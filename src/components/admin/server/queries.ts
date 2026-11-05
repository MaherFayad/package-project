import "server-only";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { pick } from "@/i18n";
import type { Dims, Locale, OrderStatus, StructureParamLimits, VendorCapabilities } from "@/types";
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
  type MetricOrder,
  type RangeKey,
  type Scorecard,
} from "../lib/metrics";
import { isOpenDispute } from "../lib/ops";
import type { AdminOrderRow } from "../lib/orders";

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
} as const;

/* ───────────────────────── Overview ───────────────────────── */

export async function loadOverview(range: RangeKey, now = new Date()) {
  const { from, to, prevFrom } = rangeWindow(range, now);
  const [orders, disputes, designs, accounts, quoteUsers, qcPending, applications, dataRequests] = await Promise.all([
    db.order.findMany({ where: { OR: [{ placedAt: { gte: prevFrom } }, { deliveredAt: { gte: prevFrom } }] }, select: metricSelect }),
    db.dispute.findMany({ select: { createdAt: true, status: true } }),
    db.design.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.user.count({ where: { role: "BUYER", createdAt: { gte: from, lt: to } } }),
    db.quote.findMany({ where: { createdAt: { gte: from, lt: to }, userId: { not: null } }, select: { userId: true }, distinct: ["userId"] }),
    db.order.count({ where: { status: "QC_PENDING" } }),
    db.vendorApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.dataRequest.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const rows = orders as MetricOrder[];
  const paidOrders = rows.filter((o) => !isReprint(o) && countsForGmv(o) && o.placedAt >= from && o.placedAt < to).length;
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
    funnel: funnel({ designs, accounts, priceViewed: quoteUsers.length, orders: paidOrders }),
    money,
    gmvChangePct: changePct(money.gmvPiasters, prevMoney.gmvPiasters),
    marginChangePct: changePct(money.marginPiasters, prevMoney.marginPiasters),
    ops,
    gmvSeries,
    marginSeries,
    tasks: { qcPending, applications, openDisputes: ops.openDisputes, dataRequests },
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
      capable: v.rateCards.length > 0 && (fromJson<VendorCapabilities>(v.capabilities).structures ?? []).includes((structureCode ?? "") as never),
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

export async function loadCatalog() {
  const [structures, materials, finishes] = await Promise.all([
    db.structure.findMany({ orderBy: { sortOrder: "asc" } }),
    db.material.findMany({ orderBy: { sortOrder: "asc" } }),
    db.finish.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    structures: structures.map((s) => ({ id: s.id, code: s.code, nameAr: s.nameAr, nameEn: s.nameEn, family: s.family, active: s.active, params: fromJson<StructureParamLimits>(s.params), defaultDims: fromJson<Dims>(s.defaultDims) })),
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
  const [vendors, reprints, auditRows] = await Promise.all([
    db.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameEn: "asc" } }),
    db.order.findMany({ where: { notes: { startsWith: `REPRINT_OF:${d.order.number}` } }, select: { number: true, status: true } }),
    db.auditLog.findMany({ where: { entityType: "DISPUTE", entityId: d.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return { dispute: d, vendors, reprints, auditRows };
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
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    actorPhone: r.actorPhone,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
    before: r.before,
    after: r.after,
  }));
}
