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
import { purgeCatalogCache } from "@/lib/catalog-cache";
import { loadOnTimeMinDeliveries, VENDOR_METRICS_SETTING_KEY, vendorMetricsSchema } from "@/lib/vendors/on-time-settings";
import { syncVendorOnTime } from "@/lib/vendors/on-time-sync";
import { z } from "zod";
import { db } from "@/lib/db";
import { scrubErasedUserTraces } from "@/lib/auth/erasure";
import { track } from "@/lib/analytics/track";
import { fromJson, toJson } from "@/lib/json";
import { OrderError, shipOrder, transitionOrder } from "@/lib/orders/service";
import { getPaymentProvider } from "@/lib/payments";
import { QuoteInputError, quote, type PricingConfig } from "@/lib/pricing";
import { loadPricingData } from "@/lib/pricing/server";
import { STRUCTURE_LIMITS } from "@/lib/dieline";
import type { Dims, OrderStatus, ShippingAddress, StructureCode, StructureParamLimits, VendorCapabilities } from "@/types";
import { AdminActionError, AdminFieldErrors, adminForMutation, audit, issuesToFields, runAdminAction, type AdminActionResponse } from "./context";
import { loadPricingConfig, loadPricingSettings } from "./settings";
import { seedStarterRateCards } from "./starter-rate-cards";
import { notify } from "@/lib/notify";
import { getT, type DictKey } from "@/i18n";
import {
  applyGoodsOverride,
  canOverrideCost,
  canOverridePrice,
  canReassign,
  canRefund,
  canReviewQc,
  needsManualCost,
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
  isOpenDispute,
  statusForDecision,
  vendorStatusAfter,
  vendorStatusSchema,
  defaultChargeBack,
  planReprint,
  type ReprintPlan,
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
import { leadState, leadStepSchema } from "../lib/quoteLeads";
import { checkoutSettingsFormSchema } from "../lib/checkoutSettings";
import { CHECKOUT_SETTING_KEY, loadCheckoutSettings } from "@/lib/orders/checkout-settings";
import { QUOTE_PRICED, QUOTE_REQUESTED, quoteCheckoutPath } from "@/lib/orders/quote-status";
import { priceLines, sendPriceSchema } from "../lib/quotePricing";
import { createModelDoc } from "@/components/designer/lib/doc";
import { saveDesign } from "@/components/designer/server";
import { modelByCode } from "@/lib/library";
import { bioCleanSchema, bioEditDecisionSchema, canApprovePortfolio, portfolioReviewSchema, reviewNoteRequired } from "../lib/moderation";
import { bioReviewData, canApproveBio } from "@/components/vendor/lib/bio-review";
import type { AuditAction } from "../lib/audit";
import { stripContactDetails } from "@/components/vendor/lib/contact";
import { orderModeOf, vendorListsModel } from "@/data/catalogue/order-mode";
import { canRaisePayout, payoutAmount, payoutStepSchema, STEP_FROM, STEP_TO } from "../lib/payouts";
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

/** WhatsApp "new job" to every staff member of a vendor (after a reassignment or a reprint). Never throws. */
async function notifyVendorNewJob(vendorId: string, number: string): Promise<void> {
  try {
    const staff = await db.user.findMany({ where: { vendorId, role: "VENDOR" }, select: { phone: true, locale: true } });
    for (const s of staff) await notify({ to: { phone: s.phone }, locale: s.locale === "en" ? "en" : "ar", template: "VENDOR_NEW_JOB", params: { number } });
  } catch (e) {
    console.error("[admin] vendor notification failed", e);
  }
}

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
    // Quote-only for this vendor (no active rate card for the job): the buy price must be entered.
    const item = await db.orderItem.findFirst({ where: { orderId: order.id }, select: { structureCode: true, materialCode: true, modelCode: true } });
    const card = item
      ? await db.rateCard.findFirst({ where: { vendorId: vendor.id, active: true, structure: { code: item.structureCode }, material: { code: item.materialCode } }, select: { id: true } })
      : null;
    // B-16 (R4-02): special-gluing models price instantly only from vendors that list the model;
    // preview / quote-only models never do, so the buy price is agreed by hand.
    const listsModel = vendorListsModel(orderModeOf(item?.modelCode).mode, item?.modelCode ?? "", fromJson<VendorCapabilities>(vendor.capabilities)?.models);
    if (needsManualCost(!!card && listsModel, d.vendorCostPiasters)) throw new AdminFieldErrors({ vendorCostPiasters: "COST_REQUIRED" });
    const nextStatus = statusAfterReassign(order.status as OrderStatus);
    const cost = d.vendorCostPiasters ?? order.vendorCostPiasters;
    await db.$transaction(async (tx) => {
      const u = await tx.order.updateMany({
        where: { id: order.id, status: order.status, vendorId: order.vendorId },
        data: { vendorId: vendor.id, status: nextStatus, vendorCostPiasters: cost },
      });
      if (u.count !== 1) throw new AdminActionError("STALE");
      // R4-01: an unpaid advance was earned by the OLD vendor's acceptance, at the OLD buy price.
      // The new vendor must accept again (ACCEPTED goes back to PAID) and earns its own advance at
      // the new price then, so the unpaid row is voided rather than handed over. A paid advance
      // stays with the old vendor (recovered off-platform) and is kept in the audit row below.
      const voided = await tx.payout.findMany({ where: { orderId: order.id, kind: "ADVANCE", status: { in: ["PENDING", "APPROVED"] } }, select: { id: true, amountPiasters: true, status: true, vendorId: true } });
      if (voided.length) await tx.payout.deleteMany({ where: { id: { in: voided.map((p) => p.id) } } });
      await audit(
        admin,
        {
          action: "ORDER_REASSIGN",
          entityType: "ORDER",
          entityId: order.id,
          summary: `${order.number}: ${order.vendor.nameEn} → ${vendor.nameEn}. ${d.reason}`,
          before: { vendorId: order.vendorId, status: order.status, vendorCostPiasters: order.vendorCostPiasters, unpaidAdvances: voided },
          after: { vendorId: vendor.id, status: nextStatus, vendorCostPiasters: cost, unpaidAdvances: [] },
        },
        tx,
      );
    });
    // R5-JR-05: the new vendor has 24 hours to answer, so tell its staff now (payment does the same).
    await notifyVendorNewJob(vendor.id, order.number);
    revalidateAdmin();
    return null;
  });
}

/**
 * Vendor payout step (research report §4.1 payout approvals). RAISE creates the PENDING row for a
 * part that is earned (advance: vendor accepted; balance: delivered after QC), APPROVE and PAY move
 * it on. Paying the balance needs ops to confirm the vendor's ETA e-invoice is on file.
 */
export async function payoutStepAction(input: z.input<typeof payoutStepSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(payoutStepSchema, input);
    const order = await db.order.findUnique({ where: { id: d.orderId }, include: { vendor: { select: { nameEn: true } }, payouts: true, disputes: { select: { status: true } } } });
    if (!order) throw new AdminActionError("NOT_FOUND");
    if (d.kind === "BALANCE" && order.disputes.some((x) => isOpenDispute(x.status))) throw new AdminActionError("NOT_ALLOWED", "PAYOUT_DISPUTE_HOLD");
    // Only the current vendor's part counts: after a reassignment the old vendor's paid advance
    // stays on the order but must not block raising the new vendor's own advance (R4-01).
    const existing = order.payouts.find((p) => (p.kind === "BALANCE" ? "BALANCE" : "ADVANCE") === d.kind && p.vendorId === order.vendorId) ?? null;
    if (d.step === "PAY" && d.kind === "BALANCE" && !d.eInvoice) throw new AdminFieldErrors({ eInvoice: "REQUIRED" });
    const label = `${order.number} ${d.kind.toLowerCase()} (${order.vendor.nameEn})`;
    await db.$transaction(async (tx) => {
      if (d.step === "RAISE") {
        if (existing) throw new AdminActionError("STALE");
        if (!canRaisePayout(d.kind, order.status)) throw new AdminActionError("NOT_ALLOWED", "PAYOUT_NOT_EARNED");
        const amount = payoutAmount(d.kind, order.vendorCostPiasters);
        if (amount <= 0) throw new AdminActionError("NOT_ALLOWED", "PAYOUT_ZERO");
        const row = await tx.payout.create({ data: { vendorId: order.vendorId, orderId: order.id, kind: d.kind, amountPiasters: amount, status: "PENDING" } });
        await audit(admin, { action: "PAYOUT_RAISE", entityType: "PAYOUT", entityId: row.id, summary: `${label}: ${amount / 100} EGP`, after: { status: "PENDING", amountPiasters: amount } }, tx);
        return;
      }
      if (!existing) throw new AdminActionError("NOT_FOUND");
      // Refunded or cancelled jobs: nothing more is owed (unpaid rows are removed by the refund).
      if (["REFUNDED", "CANCELLED"].includes(order.status)) throw new AdminActionError("NOT_ALLOWED", "PAYOUT_ORDER_CLOSED");
      const now = new Date();
      const u = await tx.payout.updateMany({
        where: { id: existing.id, status: STEP_FROM[d.step] },
        data: d.step === "APPROVE" ? { status: STEP_TO.APPROVE, approvedAt: now } : { status: STEP_TO.PAY, paidAt: now },
      });
      if (u.count !== 1) throw new AdminActionError("STALE");
      await audit(
        admin,
        {
          action: d.step === "APPROVE" ? "PAYOUT_APPROVE" : "PAYOUT_PAY",
          entityType: "PAYOUT",
          entityId: existing.id,
          summary: `${label}: ${existing.amountPiasters / 100} EGP${d.step === "PAY" && d.kind === "BALANCE" ? ", e-invoice on file" : ""}`,
          before: { status: existing.status },
          after: { status: STEP_TO[d.step] },
        },
        tx,
      );
    });
    revalidateAdmin();
    return null;
  });
}

/* ───────────── Printer metrics shown to buyers (R5-JR-05, admin round 8) ───────────── */

/** Minimum judged deliveries before a printer's on-time figure is public; re-syncs every printer. */
export async function saveVendorMetricsAction(input: z.input<typeof vendorMetricsSchema>): Promise<AdminActionResponse<{ updated: number }>> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(vendorMetricsSchema, input);
    const before = await loadOnTimeMinDeliveries();
    await db.$transaction(async (tx) => {
      await tx.platformSetting.upsert({
        where: { key: VENDOR_METRICS_SETTING_KEY },
        create: { key: VENDOR_METRICS_SETTING_KEY, value: toJson(d), updatedById: admin.id },
        update: { value: toJson(d), updatedById: admin.id },
      });
      await audit(admin, { action: "VENDOR_METRICS_SETTINGS", entityType: "SETTINGS", entityId: VENDOR_METRICS_SETTING_KEY, summary: `On-time shown after ${d.onTimeMinDeliveries} deliveries`, before: { onTimeMinDeliveries: before }, after: d }, tx);
    });
    const r = await syncVendorOnTime();
    revalidateAdmin();
    purgeCatalogCache();
    return r;
  });
}

/* ───────────────────────── Checkout settings (B-05, B-11) ───────────────────────── */

export async function saveCheckoutSettingsAction(input: z.input<typeof checkoutSettingsFormSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(checkoutSettingsFormSchema, input);
    const before = await loadCheckoutSettings();
    await db.$transaction(async (tx) => {
      await tx.platformSetting.upsert({
        where: { key: CHECKOUT_SETTING_KEY },
        create: { key: CHECKOUT_SETTING_KEY, value: toJson(d), updatedById: admin.id },
        update: { value: toJson(d), updatedById: admin.id },
      });
      await audit(admin, { action: "CHECKOUT_SETTINGS", entityType: "SETTINGS", entityId: CHECKOUT_SETTING_KEY, summary: `prepay ${d.prepayDiscountPct}%, sample ${d.sample.enabled ? "on" : "off"}`, before, after: d }, tx);
    });
    revalidateAdmin();
    revalidatePath("/[locale]/(checkout)/checkout/[designId]", "page"); // route-group path (R4-10)
    purgeCatalogCache(); // r6-why: /pricing and /why-elba show the prepay discount and the sample price
    return null;
  });
}

/* ───────────────────────── Quote leads (B-15) ───────────────────────── */

/** Record the ops follow-up on a quote request (contacted / closed) in the audit log. */
export async function quoteLeadStepAction(input: z.input<typeof leadStepSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(leadStepSchema, input);
    const q = await db.quote.findUnique({ where: { id: d.quoteId }, select: { id: true, status: true, validUntil: true } });
    if (!q || (q.status !== QUOTE_REQUESTED && q.status !== QUOTE_PRICED)) throw new AdminActionError("NOT_FOUND");
    // A sent price is followed up by closing it (or by the buyer paying); "contacted" is for open requests.
    if (q.status === QUOTE_PRICED && d.step !== "CLOSED") throw new AdminActionError("NOT_ALLOWED");
    const events = await db.auditLog.findMany({ where: { entityType: "QUOTE", entityId: q.id, action: { in: ["QUOTE_CONTACTED", "QUOTE_CLOSED", "QUOTE_PRICED"] } }, select: { action: true, createdAt: true } });
    if (leadState(events) === "CLOSED") throw new AdminActionError("NOT_ALLOWED");
    const now = new Date();
    await db.$transaction(async (tx) => {
      // Closing a sent price withdraws the buyer's link: checkout accepts a PRICED quote only while
      // validUntil is in the future, so it is ended now (the row and its lines stay for the record).
      if (q.status === QUOTE_PRICED) {
        const u = await tx.quote.updateMany({ where: { id: q.id, status: QUOTE_PRICED }, data: { validUntil: now < q.validUntil ? now : q.validUntil } });
        if (u.count !== 1) throw new AdminActionError("STALE");
      }
      await audit(
        admin,
        { action: d.step === "CONTACTED" ? "QUOTE_CONTACTED" : "QUOTE_CLOSED", entityType: "QUOTE", entityId: q.id, summary: d.note, ...(q.status === QUOTE_PRICED ? { before: { validUntil: q.validUntil }, after: { validUntil: now < q.validUntil ? now : q.validUntil } } : {}) },
        tx,
      );
    });
    revalidateAdmin();
    revalidatePath("/[locale]/(store)/account", "page");
    return null;
  });
}

/**
 * R4-B-03 (admin half): send a fixed price for a quote lead. The lead's own Quote row becomes
 * PRICED with the printer, ex-VAT lines (engine line kinds), totals with 14% VAT, validUntil from
 * the admin quote-validity setting, pricedAt, deliveryDays and the printer's agreed buy price. The
 * buyer pays it through checkout's quoted path (`/checkout/<design>?quote=<id>`), which lifts the
 * 2,000-box cap and the quote-only rule for this quote only. Sending again before the buyer pays
 * replaces the price and restarts the validity. A catalogue request has no design: one is created
 * in the buyer's account from the requested model and size (plain artwork they can edit first),
 * so the same checkout path applies.
 */
export async function sendQuotePriceAction(input: z.input<typeof sendPriceSchema>): Promise<AdminActionResponse<{ path: string; validUntil: string; totalPiasters: number }>> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(sendPriceSchema, input);
    const q = await db.quote.findUnique({ where: { id: d.quoteId }, include: { user: { select: { id: true, name: true, phone: true, role: true, locale: true } } } });
    if (!q || (q.status !== QUOTE_REQUESTED && q.status !== QUOTE_PRICED)) throw new AdminActionError("NOT_FOUND");
    if (!q.user) throw new AdminActionError("NOT_ALLOWED", "QUOTE_NO_BUYER");
    const events = await db.auditLog.findMany({ where: { entityType: "QUOTE", entityId: q.id, action: { in: ["QUOTE_CONTACTED", "QUOTE_CLOSED", "QUOTE_PRICED"] } }, select: { action: true, createdAt: true } });
    if (leadState(events) === "CLOSED") throw new AdminActionError("NOT_ALLOWED");
    const vendor = await db.vendor.findUnique({ where: { id: d.vendorId }, select: { id: true, nameEn: true, status: true } });
    if (!vendor || vendor.status !== "ACTIVE") throw new AdminFieldErrors({ vendorId: "VENDOR_INACTIVE" });
    const priced = priceLines(d);

    // A catalogue request has no design yet: make one for the buyer from the requested model.
    let designId = q.designId;
    let designCreated = false;
    if (!designId) {
      const line = (fromJson<Record<string, unknown>[]>(q.lines) ?? [])[0] ?? {};
      const model = modelByCode(typeof line.modelCode === "string" ? line.modelCode : null);
      if (!model) throw new AdminActionError("NOT_ALLOWED", "QUOTE_NO_MODEL");
      const dims = line.dims as { L?: number; W?: number; H?: number } | undefined;
      const name = line.name && typeof line.name === "object" ? (line.name as { ar?: string; en?: string }) : {};
      const doc = createModelDoc(model, {
        presetId: typeof line.presetId === "string" ? line.presetId : undefined,
        dims: model.kind === "box" && dims && [dims.L, dims.W, dims.H].every((n) => typeof n === "number" && n > 0) ? { L: dims.L!, W: dims.W!, H: dims.H! } : undefined,
        name: ((q.user.locale === "en" ? name.en : name.ar) ?? model.name[q.user.locale === "en" ? "en" : "ar"]).slice(0, 80),
      });
      const saved = await saveDesign(doc, { user: { id: q.user.id, role: q.user.role } as never, anonId: null });
      if (!saved.ok) throw new AdminActionError("NOT_ALLOWED", "QUOTE_NO_MODEL");
      designId = saved.id;
      designCreated = true;
    }

    const now = new Date();
    const validUntil = new Date(now.getTime() + (await loadPricingConfig()).quoteValidityHours * 3_600_000);
    const data = {
      vendorId: vendor.id,
      designId,
      lines: toJson(priced.lines),
      subtotalPiasters: priced.subtotalPiasters,
      vatPiasters: priced.vatPiasters,
      shippingPiasters: priced.shippingPiasters,
      totalPiasters: priced.totalPiasters,
      validUntil,
      status: QUOTE_PRICED,
      pricedAt: now,
      deliveryDays: d.deliveryDays,
      vendorCostPiasters: d.vendorCostPiasters,
    };
    await db.$transaction(async (tx) => {
      const u = await tx.quote.updateMany({ where: { id: q.id, status: q.status, validUntil: q.validUntil }, data });
      if (u.count !== 1) throw new AdminActionError("STALE");
      await audit(
        admin,
        {
          action: "QUOTE_PRICED",
          entityType: "QUOTE",
          entityId: q.id,
          summary: `${d.quantity.toLocaleString("en-US")} boxes · ${vendor.nameEn} · EGP ${(priced.totalPiasters / 100).toFixed(2)} incl. VAT${d.note ? `. ${d.note}` : ""}`,
          before: { status: q.status, vendorId: q.vendorId, totalPiasters: q.totalPiasters, validUntil: q.validUntil, designId: q.designId },
          after: { ...data, lines: priced.lines, designCreated },
        },
        tx,
      );
    });
    revalidateAdmin();
    revalidatePath("/[locale]/(store)/account", "page");
    const path = quoteCheckoutPath(q.user.locale === "en" ? "en" : "ar", { id: q.id, designId })!;
    return { path, validUntil: validUntil.toISOString(), totalPiasters: priced.totalPiasters };
  });
}

/* ───────────────────────── Moderation (B-08) ───────────────────────── */

/** Approve or reject a vendor portfolio photo. Captions with contact details cannot be approved. */
export async function reviewPortfolioAction(input: z.input<typeof portfolioReviewSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(portfolioReviewSchema, input);
    if (reviewNoteRequired(d.decision, d.note)) throw new AdminFieldErrors({ note: "NOTE_REQUIRED" });
    const item = await db.vendorPortfolioItem.findUnique({ where: { id: d.itemId }, include: { vendor: { select: { nameEn: true } } } });
    if (!item) throw new AdminActionError("NOT_FOUND");
    if (d.decision === "APPROVE" && !canApprovePortfolio(item)) throw new AdminActionError("NOT_ALLOWED", item.status === "PENDING" ? "CONTACT_IN_CAPTION" : "");
    const status = d.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await db.$transaction(async (tx) => {
      const u = await tx.vendorPortfolioItem.updateMany({ where: { id: item.id, status: item.status }, data: { status, reviewNote: d.note?.trim() || null } });
      if (u.count !== 1) throw new AdminActionError("STALE");
      await audit(
        admin,
        { action: d.decision === "APPROVE" ? "PORTFOLIO_APPROVE" : "PORTFOLIO_REJECT", entityType: "VENDOR", entityId: item.vendorId, summary: `${item.vendor.nameEn} photo "${(item.captionEn || item.captionAr).slice(0, 60)}"${d.note ? `: ${d.note}` : ""}`, before: { itemId: item.id, status: item.status }, after: { itemId: item.id, status } },
        tx,
      );
    });
    revalidateAdmin();
    // R4-10: the route lives under the (store) group, so this pattern without it matched nothing and
    // the public profile kept a rejected photo or an uncleaned bio for up to the 1 h ISR window.
    purgeCatalogCache();
    return null;
  });
}

/** Remove contact details from a vendor bio (sentences holding them go), audited with the old text. */
export async function cleanBioAction(input: z.input<typeof bioCleanSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(bioCleanSchema, input);
    const v = await db.vendor.findUnique({ where: { id: d.vendorId }, select: { id: true, nameEn: true, bioAr: true, bioEn: true, updatedAt: true } });
    if (!v) throw new AdminActionError("NOT_FOUND");
    const after = { bioAr: stripContactDetails(v.bioAr), bioEn: stripContactDetails(v.bioEn) };
    if (after.bioAr === v.bioAr && after.bioEn === v.bioEn) throw new AdminActionError("STALE");
    await db.$transaction(async (tx) => {
      const u = await tx.vendor.updateMany({ where: { id: v.id, bioAr: v.bioAr, bioEn: v.bioEn }, data: after });
      if (u.count !== 1) throw new AdminActionError("STALE");
      await audit(admin, { action: "VENDOR_BIO_CLEAN", entityType: "VENDOR", entityId: v.id, summary: `${v.nameEn}: contact details removed from bio`, before: { bioAr: v.bioAr, bioEn: v.bioEn }, after }, tx);
    });
    revalidateAdmin();
    // R4-10: the route lives under the (store) group, so this pattern without it matched nothing and
    // the public profile kept a rejected photo or an uncleaned bio for up to the 1 h ISR window.
    purgeCatalogCache();
    return null;
  });
}

/**
 * R6-05 / R4-B-02 (admin half): decide a vendor's bio edit. Approve copies the edit live (only if
 * the contact filter passes) and purges the public catalogue cache; reject keeps the edit with a
 * reason the vendor sees; clean removes the sentences with contact details from the waiting text,
 * which stays in review so a person still approves it. Every decision is audited with both texts.
 */
export async function reviewBioEditAction(input: z.input<typeof bioEditDecisionSchema>): Promise<AdminActionResponse> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(bioEditDecisionSchema, input);
    if (d.decision === "REJECT" && reviewNoteRequired("REJECT", d.note)) throw new AdminFieldErrors({ note: "NOTE_REQUIRED" });
    const v = await db.vendor.findUnique({
      where: { id: d.vendorId },
      select: { id: true, nameEn: true, bioAr: true, bioEn: true, bioArPending: true, bioEnPending: true, bioReviewStatus: true, bioReviewNote: true, bioSubmittedAt: true },
    });
    if (!v) throw new AdminActionError("NOT_FOUND");
    // The reviewer decides on the edit they saw: a newer save (or a decision by someone else) is stale.
    if (v.bioReviewStatus !== "PENDING" || (v.bioSubmittedAt?.toISOString() ?? null) !== d.submittedAt) throw new AdminActionError("STALE");
    let data: Record<string, unknown>;
    let action: AuditAction;
    if (d.decision === "APPROVE") {
      if (!canApproveBio(v)) throw new AdminActionError("NOT_ALLOWED", "CONTACT_IN_BIO");
      data = bioReviewData("APPROVE", v);
      action = "VENDOR_BIO_APPROVE";
    } else if (d.decision === "REJECT") {
      data = bioReviewData("REJECT", v, d.note);
      action = "VENDOR_BIO_REJECT";
    } else {
      const cleaned = { bioArPending: stripContactDetails(v.bioArPending ?? v.bioAr), bioEnPending: stripContactDetails(v.bioEnPending ?? v.bioEn) };
      if (cleaned.bioArPending === (v.bioArPending ?? v.bioAr) && cleaned.bioEnPending === (v.bioEnPending ?? v.bioEn)) throw new AdminActionError("STALE");
      data = cleaned;
      action = "VENDOR_BIO_CLEAN";
    }
    await db.$transaction(async (tx) => {
      const u = await tx.vendor.updateMany({ where: { id: v.id, bioReviewStatus: "PENDING", bioSubmittedAt: v.bioSubmittedAt, bioArPending: v.bioArPending, bioEnPending: v.bioEnPending }, data });
      if (u.count !== 1) throw new AdminActionError("STALE");
      const summary =
        d.decision === "APPROVE" ? `${v.nameEn}: bio edit approved and public` : d.decision === "REJECT" ? `${v.nameEn}: bio edit not approved. ${d.note ?? ""}`.trim() : `${v.nameEn}: contact details removed from the bio edit`;
      await audit(
        admin,
        {
          action,
          entityType: "VENDOR",
          entityId: v.id,
          summary,
          before: { bioAr: v.bioAr, bioEn: v.bioEn, bioArPending: v.bioArPending, bioEnPending: v.bioEnPending, bioReviewStatus: v.bioReviewStatus },
          after: data,
        },
        tx,
      );
    });
    revalidateAdmin();
    revalidatePath("/[locale]/vendor", "layout"); // the vendor's "waiting for review" banner
    if (d.decision === "APPROVE") purgeCatalogCache(); // the public profile is cached (catalog tag)
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
    // Added by technical R4-01: claim the payment (PAID → REFUNDED, conditional) BEFORE asking the
    // gateway, so a double click, a second tab or two admins cannot send the same refund twice
    // (OWASP ASVS 4.0.3 V11.1.6). A declined refund releases the claim; an unknown outcome (timeout,
    // network error) keeps it and leaves a note, because retrying could refund twice.
    const claim = await db.payment.updateMany({ where: { id: p.id, status: "PAID" }, data: { status: "REFUNDED" } });
    if (claim.count !== 1) continue;
    const provider = getPaymentProvider(p.provider === "paymob" ? "paymob" : "mock");
    let r: Awaited<ReturnType<typeof provider.refund>>;
    try {
      r = await provider.refund({ providerRef: p.providerRef ?? "", amountPiasters: p.amountPiasters, reason });
    } catch (e) {
      await db.productionEvent.create({ data: { orderId: order.id, type: "NOTE", note: `REFUND_UNCONFIRMED:${p.id}`, actorId: admin.id } });
      throw new AdminActionError("PAYMENT_FAILED", String((e as Error)?.message ?? e).slice(0, 120));
    }
    if (!r.ok) {
      await db.payment.updateMany({ where: { id: p.id, status: "REFUNDED" }, data: { status: "PAID" } });
      throw new AdminActionError("PAYMENT_FAILED", r.error);
    }
    refs.push(r.refundRef ?? "");
    const raw = (p.raw && typeof p.raw === "object" && !Array.isArray(p.raw) ? p.raw : {}) as Record<string, unknown>;
    await db.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", raw: toJson({ ...raw, refund: { ref: r.refundRef, at: new Date().toISOString(), by: admin.id } }) } });
  }
  // Every PAID payment was claimed by a concurrent refund of the same order: nothing left to do here.
  if (paid.length && !refs.length) throw new AdminActionError("STALE");
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

const shipSchema = z.object({ orderId: z.string().min(1).max(64) });

/** Book the courier pickup for a QC-approved order (READY_TO_SHIP → SHIPPED via shipOrder()). */
export async function shipOrderAction(input: z.input<typeof shipSchema>): Promise<AdminActionResponse<{ trackingNumber: string }>> {
  return runAdminAction(async () => {
    const admin = await adminForMutation();
    const d = parse(shipSchema, input);
    const order = await db.order.findUnique({ where: { id: d.orderId }, select: { id: true, number: true, status: true } });
    if (!order) throw new AdminActionError("NOT_FOUND");
    if (order.status !== "READY_TO_SHIP") throw new AdminActionError("NOT_ALLOWED");
    let trackingNumber: string;
    try {
      ({ trackingNumber } = await shipOrder(order.id, { role: "ADMIN", userId: admin.id }));
    } catch (e) {
      if (e instanceof OrderError) throw new AdminActionError("NOT_ALLOWED");
      throw e;
    }
    await audit(admin, {
      action: "ORDER_SHIP",
      entityType: "ORDER",
      entityId: order.id,
      summary: `${order.number}: ${trackingNumber}`,
      before: { status: order.status },
      after: { status: "SHIPPED", trackingNumber },
    });
    revalidateAdmin();
    return { trackingNumber };
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
    let reprintPlan: ReprintPlan | undefined;

    if (d.decision === "REFUND") {
      await refundOrderInternal(admin, dispute.orderId, d.note, dispute.id);
    }
    if (d.decision === "REPRINT") {
      const original = dispute.order;
      const vendorId = d.vendorId ?? original.vendorId;
      const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor || vendor.status !== "ACTIVE") throw new AdminActionError("NOT_ALLOWED", "VENDOR_INACTIVE");
      // R5-JR-09: only the defective boxes are redone, and the charge-back is the admin's choice.
      const originalQty = original.items.reduce((s, i) => s + i.quantity, 0) || 1;
      const paid = await db.payout.findMany({ where: { orderId: original.id, vendorId: original.vendorId, status: "PAID" }, select: { amountPiasters: true } });
      const plan = planReprint({
        originalQty,
        originalCostPiasters: original.vendorCostPiasters,
        paidToOriginalPiasters: paid.reduce((s, p) => s + p.amountPiasters, 0),
        sameVendor: vendorId === original.vendorId,
        terms: { quantity: d.reprintQuantity ?? originalQty, chargeBack: d.chargeBack ?? defaultChargeBack(dispute.reason), chargeBackPiasters: d.chargeBackPiasters },
      });
      if (plan === "QTY_RANGE") throw new AdminFieldErrors({ reprintQuantity: "REPRINT_QTY_RANGE" });
      if (plan === "CHARGE_RANGE") throw new AdminFieldErrors({ chargeBackPiasters: "CHARGE_BACK_RANGE" });
      reprintPlan = plan;
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
          vendorCostPiasters: plan.reprintVendorCostPiasters,
          shippingAddress: original.shippingAddress ?? toJson<ShippingAddress | null>(null),
          notes: reprintNote(original.number, dispute.id),
          placedAt: now,
          paidAt: now,
          dueDate: new Date(now.getTime() + lead * 86_400_000),
          items: {
            // One line per original item, scaled to the reprinted share (one-item orders: exact).
            create: original.items.map((i) => ({
              proofId: i.proofId,
              structureCode: i.structureCode,
              // R5-JR-02: keep the model and the configured finishes (gold vs silver foil, masks),
              // or the reprint is made as the base box with a generic "Hot foil".
              modelCode: i.modelCode,
              config: i.config ?? undefined,
              dims: i.dims ?? toJson<Dims | null>(null),
              materialCode: i.materialCode,
              finishCode: i.finishCode,
              printSides: i.printSides,
              quantity: original.items.length === 1 ? plan.quantity : Math.max(1, Math.round((i.quantity * plan.quantity) / originalQty)),
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
      // launch-metrics.md §1 `reprint_opened` (reprint rate = these / delivered orders).
      void track("reprint_opened", { reason: dispute.reason, same_vendor: vendorId === original.vendorId }, { userId: original.buyerId, orderId: created.id });
      // Charge-back on another printer: the original buy price goes down (its balance shrinks).
      if (plan.originalVendorCostPiasters !== original.vendorCostPiasters) {
        await db.order.update({ where: { id: original.id }, data: { vendorCostPiasters: plan.originalVendorCostPiasters } });
      }
      await audit(admin, {
        action: "ORDER_REPRINT",
        entityType: "ORDER",
        entityId: created.id,
        summary: `${reprint} ← ${original.number}: ${plan.quantity.toLocaleString("en-US")} of ${originalQty.toLocaleString("en-US")} boxes; charge-back EGP ${(plan.chargeBackPiasters / 100).toFixed(2)}. ${d.note}`,
        before: { originalVendorCostPiasters: original.vendorCostPiasters },
        after: { vendorId, chargeBack: d.chargeBack ?? defaultChargeBack(dispute.reason), ...plan },
      });
      await notifyVendorNewJob(vendorId, created.number);
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
      after: { status, ...(reprint ? { reprint, ...reprintPlan } : {}) },
    });
    // R5-JR-16: tell the buyer the outcome (the order page shows it, with the reprint to track).
    if (d.decision !== "REVIEW") {
      try {
        const buyer = await db.user.findUnique({ where: { id: dispute.order.buyerId }, select: { phone: true, locale: true } });
        if (buyer) {
          const loc = buyer.locale === "en" ? "en" : "ar";
          await notify({ to: { phone: buyer.phone }, locale: loc, template: "STATUS_CHANGED", params: { number: dispute.order.number, status: getT(loc)(`orders.dispute.status.${status}` as DictKey) } });
        }
      } catch (e) {
        console.error("[admin] dispute notification failed", e);
      }
    }
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
        // R5-JR-01: paused starter rate cards, so the new vendor can review prices and go live.
        await seedStarterRateCards(tx, app.vendorId);
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
    purgeCatalogCache(); // public "from" prices use this config (R4-04)
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
    purgeCatalogCache(); // public "from" prices use this config (R4-04)
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
          // First-party analytics rows of this user (B-19): deleting them also drops the
          // account_created row that linked the anonymous browser id to the account.
          await tx.event.deleteMany({ where: { userId: user.id } });
          // R5-SEC-02: phone, IP and free text in their audit rows, quote lines and privacy requests.
          await scrubErasedUserTraces(tx, user.id);
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
