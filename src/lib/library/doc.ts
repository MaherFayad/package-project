import type { DesignDoc, Dims, FaceId, MaterialCode, StructureCode } from "@/types";
import { BOARD_SPECS, type DielineModel, type DielinePanel, type FaceInfo } from "@/lib/dieline";
import type { VesselDims } from "@/lib/vessels";
import { boxModel, modelByCode, vesselModel } from "./index";
import { describeVesselModel } from "./vessels";
import type { BoxModelDef, ModelDef, PrintArea, VesselDescription, VesselModelDef } from "./types";

/**
 * DesignDoc ↔ model library. A design is either a BOX (dieline from the model's generator)
 * or a CONTAINER, whose print areas (labels, sleeve, pouch panels, tube body) are laid out
 * side by side on one flat sheet. That sheet is a regular DielineModel, so the designer's
 * face editor, layers, preflight, dieline view and PDF work for containers unchanged.
 */

/** The model a design shows (modelCode, else its core structure). */
export function docModel(doc: Pick<DesignDoc, "modelCode" | "structureCode">): ModelDef | null {
  return modelByCode(doc.modelCode ?? doc.structureCode);
}

export function docModelCode(doc: Pick<DesignDoc, "modelCode" | "structureCode">): string {
  return doc.modelCode ?? doc.structureCode;
}

/** Print surface / flexible panel → face of the artwork document. */
const SURFACE_FACE: Record<string, FaceId[]> = {
  WRAP: ["front"],
  FRONT: ["front"],
  SHRINK_SLEEVE: ["front"],
  BACK: ["back"],
  NECK: ["left", "top"],
  LID: ["top", "bottom"],
  front: ["front"],
  sleeve: ["front"],
  back: ["back"],
  gussetLeft: ["left"],
  gussetRight: ["right"],
  bottom: ["bottom"],
};
const ALL_FACES: FaceId[] = ["front", "back", "left", "right", "top", "bottom"];

/** Faces assigned to print areas, in order (collisions take the next free face). */
export function facesForAreas(areas: PrintArea[]): Map<string, FaceId> {
  const used = new Set<FaceId>();
  const out = new Map<string, FaceId>();
  for (const a of areas) {
    const f = [...(SURFACE_FACE[a.kind] ?? []), ...ALL_FACES].find((x) => !used.has(x));
    if (!f) continue;
    used.add(f);
    out.set(a.id, f);
  }
  return out;
}

const GAP_MM = 10;

/** Flat sheet of print areas as a DielineModel (no folds). */
export function areasToDieline(areas: PrintArea[], baseCode: StructureCode, envelope: { width: number; depth: number; height: number }): DielineModel {
  const faceOf = facesForAreas(areas);
  const bleed = Math.max(2, ...areas.map((a) => a.bleedMm));
  const safe = Math.min(...areas.map((a) => a.safeMm), 3);
  // One row, wrapping when wider than ~900 mm.
  let x = bleed;
  let y = bleed;
  let rowH = 0;
  let maxW = 0;
  const panels: DielinePanel[] = [];
  const faces: Partial<Record<FaceId, FaceInfo>> = {};
  const bleedRegions: DielineModel["bleedRegions"] = [];
  const safeZones: DielineModel["safeZones"] = [];
  for (const a of areas) {
    const face = faceOf.get(a.id);
    if (!face) continue;
    const w = a.trimWidthMm;
    const h = a.trimHeightMm;
    if (x > bleed && x + w > 900) {
      x = bleed;
      y += rowH + GAP_MM + 2 * bleed;
      rowH = 0;
    }
    const poly = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    panels.push({
      id: a.id,
      role: face,
      label: a.name.en,
      polygon: poly,
      bbox: { x, y, width: w, height: h },
      parentId: null,
      hinge: null,
      foldAngleClosed: 0,
      foldStage: 0,
      stackOffset: 0,
      pivotDepth: 0,
      printable: true,
      pieceId: a.id,
    });
    const b = a.bleedMm;
    bleedRegions.push({
      panelId: a.id,
      polygon: [
        { x: x - b, y: y - b },
        { x: x + w + b, y: y - b },
        { x: x + w + b, y: y + h + b },
        { x: x - b, y: y + h + b },
      ],
    });
    safeZones.push({ panelId: a.id, rect: { x: x + a.safeMm, y: y + a.safeMm, width: Math.max(1, w - 2 * a.safeMm), height: Math.max(1, h - 2 * a.safeMm) } });
    faces[face] = { face, width: w, height: h, parts: [{ panelId: a.id, rect: { x: 0, y: 0, width: w, height: h }, transform: [1, 0, 0, 1, x, y] }] };
    x += w + GAP_MM + 2 * bleed;
    rowH = Math.max(rowH, h);
    maxW = Math.max(maxW, x - GAP_MM - bleed);
  }
  const dieW = Math.max(1, maxW - bleed);
  const dieH = Math.max(1, y + rowH - bleed);
  const cut = panels.flatMap((p) => p.polygon.map((pt, i) => ({ a: pt, b: p.polygon[(i + 1) % p.polygon.length] })));
  const area = areas.reduce((s, a) => s + a.trimAreaM2, 0);
  return {
    structureCode: baseCode,
    dims: { L: dieW, W: 1, H: dieH },
    thicknessMm: 0.1,
    bleedMm: bleed,
    safeMm: safe,
    sheet: { width: dieW + 2 * bleed, height: dieH + 2 * bleed },
    dieBounds: { x: bleed, y: bleed, width: dieW, height: dieH },
    panels,
    rootId: panels[0]?.id ?? "none",
    cutLines: cut,
    creaseLines: [],
    perfLines: [],
    pieces: panels.map((p) => ({ rootId: p.id, label: p.label, bounds: p.bbox })),
    films: [],
    features: {},
    bleedRegions,
    safeZones,
    printRegions: { outside: bleedRegions.map((r) => r.polygon), inside: [] },
    faces,
    closedOuter: { L: envelope.width, W: envelope.depth, H: envelope.height },
    closedRotation: [0, 0, 0, 1],
    metrics: {
      blankWidthMm: dieW,
      blankHeightMm: dieH,
      blankAreaM2: area,
      netAreaM2: area,
      cutLengthMm: cut.reduce((s, l) => s + Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y), 0),
      creaseLengthMm: 0,
      perfLengthMm: 0,
      pieceCount: panels.length,
      filmAreaM2: 0,
    },
  };
}

/** Pricing structure for a container model. */
export function vesselBase(m: VesselModelDef): StructureCode {
  return m.pricing === "POUCH" ? "PRINTED_POUCH" : m.pricing === "TUBE" ? "PRINTED_TUBE" : "ROLL_LABEL";
}

/** Print materials a container model can be printed on (label stocks or laminates). */
export function vesselPrintMaterials(m: VesselModelDef, surfaces: string[] = m.defaultSurfaces): MaterialCode[] {
  if (m.pricing === "POUCH") return ["POUCH_PET_PE", "POUCH_KRAFT_PE"];
  if (m.pricing === "TUBE") return ["TUBE_PE"];
  if (surfaces.includes("SHRINK_SLEEVE")) return ["SHRINK_PETG"];
  return ["LABEL_WHITE_BOPP", "LABEL_PAPER", "LABEL_CLEAR_BOPP", "LABEL_METALLIC_BOPP"];
}

export interface DocGeometry {
  model: ModelDef;
  dieline: DielineModel;
  /** Containers only. */
  vessel?: VesselDescription;
}

export function vesselDimsOf(doc: DesignDoc, m: VesselModelDef): VesselDims {
  return doc.vessel?.dims ?? m.presets.find((p) => p.id === m.defaultPresetId)?.dims ?? m.presets[0].dims;
}

/** Dieline (box) or print-area sheet (container) for a design. null when the size is invalid. */
export function docGeometry(doc: DesignDoc): DocGeometry | null {
  const m = docModel(doc);
  if (!m) return null;
  try {
    if (m.kind === "box") {
      const dieline = m.build(doc.dims, { thicknessMm: BOARD_SPECS[doc.materialCode].thicknessMm, features: doc.features });
      return { model: m, dieline };
    }
    const v = doc.vessel;
    const dims = vesselDimsOf(doc, m);
    const surfaces = v?.surfaces?.length ? v.surfaces : m.defaultSurfaces;
    const d = describeVesselModel(m, dims, surfaces, v?.presetId, v?.container);
    if (!d.areas.length) return null;
    return { model: m, dieline: areasToDieline(d.areas, vesselBase(m), d.envelope), vessel: d };
  } catch {
    return null;
  }
}

/** Pricing dims for the base structure: boxes use inner dims; containers the print sheet (L × H). */
export function pricingDims(doc: DesignDoc, geo: DocGeometry | null = docGeometry(doc)): Dims {
  if (geo?.vessel) {
    const total = geo.vessel.areas.reduce((s, a) => s + a.trimAreaM2, 0);
    const h = Math.max(...geo.vessel.areas.map((a) => a.trimHeightMm));
    return { L: Math.max(10, Math.round((total * 1e6) / Math.max(h, 1))), W: 1, H: Math.round(h) };
  }
  return doc.dims;
}

/** Board / stock use of one unit for pricing (blank m² incl. trim, net m²). */
export function docBoardArea(doc: DesignDoc): { blankAreaM2: number; netAreaM2: number; blankWidthMm: number; blankHeightMm: number; source: "dieline" } | null {
  const geo = docGeometry(doc);
  if (!geo) return null;
  const m = geo.dieline.metrics;
  if (geo.vessel) {
    // Roll labels / pouches: add the gap between labels on the web and the side trim (about 12 %).
    const blank = m.blankAreaM2 * 1.12;
    return { blankAreaM2: blank, netAreaM2: m.netAreaM2, blankWidthMm: m.blankWidthMm, blankHeightMm: m.blankHeightMm, source: "dieline" };
  }
  return { blankAreaM2: m.blankAreaM2, netAreaM2: m.netAreaM2, blankWidthMm: m.blankWidthMm, blankHeightMm: m.blankHeightMm, source: "dieline" };
}

/** Core structure + board a design is produced and priced as. */
export function baseOf(m: ModelDef, material: MaterialCode): StructureCode {
  return m.kind === "box" ? m.baseFor(material) : vesselBase(m);
}

/** Keep a doc consistent after a model / material change: base structure, valid board. */
export function normaliseDocModel(doc: DesignDoc): DesignDoc {
  const m = docModel(doc);
  if (!m) return doc;
  if (m.kind === "box") {
    const materialCode = m.materials.includes(doc.materialCode) ? doc.materialCode : m.materials[0];
    const structureCode = m.baseFor(materialCode);
    const modelCode = m.source === "core" ? undefined : m.code;
    const { vessel: _v, ...rest } = doc;
    void _v;
    return { ...rest, ...(modelCode ? { modelCode } : { modelCode: undefined }), structureCode, materialCode };
  }
  const allowed = vesselPrintMaterials(m, doc.vessel?.surfaces);
  const materialCode = allowed.includes(doc.materialCode) ? doc.materialCode : allowed[0];
  return { ...doc, modelCode: m.code, structureCode: vesselBase(m), materialCode };
}

export { boxModel, vesselModel };
export type { BoxModelDef };
