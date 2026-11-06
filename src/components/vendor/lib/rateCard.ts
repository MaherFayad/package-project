import { parseTypedNumber } from "@/lib/number-input";
/**
 * Rate card editor validation (pure; used by the client form and re-run by the server action).
 * Vendors type prices in EGP; we store integer piasters (1 EGP = 100).
 * Error codes map to i18n keys `vendorPortal.rateCards.errors.<CODE>`.
 */
import { z } from "zod";
import { FINISH_CODES, QTY_TIERS, type Dims, type FinishCode, type RateTier, type StructureCode } from "@/types";
import { validateDims } from "@/lib/dieline/limits";

export const RATE_LIMITS = {
  maxTiers: 8,
  maxQty: 100_000,
  maxUnitEgp: 5_000,
  maxOneOffEgp: 500_000,
  leadTime: { min: 1, max: 60 },
  maxSurchargePct: 200,
  maxFinishEgp: 500,
  maxDies: 20,
  /** Same ±2 mm tolerance the pricing engine uses for "standard size". */
  dieToleranceMm: 2,
} as const;

export type RateCardErrorCode =
  | "REQUIRED"
  | "NOT_A_NUMBER"
  | "NOT_WHOLE"
  | "TOO_LOW"
  | "TOO_HIGH"
  | "TIERS_EMPTY"
  | "TIERS_TOO_MANY"
  | "TIERS_ORDER"
  | "TIERS_FIRST"
  | "UNIT_INCREASES"
  | "DIE_INVALID"
  | "DIE_DUPLICATE"
  | "DIES_TOO_MANY";

/** Raw form values (strings straight from inputs). */
export interface RateCardForm {
  tiers: { minQty: string; unitEgp: string }[];
  setupEgp: string;
  dieCostEgp: string;
  leadTimeDays: string;
  printSidesSurchargePct: string;
  finishSurcharges: Partial<Record<FinishCode, string>>;
  standardDies: { L: string; W: string; H: string }[];
  active: boolean;
}

/** Parsed, stored shape (piasters). */
export interface RateCardUpdate {
  qtyTiers: RateTier[];
  setupPiasters: number;
  dieCostPiasters: number;
  leadTimeDays: number;
  printSidesSurchargePct: number;
  finishSurcharges: Partial<Record<FinishCode, number>>;
  standardDies: Dims[];
  active: boolean;
}

export type RateCardErrors = Partial<Record<string, RateCardErrorCode>>;

export type RateCardResult = { ok: true; value: RateCardUpdate } | { ok: false; errors: RateCardErrors };

/** Accept Arabic-Indic digits, Arabic decimal separator and thousands commas. */
export function parseNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  // R5-JR-18: commas used to be dropped, so "18,50" (a decimal comma) became EGP 1,850 per piece.
  return parseTypedNumber(raw, { allowNegative: true });
}

export const egpToPiasters = (egp: number) => Math.round(egp * 100);
export const piastersToEgpString = (p: number) => {
  const v = Math.round(p) / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export function validateRateCard(form: RateCardForm, structureCode: StructureCode, finishesAllowed: readonly FinishCode[] = FINISH_CODES): RateCardResult {
  const errors: RateCardErrors = {};

  const num = (path: string, raw: string, opts: { min: number; max: number; whole?: boolean; required?: boolean }): number | null => {
    const v = parseNumber(raw);
    if (v === null) {
      if (opts.required !== false) errors[path] = "REQUIRED";
      return null;
    }
    if (Number.isNaN(v)) {
      errors[path] = "NOT_A_NUMBER";
      return null;
    }
    if (opts.whole && !Number.isInteger(v)) {
      errors[path] = "NOT_WHOLE";
      return null;
    }
    if (v < opts.min) {
      errors[path] = "TOO_LOW";
      return null;
    }
    if (v > opts.max) {
      errors[path] = "TOO_HIGH";
      return null;
    }
    return v;
  };

  // Tiers
  const tiers: RateTier[] = [];
  if (form.tiers.length === 0) errors.tiers = "TIERS_EMPTY";
  else if (form.tiers.length > RATE_LIMITS.maxTiers) errors.tiers = "TIERS_TOO_MANY";
  form.tiers.forEach((t, i) => {
    const q = num(`tiers.${i}.minQty`, t.minQty, { min: 1, max: RATE_LIMITS.maxQty, whole: true });
    const u = num(`tiers.${i}.unitEgp`, t.unitEgp, { min: 0.01, max: RATE_LIMITS.maxUnitEgp });
    if (q !== null && u !== null) tiers.push({ minQty: q, unitPiasters: egpToPiasters(u) });
    else tiers.push({ minQty: q ?? NaN, unitPiasters: u === null ? NaN : egpToPiasters(u) });
  });
  if (!errors.tiers && tiers.every((t) => Number.isFinite(t.minQty) && Number.isFinite(t.unitPiasters))) {
    // The first tier must cover our smallest instant-quote quantity.
    if (tiers[0]!.minQty > QTY_TIERS[0]) errors["tiers.0.minQty"] = "TIERS_FIRST";
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i]!.minQty <= tiers[i - 1]!.minQty) {
        errors[`tiers.${i}.minQty`] = "TIERS_ORDER";
        break;
      }
      if (tiers[i]!.unitPiasters > tiers[i - 1]!.unitPiasters) {
        errors[`tiers.${i}.unitEgp`] = "UNIT_INCREASES";
        break;
      }
    }
  }

  const setup = num("setupEgp", form.setupEgp, { min: 0, max: RATE_LIMITS.maxOneOffEgp });
  const die = num("dieCostEgp", form.dieCostEgp, { min: 0, max: RATE_LIMITS.maxOneOffEgp });
  const lead = num("leadTimeDays", form.leadTimeDays, { ...RATE_LIMITS.leadTime, whole: true });
  const pct = num("printSidesSurchargePct", form.printSidesSurchargePct, { min: 0, max: RATE_LIMITS.maxSurchargePct });

  const finishSurcharges: Partial<Record<FinishCode, number>> = {};
  for (const code of finishesAllowed) {
    if (code === "NONE") continue;
    const raw = form.finishSurcharges[code];
    if (raw === undefined || raw.trim() === "") continue; // not offered on this card
    const v = num(`finish.${code}`, raw, { min: 0, max: RATE_LIMITS.maxFinishEgp });
    if (v !== null) finishSurcharges[code] = egpToPiasters(v);
  }

  // Standard (owned) dies
  const dies: Dims[] = [];
  if (form.standardDies.length > RATE_LIMITS.maxDies) errors.standardDies = "DIES_TOO_MANY";
  form.standardDies.forEach((d, i) => {
    const L = parseNumber(d.L);
    const W = parseNumber(d.W);
    const H = parseNumber(d.H);
    if (L === null || W === null || H === null) {
      errors[`dies.${i}`] = "REQUIRED";
      return;
    }
    const dims = { L, W, H };
    if (!validateDims(structureCode, dims).ok) {
      errors[`dies.${i}`] = "DIE_INVALID";
      return;
    }
    const tol = RATE_LIMITS.dieToleranceMm;
    if (dies.some((x) => Math.abs(x.L - L) <= tol && Math.abs(x.W - W) <= tol && Math.abs(x.H - H) <= tol)) {
      errors[`dies.${i}`] = "DIE_DUPLICATE";
      return;
    }
    dies.push(dims);
  });

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      qtyTiers: tiers,
      setupPiasters: egpToPiasters(setup!),
      dieCostPiasters: egpToPiasters(die!),
      leadTimeDays: lead!,
      printSidesSurchargePct: pct!,
      finishSurcharges,
      standardDies: dies,
      active: form.active,
    },
  };
}

/** Stored card -> form strings. */
export function rateCardToForm(card: {
  qtyTiers: RateTier[];
  setupPiasters: number;
  dieCostPiasters: number;
  leadTimeDays: number;
  printSidesSurchargePct: number;
  finishSurcharges: Partial<Record<FinishCode, number>>;
  standardDies: Dims[];
  active: boolean;
}): RateCardForm {
  return {
    tiers: [...card.qtyTiers].sort((a, b) => a.minQty - b.minQty).map((t) => ({ minQty: String(t.minQty), unitEgp: piastersToEgpString(t.unitPiasters) })),
    setupEgp: piastersToEgpString(card.setupPiasters),
    dieCostEgp: piastersToEgpString(card.dieCostPiasters),
    leadTimeDays: String(card.leadTimeDays),
    printSidesSurchargePct: String(card.printSidesSurchargePct),
    finishSurcharges: Object.fromEntries(Object.entries(card.finishSurcharges).map(([k, v]) => [k, piastersToEgpString(v ?? 0)])),
    standardDies: card.standardDies.map((d) => ({ L: String(d.L), W: String(d.W), H: String(d.H) })),
    active: card.active,
  };
}

/** Server-side shape check of what the client posts (strings only; validateRateCard does the rules). */
export const rateCardFormSchema = z.object({
  tiers: z.array(z.object({ minQty: z.string().max(20), unitEgp: z.string().max(20) })).max(RATE_LIMITS.maxTiers + 2),
  setupEgp: z.string().max(20),
  dieCostEgp: z.string().max(20),
  leadTimeDays: z.string().max(10),
  printSidesSurchargePct: z.string().max(10),
  finishSurcharges: z.record(z.enum(FINISH_CODES), z.string().max(20)),
  standardDies: z.array(z.object({ L: z.string().max(10), W: z.string().max(10), H: z.string().max(10) })).max(RATE_LIMITS.maxDies + 2),
  active: z.boolean(),
});

/** Unit price at a quantity under the card's tiers (step function, for the preview table). */
export function unitAt(tiers: RateTier[], qty: number): number | null {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  let hit: RateTier | null = null;
  for (const t of sorted) if (qty >= t.minQty) hit = t;
  return hit ? hit.unitPiasters : null;
}

/** R4: what one priced piece is called on a rate card (vocabulary per production family). */
export type RateUnit = "box" | "label" | "pouch" | "tube";
export function rateUnit(structure: StructureCode): RateUnit {
  if (structure === "ROLL_LABEL") return "label";
  if (structure === "PRINTED_POUCH") return "pouch";
  if (structure === "PRINTED_TUBE") return "tube";
  return "box";
}
