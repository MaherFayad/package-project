import type { Artwork, DesignDoc, DesignVessel, DesignFinish, DesignFinishCode, FaceId, LocalizedText, MaterialCode, ShapeLayer } from "@/types";
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
import { describeVesselModel } from "@/lib/library/packs/common-vessel";
import type { VesselDims } from "@/lib/vessels";

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

/**
 * Layers a masked finish (spot UV, foil, emboss) starts on: every visible item on the outside, on
 * every face (a finish switched on applies to the whole design; the buyer can then take it off
 * single items). Empty when the outside has no artwork yet; an empty mask means "every face"
 * (DesignFinish contract) and is filled in as soon as the first item is added
 * (`fillEmptyFinishMasks`).
 */
export function defaultFinishLayerIds(doc: Pick<DesignDoc, "artwork">): string[] {
  return doc.artwork.outside.layers.filter((l) => !l.hidden).map((l) => l.id);
}

/**
 * A new outside item joins every masked finish that already covers ALL the other visible items
 * (the finish "applies to everything"), so uploading a logo on another face after switching foil
 * on puts foil there too. Finishes the buyer narrowed to some items are left alone.
 */
export function extendFinishMasks(before: DesignDoc, after: DesignDoc, layerId: string): DesignDoc {
  if (!after.finishes?.some((f) => FINISHES[f.code].masked)) return after;
  const layer = after.artwork.outside.layers.find((l) => l.id === layerId);
  if (!layer) return after;
  const prev = before.artwork.outside.layers.filter((l) => !l.hidden).map((l) => l.id);
  let changed = false;
  const finishes = after.finishes.map((f) => {
    if (!FINISHES[f.code].masked || (f.mask?.surface ?? "outside") !== "outside") return f;
    const ids = f.mask?.layerIds ?? [];
    if (ids.includes(layerId) || !prev.every((id) => ids.includes(id))) return f;
    changed = true;
    return { ...f, mask: { surface: "outside" as const, layerIds: [...ids, layerId] } };
  });
  return changed ? { ...after, finishes } : after;
}

/** Toggle a finish; masked finishes start on every item (see `defaultFinishLayerIds`, editable per item). */
export function toggleFinish(doc: DesignDoc, code: DesignFinishCode, on: boolean): DesignDoc {
  const cur = doc.finishes ?? [];
  let next: DesignFinish[];
  if (!on) next = cur.filter((f) => f.code !== code);
  else if (cur.some((f) => f.code === code)) next = cur;
  else {
    const masked = FINISHES[code].masked;
    next = [...cur, masked ? { code, mask: { surface: "outside", layerIds: defaultFinishLayerIds(doc) } } : { code }];
  }
  // The single finishCode column carries the main priced finish (coating first, then the rest).
  const coating = next.find((f) => FINISHES[f.code].group === "coating");
  const main = coating ?? next[0];
  return { ...doc, finishes: next, finishCode: main ? PRICED_FINISH_OF[main.code] : "NONE" };
}

/** Masked finishes with no layer that still exists and shows get the default layers (after an item is added or deleted). */
export function fillEmptyFinishMasks(doc: DesignDoc): DesignDoc {
  if (!doc.finishes?.some((f) => FINISHES[f.code].masked)) return doc;
  const live = new Set(doc.artwork.outside.layers.filter((l) => !l.hidden).map((l) => l.id));
  let changed = false;
  const finishes = doc.finishes.map((f) => {
    if (!FINISHES[f.code].masked || (f.mask?.surface ?? "outside") !== "outside") return f;
    if ((f.mask?.layerIds ?? []).some((id) => live.has(id))) return f;
    const layerIds = defaultFinishLayerIds(doc);
    if (!layerIds.length && !f.mask?.layerIds.length) return f;
    changed = true;
    return { ...f, mask: { surface: "outside" as const, layerIds } };
  });
  return changed ? { ...doc, finishes } : doc;
}

/** Add or remove one item from a masked finish ("Spot UV on this item"). */
export function setLayerFinish(doc: DesignDoc, code: DesignFinishCode, layerId: string, on: boolean): DesignDoc {
  const finishes = (doc.finishes ?? []).map((f) => {
    if (f.code !== code || !FINISHES[f.code].masked) return f;
    const ids = new Set(f.mask?.layerIds ?? []);
    if (on) ids.add(layerId);
    else ids.delete(layerId);
    return { ...f, mask: { surface: f.mask?.surface ?? ("outside" as const), layerIds: [...ids] } };
  });
  return { ...doc, finishes };
}

/** Id prefix of the stand-in layers `finishPreview` adds (one per face) when a masked finish has no artwork to sit on. */
export const FINISH_PREVIEW_LAYER = "finish-preview-face";

/**
 * What the 3D view paints for masked finishes. The engine only coats the layers a mask lists, so
 * an empty mask (no artwork yet) would be invisible (FN-02): following the DesignFinish contract
 * it covers every face, drawn as stand-in rectangles that never enter the document.
 */
export function finishPreview(
  finishes: readonly DesignFinish[],
  artwork: Artwork,
  model: { faces: Partial<Record<FaceId, { width: number; height: number }>> },
): { finishes: { code: DesignFinishCode; mask?: DesignFinish["mask"] }[]; artwork: Artwork } {
  const live = new Set(artwork.outside.layers.filter((l) => !l.hidden).map((l) => l.id));
  let stand: ShapeLayer[] | null = null;
  const out = finishes.map((f) => {
    if (!FINISHES[f.code].masked) return { code: f.code };
    const surface = f.mask?.surface ?? "outside";
    const ids = (f.mask?.layerIds ?? []).filter((id) => surface !== "outside" || live.has(id));
    if (ids.length) return { code: f.code, mask: { surface, layerIds: ids } };
    stand ??= (Object.keys(model.faces) as FaceId[]).flatMap((face) => {
      const info = model.faces[face];
      return info
        ? [{ id: `${FINISH_PREVIEW_LAYER}-${face}`, kind: "shape" as const, shape: "rect" as const, face, surface: "outside" as const, x: info.width / 2, y: info.height / 2, width: info.width, height: info.height, rotation: 0, fill: "#000000", stroke: null, strokeWidthMm: 0 }]
        : [];
    });
    if (!stand.length) return { code: f.code };
    return { code: f.code, mask: { surface: "outside" as const, layerIds: stand.map((l) => l.id) } };
  });
  const used = stand as ShapeLayer[] | null;
  const art: Artwork = used?.length ? { ...artwork, outside: { ...artwork.outside, layers: [...artwork.outside.layers, ...used] } } : artwork;
  return { finishes: out, artwork: art };
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

/**
 * The vessel description for sizes typed in the Model panel. The chosen closure picks the neck
 * finish it fits (engine R6-3Q-F-01), so the panel's check and print areas match the 3D view: a swing
 * top or crown on a bottle preset with a PP 28 thread draws on its own neck (3D QA round 6, item 8).
 */
export function describeVesselDraft(m: VesselModelDef, dims: VesselDims, v: Pick<DesignVessel, "surfaces" | "container" | "options" | "closure">) {
  return describeVesselModel(m, dims, v.surfaces, undefined, v.container, v.options, v.closure);
}

/**
 * R14-04: the neck finish shown under a bottle or jar's name (it used to be the preset's raw
 * finish id, "PP28", and stayed after a swing top or crown was chosen). It follows the chosen
 * closure; null when the model or closure has none (boxes keep their own standard line).
 */
export function neckFinishLabel(m: ModelDef, closure: string | undefined, locale: "ar" | "en"): string | null {
  if (m.kind !== "vessel") return null;
  const c = m.closures.find((x) => x.code === closure) ?? m.closures.find((x) => x.code === m.defaultClosure);
  return c?.neckFinish?.[locale] ?? null;
}
