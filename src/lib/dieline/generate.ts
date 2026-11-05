import { Matrix4 } from "three";
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
import { supportedFeatures } from "./features";
import type { DielineModel, DielineOptions, DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "./types";

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
  const features = supportedFeatures(code, options.features);
  const draft = GENERATORS[code](dims, t, features);
  const raw = draft.builder.panels;

  // Normalise: die bounds start at (bleed, bleed).
  const all = bboxOf(raw.flatMap((p) => p.polygon));
  const dx = bleed - all.x;
  const dy = bleed - all.y;
  const mv = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  const mvSeg = (s: Segment) => ({ a: mv(s.a), b: mv(s.b) });
  // Flat frame is (x, -y): a sheet shift of (dx, dy) is (dx, -dy) there.
  const unshift = new Matrix4().makeTranslation(-dx, dy, 0);
  const panels: DielinePanel[] = raw.map((p) => {
    const polygon = p.polygon.map(mv);
    const out: DielinePanel = {
      ...p,
      polygon,
      bbox: bboxOf(polygon),
      hinge: p.hinge ? mvSeg(p.hinge) : null,
    };
    if (p.holes) out.holes = p.holes.map((h) => h.map(mv));
    if (p.assembly) out.assembly = { ...p.assembly, matrix: new Matrix4().fromArray(p.assembly.matrix).multiply(unshift).toArray() };
    return out;
  });
  const byId = new Map(panels.map((p) => [p.id, p]));
  const pieceOf = (p: DielinePanel): string => (p.parentId ? pieceOf(byId.get(p.parentId)!) : p.id);
  for (const p of panels) p.pieceId = pieceOf(p);

  // Creases = hinges (+ extra creases). Roll hinges are virtual: neither cut nor crease.
  const hinges: Segment[] = panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
  // A crease only runs where the child panel actually has board along its hinge (a notch
  // through a turn-in leaves a gap in the crease, not a scored line across the hole).
  const creaseOf = (p: DielinePanel): Segment[] => {
    const gaps = subtractSegments(p.hinge!, edgesOf(p.polygon));
    return gaps.length ? subtractSegments(p.hinge!, gaps) : [p.hinge!];
  };
  const creaseLines: Segment[] = [
    ...panels.flatMap((p) => (p.hinge && p.hingeKind !== "roll" ? creaseOf(p) : [])),
    ...draft.builder.extraCreases.map(mvSeg),
  ];
  const cutLines: Segment[] = [];
  for (const p of panels) {
    for (const e of edgesOf(p.polygon)) {
      for (const piece of subtractSegments(e, [...hinges, ...cutLines])) cutLines.push(piece);
    }
    for (const h of p.holes ?? []) cutLines.push(...edgesOf(h));
  }
  const perfLines = draft.builder.perfLines.map(mvSeg);
  const films: FilmPatch[] = draft.builder.films.map((f) => ({ panelId: f.panelId, polygon: f.polygon.map(mv) }));

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
  const computed = computeFaces(draftModel, draft.faceDepthTol);
  const faces = draft.faces ? draft.faces(panels, computed.faces) : computed.faces;
  const closedOuter = computed.closedOuter;

  const facePanelIds = new Set(Object.values(faces).flatMap((f) => f!.parts.map((x) => x.panelId)));
  const safeZones = draft.safeZones
    ? draft.safeZones(panels, safe)
    : panels.filter((p) => facePanelIds.has(p.id)).map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));

  const printPolys = bleedRegions.map((r) => r.polygon);
  const blankW = all.width;
  const blankH = all.height;

  // Pieces: separately cut blanks. Board use = sum of each blank's rectangle.
  const pieces: DielinePiece[] = panels
    .filter((p) => p.parentId === null)
    .sort((a, b) => (a.id === draftModel.rootId ? -1 : b.id === draftModel.rootId ? 1 : 0))
    .map((root) => ({
      rootId: root.id,
      label: draft.builder.pieceLabels.get(root.id) ?? root.label,
      bounds: bboxOf(panels.filter((p) => p.pieceId === root.id).flatMap((p) => p.polygon)),
    }));
  const blankArea = pieces.length > 1 ? pieces.reduce((s, p) => s + p.bounds.width * p.bounds.height, 0) : blankW * blankH;
  const holeArea = (p: DielinePanel) => (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0);

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
    perfLines,
    pieces,
    films,
    features,
    bleedRegions,
    safeZones,
    printRegions: { outside: printPolys, inside: printPolys },
    faces,
    closedOuter,
    closedRotation: draft.closedRotation,
    metrics: {
      blankWidthMm: blankW,
      blankHeightMm: blankH,
      blankAreaM2: blankArea / 1e6,
      netAreaM2: panels.reduce((s, p) => s + polygonArea(p.polygon) - holeArea(p), 0) / 1e6,
      cutLengthMm: cutLines.reduce((s, l) => s + segLength(l), 0),
      creaseLengthMm: creaseLines.reduce((s, l) => s + segLength(l), 0),
      perfLengthMm: perfLines.reduce((s, l) => s + segLength(l), 0),
      pieceCount: pieces.length,
      filmAreaM2: films.reduce((s, f) => s + polygonArea(f.polygon), 0) / 1e6,
    },
  };
}
