import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import { z } from "zod";
import type { Dims, StructureFeatures } from "@/types";
import { edgeBleed, panelCreases } from "../../builder";
import { computeFaces } from "../../fold";
import { bboxOf, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import { DielineValidationError, thicknessSchema, type DimsIssue } from "../../limits";
import type { DielineOptions, DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "../../types";
import { trimFaces } from "../fefco-02/kit";
import type { FamilyDielineModel, FamilyStructureDef } from "./types";

/**
 * Local finaliser: the same pipeline as buildDieline() in ../../generate.ts (normalise to
 * bleed, cut/crease/perf lines, bleed, faces, safe zones, pieces, metrics), keyed by a
 * FamilyStructureDef instead of a StructureCode.
 *
 * One difference the integrator must port (README): creases that are not hinges
 * (`builder.extraCreases`) are subtracted from the cut lines, so a gusset's web edge,
 * where board stays joined to two walls, is creased and not cut.
 */

export const DEFAULT_BLEED_MM = 3;

/** zod schema of one style's inner dims (limits + simple rules such as "L == W"). */
export function familyDimsSchema(def: FamilyStructureDef) {
  const axis = (k: "L" | "W" | "H") =>
    z
      .number()
      .finite()
      .superRefine((v, ctx) => {
        const r = def.params[k];
        if (v < r.min) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_SMALL", limit: r.min } });
        else if (v > r.max) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_LARGE", limit: r.max } });
      });
  return z.object({ L: axis("L"), W: axis("W"), H: axis("H") }).superRefine((d, ctx) => {
    for (const rule of def.params.rules ?? []) {
      const m = /^\s*([LWH])\s*(<=|>=|==|<|>)\s*([LWH])\s*$/.exec(rule);
      if (!m) continue;
      const a = d[m[1] as keyof Dims];
      const b = d[m[3] as keyof Dims];
      const ok = m[2] === "<=" ? a <= b + 1e-9 : m[2] === ">=" ? a + 1e-9 >= b : m[2] === "==" ? Math.abs(a - b) < 0.5 : m[2] === "<" ? a < b : a > b;
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [m[1]], params: { code: "RULE", rule } });
    }
  });
}

export function validateFamilyDims(def: FamilyStructureDef, dims: unknown): { ok: true; dims: Dims } | { ok: false; issues: DimsIssue[] } {
  const parsed = familyDimsSchema(def).safeParse(dims);
  if (parsed.success) return { ok: true, dims: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => {
      const params = (i as { params?: { code?: DimsIssue["code"]; limit?: number; rule?: string } }).params;
      return {
        path: String(i.path[0] ?? ""),
        code: params?.code ?? "INVALID",
        ...(params?.limit !== undefined ? { limit: params.limit } : {}),
        ...(params?.rule ? { rule: params.rule } : {}),
      };
    }),
  };
}

/** Drop features the style cannot make (this family supports the lid / cap depth only). */
export function familyFeatures(def: FamilyStructureDef, f: StructureFeatures | undefined): StructureFeatures {
  const out: StructureFeatures = {};
  if (def.features.lidHeight && typeof f?.lidHeightMm === "number" && Number.isFinite(f.lidHeightMm) && f.lidHeightMm > 0) out.lidHeightMm = f.lidHeightMm;
  return out;
}

export function generateFamilyDieline(def: FamilyStructureDef, dims: Dims, options: DielineOptions): FamilyDielineModel {
  const v = validateFamilyDims(def, dims);
  if (!v.ok) throw new DielineValidationError(v.issues);
  if (!thicknessSchema.safeParse(options.thicknessMm).success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  return buildFamilyDieline(def, v.dims, options);
}

function buildFamilyDieline(def: FamilyStructureDef, dims: Dims, options: DielineOptions): FamilyDielineModel {
  const t = options.thicknessMm;
  const bleed = options.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = options.safeMm ?? (def.family === "CORRUGATED" ? 5 : 3);
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
      const distances = edgesOf(p.polygon).map((e) => edgeBleed(e, creases, panels, bleed));
      return { panelId: p.id, polygon: offsetConvex(p.polygon, distances) as Polygon };
    });

  const draftModel = { panels, rootId: draft.builder.rootId, thicknessMm: t, closedRotation: draft.closedRotation };
  const computed = computeFaces(draftModel, draft.faceDepthTol);
  // Faces cropped to the panels that carry them: an octagon's flat side, a tray floor smaller
  // than the lid over it. Artwork centred on a face then lands on the panel.
  const faces = trimFaces(draft.faces ? draft.faces(panels, computed.faces) : computed.faces);
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
