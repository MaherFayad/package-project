import type { Dims, StructureCode, StructureParamLimits } from "@/types";
import { STRUCTURE_FAMILY } from "./materials";
import { computeFaces } from "./fold";
import {
  bboxOf,
  coveredFraction,
  edgesOf,
  insetRect,
  offsetConvex,
  polygonArea,
  segLength,
  subtractSegments,
} from "./geometry";
import { panelCreases } from "./builder";
import { DielineValidationError, thicknessSchema, validateDims } from "./limits";
import { GENERATORS } from "./structures";
import type { DielineModel, DielineOptions, DielinePanel, Polygon, Segment } from "./types";

export const DEFAULT_BLEED_MM = 3;

/**
 * Generate the dieline for a catalog structure.
 * Throws `DielineValidationError` when the dims are outside the structure limits.
 */
export function generateDieline(
  code: StructureCode,
  dims: Dims,
  options: DielineOptions,
  limits?: StructureParamLimits,
): DielineModel {
  const v = validateDims(code, dims, limits);
  if (!v.ok) throw new DielineValidationError(v.issues);
  const tParsed = thicknessSchema.safeParse(options.thicknessMm);
  if (!tParsed.success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  return buildDieline(code, v.dims, options);
}

/** Like generateDieline but returns null instead of throwing. */
export function tryGenerateDieline(
  code: StructureCode,
  dims: Dims,
  options: DielineOptions,
  limits?: StructureParamLimits,
): DielineModel | null {
  try {
    return generateDieline(code, dims, options, limits);
  } catch {
    return null;
  }
}

function buildDieline(code: StructureCode, dims: Dims, options: DielineOptions): DielineModel {
  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = options.safeMm ?? (STRUCTURE_FAMILY[code] === "CORRUGATED" ? 5 : 3);
  const draft = GENERATORS[code](dims, t);
  const raw = draft.builder.panels;

  // Normalise: die bounds start at (bleed, bleed).
  const all = bboxOf(raw.flatMap((p) => p.polygon));
  const dx = bleed - all.x;
  const dy = bleed - all.y;
  const mv = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
  const panels: DielinePanel[] = raw.map((p) => {
    const polygon = p.polygon.map(mv);
    return {
      ...p,
      polygon,
      bbox: bboxOf(polygon),
      hinge: p.hinge ? { a: mv(p.hinge.a), b: mv(p.hinge.b) } : null,
    };
  });

  // Creases = hinges. Cuts = every other piece of every outline (deduplicated).
  const creaseLines: Segment[] = panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
  const cutLines: Segment[] = [];
  for (const p of panels) {
    for (const e of edgesOf(p.polygon)) {
      for (const piece of subtractSegments(e, [...creaseLines, ...cutLines])) cutLines.push(piece);
    }
  }

  // Bleed: grow each printable panel on its cut edges.
  const bleedRegions = panels
    .filter((p) => p.printable)
    .map((p) => {
      const creases = panelCreases(p, panels);
      const distances = edgesOf(p.polygon).map((e) => (coveredFraction(e, creases) > 0.98 ? 0 : bleed));
      return { panelId: p.id, polygon: offsetConvex(p.polygon, distances) as Polygon };
    });

  const draftModel = {
    panels,
    rootId: draft.builder.rootId,
    thicknessMm: t,
    closedRotation: draft.closedRotation,
  };
  const { faces, closedOuter } = computeFaces(draftModel);

  const facePanelIds = new Set(Object.values(faces).flatMap((f) => f!.parts.map((x) => x.panelId)));
  const safeZones = panels
    .filter((p) => facePanelIds.has(p.id))
    .map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));

  const printPolys = bleedRegions.map((r) => r.polygon);
  const blankW = all.width;
  const blankH = all.height;

  return {
    structureCode: code,
    dims: { ...dims },
    thicknessMm: t,
    bleedMm: bleed,
    safeMm: safe,
    sheet: { width: blankW + 2 * bleed, height: blankH + 2 * bleed },
    dieBounds: { x: bleed, y: bleed, width: blankW, height: blankH },
    panels,
    rootId: draft.builder.rootId,
    cutLines,
    creaseLines,
    bleedRegions,
    safeZones,
    printRegions: { outside: printPolys, inside: printPolys },
    faces,
    closedOuter,
    closedRotation: draft.closedRotation,
    metrics: {
      blankWidthMm: blankW,
      blankHeightMm: blankH,
      blankAreaM2: (blankW * blankH) / 1e6,
      netAreaM2: panels.reduce((s, p) => s + polygonArea(p.polygon), 0) / 1e6,
      cutLengthMm: cutLines.reduce((s, l) => s + segLength(l), 0),
      creaseLengthMm: creaseLines.reduce((s, l) => s + segLength(l), 0),
    },
  };
}
