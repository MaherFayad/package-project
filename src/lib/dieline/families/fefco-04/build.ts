import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import { z } from "zod";
import type { Dims, StructureFeatures } from "@/types";
import { panelCreases } from "../../builder";
import { computeFaces } from "../../fold";
import { bboxOf, clamp, coveredFraction, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import { DielineValidationError, thicknessSchema, type DimsIssue } from "../../limits";
import type { DielineOptions, DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "../../types";
import type { Fefco04Definition, Fefco04Model } from "./types";

/**
 * Model assembly for family definitions. Same post-processing as the core `buildDieline`
 * (src/lib/dieline/generate.ts), which is keyed by the closed StructureCode union and so
 * cannot run family codes yet. The integrator can delete this once GENERATORS accepts them.
 */

export const DEFAULT_BLEED_MM = 3;
export const CORRUGATED_SAFE_MM = 5;

const RULE = /^\s*([LWH])\s*(<=|>=|==|<|>)\s*([LWH])\s*$/;

function ruleHolds(rule: string, d: Dims): boolean {
  const m = RULE.exec(rule);
  if (!m) return true;
  const a = d[m[1] as keyof Dims];
  const b = d[m[3] as keyof Dims];
  switch (m[2]) {
    case "<=":
      return a <= b + 1e-9;
    case ">=":
      return a + 1e-9 >= b;
    case "==":
      return Math.abs(a - b) < 0.5;
    case "<":
      return a < b;
    default:
      return a > b;
  }
}

/** zod schema for a definition's inner dims (limits + rules). */
export function familyDimsSchema(def: Pick<Fefco04Definition, "params">) {
  const { L, W, H, rules = [] } = def.params;
  const n = (r: { min: number; max: number }) => z.number().finite().min(r.min).max(r.max);
  return z
    .object({ L: n(L), W: n(W), H: n(H) })
    .superRefine((d, ctx) => {
      for (const rule of rules) if (!ruleHolds(rule, d)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule, params: { rule } });
    });
}

export type FamilyDimsValidation = { ok: true; dims: Dims } | { ok: false; issues: DimsIssue[] };

export function validateFamilyDims(def: Pick<Fefco04Definition, "params">, dims: Dims): FamilyDimsValidation {
  const r = familyDimsSchema(def).safeParse(dims);
  if (r.success) return { ok: true, dims: r.data };
  return {
    ok: false,
    issues: r.error.issues.map((i): DimsIssue => {
      const path = String(i.path[0] ?? "structureCode");
      if (i.code === "too_small") return { path, code: "TOO_SMALL", limit: Number(i.minimum) };
      if (i.code === "too_big") return { path, code: "TOO_LARGE", limit: Number(i.maximum) };
      if (i.code === "custom") return { path: "dims", code: "RULE", rule: String(i.params?.rule ?? i.message) };
      return { path, code: "INVALID" };
    }),
  };
}

/** Keep the features this definition supports (local mirror of `supportedFeatures`). */
export function familyFeatures(def: Pick<Fefco04Definition, "features">, f: StructureFeatures = {}): StructureFeatures {
  const s = def.features;
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
  return out;
}

/** Generate the dieline model of a family definition. Throws DielineValidationError on bad dims. */
export function generateFamilyDieline(def: Fefco04Definition, dims: Dims, options: DielineOptions): Fefco04Model {
  const v = validateFamilyDims(def, dims);
  if (!v.ok) throw new DielineValidationError(v.issues);
  if (!thicknessSchema.safeParse(options.thicknessMm).success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);

  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = options.safeMm ?? CORRUGATED_SAFE_MM;
  const features = familyFeatures(def, options.features);
  const draft = def.generate(v.dims, t, features);
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

  const hinges = panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
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
    structureCode: def.code,
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

export function tryGenerateFamilyDieline(def: Fefco04Definition, dims: Dims, options: DielineOptions): Fefco04Model | null {
  try {
    return generateFamilyDieline(def, dims, options);
  } catch {
    return null;
  }
}
