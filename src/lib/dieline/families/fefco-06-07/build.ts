import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import { z } from "zod";
import type { Dims, StructureFeatures, StructureParamLimits } from "@/types";
import { panelCreases } from "@/lib/dieline/builder";
import { computeFaces } from "@/lib/dieline/fold";
import {
  bboxOf,
  coveredFraction,
  edgesOf,
  insetRect,
  offsetConvex,
  polygonArea,
  segLength,
  subtractSegments,
} from "@/lib/dieline/geometry";
import { DielineValidationError, thicknessSchema, type DimsIssue, type DimsValidation } from "@/lib/dieline/limits";
import type { DielineOptions, DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "@/lib/dieline/types";
import type { FamilyDielineModel, FamilyStructureDef } from "./types";

export const BLEED_MM = 3;
/** Corrugated default safe zone (mm), same as the core engine. */
export const SAFE_MM = 5;

function checkRule(rule: string, d: Dims): boolean | null {
  const m = /^\s*([LWH])\s*(<=|>=|==|<|>)\s*([LWH])\s*$/.exec(rule);
  if (!m) return null;
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

/** zod schema for a family structure's inner dims (codes: TOO_SMALL / TOO_LARGE / RULE). */
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [/^\s*([LWH])/.exec(rule)?.[1] ?? "L"], params: { code: "RULE", rule } });
      }
    }
  });
}

export function validateFamilyDims(def: Pick<FamilyStructureDef, "params">, dims: unknown): DimsValidation {
  const parsed = familyDimsSchema(def.params).safeParse(dims);
  if (parsed.success) return { ok: true, dims: parsed.data };
  const issues: DimsIssue[] = parsed.error.issues.map((i) => {
    const params = (i as { params?: { code?: DimsIssue["code"]; limit?: number; rule?: string } }).params;
    return {
      path: String(i.path[0] ?? ""),
      code: params?.code ?? "INVALID",
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
      ...(params?.rule ? { rule: params.rule } : {}),
    };
  });
  return { ok: false, issues };
}

/**
 * Generate a dieline model for a FEFCO 06/07 definition. Same post-processing as the core
 * `generateDieline` (normalise to the sheet, cut / crease extraction, bleed, safe zones,
 * faces, metrics), except that non-hinge creases (web-corner diagonals, glued-corner edges)
 * are also removed from the cut lines.
 */
export function generateFamilyDieline(def: FamilyStructureDef, dims: Dims, options: DielineOptions): FamilyDielineModel {
  const v = validateFamilyDims(def, dims);
  if (!v.ok) throw new DielineValidationError(v.issues);
  if (!thicknessSchema.safeParse(options.thicknessMm).success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  return buildFamilyModel(def, v.dims, options);
}

export function tryGenerateFamilyDieline(def: FamilyStructureDef, dims: Dims, options: DielineOptions): FamilyDielineModel | null {
  try {
    return generateFamilyDieline(def, dims, options);
  } catch {
    return null;
  }
}

function buildFamilyModel(def: FamilyStructureDef, dims: Dims, options: DielineOptions): FamilyDielineModel {
  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? BLEED_MM;
  const safe = options.safeMm ?? SAFE_MM;
  const features: StructureFeatures = {};
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

  const hinges: Segment[] = panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
  const extra = draft.builder.extraCreases.map(mvSeg);
  const creaseLines: Segment[] = [...panels.flatMap((p) => (p.hinge && p.hingeKind !== "roll" ? [p.hinge] : [])), ...extra];
  const cutLines: Segment[] = [];
  for (const p of panels) {
    for (const e of edgesOf(p.polygon)) for (const piece of subtractSegments(e, [...hinges, ...extra, ...cutLines])) cutLines.push(piece);
    for (const h of p.holes ?? []) cutLines.push(...edgesOf(h));
  }
  const perfLines = draft.builder.perfLines.map(mvSeg);
  const films: FilmPatch[] = draft.builder.films.map((f) => ({ panelId: f.panelId, polygon: f.polygon.map(mv) }));

  const bleedRegions = panels
    .filter((p) => p.printable)
    .map((p) => {
      const creases = [...panelCreases(p, panels), ...extra];
      const distances = edgesOf(p.polygon).map((e) => (coveredFraction(e, creases) > 0.98 ? 0 : bleed));
      return { panelId: p.id, polygon: offsetConvex(p.polygon, distances) as Polygon };
    });

  const computed = computeFaces({ panels, rootId: draft.builder.rootId, thicknessMm: t, closedRotation: draft.closedRotation }, draft.faceDepthTol);
  const faces = draft.faces ? draft.faces(panels, computed.faces) : computed.faces;
  const facePanelIds = new Set(Object.values(faces).flatMap((f) => f!.parts.map((x) => x.panelId)));
  const safeZones = draft.safeZones
    ? draft.safeZones(panels, safe)
    : panels.filter((p) => facePanelIds.has(p.id)).map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));

  const pieces: DielinePiece[] = panels
    .filter((p) => p.parentId === null)
    .sort((a, b) => (a.id === draft.builder.rootId ? -1 : b.id === draft.builder.rootId ? 1 : 0))
    .map((root) => ({
      rootId: root.id,
      label: draft.builder.pieceLabels.get(root.id) ?? root.label,
      bounds: bboxOf(panels.filter((p) => p.pieceId === root.id).flatMap((p) => p.polygon)),
    }));
  const blankArea = pieces.length > 1 ? pieces.reduce((s, p) => s + p.bounds.width * p.bounds.height, 0) : all.width * all.height;
  const holeArea = (p: DielinePanel) => (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0);
  const printPolys = bleedRegions.map((r) => r.polygon);

  return {
    structureCode: def.code,
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
      filmAreaM2: 0,
    },
  };
}

/** Printable area (m²) of the outside surface: sum of bleed regions minus holes. */
export function printAreaM2(model: FamilyDielineModel): number {
  const holes = new Map(model.panels.map((p) => [p.id, (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0)]));
  return model.bleedRegions.reduce((s, r) => s + polygonArea(r.polygon) - (holes.get(r.panelId) ?? 0), 0) / 1e6;
}
