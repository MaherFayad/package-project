import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import { z } from "zod";
import type { Dims, StructureCode, StructureFeatures, StructureParamLimits } from "@/types";
import { panelCreases } from "../../builder";
import { computeFaces } from "../../fold";
import { MAX_PARTITION_CELLS } from "../../features";
import { bboxOf, clamp, coveredFraction, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import { DielineValidationError, thicknessSchema, type DimsIssue, type DimsIssueCode, type DimsValidation } from "../../limits";
import type { DielineModel, DielineOptions, DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "../../types";
import type { EcmaSpecialDef } from "./types";

export const DEFAULT_BLEED_MM = 3;
export const DEFAULT_SAFE_MM = 3;

/* ───────────────────────── validation (zod) ───────────────────────── */

function checkRule(rule: string, d: Dims): boolean | null {
  const m = /^\s*([LWH])\s*(<=|>=|==|<|>)\s*([LWH])(?:\s*\*\s*([\d.]+))?\s*$/.exec(rule);
  if (!m) return null;
  const a = d[m[1] as keyof Dims];
  const b = d[m[3] as keyof Dims] * (m[4] ? Number(m[4]) : 1);
  switch (m[2]) {
    case "<=":
      return a <= b + 1e-9;
    case ">=":
      return a + 1e-9 >= b;
    case "==":
      return Math.abs(a - b) < 0.5;
    case "<":
      return a < b;
    case ">":
      return a > b;
  }
  return null;
}

/** zod schema of a definition's inner dims. Rules: "L == W", "H <= W", "W <= L * 0.5". */
export function familyDimsSchema(limits: StructureParamLimits) {
  const axis = (k: "L" | "W" | "H") =>
    z
      .number({ invalid_type_error: "INVALID", required_error: "INVALID" })
      .finite()
      .superRefine((v, ctx) => {
        const r = limits[k];
        if (v < r.min) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_SMALL", limit: r.min } });
        else if (v > r.max) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_LARGE", limit: r.max } });
      });
  return z.object({ L: axis("L"), W: axis("W"), H: axis("H") }).superRefine((d, ctx) => {
    for (const rule of limits.rules ?? []) {
      if (checkRule(rule, d) === false) {
        const field = /^\s*([LWH])/.exec(rule)?.[1] ?? "L";
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], params: { code: "RULE", rule } });
      }
    }
  });
}

export function validateFamilyDims(def: Pick<EcmaSpecialDef, "params">, dims: unknown): DimsValidation {
  const parsed = familyDimsSchema(def.params).safeParse(dims);
  if (parsed.success) return { ok: true, dims: parsed.data };
  const issues: DimsIssue[] = parsed.error.issues.map((i) => {
    const params = (i as { params?: { code?: DimsIssueCode; limit?: number; rule?: string } }).params;
    return {
      path: String(i.path[0] ?? ""),
      code: params?.code ?? "INVALID",
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
      ...(params?.rule ? { rule: params.rule } : {}),
    };
  });
  return { ok: false, issues };
}

/** Drop features the definition cannot make; clamp the rest (mirrors supportedFeatures). */
export function familyFeatures(def: Pick<EcmaSpecialDef, "features" | "defaultFeatures">, requested?: StructureFeatures): StructureFeatures {
  const s = def.features;
  const f: StructureFeatures = { ...def.defaultFeatures, ...requested };
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
  if (f.handle && s.handle) out.handle = true;
  if (f.tearStrip && s.tearStrip) out.tearStrip = true;
  if (f.partitions && s.partitions) {
    const rows = clamp(Math.round(f.partitions.rows) || 1, 1, MAX_PARTITION_CELLS);
    const cols = clamp(Math.round(f.partitions.cols) || 1, 1, MAX_PARTITION_CELLS);
    if (rows > 1 || cols > 1) out.partitions = { rows, cols };
  }
  if (s.lidHeight && typeof f.lidHeightMm === "number" && Number.isFinite(f.lidHeightMm) && f.lidHeightMm > 0) out.lidHeightMm = f.lidHeightMm;
  if (f.displayFront && s.displayFront) out.displayFront = true;
  return out;
}

/* ───────────────────────── model assembly ───────────────────────── */

/**
 * Generate the dieline model of an ECMA-specials definition. Same output contract as
 * `generateDieline` in src/lib/dieline/generate.ts (that function only accepts the shared
 * StructureCode union, so this mirrors its normalisation step locally; see README).
 * Throws `DielineValidationError` when dims are outside the definition's limits.
 */
export function generateFamilyDieline(def: EcmaSpecialDef, dims: Dims, options: DielineOptions): DielineModel {
  const v = validateFamilyDims(def, dims);
  if (!v.ok) throw new DielineValidationError(v.issues);
  if (!thicknessSchema.safeParse(options.thicknessMm).success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  return assemble(def, v.dims, options);
}

export function tryGenerateFamilyDieline(def: EcmaSpecialDef, dims: Dims, options: DielineOptions): DielineModel | null {
  try {
    return generateFamilyDieline(def, dims, options);
  } catch {
    return null;
  }
}

function assemble(def: EcmaSpecialDef, dims: Dims, options: DielineOptions): DielineModel {
  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = options.safeMm ?? (def.family === "CORRUGATED" ? 5 : DEFAULT_SAFE_MM);
  const features = familyFeatures(def, options.features);
  const draft = def.generate(dims, t, features);
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

  const joins = (draft.joins ?? []).map(mvSeg);
  const hinges: Segment[] = panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
  const creaseLines: Segment[] = [
    ...panels.flatMap((p) => (p.hinge && p.hingeKind !== "roll" ? [p.hinge] : [])),
    ...draft.builder.extraCreases.map(mvSeg),
    ...joins,
  ];
  const cutLines: Segment[] = [];
  for (const p of panels) {
    for (const e of edgesOf(p.polygon)) for (const piece of subtractSegments(e, [...hinges, ...joins, ...cutLines])) cutLines.push(piece);
    for (const h of p.holes ?? []) cutLines.push(...edgesOf(h));
  }
  const perfLines = draft.builder.perfLines.map(mvSeg);
  const films: FilmPatch[] = draft.builder.films.map((f) => ({ panelId: f.panelId, polygon: f.polygon.map(mv) }));

  const rollJoins = new Set(panels.flatMap((p) => (p.hinge && p.hingeKind === "roll" ? [p.hinge] : [])));
  const bleedRegions = panels
    .filter((p) => p.printable)
    .map((p) => {
      // Virtual `roll` joins (curved walls, lock tongues) are not creases: the print bleeds
      // across them, so collinear outline edges keep one offset and strips never show a seam.
      const creases = [...panelCreases(p, panels).filter((s) => !rollJoins.has(s)), ...joins];
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
    // Not yet a member of the shared StructureCode union (integrator adds it).
    structureCode: def.code as StructureCode,
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
