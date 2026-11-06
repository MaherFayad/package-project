import type { DesignDoc, DesignFinish, DesignFinishCode, LocalizedText, MaterialCode } from "@/types";
import { DESIGN_FINISH_CODES, PRICED_FINISH_OF } from "@/types";
import {
  BOX_BOARDS,
  CONFIG_FINISH_CODES,
  FINISHES,
  boxMaterialRule,
  finishRule,
  printSidesRule,
  vesselMaterialRule,
  type BoxBoardCode,
  type BoxConfig,
  type ModelConfig,
  type VesselConfigInput,
  type VesselStockCode,
} from "@/lib/configurator";
import { FEATURE_SUPPORT, type FeatureSupport } from "@/lib/dieline";
import { PRINT_SURFACE_KINDS, type LabelFinishCode, type LabelStockCode, type PrintSurfaceKind } from "@/lib/vessels";
import type { BoxModelDef, ModelDef, VesselModelDef } from "@/lib/library";
import { vesselPrintMaterials } from "@/lib/library/doc";

/**
 * Designer ↔ configurator rules engine. The DesignDoc is what the designer edits; for every
 * option shown we build the equivalent ModelConfig and ask the rules engine whether it is
 * possible and why not (Arabic + English reasons), so the panel never offers what no printer
 * can make.
 */

export interface Choice<T extends string> {
  value: T;
  name: LocalizedText;
  enabled: boolean;
  reason?: LocalizedText;
  warning?: LocalizedText;
}

/** Print material (label stock / laminate) → configurator stock. */
const STOCK_OF: Partial<Record<MaterialCode, VesselStockCode>> = {
  LABEL_PAPER: "PAPER_SEMIGLOSS",
  LABEL_WHITE_BOPP: "WHITE_BOPP",
  LABEL_CLEAR_BOPP: "CLEAR_BOPP",
  LABEL_METALLIC_BOPP: "METALLIC_BOPP",
  SHRINK_PETG: "PETG_SHRINK",
  POUCH_PET_PE: "DIRECT_PRINT",
  POUCH_KRAFT_PE: "DIRECT_PRINT",
  TUBE_PE: "DIRECT_PRINT",
};

export function labelStockOf(material: MaterialCode): LabelStockCode {
  const s = STOCK_OF[material];
  return s && s !== "DIRECT_PRINT" ? s : "WHITE_BOPP";
}

/** Main label finish shown in 3D (varnish / lamination / foil). */
export function labelFinishOf(doc: Pick<DesignDoc, "finishes">): LabelFinishCode {
  const codes = (doc.finishes ?? []).map((f) => f.code);
  const map: Partial<Record<DesignFinishCode, LabelFinishCode>> = {
    GLOSS_LAMINATION: "GLOSS_LAMINATION",
    MATTE_LAMINATION: "MATTE_LAMINATION",
    SOFT_TOUCH_LAMINATION: "MATTE_LAMINATION",
    GLOSS_VARNISH: "GLOSS_VARNISH",
    MATTE_VARNISH: "MATTE_VARNISH",
    FOIL_GOLD: "HOT_FOIL",
    FOIL_SILVER: "HOT_FOIL",
    FOIL_ROSE_GOLD: "HOT_FOIL",
    SPOT_UV: "SPOT_UV",
    EMBOSS: "EMBOSS",
  };
  for (const c of codes) if (map[c]) return map[c]!;
  return "NONE";
}

const finishChoices = (doc: DesignDoc) => (doc.finishes ?? []).map((f) => ({ code: f.code, ...(f.mask ? { mask: f.mask } : {}) }));

/** Configurator board for a box doc (every priced MaterialCode is a BoxBoardCode). */
function boardOf(material: MaterialCode): BoxBoardCode {
  return (material in BOX_BOARDS ? material : "E_FLUTE_KRAFT") as BoxBoardCode;
}

export function boxConfigOf(doc: DesignDoc, material: MaterialCode = doc.materialCode): BoxConfig {
  const f = doc.features ?? {};
  return {
    v: 1,
    model: { type: "box", code: doc.structureCode },
    size: { mode: "custom", dims: { ...doc.dims } },
    material: boardOf(material),
    printSides: doc.printSides,
    colour: { mode: "CMYK", spots: [] },
    finishes: finishChoices(doc),
    addOns: {
      windowFilm: f.window ? { face: f.window.face, film: f.window.film !== false } : null,
      insert: f.partitions ? { kind: "DIVIDERS", rows: f.partitions.rows, cols: f.partitions.cols } : null,
      handle: !!f.handle,
      tearStrip: !!f.tearStrip,
    },
    structure: { thumbNotch: f.thumbNotch, lidHeightMm: f.lidHeightMm, displayFront: f.displayFront },
    quantity: 500,
  };
}

export function vesselConfigOf(doc: DesignDoc, m: VesselModelDef, material: MaterialCode = doc.materialCode): VesselConfigInput {
  const v = doc.vessel;
  const surfaces = (v?.surfaces ?? m.defaultSurfaces).filter((s): s is PrintSurfaceKind => (PRINT_SURFACE_KINDS as readonly string[]).includes(s));
  const container = m.containers.find((c) => c.code === v?.container)?.core;
  return {
    v: 1,
    model: { type: "vessel", code: m.coreKind },
    size: { mode: "custom", dims: { ...(v?.dims ?? m.presets[0].dims) } },
    material: STOCK_OF[material] ?? "WHITE_BOPP",
    ...(container ? { container: container as VesselConfigInput["container"] } : {}),
    surfaces: surfaces.length ? surfaces : ["FRONT"],
    printSides: "OUTSIDE",
    colour: { mode: "CMYK", spots: [] },
    finishes: finishChoices(doc),
    addOns: { windowFilm: null, insert: null, handle: false, tearStrip: false },
    quantity: 1000,
  };
}

export function configOf(doc: DesignDoc, m: ModelDef): ModelConfig {
  return m.kind === "box" ? boxConfigOf(doc) : vesselConfigOf(doc, m);
}

/** Boards / print materials of a model, with the rules engine's verdict for each. */
export function materialChoices(doc: DesignDoc, m: ModelDef): Choice<MaterialCode>[] {
  if (m.kind === "box") {
    return m.materials.map((mat) => {
      const v = boxMaterialRule(m.baseFor(mat), boardOf(mat), doc.dims);
      return { value: mat, name: BOX_BOARDS[boardOf(mat)].name, enabled: v.ok, ...(v.reason ? { reason: v.reason } : {}), ...(v.warning ? { warning: v.warning } : {}) };
    });
  }
  const surfaces = vesselConfigOf(doc, m).surfaces;
  const all = [...new Set([...vesselPrintMaterials(m), ...vesselPrintMaterials(m, ["SHRINK_SLEEVE"])])].filter((x) => m.surfaces.includes("SHRINK_SLEEVE") || x !== "SHRINK_PETG");
  const container = vesselConfigOf(doc, m).container;
  return all.map((mat) => {
    const v = vesselMaterialRule(m.coreKind, STOCK_OF[mat] ?? "WHITE_BOPP", surfaces, container);
    return { value: mat, name: { ar: mat, en: mat }, enabled: v.ok, ...(v.reason ? { reason: v.reason } : {}), ...(v.warning ? { warning: v.warning } : {}) };
  });
}

/** Every designer finish with its verdict for the current doc (others kept as they are). */
export function finishChoicesFor(doc: DesignDoc, m: ModelDef): Choice<DesignFinishCode>[] {
  const cfg = configOf(doc, m);
  return CONFIG_FINISH_CODES.filter((c): c is DesignFinishCode => (DESIGN_FINISH_CODES as readonly string[]).includes(c)).map((code) => {
    const v = finishRule(cfg, code);
    return { value: code, name: FINISHES[code].name, enabled: v.ok, ...(v.reason ? { reason: v.reason } : {}), ...(v.warning ? { warning: v.warning } : {}) };
  });
}

export function printSidesChoices(doc: DesignDoc, m: ModelDef): Choice<"OUTSIDE" | "BOTH">[] {
  const cfg = configOf(doc, m);
  return (["OUTSIDE", "BOTH"] as const).map((s) => {
    const v = printSidesRule(cfg, s);
    return {
      value: s,
      name: s === "OUTSIDE" ? { ar: "الخارج فقط", en: "Outside only" } : { ar: "الخارج والداخل", en: "Outside and inside" },
      enabled: v.ok,
      ...(v.reason ? { reason: v.reason } : {}),
      ...(v.warning ? { warning: v.warning } : {}),
    };
  });
}

/** Construction options a box model supports (family support, else its base structure's). */
export function featureSupportOf(m: BoxModelDef, doc: DesignDoc): FeatureSupport {
  return m.source === "core" ? FEATURE_SUPPORT[doc.structureCode] : m.features;
}

/** Toggle a finish; masked finishes start on every artwork layer of the outside (editable). */
export function toggleFinish(doc: DesignDoc, code: DesignFinishCode, on: boolean): DesignDoc {
  const cur = doc.finishes ?? [];
  let next: DesignFinish[];
  if (!on) next = cur.filter((f) => f.code !== code);
  else if (cur.some((f) => f.code === code)) next = cur;
  else {
    const masked = FINISHES[code].masked;
    const layerIds = doc.artwork.outside.layers.filter((l) => !l.hidden).map((l) => l.id);
    next = [...cur, masked ? { code, mask: { surface: "outside", layerIds } } : { code }];
  }
  // The single finishCode column carries the main priced finish (coating first, then the rest).
  const coating = next.find((f) => FINISHES[f.code].group === "coating");
  const main = coating ?? next[0];
  return { ...doc, finishes: next, finishCode: main ? PRICED_FINISH_OF[main.code] : "NONE" };
}

/** Drop finishes the rules engine no longer allows (after a model / board change). */
export function pruneFinishes(doc: DesignDoc, m: ModelDef): { doc: DesignDoc; removed: DesignFinishCode[] } {
  let cur = doc;
  const removed: DesignFinishCode[] = [];
  for (const f of doc.finishes ?? []) {
    const ok = finishChoicesFor(cur, m).find((c) => c.value === f.code)?.enabled ?? false;
    if (!ok) {
      cur = toggleFinish(cur, f.code, false);
      removed.push(f.code);
    }
  }
  if (!cur.finishes?.length && cur.finishCode !== "NONE" && !(doc.finishes ?? []).length) {
    // Legacy single finish: keep it only if still allowed.
    const legacy = (Object.keys(PRICED_FINISH_OF) as DesignFinishCode[]).find((k) => PRICED_FINISH_OF[k] === cur.finishCode);
    if (legacy && !(finishChoicesFor(cur, m).find((c) => c.value === legacy)?.enabled ?? false)) cur = { ...cur, finishCode: "NONE" };
  }
  return { doc: cur, removed };
}
