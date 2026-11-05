import { Matrix4 } from "three";
import { z } from "zod";
import type { Dims, StructureFeatures } from "@/types";
import { panelCreases } from "../../builder";
import { computeFaces } from "../../fold";
import { MAX_PARTITION_CELLS } from "../../features";
import { bboxOf, clamp, coveredFraction, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import { DielineValidationError, dimsSchema, thicknessSchema, type DimsIssue, type DimsIssueCode } from "../../limits";
import type { DielineOptions, DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "../../types";
import type { EcmaTuckDefinition, EcmaTuckDielineModel, EcmaTuckOptions } from "./types";

export const DEFAULT_BLEED_MM = 3;
export const DEFAULT_SAFE_MM = 3;

/** zod schema for the per-model options (mm). Unknown keys are rejected. */
export const ecmaTuckOptionsSchema = z
  .object({
    tuckDepthMm: z.number().finite().min(6).max(40),
    glueFlapMm: z.number().finite().min(8).max(20),
    tuckLock: z.enum(["friction", "slit"]),
    hangHole: z.enum(["euro", "round"]),
    headerHeightMm: z.number().finite().min(20).max(80),
    leafletThicknessMm: z.number().finite().min(0).max(15),
    lidHeightMm: z.number().finite().min(10).max(80),
  })
  .partial()
  .strict();

export type EcmaDimsValidation = { ok: true; dims: Dims } | { ok: false; issues: DimsIssue[] };

/** Validate inner dims against a definition's limits and rules (zod, shared issue codes). */
export function validateEcmaDims(def: EcmaTuckDefinition, dims: unknown): EcmaDimsValidation {
  const parsed = dimsSchema(def.baseCode, def.params).safeParse(dims);
  if (parsed.success) return { ok: true, dims: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => {
      const params = (i as { params?: { code?: DimsIssueCode; limit?: number; rule?: string } }).params;
      return {
        path: String(i.path[0] ?? ""),
        code: params?.code ?? "INVALID",
        ...(params?.limit !== undefined ? { limit: params.limit } : {}),
        ...(params?.rule ? { rule: params.rule } : {}),
      };
    }),
  };
}

/** Clamp dims into a definition's limits (sliders / presets). */
export function clampEcmaDims(def: EcmaTuckDefinition, dims: Dims): Dims {
  const c = (v: number, k: keyof Dims) => clamp(Number.isFinite(v) ? v : def.params[k].min, def.params[k].min, def.params[k].max);
  const out = { L: c(dims.L, "L"), W: c(dims.W, "W"), H: c(dims.H, "H") };
  for (const rule of def.params.rules ?? []) if (rule.replace(/\s/g, "") === "W<=L" && out.W > out.L) out.W = Math.max(def.params.W.min, out.L);
  return out;
}

/** Drop features the definition cannot make; clamp the rest. */
export function supportedEcmaFeatures(def: EcmaTuckDefinition, requested: StructureFeatures | undefined): StructureFeatures {
  const s = def.features;
  const f = { ...def.defaultFeatures, ...requested };
  const out: StructureFeatures = {};
  if (f.window && s.windowFaces.includes(f.window.face)) {
    out.window = {
      face: f.window.face,
      widthRatio: clamp(Number(f.window.widthRatio ?? 0.55) || 0.55, 0.15, 0.8),
      heightRatio: clamp(Number(f.window.heightRatio ?? 0.45) || 0.45, 0.15, 0.8),
      film: f.window.film !== false,
    };
  }
  if (f.thumbNotch && s.thumbNotch) out.thumbNotch = true;
  if (f.tearStrip && s.tearStrip) out.tearStrip = true;
  if (f.partitions && s.partitions) {
    const rows = clamp(Math.round(f.partitions.rows) || 1, 1, MAX_PARTITION_CELLS);
    const cols = clamp(Math.round(f.partitions.cols) || 1, 1, MAX_PARTITION_CELLS);
    if (rows > 1 || cols > 1) out.partitions = { rows, cols };
  }
  return out;
}

export interface EcmaDielineOptions extends DielineOptions {
  model?: EcmaTuckOptions;
}

/**
 * Generate the dieline of a family carton. Same pipeline and output contract as the engine's
 * `generateDieline` (die normalised to the bleed, cut = outline minus hinges, bleed grown on
 * cut edges only, faces from the fold kinematics), plus `catalogCode`, `cartonInner` and
 * `reservedZones`. Throws `DielineValidationError` on bad dims, thickness or options.
 */
export function generateEcmaDieline(def: EcmaTuckDefinition, dims: Dims, options: EcmaDielineOptions): EcmaTuckDielineModel {
  const v = validateEcmaDims(def, dims);
  if (!v.ok) throw new DielineValidationError(v.issues);
  if (!thicknessSchema.safeParse(options.thicknessMm).success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  const opt = ecmaTuckOptionsSchema.safeParse(options.model ?? {});
  if (!opt.success) throw new DielineValidationError(opt.error.issues.map((i) => ({ path: String(i.path[0] ?? "options"), code: "INVALID" as const })));

  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = options.safeMm ?? DEFAULT_SAFE_MM;
  const features = supportedEcmaFeatures(def, options.features);
  const modelOpts: EcmaTuckOptions = { ...def.optionsDefaults, ...opt.data };
  const draft = def.generator(v.dims, t, features, modelOpts);
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
      const distances = edgesOf(p.polygon).map((e) => (coveredFraction(e, creases) > 0.98 ? 0 : bleed));
      return { panelId: p.id, polygon: offsetConvex(p.polygon, distances) as Polygon };
    });

  const draftModel = { panels, rootId: draft.builder.rootId, thicknessMm: t, closedRotation: draft.closedRotation };
  const computed = computeFaces(draftModel, draft.faceDepthTol);
  const faces = draft.faces ? draft.faces(panels, computed.faces) : computed.faces;
  const facePanelIds = new Set(Object.values(faces).flatMap((f) => f!.parts.map((x) => x.panelId)));
  const safeZones = draft.safeZones
    ? draft.safeZones(panels, safe)
    : panels.filter((p) => facePanelIds.has(p.id)).map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));

  const printPolys = bleedRegions.map((r) => r.polygon);
  const pieces: DielinePiece[] = panels
    .filter((p) => p.parentId === null)
    .sort((a, b) => (a.id === draftModel.rootId ? -1 : b.id === draftModel.rootId ? 1 : 0))
    .map((root) => ({
      rootId: root.id,
      label: draft.builder.pieceLabels.get(root.id) ?? root.label,
      bounds: bboxOf(panels.filter((p) => p.pieceId === root.id).flatMap((p) => p.polygon)),
    }));
  const blankArea = pieces.length > 1 ? pieces.reduce((s, p) => s + p.bounds.width * p.bounds.height, 0) : all.width * all.height;
  const holeArea = (p: DielinePanel) => (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0);

  return {
    structureCode: def.baseCode,
    catalogCode: def.code,
    options: { ...modelOpts, tuckLock: modelOpts.tuckLock ?? "friction" },
    cartonInner: { ...draft.inner },
    reservedZones: draft.reserved ? draft.reserved(panels) : [],
    dims: { ...v.dims },
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

/** Like generateEcmaDieline but returns null instead of throwing. */
export function tryGenerateEcmaDieline(def: EcmaTuckDefinition, dims: Dims, options: EcmaDielineOptions): EcmaTuckDielineModel | null {
  try {
    return generateEcmaDieline(def, dims, options);
  } catch {
    return null;
  }
}
