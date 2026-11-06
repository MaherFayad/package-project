import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import { z } from "zod";
import type { Dims, StructureFeatures, StructureParamLimits } from "@/types";
import { edgeBleed, panelCreases } from "../../builder";
import { computeFaces } from "../../fold";
import { bboxOf, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import { DielineValidationError, dimsSchema, thicknessSchema, type DimsIssue, type DimsIssueCode } from "../../limits";
import type { FeatureSupport } from "../../features";
import type { DielineOptions, DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "../../types";
import { trimFaces } from "./kit";
import type { Fefco02Code, Fefco02Definition, Fefco02Model, Fefco02Params } from "./types";

export const DEFAULT_BLEED_MM = 3;
/** Corrugated safe zone (same default as the shared engine). */
export const DEFAULT_SAFE_MM = 5;

export type Validation<T> = { ok: true; value: T } | { ok: false; issues: DimsIssue[] };

const issuesOf = (error: z.ZodError, prefix = ""): DimsIssue[] =>
  error.issues.map((i) => {
    const params = (i as { params?: { code?: DimsIssueCode; limit?: number; rule?: string } }).params;
    return {
      path: prefix + String(i.path[0] ?? ""),
      code: params?.code ?? "INVALID",
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
      ...(params?.rule ? { rule: params.rule } : {}),
    };
  });

/**
 * Validate inner dims against a style's limits and rules. Reuses the shared zod schema
 * builder (rules such as "W <= L" use its parser); the structure code argument of
 * `dimsSchema` is only used for its default limits, which we always override.
 */
export function validateFefco02Dims(def: Pick<Fefco02Definition, "params">, dims: unknown, limits: StructureParamLimits = def.params): Validation<Dims> {
  const parsed = dimsSchema("FEFCO_0201", limits).safeParse(dims);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, issues: issuesOf(parsed.error) };
}

export function validateFefco02Params(def: Pick<Fefco02Definition, "paramsSchema">, params: unknown): Validation<Fefco02Params> {
  const parsed = def.paramsSchema.safeParse(params ?? {});
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, issues: issuesOf(parsed.error, "params.") };
}

/** Keep only the features a style supports (window is never supported in group 02). */
export function supportedFeatures(s: FeatureSupport, requested: StructureFeatures | undefined): StructureFeatures {
  const f = requested ?? {};
  const out: StructureFeatures = {};
  if (s.handle && f.handle) out.handle = true;
  if (s.tearStrip && f.tearStrip) out.tearStrip = true;
  if (s.thumbNotch && f.thumbNotch) out.thumbNotch = true;
  return out;
}

export interface Fefco02Options extends DielineOptions {
  params?: Fefco02Params;
  limits?: StructureParamLimits;
}

/**
 * Build the full dieline model of a group 02 style: the same post-processing as the shared
 * engine's `generateDieline` (cut/crease extraction, bleed, safe zones, faces, metrics), so
 * the result drops into the 3D view, SVG export and pricing unchanged.
 * Throws `DielineValidationError` on invalid dims, thickness or style params.
 */
export function buildFefco02Dieline(def: Fefco02Definition, dims: Dims, options: Fefco02Options): Fefco02Model {
  const v = validateFefco02Dims(def, dims, options.limits);
  if (!v.ok) throw new DielineValidationError(v.issues);
  if (!thicknessSchema.safeParse(options.thicknessMm).success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  const pv = validateFefco02Params(def, { ...def.defaultParams(v.value), ...options.params });
  if (!pv.ok) throw new DielineValidationError(pv.issues);
  const features = supportedFeatures(def.features, options.features);
  const draft = def.generateWith(v.value, options.thicknessMm, features, pv.value);
  return assemble(def.code, v.value, options, features, draft);
}

/** Non-throwing variant. */
export function tryBuildFefco02Dieline(def: Fefco02Definition, dims: Dims, options: Fefco02Options): Fefco02Model | null {
  try {
    return buildFefco02Dieline(def, dims, options);
  } catch {
    return null;
  }
}

function assemble(
  code: Fefco02Code,
  dims: Dims,
  options: DielineOptions,
  features: StructureFeatures,
  draft: ReturnType<Fefco02Definition["generateWith"]>,
): Fefco02Model {
  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = options.safeMm ?? DEFAULT_SAFE_MM;
  const raw = draft.builder.panels;

  const all = bboxOf(raw.flatMap((p) => p.polygon));
  const dx = bleed - all.x;
  const dy = bleed - all.y;
  const mv = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  const mvSeg = (s: Segment) => ({ a: mv(s.a), b: mv(s.b) });
  const unshift = new Matrix4().makeTranslation(-dx, dy, 0);
  const panels: DielinePanel[] = raw.map((p) => {
    const polygon = p.polygon.map(mv);
    const out: DielinePanel = { ...p, polygon, bbox: bboxOf(polygon), hinge: p.hinge ? mvSeg(p.hinge) : null };
    if (p.holes) out.holes = p.holes.map((h) => h.map(mv));
    if (p.assembly) out.assembly = { ...p.assembly, matrix: new Matrix4().fromArray(p.assembly.matrix).multiply(unshift).toArray() };
    return out;
  });
  const byId = new Map(panels.map((p) => [p.id, p]));
  const pieceOf = (p: DielinePanel): string => (p.parentId ? pieceOf(byId.get(p.parentId)!) : p.id);
  for (const p of panels) p.pieceId = pieceOf(p);

  const hinges: Segment[] = panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
  const creaseLines: Segment[] = [...panels.flatMap((p) => (p.hinge && p.hingeKind !== "roll" ? [p.hinge] : [])), ...draft.builder.extraCreases.map(mvSeg)];
  const cutLines: Segment[] = [];
  for (const p of panels) {
    for (const e of edgesOf(p.polygon)) for (const piece of subtractSegments(e, [...hinges, ...cutLines])) cutLines.push(piece);
    for (const h of p.holes ?? []) cutLines.push(...edgesOf(h));
  }
  const perfLines = draft.builder.perfLines.map(mvSeg);
  const films: FilmPatch[] = draft.builder.films.map((f) => ({ panelId: f.panelId, polygon: f.polygon.map(mv) }));

  const bleedRegions = panels
    .filter((p) => p.printable)
    .map((p) => {
      const creases = panelCreases(p, panels);
      const distances = edgesOf(p.polygon).map((e) => edgeBleed(e, creases, panels, bleed));
      return { panelId: p.id, polygon: offsetConvex(p.polygon, distances) as Polygon };
    });

  const computed = computeFaces({ panels, rootId: draft.builder.rootId, thicknessMm: t, closedRotation: draft.closedRotation }, draft.faceDepthTol);
  // Faces cropped to the panels that carry them (a roof or handle above the walls would
  // otherwise leave empty space at the top of the wall faces).
  const faces = trimFaces(draft.faces ? draft.faces(panels, computed.faces) : computed.faces);
  const facePanelIds = new Set(Object.values(faces).flatMap((f) => f!.parts.map((x) => x.panelId)));
  const safeZones = draft.safeZones
    ? draft.safeZones(panels, safe)
    : panels.filter((p) => facePanelIds.has(p.id)).map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));

  const printPolys = bleedRegions.map((r) => r.polygon);
  const pieces: DielinePiece[] = panels
    .filter((p) => p.parentId === null)
    .map((root) => ({
      rootId: root.id,
      label: draft.builder.pieceLabels.get(root.id) ?? root.label,
      bounds: bboxOf(panels.filter((p) => p.pieceId === root.id).flatMap((p) => p.polygon)),
    }));
  const holeArea = (p: DielinePanel) => (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0);

  return {
    structureCode: code,
    dims: { ...dims },
    thicknessMm: t,
    bleedMm: bleed,
    safeMm: safe,
    sheet: { width: all.width + 2 * bleed, height: all.height + 2 * bleed },
    dieBounds: { x: bleed, y: bleed, width: all.width, height: all.height },
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
    closedOuter: computed.closedOuter,
    closedRotation: draft.closedRotation,
    metrics: {
      blankWidthMm: all.width,
      blankHeightMm: all.height,
      blankAreaM2: (all.width * all.height) / 1e6,
      netAreaM2: panels.reduce((s, p) => s + polygonArea(p.polygon) - holeArea(p), 0) / 1e6,
      cutLengthMm: cutLines.reduce((s, l) => s + segLength(l), 0),
      creaseLengthMm: creaseLines.reduce((s, l) => s + segLength(l), 0),
      perfLengthMm: perfLines.reduce((s, l) => s + segLength(l), 0),
      pieceCount: pieces.length,
      filmAreaM2: 0,
    },
  };
}
