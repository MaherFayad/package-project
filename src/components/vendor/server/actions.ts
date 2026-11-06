"use server";

/**
 * Vendor portal server actions. Every action:
 *  1. authenticates (signed-in VENDOR/ADMIN linked to an ACTIVE vendor; see vendorForMutation),
 *  2. validates its input with zod,
 *  3. scopes every query by the caller's vendorId (no cross-vendor access),
 *  4. re-checks the job state machine and the shared order graph (src/lib/orders/state.ts).
 */
import { access } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { purgeCatalogCache } from "@/lib/catalog-cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { toJson, fromJson } from "@/lib/json";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/auth/session";
import { getDictionary } from "@/i18n";
import { assertTransition, OrderTransitionError } from "@/lib/orders/state";
import type { FinishCode, OrderStatus, StructureCode, VendorCapabilities, VendorCertification } from "@/types";
import { FINISH_CODES, LOCALES } from "@/types";
import { DECLINE_REASONS, can, declineNote, eventFor, nextStatus, type JobAction } from "../lib/jobs";
import { splitVendorCost } from "../lib/payouts";
import { rateCardFormSchema, validateRateCard } from "../lib/rateCard";
import { isFoodSafe, isPermutation, issuesToErrors, mergeCertifications, portfolioCaptionSchema, profileSchema, splitContact, MAX_PORTFOLIO_ITEMS } from "../lib/profile";
import { applicationSchema, slugify, uniqueSlug } from "../lib/application";
import { keyFromUrl, parseKey } from "../lib/files";
import { listedBases } from "../lib/coverage";
import { bioSaveData } from "../lib/bio-review";
import { FieldErrors, VendorActionError, runAction, vendorForMutation, type ActionResponse } from "./context";
import { deleteUpload, uploadRoot } from "./storage";
import path from "node:path";

const id = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/);

function revalidatePortal() {
  revalidatePath("/[locale]/vendor", "layout");
}
function revalidatePublic() {
  // Vendor profile pages on the storefront (and lists that show the vendor).
  revalidatePath("/[locale]", "layout");
}

/* ───────────────────────── Jobs ───────────────────────── */

async function loadJob(vendorId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, vendorId },
    include: {
      productionEvents: { select: { type: true, createdAt: true } },
      qcPhotos: { select: { kind: true, status: true } },
      payouts: { select: { kind: true } },
    },
  });
  if (!order) throw new VendorActionError("NOT_FOUND");
  return order;
}

async function moveJob(orderId: string, action: JobAction, note?: string | null) {
  const { user, vendor } = await vendorForMutation();
  const order = await loadJob(vendor.id, orderId);
  const state = { status: order.status, paidAt: order.paidAt, events: order.productionEvents, qcPhotos: order.qcPhotos };
  if (!can(state, action)) throw new VendorActionError("NOT_ALLOWED");
  const to = nextStatus(action);
  if (to) {
    try {
      assertTransition(order.status as OrderStatus, to, "VENDOR");
    } catch (e) {
      if (e instanceof OrderTransitionError) throw new VendorActionError("NOT_ALLOWED");
      throw e;
    }
  }
  const type = eventFor(action);
  await db.$transaction(async (tx) => {
    if (to) {
      // Optimistic lock on the status we checked: a concurrent change makes this a no-op.
      const r = await tx.order.updateMany({ where: { id: order.id, vendorId: vendor.id, status: order.status }, data: { status: to } });
      if (r.count !== 1) throw new VendorActionError("STALE");
    }
    if (type) await tx.productionEvent.create({ data: { orderId: order.id, type, note: note ?? null, actorId: user.id } });
    if (action === "accept" && !order.payouts.some((p) => p.kind === "ADVANCE")) {
      const { advance } = splitVendorCost(order.vendorCostPiasters);
      if (advance > 0) await tx.payout.create({ data: { vendorId: vendor.id, orderId: order.id, kind: "ADVANCE", amountPiasters: advance, status: "PENDING" } });
    }
  });
  revalidatePortal();
}

export async function acceptJob(orderId: string): Promise<ActionResponse<null>> {
  return runAction(async () => {
    await moveJob(id.parse(orderId), "accept");
    return null;
  });
}

export async function startProduction(orderId: string): Promise<ActionResponse<null>> {
  return runAction(async () => {
    await moveJob(id.parse(orderId), "startProduction");
    return null;
  });
}

export async function submitQc(orderId: string): Promise<ActionResponse<null>> {
  return runAction(async () => {
    await moveJob(id.parse(orderId), "submitQc");
    return null;
  });
}

const declineSchema = z.object({ orderId: id, reason: z.enum(DECLINE_REASONS), detail: z.string().max(500).default("") });

export async function declineJob(input: z.input<typeof declineSchema>): Promise<ActionResponse<null>> {
  return runAction(async () => {
    const p = declineSchema.safeParse(input);
    if (!p.success) throw new VendorActionError("INVALID");
    await moveJob(p.data.orderId, "decline", declineNote(p.data.reason, p.data.detail));
    return null;
  });
}

const noteSchema = z.object({ orderId: id, note: z.string().trim().min(1).max(1000) });

export async function addJobNote(input: z.input<typeof noteSchema>): Promise<ActionResponse<null>> {
  return runAction(async () => {
    const p = noteSchema.safeParse(input);
    if (!p.success) throw new VendorActionError("INVALID");
    const { user } = await vendorForMutation();
    if (!rateLimit("vendor-note", user.id, 30, 60_000).ok) throw new VendorActionError("RATE_LIMITED");
    await moveJob(p.data.orderId, "addNote", p.data.note);
    return null;
  });
}

export async function deleteQcPhoto(photoId: string): Promise<ActionResponse<null>> {
  return runAction(async () => {
    const pid = id.parse(photoId);
    const { vendor } = await vendorForMutation();
    const photo = await db.qcPhoto.findFirst({ where: { id: pid, order: { vendorId: vendor.id } }, include: { order: { select: { status: true } } } });
    if (!photo) throw new VendorActionError("NOT_FOUND");
    if (photo.status !== "PENDING" || photo.order.status !== "IN_PRODUCTION") throw new VendorActionError("NOT_ALLOWED");
    await db.qcPhoto.delete({ where: { id: photo.id } });
    const key = keyFromUrl(photo.url);
    if (key) await deleteUpload(key);
    revalidatePortal();
    return null;
  });
}

/* ───────────────────────── Profile ───────────────────────── */

export async function saveProfile(input: unknown, expectedUpdatedAt?: string): Promise<ActionResponse<{ updatedAt: string }>> {
  return runAction(async () => {
    const { vendor } = await vendorForMutation();
    const p = profileSchema.safeParse(input);
    if (!p.success) throw new FieldErrors(issuesToErrors(p.error.issues));
    if (expectedUpdatedAt && vendor.updatedAt.toISOString() !== expectedUpdatedAt) throw new VendorActionError("STALE");
    const v = p.data;
    // Certificate documents must be this vendor's own uploads.
    const fields: Record<string, string> = {};
    v.certifications.forEach((c, i) => {
      if (!c.documentKey) return;
      const k = parseKey(c.documentKey);
      if (!k || k.scope !== "cert" || k.ownerId !== vendor.id) fields[`certifications.${i}.documentKey`] = "KEY";
    });
    // R4: a special-gluing model is priced with its base style's rate card, so that style must be on.
    const bases = listedBases();
    if (v.models.some((c) => !bases.get(c)?.some((b) => v.structures.includes(b)))) fields.models = "MODEL_NEEDS_STYLE";
    if (Object.keys(fields).length) throw new FieldErrors(fields);

    const prevCerts = fromJson<VendorCertification[]>(vendor.certifications) ?? [];
    const certifications = mergeCertifications(prevCerts, v.certifications);
    const prevCaps = fromJson<VendorCapabilities>(vendor.capabilities);
    const capabilities: VendorCapabilities = {
      ...prevCaps,
      structures: v.structures,
      materials: v.materials,
      finishes: Array.from(new Set<FinishCode>(["NONE", ...v.finishes])),
      maxColors: v.maxColors,
      digitalShortRun: v.digitalShortRun,
      monthlyCapacityUnits: v.monthlyCapacityUnits,
      models: v.models,
    };
    const updated = await db.vendor.update({
      where: { id: vendor.id },
      data: {
        // B-08 / R5: a changed bio waits for Elba's review; the live bio stays public meanwhile.
        ...bioSaveData(vendor, { bioAr: v.bioAr, bioEn: v.bioEn }),
        machines: toJson(v.machines),
        capabilities: toJson(capabilities),
        certifications: toJson(certifications),
        foodSafe: isFoodSafe(certifications),
        leadTimeDays: v.leadTimeDays,
        minOrderQty: v.minOrderQty,
        serviceAreas: toJson(v.serviceAreas),
      },
    });
    revalidatePublic();
    return { updatedAt: updated.updatedAt.toISOString() };
  });
}

/* ───────────────────────── Portfolio ───────────────────────── */

const captionInput = portfolioCaptionSchema.extend({ id });

export async function updatePortfolioItem(input: z.input<typeof captionInput>): Promise<ActionResponse<null>> {
  return runAction(async () => {
    const { vendor } = await vendorForMutation();
    const p = captionInput.safeParse(input);
    if (!p.success) throw new FieldErrors(issuesToErrors(p.error.issues));
    // R6: a site or number split across captions (this photo's and the others') is blocked too.
    // Captions in display order, this photo's new text in its own slot.
    const all = (await db.vendorPortfolioItem.findMany({ where: { vendorId: vendor.id }, orderBy: { sortOrder: "asc" }, select: { id: true, captionAr: true, captionEn: true } })).map((o) =>
      o.id === p.data.id ? { ...o, captionAr: p.data.captionAr, captionEn: p.data.captionEn } : o,
    );
    if (splitContact(all.map((o) => o.captionEn)) || splitContact(all.map((o) => o.captionAr)) || splitContact(all.flatMap((o) => [o.captionAr, o.captionEn]))) {
      throw new FieldErrors({ captionEn: "CONTACT_SPLIT" });
    }
    const r = await db.vendorPortfolioItem.updateMany({
      where: { id: p.data.id, vendorId: vendor.id },
      data: { captionAr: p.data.captionAr, captionEn: p.data.captionEn, structureCode: p.data.structureCode },
    });
    if (r.count !== 1) throw new VendorActionError("NOT_FOUND");
    revalidatePublic();
    return null;
  });
}

export async function reorderPortfolio(ids: string[]): Promise<ActionResponse<null>> {
  return runAction(async () => {
    const { vendor } = await vendorForMutation();
    const parsed = z.array(id).max(MAX_PORTFOLIO_ITEMS * 2).safeParse(ids);
    if (!parsed.success) throw new VendorActionError("INVALID");
    const stored = await db.vendorPortfolioItem.findMany({ where: { vendorId: vendor.id }, select: { id: true } });
    if (!isPermutation(stored.map((s) => s.id), parsed.data)) throw new VendorActionError("STALE");
    await db.$transaction(parsed.data.map((pid, i) => db.vendorPortfolioItem.update({ where: { id: pid }, data: { sortOrder: i } })));
    revalidatePublic();
    return null;
  });
}

export async function deletePortfolioItem(itemId: string): Promise<ActionResponse<null>> {
  return runAction(async () => {
    const { vendor } = await vendorForMutation();
    const item = await db.vendorPortfolioItem.findFirst({ where: { id: id.parse(itemId), vendorId: vendor.id } });
    if (!item) throw new VendorActionError("NOT_FOUND");
    await db.vendorPortfolioItem.delete({ where: { id: item.id } });
    const key = keyFromUrl(item.imageUrl);
    if (key) await deleteUpload(key);
    revalidatePublic();
    return null;
  });
}

/* ───────────────────────── Rate cards ───────────────────────── */

export async function saveRateCard(cardId: string, form: unknown, expectedUpdatedAt?: string): Promise<ActionResponse<{ updatedAt: string }>> {
  return runAction(async () => {
    const { vendor } = await vendorForMutation();
    const parsed = rateCardFormSchema.safeParse(form);
    if (!parsed.success) throw new VendorActionError("INVALID");
    const card = await db.rateCard.findFirst({ where: { id: id.parse(cardId), vendorId: vendor.id }, include: { structure: { select: { code: true } } } });
    if (!card) throw new VendorActionError("NOT_FOUND");
    if (expectedUpdatedAt && card.updatedAt.toISOString() !== expectedUpdatedAt) throw new VendorActionError("STALE");
    const caps = fromJson<VendorCapabilities>(vendor.capabilities);
    const offered = FINISH_CODES.filter((f) => caps?.finishes?.includes(f));
    const result = validateRateCard(parsed.data, card.structure.code as StructureCode, offered);
    if (!result.ok) throw new FieldErrors(result.errors as Record<string, string>);
    const v = result.value;
    const updated = await db.rateCard.update({
      where: { id: card.id },
      data: {
        qtyTiers: toJson(v.qtyTiers),
        setupPiasters: v.setupPiasters,
        dieCostPiasters: v.dieCostPiasters,
        leadTimeDays: v.leadTimeDays,
        printSidesSurchargePct: v.printSidesSurchargePct,
        finishSurcharges: toJson(v.finishSurcharges),
        standardDies: toJson(v.standardDies),
        active: v.active,
      },
    });
    revalidatePortal();
    purgeCatalogCache(); // public "from" prices are built from rate cards (R4-04)
    return { updatedAt: updated.updatedAt.toISOString() };
  });
}

/* ───────────────────────── Application (onboarding) ───────────────────────── */

const APPLICATION_TEXT_VERSION = "vendor-application-2026-11-05";

export async function submitApplication(input: unknown, locale: string): Promise<ActionResponse<{ phone: string }>> {
  return runAction(async () => {
    const s = await getSession();
    if (!s) throw new VendorActionError("UNAUTHENTICATED");
    const user = s.user;
    if (user.vendorId || user.role === "VENDOR") throw new VendorActionError("FORBIDDEN");
    if (!rateLimit("vendor-apply", user.id, 5, 3600_000).ok) throw new VendorActionError("RATE_LIMITED");
    const p = applicationSchema.safeParse(input);
    if (!p.success) throw new FieldErrors(issuesToErrors(p.error.issues));
    const v = p.data;

    const open = await db.vendorApplication.findFirst({ where: { applicantId: user.id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } });
    if (open) throw new FieldErrors({ _: "ALREADY_APPLIED" });

    // Documents must be this applicant's own uploads and must exist on disk.
    const fields: Record<string, string> = {};
    for (const [i, d] of v.documents.entries()) {
      const k = parseKey(d.key);
      if (!k || k.scope !== "apply" || k.ownerId !== user.id) {
        fields[`documents.${i}`] = "INVALID";
        continue;
      }
      try {
        await access(path.join(uploadRoot(), k.scope, k.ownerId, k.file));
      } catch {
        fields[`documents.${i}`] = "INVALID";
      }
    }
    if (Object.keys(fields).length) throw new FieldErrors(fields);

    const base = slugify(v.nameEn);
    const taken = new Set((await db.vendor.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((x) => x.slug));
    const slug = uniqueSlug(base, taken);
    const ar = getDictionary("ar");
    const en = getDictionary("en");
    const loc = (LOCALES as readonly string[]).includes(locale) ? locale : "ar";
    const h = await headers();

    await db.$transaction(async (tx) => {
      const vendor = await tx.vendor.create({
        data: {
          slug,
          nameAr: v.nameAr,
          nameEn: v.nameEn,
          city: v.factoryCity,
          cityAr: ar.cities[v.factoryCity],
          cityEn: en.cities[v.factoryCity],
          bioAr: "",
          bioEn: "",
          machines: toJson([]),
          capabilities: toJson<VendorCapabilities>({ structures: v.structures, materials: [], finishes: ["NONE"], maxColors: 4, digitalShortRun: false, monthlyCapacityUnits: 0 }),
          certifications: toJson([]),
          serviceAreas: toJson([v.factoryCity]),
          verified: false,
          status: "PENDING",
        },
      });
      await tx.vendorApplication.create({
        data: {
          applicantId: user.id,
          vendorId: vendor.id,
          legalName: v.legalName,
          commercialRegisterNo: v.commercialRegisterNo,
          taxCardNo: v.taxCardNo,
          factoryAddress: v.factoryAddress,
          factoryCity: v.factoryCity,
          contactName: v.contactName,
          contactPhone: v.contactPhone,
          documents: toJson(v.documents),
          message: v.message || null,
        },
      });
      await tx.consent.create({
        data: {
          userId: user.id,
          phone: user.phone,
          kind: "TERMS",
          granted: true,
          textVersion: APPLICATION_TEXT_VERSION,
          locale: loc,
          ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
        },
      });
    });
    revalidatePath("/[locale]/vendor/apply", "page");
    return { phone: v.contactPhone };
  });
}
