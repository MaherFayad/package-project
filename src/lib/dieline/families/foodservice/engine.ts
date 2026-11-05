import { Matrix4, Vector3 } from "three";
import { z } from "zod";
import type { Dims, FaceId, StructureFeatures, StructureParamLimits } from "@/types";
import { panelCreases } from "../../builder";
import type { FeatureSupport } from "../../features";
import { computeFaces, computePoses, panelLocalPoint, panelPivot } from "../../fold";
import { bboxOf, coveredFraction, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import type { StructureDraft } from "../../structures";
import type { Affine, DielinePanel, DielinePiece, FaceInfo, FilmPatch, Polygon, Pt, Segment } from "../../types";
import type { DielineDefinition, FamilyDielineModel, FoodserviceCode, HandleSpec } from "./types";

export const DEFAULT_BLEED_MM = 3;

/* ───────────────────────── validation (zod) ───────────────────────── */

export type FamilyIssue = { path: string; code: "TOO_SMALL" | "TOO_LARGE" | "RULE" | "INVALID"; limit?: number; rule?: string };

function checkRule(rule: string, v: Record<string, number>): boolean | null {
  const m = /^\s*(\w+)\s*(<=|>=|==|<|>)\s*(\w+)\s*$/.exec(rule);
  if (!m || !(m[1] in v) || !(m[3] in v)) return null;
  const a = v[m[1]];
  const b = v[m[3]];
  return m[2] === "<=" ? a <= b + 1e-9 : m[2] === ">=" ? a + 1e-9 >= b : m[2] === "==" ? Math.abs(a - b) < 0.5 : m[2] === "<" ? a < b : a > b;
}

/** Zod schema for a record of numeric params with [min, max] ranges and simple rules ("A <= B"). */
export function rangeSchema<K extends string>(limits: { [P in K]: { min: number; max: number } }, rules: string[] = []) {
  const shape = Object.fromEntries(
    (Object.keys(limits) as K[]).map((k) => [k, z.number({ invalid_type_error: "INVALID" }).finite().min(limits[k].min).max(limits[k].max)]),
  ) as Record<K, z.ZodNumber>;
  return z.object(shape).superRefine((v, ctx) => {
    for (const rule of rules) {
      if (checkRule(rule, v as Record<string, number>) === false) ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule, params: { rule } });
    }
  });
}

export type Validation<T> = { ok: true; value: T } | { ok: false; issues: FamilyIssue[] };

export function validateRanges<T extends { [K in keyof T]: number }>(limits: { [K in keyof T]: { min: number; max: number } }, value: T, rules: string[] = []): Validation<T> {
  const r = rangeSchema(limits as Record<string, { min: number; max: number }>, rules).safeParse(value);
  if (r.success) return { ok: true, value: r.data as T };
  return {
    ok: false,
    issues: r.error.issues.map((i) => {
      const path = String(i.path[0] ?? "");
      if (i.code === "too_small") return { path, code: "TOO_SMALL", limit: Number(i.minimum) };
      if (i.code === "too_big") return { path, code: "TOO_LARGE", limit: Number(i.maximum) };
      if (i.code === "custom") return { path, code: "RULE", rule: i.message };
      return { path, code: "INVALID" };
    }),
  };
}

export class FamilyValidationError extends Error {
  constructor(readonly issues: FamilyIssue[]) {
    super(`Invalid parameters: ${issues.map((i) => `${i.path}:${i.code}`).join(", ")}`);
    this.name = "FamilyValidationError";
  }
}

export function validateDielineDims(limits: StructureParamLimits, dims: Dims): Validation<Dims> {
  return validateRanges<{ L: number; W: number; H: number }>({ L: limits.L, W: limits.W, H: limits.H }, dims, limits.rules);
}

/** Drop features the definition cannot make (same policy as the core `supportedFeatures`). */
export function filterFeatures(s: FeatureSupport, requested: StructureFeatures | undefined): StructureFeatures {
  const f = { ...requested };
  const out: StructureFeatures = {};
  if (f.window && s.windowFaces.includes(f.window.face)) out.window = { ...f.window };
  if (f.thumbNotch && s.thumbNotch) out.thumbNotch = true;
  if (f.handle && s.handle) out.handle = true;
  if (f.tearStrip && s.tearStrip) out.tearStrip = true;
  if (f.displayFront && s.displayFront) out.displayFront = true;
  return out;
}

/* ───────────────────────── draft → model ───────────────────────── */

export interface FamilyDielineOptions {
  thicknessMm: number;
  bleedMm?: number;
  safeMm?: number;
  features?: StructureFeatures;
}

/** Validate, generate and finalise a dieline for one of our definitions. */
export function generateFamilyDieline(def: DielineDefinition, dims: Dims, options: FamilyDielineOptions): FamilyDielineModel {
  const v = validateDielineDims(def.params, dims);
  if (!v.ok) throw new FamilyValidationError(v.issues);
  if (!(options.thicknessMm > 0 && options.thicknessMm <= 10)) throw new FamilyValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  const features = filterFeatures(def.features, { ...def.defaultFeatures, ...options.features });
  const draft = def.generate(v.value, options.thicknessMm, features);
  const model = finalizeDraft(def.code, v.value, draft, { ...options, features, safeMm: options.safeMm ?? (def.family === "CORRUGATED" ? 5 : 3) });
  if (def.handle) model.handle = handleSpecFor(def.handle, v.value);
  return model;
}

/** Twisted / flat paper handle proportions (typical converter practice; confirm per machine). */
export function handleSpecFor(kind: "flat" | "twisted", dims: Dims): HandleSpec {
  const span = Math.min(dims.L * 0.45, kind === "flat" ? 100 : 95);
  return {
    kind,
    spanMm: span,
    heightMm: kind === "flat" ? Math.min(90, Math.max(60, dims.L * 0.3)) : Math.min(110, Math.max(70, dims.L * 0.35)),
    widthMm: kind === "flat" ? 15 : 4,
    anchorMm: kind === "flat" ? 45 : 60,
    faces: ["front", "back"],
  };
}

/**
 * Same normalisation as the core `buildDieline` (src/lib/dieline/generate.ts), for drafts
 * whose code is not (yet) a core StructureCode.
 */
export function finalizeDraft(code: FoodserviceCode, dims: Dims, draft: StructureDraft, options: FamilyDielineOptions & { features: StructureFeatures; safeMm: number }): FamilyDielineModel {
  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = options.safeMm;
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
  const safeZones = draft.safeZones ? draft.safeZones(panels, safe) : panels.filter((p) => facePanelIds.has(p.id)).map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));
  const printPolys = bleedRegions.map((r) => r.polygon);
  const pieces: DielinePiece[] = panels
    .filter((p) => p.parentId === null)
    .sort((a, b) => (a.id === draftModel.rootId ? -1 : b.id === draftModel.rootId ? 1 : 0))
    .map((root) => ({ rootId: root.id, label: draft.builder.pieceLabels.get(root.id) ?? root.label, bounds: bboxOf(panels.filter((p) => p.pieceId === root.id).flatMap((p) => p.polygon)) }));
  const blankArea = pieces.length > 1 ? pieces.reduce((s, p) => s + p.bounds.width * p.bounds.height, 0) : all.width * all.height;
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
    features: options.features,
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

/**
 * Face for a panel whose closed normal is not axis aligned (wedge slope, pail wall).
 * Frame: n = closed outward normal, r = world +X, d = r × n (same handedness as FACE_FRAMES).
 */
export function obliqueFace(face: FaceId, panels: DielinePanel[], rootId: string, t: number, closedRotation: [number, number, number, number], panelId: string): FaceInfo | null {
  const input = { panels, rootId, thicknessMm: t, closedRotation };
  const poses = computePoses(input, 1);
  const panel = panels.find((p) => p.id === panelId);
  if (!panel) return null;
  const pose = poses.get(panel.id)!;
  const pivot = panelPivot(panel, t);
  const n = new Vector3(0, 0, 1).transformDirection(pose.world).normalize();
  let r = new Vector3(1, 0, 0).sub(n.clone().multiplyScalar(n.x));
  if (r.lengthSq() < 1e-6) r = new Vector3(0, 0, -1);
  r.normalize();
  const d = r.clone().cross(n).normalize();
  const world = (p: Pt) => panelLocalPoint(panel, p, 0, pivot, t).applyMatrix4(pose.world);
  const pts = panel.polygon.map(world);
  const uv = (w: Vector3) => ({ u: w.dot(r), v: w.dot(d) });
  const box = bboxOf(pts.map((w) => ({ x: uv(w).u, y: uv(w).v })));
  const toFace = (p: Pt) => {
    const q = uv(world(p));
    return { u: q.u - box.x, v: q.v - box.y };
  };
  const o = toFace({ x: 0, y: 0 });
  const ex = toFace({ x: 1, y: 0 });
  const ey = toFace({ x: 0, y: 1 });
  const m00 = ex.u - o.u;
  const m10 = ex.v - o.v;
  const m01 = ey.u - o.u;
  const m11 = ey.v - o.v;
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) < 1e-9) return null;
  const i00 = m11 / det;
  const i01 = -m01 / det;
  const i10 = -m10 / det;
  const i11 = m00 / det;
  const transform = [i00, i10, i01, i11, -(i00 * o.u + i01 * o.v), -(i10 * o.u + i11 * o.v)].map((x) => (Math.abs(x) < 1e-12 ? 0 : x)) as Affine;
  return { face, width: box.width, height: box.height, parts: [{ panelId, rect: { x: 0, y: 0, width: box.width, height: box.height }, transform }] };
}
