import { configFinishNames } from "@/lib/orders/finish-label";
import "server-only";
// Eager model library before the doc helpers (board area of the job's own dieline).
import "@/lib/library";
import { docBoardArea } from "@/lib/library/doc";
import { db } from "@/lib/db";
import { fromJson } from "@/lib/json";
import { interpolateUnit } from "@/lib/pricing/tiers";
import { loadOnTimeMinDeliveries } from "@/lib/vendors/on-time-settings";
import type {
  DesignDoc,
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
import { payoutExpectation, payoutSchedule, payoutSummary } from "../lib/payouts";
import { summariseArtwork } from "../lib/artwork";
import { vendorStats } from "../lib/stats";
import { instantModelsForCard, jobModel } from "../lib/coverage";
import { bioForEditing } from "../lib/bio-review";
import type {
  JobDetailDTO,
  JobEventDTO,
  JobListItemDTO,
  JobPriceDTO,
  PortfolioItemDTO,
  RateCardDetailDTO,
  RateCardRowWithCoverageDTO,
  VendorProfileDTO,
  VendorPayoutRow,
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
    // P-11: the city only (shippingAddress never reaches the vendor beyond city and governorate).
    city: fromJson<ShippingAddress>(o.shippingAddress)?.city ?? "",
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
      items: { include: { proof: { select: { id: true, hash: true, version: true, approvedAt: true, previewUrl: true, snapshot: true } } } },
      productionEvents: { orderBy: { createdAt: "asc" } },
      qcPhotos: { orderBy: { uploadedAt: "asc" } },
      payouts: { select: { kind: true, amountPiasters: true, status: true } },
      quote: { select: { vendorCostPiasters: true } },
      shipments: { select: { provider: true, trackingNumber: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!o) return null;
  const first = o.items[0];
  const snapshot = first?.proof ? fromJson<DesignDoc>(first.proof.snapshot) : null;
  const price = await jobPrice(vendorId, o.quote?.vendorCostPiasters != null, first, snapshot);
  const ship = o.shipments[0];
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
    city: addr?.city ?? "",
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
      finishNames: configFinishNames(i.config, "en") ? { ar: configFinishNames(i.config, "ar")!, en: configFinishNames(i.config, "en")! } : null,
      printSides: i.printSides as PrintSides,
      quantity: i.quantity,
      proof: i.proof ? { hash: i.proof.hash, version: i.proof.version, approvedAt: iso(i.proof.approvedAt) } : null,
    })),
    events,
    qcPhotos: o.qcPhotos.map((p) => ({ id: p.id, url: p.url, kind: p.kind, status: p.status, reviewNote: p.reviewNote, uploadedAt: p.uploadedAt.toISOString() })),
    shipTo: { city: addr?.city ?? "", governorate: addr?.governorate ?? "" },
    payouts: o.payouts,
    // P-01: the approved proof (3D render + watermarked PDF) is readable by the order's printer once
    // paid (canViewOrder); only the print-ready PDF waits for acceptance.
    artwork: first?.proof
      ? {
          previewUrl: first.proof.previewUrl?.startsWith("/api/orders/proofs/") ? first.proof.previewUrl : null,
          proofPdfUrl: `/api/orders/${o.id}/proof-pdf`,
          summary: summariseArtwork(snapshot),
        }
      : null,
    price,
    shipment: ship ? { provider: ship.provider, trackingNumber: ship.trackingNumber, createdAt: ship.createdAt.toISOString() } : null,
  };
}

/**
 * P-04: the printer's current rate card numbers for this job (tier unit at the quantity, setup,
 * die, reference size) and the board blank of the job's own box, so the page can explain the price
 * in the printer's terms. The paid price itself is Order.vendorCostPiasters (fixed at checkout).
 */
async function jobPrice(
  vendorId: string,
  agreed: boolean,
  item: { structureCode: string; materialCode: string; quantity: number } | undefined,
  doc: DesignDoc | null,
): Promise<JobPriceDTO> {
  if (agreed || !item) return { source: agreed ? "agreed" : "card", card: null, blankAreaM2: null };
  const card = await db.rateCard.findFirst({
    where: { vendorId, structure: { code: item.structureCode }, material: { code: item.materialCode } },
    select: { id: true, qtyTiers: true, setupPiasters: true, dieCostPiasters: true, referenceAreaM2: true },
  });
  const tiers = card ? (fromJson<RateTier[]>(card.qtyTiers) ?? []) : [];
  let blankAreaM2: number | null = null;
  try {
    blankAreaM2 = doc ? (docBoardArea(doc)?.blankAreaM2 ?? null) : null;
  } catch {
    blankAreaM2 = null;
  }
  return {
    source: "card",
    card:
      card && tiers.length && item.quantity > 0
        ? {
            id: card.id,
            tierUnitPiasters: Math.round(interpolateUnit(tiers, item.quantity)),
            setupPiasters: card.setupPiasters,
            dieCostPiasters: card.dieCostPiasters,
            referenceAreaM2: card.referenceAreaM2,
          }
        : null,
    blankAreaM2,
  };
}

export async function getPayoutRows(vendorId: string, now = new Date()): Promise<VendorPayoutRow[]> {
  const [orders, payouts] = await Promise.all([
    db.order.findMany({
      where: { vendorId },
      select: {
        id: true,
        number: true,
        status: true,
        vendorCostPiasters: true,
        deliveredAt: true,
        productionEvents: { where: { type: "VENDOR_ACCEPTED" }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.payout.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" } }),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  // P-03: each row says when it is expected (target) and whether that date has passed.
  return payoutSchedule(orders, payouts).map((r) => {
    const o = r.orderId ? byId.get(r.orderId) : undefined;
    return { ...r, ...payoutExpectation(r, { acceptedAt: o?.productionEvents[0]?.createdAt ?? null, deliveredAt: o?.deliveredAt ?? null }, now) };
  });
}

export async function getDashboard(vendorId: string, now = new Date()) {
  const [jobs, payoutRows, activeCards, portfolioCount, vendor, stats] = await Promise.all([
    listJobs(vendorId),
    getPayoutRows(vendorId, now),
    db.rateCard.count({ where: { vendorId, active: true } }),
    db.vendorPortfolioItem.count({ where: { vendorId } }),
    db.vendor.findUniqueOrThrow({ where: { id: vendorId } }),
    getVendorStats(vendorId),
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
    // R7: a bio edit waiting for (or sent back by) Elba's review, shown on the home page too.
    bioReview: vendor.bioReviewStatus === "PENDING" || vendor.bioReviewStatus === "REJECTED" ? (vendor.bioReviewStatus as "PENDING" | "REJECTED") : null,
    awaiting: awaiting.slice(0, 5),
    awaitingCount: awaiting.length,
    inProductionCount: inProduction.length,
    // Awaiting jobs already have their own card: the due-soon card lists accepted work only (no duplicate rows).
    dueSoon: dueSoon.filter((j) => !isAwaitingAcceptance(j)).slice(0, 5),
    dueSoonCount: dueSoon.length,
    payouts: payoutSummary(payoutRows),
    activeCards,
    setup,
    stats,
    payoutsLate: payoutRows.filter((r) => r.late).length,
  };
}

/** P-02: the same sources as the admin scorecard (real deliveries and reviews), not the seeded Vendor columns. */
export async function getVendorStats(vendorId: string) {
  const [deliveries, reviews, min] = await Promise.all([
    db.order.findMany({ where: { vendorId, deliveredAt: { not: null } }, select: { dueDate: true, deliveredAt: true, notes: true } }),
    db.review.findMany({ where: { vendorId }, select: { rating: true } }),
    loadOnTimeMinDeliveries(),
  ]);
  return vendorStats(deliveries, reviews.map((r) => r.rating), min);
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
  const [v, stats] = await Promise.all([
    db.vendor.findUnique({ where: { id: vendorId }, include: { portfolio: { orderBy: { sortOrder: "asc" } } } }),
    getVendorStats(vendorId),
  ]);
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
      stats,
      // R5: the form edits the waiting (or rejected) bio when there is one.
      ...bioForEditing(v),
      bioReview: v.bioReviewStatus === "PENDING" || v.bioReviewStatus === "REJECTED" ? { status: v.bioReviewStatus, note: v.bioReviewNote } : null,
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
