import "server-only";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import type {
  Dims,
  EgyptCity,
  FinishCode,
  MaterialCode,
  OrderStatus,
  PrintSides,
  RateTier,
  ShippingAddress,
  StructureCode,
  VendorCapabilities,
  VendorCertification,
  VendorMachine,
} from "@/types";
import { VENDOR_VISIBLE_STATUSES, isAwaitingAcceptance, dueState, ACTIVE_STATUSES } from "../lib/jobs";
import { payoutSchedule, payoutSummary } from "../lib/payouts";
import { instantModelsForCard, jobModel } from "../lib/coverage";
import type {
  JobDetailDTO,
  JobEventDTO,
  JobListItemDTO,
  PortfolioItemDTO,
  RateCardDetailDTO,
  RateCardRowWithCoverageDTO,
  VendorProfileDTO,
} from "../types";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Buyers are Elba's customers: vendors only see a first name (no phone, no street address). */
export function buyerFirstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/)[0]! : "—";
}

const MAX_JOBS = 500;

export async function listJobs(vendorId: string): Promise<JobListItemDTO[]> {
  const orders = await db.order.findMany({
    where: { vendorId, status: { in: [...VENDOR_VISIBLE_STATUSES] } },
    orderBy: { placedAt: "desc" },
    take: MAX_JOBS,
    include: {
      buyer: { select: { name: true } },
      items: { select: { structureCode: true, modelCode: true, quantity: true }, take: 1 },
      productionEvents: { select: { type: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      qcPhotos: { select: { kind: true, status: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    paidAt: iso(o.paidAt),
    placedAt: o.placedAt.toISOString(),
    dueDate: iso(o.dueDate),
    buyerName: buyerFirstName(o.buyer.name),
    structureCode: (o.items[0]?.structureCode ?? "FEFCO_0427") as StructureCode,
    model: jobModel(o.items[0]?.modelCode),
    quantity: o.items.reduce((s, i) => s + i.quantity, 0),
    vendorCostPiasters: o.vendorCostPiasters,
    events: o.productionEvents.map((e) => ({ type: e.type, createdAt: e.createdAt.toISOString() })),
    qcPhotos: o.qcPhotos,
  }));
}

/** Count for the nav badge (cheap: no includes beyond events). */
export async function countAwaiting(vendorId: string): Promise<number> {
  const rows = await db.order.findMany({
    where: { vendorId, status: { in: ["PAID", "PROOF_APPROVED"] }, paidAt: { not: null } },
    select: { status: true, paidAt: true, productionEvents: { select: { type: true, createdAt: true }, where: { type: { in: ["VENDOR_ACCEPTED", "VENDOR_DECLINED"] } } } },
  });
  return rows.filter((r) => isAwaitingAcceptance({ status: r.status, paidAt: r.paidAt, events: r.productionEvents, qcPhotos: [] })).length;
}

export async function getJob(vendorId: string, number: string): Promise<JobDetailDTO | null> {
  const o = await db.order.findFirst({
    where: { vendorId, number, status: { in: [...VENDOR_VISIBLE_STATUSES] } },
    include: {
      buyer: { select: { name: true } },
      items: { include: { proof: { select: { hash: true, version: true, approvedAt: true } } } },
      productionEvents: { orderBy: { createdAt: "asc" } },
      qcPhotos: { orderBy: { uploadedAt: "asc" } },
      payouts: { select: { kind: true, amountPiasters: true, status: true } },
    },
  });
  if (!o) return null;
  const staff = new Set((await db.user.findMany({ where: { vendorId }, select: { id: true } })).map((u) => u.id));
  const addr = fromJson<ShippingAddress>(o.shippingAddress);
  const events: JobEventDTO[] = o.productionEvents.map((e) => ({
    id: e.id,
    type: e.type,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    by: e.actorId && staff.has(e.actorId) ? "you" : e.actorId ? "elba" : "system",
  }));
  return {
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    paidAt: iso(o.paidAt),
    placedAt: o.placedAt.toISOString(),
    dueDate: iso(o.dueDate),
    buyerName: buyerFirstName(o.buyer.name),
    structureCode: (o.items[0]?.structureCode ?? "FEFCO_0427") as StructureCode,
    model: jobModel(o.items[0]?.modelCode),
    quantity: o.items.reduce((s, i) => s + i.quantity, 0),
    vendorCostPiasters: o.vendorCostPiasters,
    items: o.items.map((i) => ({
      id: i.id,
      structureCode: i.structureCode as StructureCode,
      model: jobModel(i.modelCode),
      dims: fromJson<Dims>(i.dims),
      materialCode: i.materialCode as MaterialCode,
      finishCode: i.finishCode as FinishCode,
      printSides: i.printSides as PrintSides,
      quantity: i.quantity,
      proof: i.proof ? { hash: i.proof.hash, version: i.proof.version, approvedAt: iso(i.proof.approvedAt) } : null,
    })),
    events,
    qcPhotos: o.qcPhotos.map((p) => ({ id: p.id, url: p.url, kind: p.kind, status: p.status, reviewNote: p.reviewNote, uploadedAt: p.uploadedAt.toISOString() })),
    shipTo: { city: addr?.city ?? "", governorate: addr?.governorate ?? "" },
    payouts: o.payouts,
  };
}

export async function getPayoutRows(vendorId: string) {
  const [orders, payouts] = await Promise.all([
    db.order.findMany({ where: { vendorId }, select: { id: true, number: true, status: true, vendorCostPiasters: true, deliveredAt: true } }),
    db.payout.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" } }),
  ]);
  return payoutSchedule(orders, payouts);
}

export async function getDashboard(vendorId: string, now = new Date()) {
  const [jobs, payoutRows, activeCards, portfolioCount, vendor] = await Promise.all([
    listJobs(vendorId),
    getPayoutRows(vendorId),
    db.rateCard.count({ where: { vendorId, active: true } }),
    db.vendorPortfolioItem.count({ where: { vendorId } }),
    db.vendor.findUniqueOrThrow({ where: { id: vendorId } }),
  ]);
  const awaiting = jobs.filter((j) => isAwaitingAcceptance(j));
  const inProduction = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  const dueSoon = jobs
    .filter((j) => {
      const d = dueState(j.dueDate, j.status, now);
      return d === "dueSoon" || d === "overdue";
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const certs = fromJson<VendorCertification[]>(vendor.certifications) ?? [];
  const machines = fromJson<VendorMachine[]>(vendor.machines) ?? [];
  const setup = {
    bio: vendor.bioAr.trim().length >= 40 && vendor.bioEn.trim().length >= 40,
    machines: machines.length > 0,
    portfolio: portfolioCount >= 3,
    foodSafe: certs.some((c) => c.code === "FOOD_SAFE"),
    rateCards: activeCards > 0,
  };
  return {
    awaiting: awaiting.slice(0, 5),
    awaitingCount: awaiting.length,
    inProductionCount: inProduction.length,
    // Awaiting jobs already have their own card: the due-soon card lists accepted work only (no duplicate rows).
    dueSoon: dueSoon.filter((j) => !isAwaitingAcceptance(j)).slice(0, 5),
    dueSoonCount: dueSoon.length,
    payouts: payoutSummary(payoutRows),
    activeCards,
    setup,
    rating: vendor.rating,
    ratingCount: vendor.ratingCount,
    onTimePct: vendor.onTimePct,
  };
}

export async function listRateCards(vendorId: string): Promise<RateCardRowWithCoverageDTO[]> {
  const [cards, vendor] = await Promise.all([
    db.rateCard.findMany({
      where: { vendorId },
      include: { structure: { select: { code: true, sortOrder: true } }, material: { select: { code: true, sortOrder: true } } },
    }),
    db.vendor.findUnique({ where: { id: vendorId }, select: { capabilities: true } }),
  ]);
  const listed = fromJson<VendorCapabilities>(vendor?.capabilities ?? null)?.models ?? [];
  return cards
    .sort((a, b) => a.structure.sortOrder - b.structure.sortOrder || a.material.sortOrder - b.material.sortOrder)
    .map((c) => ({
      id: c.id,
      structureCode: c.structure.code as StructureCode,
      materialCode: c.material.code as MaterialCode,
      qtyTiers: fromJson<RateTier[]>(c.qtyTiers),
      setupPiasters: c.setupPiasters,
      dieCostPiasters: c.dieCostPiasters,
      leadTimeDays: c.leadTimeDays,
      active: c.active,
      // R4: only models this card gives an instant price for (special gluing once listed).
      modelCount: instantModelsForCard(c.structure.code as StructureCode, c.material.code as MaterialCode, listed).length,
    }));
}

export async function getRateCard(vendorId: string, id: string): Promise<RateCardDetailDTO | null> {
  const c = await db.rateCard.findFirst({
    where: { id, vendorId },
    include: { structure: { select: { code: true } }, material: { select: { code: true } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    structureCode: c.structure.code as StructureCode,
    materialCode: c.material.code as MaterialCode,
    qtyTiers: fromJson<RateTier[]>(c.qtyTiers),
    setupPiasters: c.setupPiasters,
    dieCostPiasters: c.dieCostPiasters,
    leadTimeDays: c.leadTimeDays,
    active: c.active,
    referenceAreaM2: c.referenceAreaM2,
    printSidesSurchargePct: c.printSidesSurchargePct,
    finishSurcharges: fromJson<Partial<Record<FinishCode, number>>>(c.finishSurcharges) ?? {},
    standardDies: fromJson<Dims[]>(c.standardDies) ?? [],
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function getProfile(vendorId: string): Promise<{ profile: VendorProfileDTO; portfolio: PortfolioItemDTO[] } | null> {
  const v = await db.vendor.findUnique({ where: { id: vendorId }, include: { portfolio: { orderBy: { sortOrder: "asc" } } } });
  if (!v) return null;
  const caps = fromJson<VendorCapabilities>(v.capabilities);
  return {
    profile: {
      id: v.id,
      slug: v.slug,
      nameAr: v.nameAr,
      nameEn: v.nameEn,
      city: v.city as EgyptCity,
      status: v.status,
      verified: v.verified,
      foodSafe: v.foodSafe,
      rating: v.rating,
      ratingCount: v.ratingCount,
      onTimePct: v.onTimePct,
      bioAr: v.bioAr,
      bioEn: v.bioEn,
      machines: fromJson<VendorMachine[]>(v.machines) ?? [],
      structures: caps?.structures ?? [],
      materials: caps?.materials ?? [],
      finishes: caps?.finishes ?? [],
      maxColors: caps?.maxColors ?? 4,
      digitalShortRun: caps?.digitalShortRun ?? false,
      monthlyCapacityUnits: caps?.monthlyCapacityUnits ?? 0,
      leadTimeDays: v.leadTimeDays,
      minOrderQty: v.minOrderQty,
      serviceAreas: fromJson<EgyptCity[]>(v.serviceAreas) ?? [],
      certifications: fromJson<VendorCertification[]>(v.certifications) ?? [],
      models: caps?.models ?? [],
      updatedAt: v.updatedAt.toISOString(),
    },
    portfolio: v.portfolio.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      captionAr: p.captionAr,
      captionEn: p.captionEn,
      structureCode: (p.structureCode as StructureCode | null) ?? null,
      status: (p.status as PortfolioItemDTO["status"]) ?? "APPROVED",
      reviewNote: p.reviewNote,
    })),
  };
}
