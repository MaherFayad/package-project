import type {
  DesignDoc,
  Dims,
  ExtraFinishCode,
  FinishCode,
  LocalizedText,
  MaterialCode,
  PrintSides,
  StructureCode,
  StructureFeatures,
  VendorCapabilities,
  VendorMachine,
} from "@/types";
import { MAX_INSTANT_QTY } from "@/types";
import { defaultMaterialFor } from "@/lib/dieline";
import type { DeliveryZone, QuoteInput } from "@/lib/pricing";
import { describeVessel, labelRun, type LabelFinishCode, type LabelRun, type LabelSpec, type LabelStockCode } from "@/lib/vessels";
import { BOX_BOARDS, BOX_BOARD_CODES, FINISHES, type BoxBoardCode, type ConfigFinishCode } from "./catalog";
import { colourCount, evaluateConfig, type ConfigEvaluation } from "./rules";
import { isBoxConfig, type BoxConfig, type ModelConfig, type VesselConfigInput } from "./schema";

/**
 * ModelConfig → pricing engine inputs (src/lib/pricing) and → printer capabilities, so only a
 * config some vetted vendor can actually print reaches checkout.
 */

const t = (en: string, ar: string): LocalizedText => ({ ar, en });

/** Finishes the rate cards price (DB Finish rows + RateCard.finishSurcharges). */
const PRICED: Partial<Record<ConfigFinishCode, FinishCode>> = {
  MATTE_LAMINATION: "MATTE_LAMINATION",
  GLOSS_LAMINATION: "GLOSS_LAMINATION",
  SPOT_UV: "SPOT_UV",
  SOFT_TOUCH_LAMINATION: "SOFT_TOUCH_LAMINATION",
  GLOSS_VARNISH: "VARNISH",
  MATTE_VARNISH: "VARNISH",
  FOIL_GOLD: "HOT_FOIL",
  FOIL_SILVER: "HOT_FOIL",
  FOIL_ROSE_GOLD: "HOT_FOIL",
  EMBOSS: "EMBOSS",
  DEBOSS: "DEBOSS",
};

/** Pricing finish code → the configurator finish it stands for (DesignDoc.finishCode → config). */
export const FINISH_FROM_PRICED: Record<Exclude<FinishCode, "NONE">, ConfigFinishCode> = {
  MATTE_LAMINATION: "MATTE_LAMINATION",
  GLOSS_LAMINATION: "GLOSS_LAMINATION",
  SPOT_UV: "SPOT_UV",
  SOFT_TOUCH_LAMINATION: "SOFT_TOUCH_LAMINATION",
  VARNISH: "GLOSS_VARNISH",
  HOT_FOIL: "FOIL_GOLD",
  EMBOSS: "EMBOSS",
  DEBOSS: "DEBOSS",
};

/** The pricing finish a configurator finish is charged as (null = manual quote). */
export function pricedFinish(code: ConfigFinishCode): FinishCode | null {
  return PRICED[code] ?? null;
}

/** Finishes a vendor lists in VendorCapabilities.extraFinishes (quoted manually). */
const EXTRA: Partial<Record<ConfigFinishCode, ExtraFinishCode>> = {
  SOFT_TOUCH_LAMINATION: "SOFT_TOUCH_LAMINATION",
  GLOSS_VARNISH: "VARNISH",
  MATTE_VARNISH: "VARNISH",
  FOIL_GOLD: "HOT_FOIL",
  FOIL_SILVER: "HOT_FOIL",
  FOIL_ROSE_GOLD: "HOT_FOIL",
  EMBOSS: "EMBOSS",
  DEBOSS: "DEBOSS",
};

export interface ManualReason {
  code: "INVALID_CONFIG" | "BOARD_NOT_PRICED" | "FINISH_NOT_PRICED" | "INSERT_NOT_PRICED" | "QUANTITY_ABOVE_INSTANT_MAX" | "LABELS_NOT_PRICED";
  message: LocalizedText;
}

/** Dieline features a config asks for (window, handle, tear strip, dividers, lid depth…). */
export function toStructureFeatures(cfg: BoxConfig): StructureFeatures {
  const f: StructureFeatures = {};
  const a = cfg.addOns;
  if (a.windowFilm) {
    f.window = { face: a.windowFilm.face, film: a.windowFilm.film, ...(a.windowFilm.widthRatio ? { widthRatio: a.windowFilm.widthRatio } : {}), ...(a.windowFilm.heightRatio ? { heightRatio: a.windowFilm.heightRatio } : {}) };
  }
  if (a.handle) f.handle = true;
  if (a.tearStrip) f.tearStrip = true;
  if (a.insert?.kind === "DIVIDERS") f.partitions = { rows: a.insert.rows, cols: a.insert.cols };
  if (cfg.structure.thumbNotch) f.thumbNotch = true;
  if (cfg.structure.lidHeightMm) f.lidHeightMm = cfg.structure.lidHeightMm;
  if (cfg.structure.displayFront) f.displayFront = true;
  return f;
}

/** Board caliper for the dieline (mm). */
export function boardThicknessMm(cfg: BoxConfig): number {
  return BOX_BOARDS[cfg.material].thicknessMm;
}

export interface BoxPricingRequest {
  kind: "box";
  /** Every part of the config is priced by rate cards: show the instant price. */
  instant: boolean;
  /** Input for `quote()`; null when the config is invalid. Without `instant` it prices the base box only. */
  input: QuoteInput | null;
  features: StructureFeatures;
  /** Finishes that rate cards cannot price yet (added to a manual quote). */
  unpricedFinishes: ConfigFinishCode[];
  manual: ManualReason[];
  evaluation: ConfigEvaluation;
}

export interface LabelPricingLine {
  spec: LabelSpec;
  run: LabelRun;
}

export interface LabelPricingRequest {
  kind: "labels";
  instant: false;
  stock: LabelStockCode | "DIRECT_PRINT";
  finishes: LabelFinishCode[];
  colours: number;
  quantity: number;
  /** One line per print surface, with roll-label imposition (linear m, m² of stock, die). */
  lines: LabelPricingLine[];
  manual: ManualReason[];
  evaluation: ConfigEvaluation;
}

export type PricingRequest = BoxPricingRequest | LabelPricingRequest;

export interface PricingOptions {
  zone?: DeliveryZone;
  vendorId?: string;
}

/** One-sided pricing for OUTSIDE or INSIDE; both sides cost the BOTH surcharge. */
export function pricingPrintSides(cfg: ModelConfig): PrintSides {
  return cfg.printSides === "BOTH" ? "BOTH" : "OUTSIDE";
}

export function toPricingRequest(cfg: ModelConfig, opts: PricingOptions = {}): PricingRequest {
  const evaluation = evaluateConfig(cfg);
  const manual: ManualReason[] = [];
  if (!evaluation.ok) manual.push({ code: "INVALID_CONFIG", message: t("Fix the highlighted options to see a price.", "عدل الخيارات المحددة لعرض السعر.") });
  if (cfg.quantity > MAX_INSTANT_QTY)
    manual.push({ code: "QUANTITY_ABOVE_INSTANT_MAX", message: t(`Above ${MAX_INSTANT_QTY} pieces we price by quote.`, `فوق ${MAX_INSTANT_QTY} قطعة نسعر بعرض سعر.`) });

  if (!isBoxConfig(cfg)) return labelRequest(cfg, evaluation, manual);

  const board = BOX_BOARDS[cfg.material];
  const features = toStructureFeatures(cfg);
  const priced: FinishCode[] = [];
  const unpriced: ConfigFinishCode[] = [];
  for (const f of cfg.finishes) {
    const p = PRICED[f.code];
    if (p) priced.push(p);
    else unpriced.push(f.code);
  }
  if (!board.pricingMaterial)
    manual.push({ code: "BOARD_NOT_PRICED", message: t(`${board.name.en} is priced by quote.`, `${board.name.ar} يسعر بعرض سعر.`) });
  if (unpriced.length)
    manual.push({
      code: "FINISH_NOT_PRICED",
      message: t(
        `${unpriced.map((c) => FINISHES[c].name.en).join(", ")}: priced by the printer within 24 hours.`,
        `${unpriced.map((c) => FINISHES[c].name.ar).join("، ")}: تسعره المطبعة خلال 24 ساعة.`,
      ),
    });
  if (cfg.addOns.insert && cfg.addOns.insert.kind !== "DIVIDERS")
    manual.push({ code: "INSERT_NOT_PRICED", message: t("Inserts are priced by quote.", "الحشوات تسعر بعرض سعر.") });

  const dims = evaluation.size.box;
  const input: QuoteInput | null =
    evaluation.ok && dims && board.pricingMaterial
      ? {
          structureCode: cfg.model.code,
          dims,
          materialId: board.pricingMaterial,
          finishes: [...new Set(priced)],
          printSides: pricingPrintSides(cfg),
          colours: Math.min(6, Math.max(1, colourCount(cfg))),
          quantity: cfg.quantity,
          zone: opts.zone ?? "GREATER_CAIRO",
          ...(opts.vendorId ? { vendorId: opts.vendorId } : {}),
        }
      : null;
  return { kind: "box", instant: manual.length === 0 && !!input, input, features, unpricedFinishes: unpriced, manual, evaluation };
}

function labelRequest(cfg: VesselConfigInput, evaluation: ConfigEvaluation, manual: ManualReason[]): LabelPricingRequest {
  manual.push({ code: "LABELS_NOT_PRICED", message: t("Labels and sleeves are priced by quote within 24 hours.", "الملصقات والأغلفة تسعر بعرض سعر خلال 24 ساعة.") });
  const lines: LabelPricingLine[] = [];
  const dims = evaluation.size.vessel;
  if (dims) {
    const d = describeVessel({ kind: cfg.model.code, dims, neck: evaluation.size.vesselPreset?.neck, surfaces: cfg.surfaces });
    for (const spec of d.labels) lines.push({ spec, run: labelRun(spec, cfg.quantity) });
  }
  const finishes = [...new Set(cfg.finishes.map((f) => FINISHES[f.code].label).filter((x): x is LabelFinishCode => !!x))];
  return { kind: "labels", instant: false, stock: cfg.material, finishes, colours: colourCount(cfg), quantity: cfg.quantity, lines, manual, evaluation };
}

/* ───────────────────────────── vendors ───────────────────────────── */

export interface PrintRequirements {
  structure: StructureCode | null;
  /** Material row a rate card must exist for (null: board without rate cards yet). */
  material: MaterialCode | null;
  board: BoxBoardCode | null;
  finishes: FinishCode[];
  extraFinishes: ExtraFinishCode[];
  colours: number;
}

export function requiredCapabilities(cfg: ModelConfig): PrintRequirements {
  const finishes = new Set<FinishCode>();
  const extra = new Set<ExtraFinishCode>();
  for (const f of cfg.finishes) {
    const p = PRICED[f.code];
    if (p) finishes.add(p);
    // Extra (machine-inferred) finishes only matter for finishes rate cards do not price.
    const e = EXTRA[f.code];
    if (e && !p) extra.add(e);
  }
  if (!isBoxConfig(cfg)) return { structure: null, material: null, board: null, finishes: [...finishes], extraFinishes: [...extra], colours: colourCount(cfg) };
  return {
    structure: cfg.model.code,
    material: BOX_BOARDS[cfg.material].pricingMaterial,
    board: cfg.material,
    finishes: [...finishes],
    extraFinishes: [...extra],
    colours: colourCount(cfg),
  };
}

/** Extra finishes a vendor offers: explicit list, else inferred from machines (laminator, UV coater). */
export function vendorExtraFinishes(caps: VendorCapabilities, machines: VendorMachine[] = []): Set<ExtraFinishCode> {
  if (caps.extraFinishes) return new Set(caps.extraFinishes);
  const out = new Set<ExtraFinishCode>();
  if (machines.some((m) => m.kind === "LAMINATOR")) out.add("SOFT_TOUCH_LAMINATION");
  if (machines.some((m) => m.kind === "UV_COATER" || m.kind === "OFFSET")) out.add("VARNISH");
  return out;
}

export interface VendorFit {
  ok: boolean;
  missing: { code: string; message: LocalizedText }[];
}

const EXTRA_NAMES: Record<ExtraFinishCode, LocalizedText> = {
  SOFT_TOUCH_LAMINATION: FINISHES.SOFT_TOUCH_LAMINATION.name,
  VARNISH: t("Varnish", "الورنيش"),
  HOT_FOIL: t("Hot foil", "البصمة"),
  EMBOSS: FINISHES.EMBOSS.name,
  DEBOSS: FINISHES.DEBOSS.name,
};

/** Can this printer make the config? Box configs only (labels go to label printers by quote). */
export function vendorCanMake(cfg: ModelConfig, caps: VendorCapabilities, machines: VendorMachine[] = []): VendorFit {
  const req = requiredCapabilities(cfg);
  const missing: VendorFit["missing"] = [];
  if (!req.structure) return { ok: false, missing: [{ code: "LABELS", message: t("This printer does not print labels.", "هذه المطبعة لا تطبع الملصقات.") }] };
  if (!caps.structures.includes(req.structure)) missing.push({ code: "STRUCTURE", message: t("Does not make this box style.", "لا تصنع هذا النوع من العلب.") });
  if (!req.material) missing.push({ code: "BOARD", message: t("This board is not on printer rate cards yet.", "هذه الخامة غير مدرجة في أسعار المطابع بعد.") });
  else if (!caps.materials.includes(req.material)) missing.push({ code: "MATERIAL", message: t("Does not stock this board.", "لا تتوفر لديها هذه الخامة.") });
  for (const f of req.finishes)
    if (!caps.finishes.includes(f)) missing.push({ code: `FINISH_${f}`, message: t(`No ${FINISHES[f as ConfigFinishCode]?.name.en.toLowerCase() ?? f}.`, `لا تقدم ${FINISHES[f as ConfigFinishCode]?.name.ar ?? f}.`) });
  const extra = vendorExtraFinishes(caps, machines);
  for (const f of req.extraFinishes)
    if (!extra.has(f)) missing.push({ code: `FINISH_${f}`, message: t(`No ${EXTRA_NAMES[f].en.toLowerCase()}.`, `لا تقدم ${EXTRA_NAMES[f].ar}.`) });
  if (req.colours > caps.maxColors) missing.push({ code: "COLOURS", message: t(`Prints up to ${caps.maxColors} colours.`, `تطبع حتى ${caps.maxColors} ألوان.`) });
  return { ok: missing.length === 0, missing };
}

/** A printer as the orderability check sees it (DB row, or test fixture). */
export interface VendorForMatch {
  id: string;
  status: string;
  verified?: boolean;
  minOrderQty: number;
  capabilities: VendorCapabilities;
  machines?: VendorMachine[];
  /** Active rate cards: structure + material code (+ the finishes it prices). */
  rateCards: { structureCode: StructureCode; materialCode: MaterialCode; finishes: FinishCode[] }[];
}

export interface VendorMatch {
  vendorId: string;
  ok: boolean;
  verified: boolean;
  missing: VendorFit["missing"];
}

/**
 * Which printers can make this config: capability fit (structure, board, finishes, extra
 * finishes, colours) plus an active rate card for the structure and board that prices every
 * rate-card finish, plus the printer's minimum run. Mirrors the pricing engine's eligibility,
 * so a config that matches here is one the engine (or the printer, for extra finishes) prices.
 */
export function matchVendors(cfg: ModelConfig, vendors: readonly VendorForMatch[]): VendorMatch[] {
  const req = requiredCapabilities(cfg);
  return vendors.map((v) => {
    const fit = vendorCanMake(cfg, v.capabilities, v.machines ?? []);
    const missing = [...fit.missing];
    if (v.status !== "ACTIVE") missing.unshift({ code: "INACTIVE", message: t("This printer is not taking orders.", "هذه المطبعة لا تستقبل طلبات حاليا.") });
    if (req.structure && req.material) {
      const card = v.rateCards.find((c) => c.structureCode === req.structure && c.materialCode === req.material);
      if (!card) missing.push({ code: "NO_RATE_CARD", message: t("No price list for this box and board.", "لا توجد قائمة أسعار لهذه العلبة وهذه الخامة.") });
      else
        for (const f of req.finishes)
          if (!card.finishes.includes(f))
            missing.push({ code: `NO_PRICE_${f}`, message: t(`No price for ${FINISHES[f as ConfigFinishCode]?.name.en.toLowerCase() ?? f} on this box.`, `لا يوجد سعر لـ${FINISHES[f as ConfigFinishCode]?.name.ar ?? f} على هذه العلبة.`) });
    }
    if (cfg.quantity < v.minOrderQty)
      missing.push({ code: "BELOW_MIN_QTY", message: t(`Minimum run is ${v.minOrderQty} pieces.`, `أقل كمية ${v.minOrderQty} قطعة.`) });
    // de-duplicate (vendorCanMake and the rate card can both flag a finish)
    const seen = new Set<string>();
    const unique = missing.filter((m) => (seen.has(m.code) ? false : (seen.add(m.code), true)));
    return { vendorId: v.id, ok: unique.length === 0, verified: !!v.verified, missing: unique };
  });
}

export interface Orderability {
  /** The config is valid and at least one active printer can make it. */
  ok: boolean;
  evaluation: ConfigEvaluation;
  /** Printers that can make it (verified first). */
  vendorIds: string[];
  /** Why it cannot be ordered (empty when ok). */
  reasons: { code: string; message: LocalizedText }[];
  /** Orderable, but needs a manual price (extra finishes, board without rate cards, big runs). */
  manual: ManualReason[];
}

/**
 * Gate for checkout: only a valid config that some active printer can make may be ordered.
 * `vendorId` narrows it to the printer the buyer picked. Labels and sleeves always go to a
 * manual quote (no rate cards yet), so they are never instantly orderable.
 */
export function orderability(cfg: ModelConfig, vendors: readonly VendorForMatch[], opts: { vendorId?: string } = {}): Orderability {
  const pricing = toPricingRequest(cfg, opts);
  const evaluation = pricing.evaluation;
  const reasons: Orderability["reasons"] = [];
  if (!evaluation.ok)
    for (const i of evaluation.issues) if (i.severity === "error") reasons.push({ code: i.code, message: i.message });
  if (!isBoxConfig(cfg)) {
    reasons.push({ code: "LABELS_BY_QUOTE", message: t("Labels and sleeves are ordered through a quote.", "الملصقات والأغلفة تطلب من خلال عرض سعر.") });
    return { ok: false, evaluation, vendorIds: [], reasons, manual: pricing.manual };
  }
  const board = BOX_BOARDS[cfg.material];
  if (!board.pricingMaterial) {
    reasons.push({ code: "BOARD_BY_QUOTE", message: t(`${board.name.en} is ordered through a quote: printers confirm it within 24 hours.`, `${board.name.ar} يطلب من خلال عرض سعر، وتؤكده المطابع خلال 24 ساعة.`) });
    return { ok: false, evaluation, vendorIds: [], reasons, manual: pricing.manual };
  }
  const pool = opts.vendorId ? vendors.filter((v) => v.id === opts.vendorId) : vendors;
  const matches = matchVendors(cfg, pool).filter((m) => m.ok);
  matches.sort((a, b) => Number(b.verified) - Number(a.verified));
  if (evaluation.ok && matches.length === 0) {
    reasons.push(
      opts.vendorId
        ? { code: "VENDOR_CANNOT_MAKE", message: t("This printer cannot make this box as configured. Choose another printer or change the options.", "هذه المطبعة لا تستطيع تنفيذ هذه العلبة بهذه الخيارات. اختر مطبعة أخرى أو غير الخيارات.") }
        : { code: "NO_VENDOR", message: t("No printer on Elba can make this combination yet. Change the board or finishes.", "لا توجد مطبعة على علبة تستطيع تنفيذ هذه التركيبة بعد. غير الخامة أو التشطيبات.") },
    );
  }
  const manual = pricing.manual.filter((m) => m.code !== "INVALID_CONFIG");
  return { ok: reasons.length === 0, evaluation, vendorIds: matches.map((m) => m.vendorId), reasons, manual };
}

/* ───────────────────────────── design doc bridge ───────────────────────────── */

/** Primary priced finish for the single `DesignDoc.finishCode` column (spot UV wins, then lamination). */
export function primaryFinishCode(cfg: ModelConfig): FinishCode {
  const codes = cfg.finishes.map((f) => PRICED[f.code]).filter((x): x is FinishCode => !!x);
  if (codes.includes("SPOT_UV")) return "SPOT_UV";
  return codes[0] ?? "NONE";
}

/** Fields of a DesignDoc that a box config decides. INSIDE-only renders the inside (BOTH). */
export function toDesignDocPatch(cfg: BoxConfig): Pick<DesignDoc, "structureCode" | "dims" | "materialCode" | "finishCode" | "printSides" | "features"> | null {
  const ev = evaluateConfig(cfg);
  const dims: Dims | null = ev.size.box;
  if (!dims) return null;
  return {
    structureCode: cfg.model.code,
    dims,
    materialCode: BOX_BOARDS[cfg.material].pricingMaterial ?? defaultMaterialFor(cfg.model.code),
    finishCode: primaryFinishCode(cfg),
    printSides: cfg.printSides === "OUTSIDE" ? "OUTSIDE" : "BOTH",
    features: toStructureFeatures(cfg),
  };
}

/** A BoxConfig for an existing DesignDoc (spot UV masks start empty: the buyer picks layers). */
export function fromDesignDoc(doc: DesignDoc, quantity = 250): BoxConfig {
  const fromDoc = doc.finishes?.length ? doc.finishes : doc.finishCode === "NONE" ? [] : [{ code: FINISH_FROM_PRICED[doc.finishCode] }];
  const finishes: BoxConfig["finishes"] = fromDoc.map((f) => ({ code: f.code, mask: FINISHES[f.code].masked ? (f.mask ?? { surface: "outside", layerIds: [] }) : undefined }));
  const f = doc.features ?? {};
  const board = (BOX_BOARD_CODES as readonly string[]).includes(doc.materialCode) ? (doc.materialCode as BoxBoardCode) : "E_FLUTE_KRAFT";
  return {
    v: 1,
    model: { type: "box", code: doc.structureCode },
    size: { mode: "custom", dims: { ...doc.dims } },
    material: board,
    printSides: doc.printSides,
    colour: { mode: "CMYK", spots: [] },
    finishes,
    addOns: {
      windowFilm: f.window ? { face: f.window.face, film: f.window.film !== false, widthRatio: f.window.widthRatio, heightRatio: f.window.heightRatio } : null,
      insert: f.partitions ? { kind: "DIVIDERS", rows: f.partitions.rows, cols: f.partitions.cols } : null,
      handle: !!f.handle,
      tearStrip: !!f.tearStrip,
    },
    structure: { thumbNotch: f.thumbNotch, lidHeightMm: f.lidHeightMm, displayFront: f.displayFront },
    quantity,
  };
}
