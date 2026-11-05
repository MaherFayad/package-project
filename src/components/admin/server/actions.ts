"use server";

/**
 * Admin server actions. Every action:
 *  1. authenticates: signed-in role ADMIN (adminForMutation), independent of the page guard;
 *  2. validates its input with zod;
 *  3. re-checks the business rule (src/components/admin/lib/*) and the shared order state machine
 *     (status changes go through transitionOrder() from src/lib/orders/service);
 *  4. writes an AuditLog row with before/after.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { fromJson, toJson } from "@/lib/json";
import { transitionOrder } from "@/lib/orders/service";
import { getPaymentProvider } from "@/lib/payments";
import { QuoteInputError, quote, type PricingConfig } from "@/lib/pricing";
import { loadPricingData } from "@/lib/pricing/server";
import { STRUCTURE_LIMITS } from "@/lib/dieline";
import type { Dims, OrderStatus, ShippingAddress, StructureCode, StructureParamLimits } from "@/types";
import { AdminActionError, AdminFieldErrors, adminForMutation, audit, issuesToFields, runAdminAction, type AdminActionResponse } from "./context";
import { loadPricingSettings } from "./settings";
import {
  applyGoodsOverride,
  canOverrideCost,
  canOverridePrice,
  canReassign,
  canRefund,
  canReviewQc,
  noteSchema,
  overrideSchema,
  qcSchema,
  reassignSchema,
  refundSchema,
  reprintNote,
  reprintNumber,
  statusAfterReassign,
} from "../lib/orders";
import {
  allowedDecisions,
  anonymisedPhone,
  applicationDecisionSchema,
  canDecideApplication,
  canDecideRequest,
  dataRequestDecisionSchema,
  deletionBlockers,
  disputeDecisionSchema,
  encodeReviewNote,
  statusForDecision,
  vendorStatusAfter,
  vendorStatusSchema,
} from "../lib/ops";
import {
  appendIndexRow,
  indexUpdateSchema,
  previewPriceChanges,
  PRICING_SETTING_KEY,
  settingsFormSchema,
  settingsToConfig,
  type AdminPricingSettings,
  type PreviewRow,
  type PreviewSample,
} from "../lib/pricingSettings";
import { defaultFits, finishUpdateSchema, materialUpdateSchema, mergeLimits, outsideHardBounds, structureUpdateSchema } from "../lib/catalog";

function revalidateAdmin() {
  revalidatePath("/[locale]/admin", "layout");
}

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new AdminFieldErrors(issuesToFields(r.error.issues));
  return r.data;
}

/* ───────────────────────── Orders ───────────────────────── */

export async function reassignOrderAction(input: z.input<typeof reassignSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(reassignSchema, input);
    const order = await db.order.findUnique({ where: { id: d.orderId }, include: { vendor: { select: { nameEn: true } } } });
    if (!order) throw new AdminActionError("NOT_FOUND");
    if (!canReassign(order.status)) throw new AdminActionError("NOT_ALLOWED");
    if (order.vendorId === d.vendorId) throw new AdminActionError("INVALID");
    const vendor = await db.vendor.findUnique({ where: { id: d.vendorId } });
    if (!vendor || vendor.status !== "ACTIVE") throw new AdminActionError("NOT_ALLOWED", "VENDOR_INACTIVE");
    const nextStatus = statusAfterReassign(order.status as OrderStatus);
    const cost = d.vendorCostPiasters ?? order.vendorCostPiasters;
    await db.$transaction(async (tx) => {
      const u = await tx.order.updateMany({
        where: { id: order.id, status: order.status, vendorId: order.vendorId },
        data: { vendorId: vendor.id, status: nextStatus, vendorCostPiasters: cost },
      });
      if (u.count !== 1) throw new AdminActionError("STALE");
      // Advance payouts that were not paid yet follow the job; paid ones stay with the old vendor.
      await tx.payout.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { vendorId: vendor.id } });
      await audit(
        admin,
        {
          action: "ORDER_REASSIGN",
          entityType: "ORDER",
          entityId: order.id,
          summary: `${order.number}: ${order.vendor.nameEn} → ${vendor.nameEn}. ${d.reason}`,
          before: { vendorId: order.vendorId, status: order.status, vendorCostPiasters: order.vendorCostPiasters },
          after: { vendorId: vendor.id, status: nextStatus, vendorCostPiasters: cost },
        },
        tx,
      );
    });
    revalidateAdmin();
    return null;
  });
}

export async function overrideOrderAction(input: z.input<typeof overrideSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(overrideSchema, input);
    if (d.goodsPiasters === null && d.vendorCostPiasters === null) throw new AdminFieldErrors({ goodsPiasters: "REQUIRED" });
    const order = await db.order.findUnique({ where: { id: d.orderId }, include: { items: true } });
    if (!order) throw new AdminActionError("NOT_FOUND");
    if (d.goodsPiasters !== null && !canOverridePrice(order.status)) throw new AdminActionError("NOT_ALLOWED", "PRICE_LOCKED");
    if (d.vendorCostPiasters !== null && !canOverrideCost(order.status)) throw new AdminActionError("NOT_ALLOWED", "COST_LOCKED");
    const before = { subtotalPiasters: order.subtotalPiasters, vatPiasters: order.vatPiasters, totalPiasters: order.totalPiasters, vendorCostPiasters: order.vendorCostPiasters };
    const money = d.goodsPiasters !== null ? applyGoodsOverride(order, d.goodsPiasters) : null;
    await db.$transaction(async (tx) => {
      const u = await tx.order.updateMany({
        where: { id: order.id, status: order.status, updatedAt: order.updatedAt },
        data: {
          ...(money ? { subtotalPiasters: money.subtotalPiasters, vatPiasters: money.vatPiasters, totalPiasters: money.totalPiasters } : {}),
          ...(d.vendorCostPiasters !== null ? { vendorCostPiasters: d.vendorCostPiasters } : {}),
        },
      });
      if (u.count !== 1) throw new AdminActionError("STALE");
      if (money && order.items.length === 1) {
        const item = order.items[0]!;
        await tx.orderItem.update({ where: { id: item.id }, data: { lineTotalPiasters: d.goodsPiasters!, unitPiasters: Math.round(d.goodsPiasters! / Math.max(1, item.quantity)) } });
      }
      if (money) {
        // Pending payment intents carry the old amount; they are cancelled so the buyer pays the new total.
        await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "FAILED" } });
      }
      await audit(
        admin,
        {
          action: "ORDER_OVERRIDE",
          entityType: "ORDER",
          entityId: order.id,
          summary: `${order.number}: ${d.reason}`,
          before,
          after: { ...(money ?? {}), ...(d.vendorCostPiasters !== null ? { vendorCostPiasters: d.vendorCostPiasters } : {}) },
        },
        tx,
      );
    });
    revalidateAdmin();
    return null;
  });
}

/** Full refund through the payment adapter, then REFUNDED on the state machine. */
async function refundOrderInternal(admin: Awaited<ReturnType<typeof adminForMutation>>, orderId: string, reason: string, disputeId?: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) throw new AdminActionError("NOT_FOUND");
  if (!canRefund(order.status, order.payments)) throw new AdminActionError("NOT_ALLOWED", "NOT_REFUNDABLE");
  const paid = order.payments.filter((p) => p.status === "PAID");
  const refs: string[] = [];
  for (const p of paid) {
    const provider = getPaymentProvider(p.provider === "paymob" ? "paymob" : "mock");
    const r = await provider.refund({ providerRef: p.providerRef ?? "", amountPiasters: p.amountPiasters, reason });
    if (!r.ok) throw new AdminActionError("PAYMENT_FAILED", r.error);
    refs.push(r.refundRef ?? "");
    const raw = (p.raw && typeof p.raw === "object" && !Array.isArray(p.raw) ? p.raw : {}) as Record<string, unknown>;
    await db.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", raw: toJson({ ...raw, refund: { ref: r.refundRef, at: new Date().toISOString(), by: admin.id } }) } });
  }
  await transitionOrder(order.id, "REFUNDED", { role: "ADMIN", userId: admin.id }, `REFUNDED:${reason.replace(/\s+/g, " ").slice(0, 200)}`);
  // Unpaid vendor payouts for a refunded job are not owed any more.
  await db.payout.deleteMany({ where: { orderId: order.id, status: "PENDING" } });
  await audit(admin, {
    action: "ORDER_REFUND",
    entityType: "ORDER",
    entityId: order.id,
    summary: `${order.number}: ${reason}${disputeId ? ` (dispute ${disputeId})` : ""}`,
    before: { status: order.status, payments: paid.map((p) => ({ id: p.id, status: p.status, amountPiasters: p.amountPiasters })) },
    after: { status: "REFUNDED", refundRefs: refs },
  });
}

export async function refundOrderAction(input: z.input<typeof refundSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(refundSchema, input);
    await refundOrderInternal(admin, d.orderId, d.reason, d.disputeId);
    revalidateAdmin();
    return null;
  });
}

export async function reviewQcAction(input: z.input<typeof qcSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(qcSchema, input);
    if (d.decision === "REJECT" && (!d.note || d.note.length < 3)) throw new AdminFieldErrors({ note: "NOTE_REQUIRED" });
    const order = await db.order.findUnique({ where: { id: d.orderId }, include: { qcPhotos: true } });
    if (!order) throw new AdminActionError("NOT_FOUND");
    if (!canReviewQc(order.status, order.qcPhotos)) throw new AdminActionError("NOT_ALLOWED");
    const pending = order.qcPhotos.filter((p) => p.status === "PENDING").map((p) => p.id);
    const now = new Date();
    await db.qcPhoto.updateMany({
      where: { id: { in: pending } },
      data: { status: d.decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewNote: d.note || null, reviewedAt: now },
    });
    await transitionOrder(order.id, d.decision === "APPROVE" ? "READY_TO_SHIP" : "IN_PRODUCTION", { role: "ADMIN", userId: admin.id }, d.decision === "REJECT" ? d.note : undefined);
    await audit(admin, {
      action: d.decision === "APPROVE" ? "ORDER_QC_APPROVE" : "ORDER_QC_REJECT",
      entityType: "ORDER",
      entityId: order.id,
      summary: `${order.number}${d.note ? `: ${d.note}` : ""}`,
      before: { status: order.status, photos: pending.length },
      after: { status: d.decision === "APPROVE" ? "READY_TO_SHIP" : "IN_PRODUCTION" },
    });
    revalidateAdmin();
    return null;
  });
}

/** Internal staff note: stored in the audit log only (never shown to buyers or vendors). */
export async function addOrderNoteAction(input: z.input<typeof noteSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(noteSchema, input);
    const order = await db.order.findUnique({ where: { id: d.orderId }, select: { id: true, number: true } });
    if (!order) throw new AdminActionError("NOT_FOUND");
    await audit(admin, { action: "ORDER_NOTE", entityType: "ORDER", entityId: order.id, summary: `${order.number}: ${d.note}`, after: { note: d.note } });
    revalidateAdmin();
    return null;
  });
}

/* ───────────────────────── Disputes & reprints ───────────────────────── */

export async function decideDisputeAction(input: z.input<typeof disputeDecisionSchema>): Promise<AdminActionResponse<{ reprintNumber?: string }>> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(disputeDecisionSchema, input);
    const dispute = await db.dispute.findUnique({ where: { id: d.disputeId }, include: { order: { include: { items: true } } } });
    if (!dispute) throw new AdminActionError("NOT_FOUND");
    if (!allowedDecisions(dispute.status).includes(d.decision)) throw new AdminActionError("NOT_ALLOWED");
    const status = statusForDecision(d.decision);
    let reprint: string | undefined;

    if (d.decision === "REFUND") {
      await refundOrderInternal(admin, dispute.orderId, d.note, dispute.id);
    }
    if (d.decision === "REPRINT") {
      const original = dispute.order;
      const vendorId = d.vendorId ?? original.vendorId;
      const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor || vendor.status !== "ACTIVE") throw new AdminActionError("NOT_ALLOWED", "VENDOR_INACTIVE");
      const existing = await db.order.findMany({ where: { number: { startsWith: `${original.number}-R` } }, select: { number: true } });
      reprint = reprintNumber(original.number, existing.map((e) => e.number));
      const now = new Date();
      const lead = Math.max(2, vendor.leadTimeDays);
      const created = await db.order.create({
        data: {
          number: reprint,
          buyerId: original.buyerId,
          vendorId,
          status: "PAID",
          // Free for the buyer; the vendor is paid again from the reprint reserve (report §6.2).
          subtotalPiasters: 0,
          vatPiasters: 0,
          shippingPiasters: 0,
          totalPiasters: 0,
          vendorCostPiasters: original.vendorCostPiasters,
          shippingAddress: original.shippingAddress ?? toJson<ShippingAddress | null>(null),
          notes: reprintNote(original.number, dispute.id),
          placedAt: now,
          paidAt: now,
          dueDate: new Date(now.getTime() + lead * 86_400_000),
          items: {
            create: original.items.map((i) => ({
              proofId: i.proofId,
              structureCode: i.structureCode,
              dims: i.dims ?? toJson<Dims | null>(null),
              materialCode: i.materialCode,
              finishCode: i.finishCode,
              printSides: i.printSides,
              quantity: i.quantity,
              unitPiasters: 0,
              lineTotalPiasters: 0,
              printPdfUrl: i.printPdfUrl,
            })),
          },
          productionEvents: {
            create: [
              { type: "ORDER_PLACED", note: `REORDER:${original.number}`, actorId: admin.id },
              { type: "PAYMENT_CONFIRMED", actorId: admin.id },
            ],
          },
        },
      });
      await audit(admin, { action: "ORDER_REPRINT", entityType: "ORDER", entityId: created.id, summary: `${reprint} ← ${original.number}: ${d.note}`, after: { vendorId, vendorCostPiasters: original.vendorCostPiasters } });
    }

    const u = await db.dispute.updateMany({
      where: { id: dispute.id, status: dispute.status },
      data: { status, resolution: d.note || dispute.resolution, ...(status === "UNDER_REVIEW" ? {} : { resolvedAt: new Date() }) },
    });
    if (u.count !== 1) throw new AdminActionError("STALE");
    await audit(admin, {
      action: d.decision === "REVIEW" ? "DISPUTE_REVIEW" : d.decision === "REPRINT" ? "DISPUTE_REPRINT" : d.decision === "REFUND" ? "DISPUTE_REFUND" : "DISPUTE_REJECT",
      entityType: "DISPUTE",
      entityId: dispute.id,
      summary: `${dispute.order.number}${reprint ? ` → ${reprint}` : ""}${d.note ? `: ${d.note}` : ""}`,
      before: { status: dispute.status },
      after: { status, ...(reprint ? { reprint } : {}) },
    });
    revalidateAdmin();
    return { reprintNumber: reprint };
  });
}

/* ───────────────────────── Vendors ───────────────────────── */

export async function setVendorStatusAction(input: z.input<typeof vendorStatusSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(vendorStatusSchema, input);
    const vendor = await db.vendor.findUnique({ where: { id: d.vendorId } });
    if (!vendor) throw new AdminActionError("NOT_FOUND");
    const next = vendorStatusAfter(vendor, d.action);
    if (!next) throw new AdminActionError("NOT_ALLOWED");
    const u = await db.vendor.updateMany({ where: { id: vendor.id, status: vendor.status, verified: vendor.verified }, data: next });
    if (u.count !== 1) throw new AdminActionError("STALE");
    await audit(admin, {
      action: d.action === "SUSPEND" ? "VENDOR_SUSPEND" : d.action === "REINSTATE" ? "VENDOR_REINSTATE" : d.action === "VERIFY" ? "VENDOR_VERIFY" : "VENDOR_UNVERIFY",
      entityType: "VENDOR",
      entityId: vendor.id,
      summary: `${vendor.nameEn}${d.reason ? `: ${d.reason}` : ""}`,
      before: { status: vendor.status, verified: vendor.verified },
      after: next,
    });
    revalidateAdmin();
    revalidatePath("/[locale]", "layout");
    return null;
  });
}

export async function decideApplicationAction(input: z.input<typeof applicationDecisionSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(applicationDecisionSchema, input);
    const app = await db.vendorApplication.findUnique({ where: { id: d.applicationId } });
    if (!app) throw new AdminActionError("NOT_FOUND");
    if (!canDecideApplication(app.status)) throw new AdminActionError("NOT_ALLOWED");
    if (d.decision === "UNDER_REVIEW" && app.status === "UNDER_REVIEW") throw new AdminActionError("NOT_ALLOWED");
    const status = d.decision === "APPROVE" ? "APPROVED" : d.decision === "REJECT" ? "REJECTED" : "UNDER_REVIEW";
    const now = new Date();
    await db.$transaction(async (tx) => {
      const u = await tx.vendorApplication.updateMany({
        where: { id: app.id, status: app.status },
        data: { status, reviewNote: encodeReviewNote(d.checklist, d.note), reviewedById: admin.id, reviewedAt: now },
      });
      if (u.count !== 1) throw new AdminActionError("STALE");
      if (d.decision === "APPROVE") {
        await tx.vendor.update({ where: { id: app.vendorId }, data: { status: "ACTIVE", verified: true } });
        const applicant = await tx.user.findUnique({ where: { id: app.applicantId }, select: { role: true } });
        if (applicant) {
          await tx.user.update({ where: { id: app.applicantId }, data: { vendorId: app.vendorId, ...(applicant.role === "ADMIN" ? {} : { role: "VENDOR" }) } });
        }
      }
      await audit(
        admin,
        {
          action: d.decision === "APPROVE" ? "APPLICATION_APPROVE" : d.decision === "REJECT" ? "APPLICATION_REJECT" : "APPLICATION_REVIEW",
          entityType: "VENDOR_APPLICATION",
          entityId: app.id,
          summary: `${app.legalName}${d.note ? `: ${d.note}` : ""}`,
          before: { status: app.status },
          after: { status, checklist: d.checklist },
        },
        tx,
      );
    });
    revalidateAdmin();
    revalidatePath("/[locale]", "layout");
    return null;
  });
}

/* ───────────────────────── Pricing config ───────────────────────── */

async function saveSettings(admin: Awaited<ReturnType<typeof adminForMutation>>, next: AdminPricingSettings) {
  await db.platformSetting.upsert({
    where: { key: PRICING_SETTING_KEY },
    create: { key: PRICING_SETTING_KEY, value: toJson(next), updatedById: admin.id },
    update: { value: toJson(next), updatedById: admin.id },
  });
}

export async function savePricingSettingsAction(input: z.input<typeof settingsFormSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(settingsFormSchema, input);
    const { settings } = await loadPricingSettings();
    const next: AdminPricingSettings = { ...settings, ...d };
    await saveSettings(admin, next);
    await audit(admin, {
      action: "PRICING_SETTINGS",
      entityType: "SETTINGS",
      entityId: PRICING_SETTING_KEY,
      summary: `margin ${Math.round(d.marginPct * 1000) / 10}%, validity ${d.quoteValidityHours} h`,
      before: { marginPct: settings.marginPct, marginOnShipping: settings.marginOnShipping, quoteValidityHours: settings.quoteValidityHours, zones: settings.zones },
      after: d,
    });
    revalidateAdmin();
    return null;
  });
}

export async function applyIndexUpdateAction(input: z.input<typeof indexUpdateSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(indexUpdateSchema, input);
    const { settings } = await loadPricingSettings();
    const priceIndex = appendIndexRow(settings.priceIndex, d, new Date());
    await saveSettings(admin, { ...settings, priceIndex });
    await audit(admin, { action: "PRICING_INDEX", entityType: "SETTINGS", entityId: PRICING_SETTING_KEY, summary: `${d.effectiveFrom} fx ${d.fx}${d.note ? `: ${d.note}` : ""}`, after: d });
    revalidateAdmin();
    return null;
  });
}

const previewSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("settings"), settings: settingsFormSchema }),
  z.object({ kind: z.literal("index"), index: indexUpdateSchema }),
]);

export interface PricingPreview {
  rows: PreviewRow[];
  affected: number;
  avgChangePct: number | null;
}

const PREVIEW_QTY = 500;

/** Price each active structure × compatible material at its default size, now vs proposed. */
export async function previewPricingAction(input: z.input<typeof previewSchema>): Promise<AdminActionResponse<PricingPreview>> {
  return runAdminAction(async () => {
    await adminForMutation();
    const d = parse(previewSchema, input);
    const [{ settings }, data, structures, materials] = await Promise.all([
      loadPricingSettings(),
      loadPricingData(),
      db.structure.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      db.material.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    const now = new Date();
    const proposedSettings: AdminPricingSettings =
      d.kind === "settings" ? { ...settings, ...d.settings } : { ...settings, priceIndex: appendIndexRow(settings.priceIndex, d.index, now) };
    const proposedNow = d.kind === "index" ? new Date(Math.max(now.getTime(), new Date(`${d.index.effectiveFrom}T12:00:00Z`).getTime())) : now;
    const dimsByCode = new Map(structures.map((s) => [s.code, fromJson<Dims>(s.defaultDims)]));
    const samples: PreviewSample[] = structures.flatMap((s) =>
      materials.filter((m) => m.family === s.family).map((m) => ({ id: `${s.code}:${m.code}`, structureCode: s.code, materialCode: m.code, quantity: PREVIEW_QTY })),
    );
    const priceFn = (cfg: PricingConfig, s: PreviewSample, at: Date): number | null => {
      try {
        const r = quote(
          { structureCode: s.structureCode as StructureCode, dims: dimsByCode.get(s.structureCode)!, materialId: s.materialCode, finishes: [], printSides: "OUTSIDE", colours: 4, quantity: s.quantity, zone: "GREATER_CAIRO" },
          data,
          { config: cfg, now: at, skipSuggestion: true },
        );
        if (r.mode !== "instant" || r.offers.length === 0) return null;
        return Math.min(...r.offers.map((o) => o.unitPiasters));
      } catch (e) {
        if (e instanceof QuoteInputError) return null;
        throw e;
      }
    };
    return previewPriceChanges(samples, priceFn, settingsToConfig(settings), settingsToConfig(proposedSettings), now, proposedNow);
  });
}

/* ───────────────────────── Catalogue ───────────────────────── */

export async function updateStructureAction(input: z.input<typeof structureUpdateSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(structureUpdateSchema, input);
    const s = await db.structure.findUnique({ where: { id: d.id } });
    if (!s) throw new AdminActionError("NOT_FOUND");
    const hard = STRUCTURE_LIMITS[s.code as StructureCode];
    if (hard) {
      const out = outsideHardBounds(d, hard);
      if (out.length) throw new AdminFieldErrors(Object.fromEntries(out.map((k) => [`${k}`, "OUT_OF_ENGINE_RANGE"])));
    }
    if (!defaultFits(fromJson<Dims>(s.defaultDims), d)) throw new AdminFieldErrors({ _: "DEFAULT_OUTSIDE" });
    const before = fromJson<StructureParamLimits>(s.params);
    const params = mergeLimits(before, d);
    await db.structure.update({ where: { id: s.id }, data: { params: toJson(params), active: d.active } });
    await audit(admin, { action: "STRUCTURE_UPDATE", entityType: "STRUCTURE", entityId: s.id, summary: s.code, before: { params: before, active: s.active }, after: { params, active: d.active } });
    revalidateAdmin();
    revalidatePath("/[locale]", "layout");
    return null;
  });
}

export async function updateMaterialAction(input: z.input<typeof materialUpdateSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(materialUpdateSchema, input);
    const m = await db.material.findUnique({ where: { id: d.id } });
    if (!m) throw new AdminActionError("NOT_FOUND");
    const { id, ...data } = d;
    await db.material.update({ where: { id }, data });
    await audit(admin, { action: "MATERIAL_UPDATE", entityType: "MATERIAL", entityId: m.id, summary: m.code, before: { gsm: m.gsm, thicknessMm: m.thicknessMm, foodSafe: m.foodSafe, active: m.active }, after: data });
    revalidateAdmin();
    revalidatePath("/[locale]", "layout");
    return null;
  });
}

export async function updateFinishAction(input: z.input<typeof finishUpdateSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(finishUpdateSchema, input);
    const f = await db.finish.findUnique({ where: { id: d.id } });
    if (!f) throw new AdminActionError("NOT_FOUND");
    if (f.code === "NONE" && !d.active) throw new AdminFieldErrors({ active: "NONE_REQUIRED" });
    const { id, ...data } = d;
    await db.finish.update({ where: { id }, data });
    await audit(admin, { action: "FINISH_UPDATE", entityType: "FINISH", entityId: f.id, summary: f.code, before: { unitSurchargePiasters: f.unitSurchargePiasters, setupPiasters: f.setupPiasters, active: f.active }, after: data });
    revalidateAdmin();
    revalidatePath("/[locale]", "layout");
    return null;
  });
}

/* ───────────────────────── PDPL data requests ───────────────────────── */

export async function decideDataRequestAction(input: z.input<typeof dataRequestDecisionSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(dataRequestDecisionSchema, input);
    const req = await db.dataRequest.findUnique({ where: { id: d.requestId } });
    if (!req) throw new AdminActionError("NOT_FOUND");
    if (!canDecideRequest(req.status)) throw new AdminActionError("NOT_ALLOWED");
    if (d.decision === "START" && req.status !== "OPEN") throw new AdminActionError("NOT_ALLOWED");
    const now = new Date();

    if (d.decision === "COMPLETE" && req.kind === "DELETE") {
      const user = await db.user.findUnique({ where: { id: req.userId }, include: { orders: { select: { id: true, status: true } }, disputes: { select: { status: true } } } });
      if (user) {
        if (user.role === "ADMIN") throw new AdminActionError("BLOCKED", "ADMIN_ACCOUNT");
        const blockers = deletionBlockers(user.orders, user.disputes);
        if (blockers.length) throw new AdminActionError("BLOCKED", blockers.join(","));
        await db.$transaction(async (tx) => {
          await tx.session.deleteMany({ where: { userId: user.id } });
          // Designs that never became an order are deleted; ordered ones keep the proof (tax/consumer law) but lose the name and share link.
          await tx.design.deleteMany({ where: { ownerId: user.id, proofs: { none: {} } } });
          await tx.design.updateMany({ where: { ownerId: user.id }, data: { name: "", shareToken: null, thumbnailUrl: null } });
          for (const o of user.orders) {
            const order = await tx.order.findUnique({ where: { id: o.id }, select: { shippingAddress: true } });
            const addr = order ? fromJson<Partial<ShippingAddress> | null>(order.shippingAddress) : null;
            await tx.order.update({ where: { id: o.id }, data: { shippingAddress: toJson({ name: "—", phone: "—", governorate: addr?.governorate ?? "", city: addr?.city ?? "", street: "—" }), notes: null } });
          }
          await tx.consent.updateMany({ where: { userId: user.id }, data: { phone: null, ip: null, userAgent: null } });
          await tx.user.update({
            where: { id: user.id },
            data: { name: null, email: null, phone: anonymisedPhone(user.id), marketingConsent: false, organizationId: null, vendorId: null, role: "BUYER" },
          });
          await audit(admin, { action: "USER_ANONYMISE", entityType: "USER", entityId: user.id, summary: `request ${req.id}`, before: { orders: user.orders.length }, after: { anonymised: true } }, tx);
        });
      }
    }

    const status = d.decision === "START" ? "IN_PROGRESS" : d.decision === "COMPLETE" ? "COMPLETED" : "REJECTED";
    const u = await db.dataRequest.updateMany({
      where: { id: req.id, status: req.status },
      data: { status, note: d.note || req.note, ...(status === "IN_PROGRESS" ? {} : { completedAt: now }) },
    });
    if (u.count !== 1) throw new AdminActionError("STALE");
    await audit(admin, {
      action: d.decision === "START" ? "DATA_REQUEST_START" : d.decision === "COMPLETE" ? "DATA_REQUEST_COMPLETE" : "DATA_REQUEST_REJECT",
      entityType: "DATA_REQUEST",
      entityId: req.id,
      summary: `${req.kind} user ${req.userId}${d.note ? `: ${d.note}` : ""}`,
      before: { status: req.status },
      after: { status },
    });
    revalidateAdmin();
    return null;
  });
}
