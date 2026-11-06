import { Euler, Mat4 as Matrix4, Quat as Quaternion, Vec3 as Vector3 } from "@/lib/dieline/math";
import { z } from "zod";
import type { Dims } from "@/types";
import { DielineBuilder, edgeBleed, panelCreases, rectEdges } from "../../builder";
import { boundsAt, computeFaces } from "../../fold";
import { bboxOf, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import { DielineValidationError, thicknessSchema, type DimsIssue } from "../../limits";
import type { DielinePanel, DielinePiece, PanelRole, Polygon, Pt, Rect, Segment } from "../../types";
import type { FittingDefinition, FittingDraft, FittingModel, FittingOptionKey, FittingParams, ResolvedFittingParams } from "./types";

export const DEFAULT_BLEED_MM = 3;
/** Corrugated safe zone (same as the core engine's corrugated default). */
export const DEFAULT_SAFE_MM = 5;
/** Default fit allowance per dimension (host inner − fitting outer), mm. */
export const DEFAULT_CLEARANCE_MM = 3;

/* ───────────────────────── rotations ───────────────────────── */

export type Quat = [number, number, number, number];
export const IDENTITY: Quat = [0, 0, 0, 1];

/** Quaternion from Euler angles in degrees (applied X, then Y, then Z unless `order`). */
export function quatDeg(x: number, y: number, zr: number, order: "XYZ" | "YXZ" | "ZYX" = "YXZ"): Quat {
  const r = Math.PI / 180;
  const q = new Quaternion().setFromEuler(new Euler(x * r, y * r, zr * r, order));
  return [q.x, q.y, q.z, q.w];
}

/** Root lies flat, printed (outside) surface DOWN, sheet top toward the front (+Z). */
export const FLAT_PRINT_DOWN: Quat = quatDeg(90, 0, 0);
/** Root lies flat, printed surface UP (pads, cushion tops), sheet top toward the back. */
export const FLAT_PRINT_UP: Quat = quatDeg(-90, 0, 0);
/** As FLAT_PRINT_DOWN, then turned 90° about Y: the chain (sheet x) runs along host W. */
export const FLAT_PRINT_DOWN_ALONG_W: Quat = quatDeg(90, 90, 0, "YXZ");
export const FLAT_PRINT_UP_ALONG_W: Quat = quatDeg(-90, 90, 0, "YXZ");

/* ───────────────────────── chain builder ───────────────────────── */

export interface ChainPanel {
  len: number;
  /** Fold angle relative to the neighbour toward the root (deg, + = toward the unprinted side). */
  fold?: number;
  role?: PanelRole;
  label?: string;
  stage?: number;
  stack?: number;
  /** Default: 1 for folds > 135°, 0 otherwise (negative folds pivot on the printed face). */
  pivotDepth?: number;
  printable?: boolean;
  /** Glue tab: trapezoid outline, ink-free. */
  glue?: boolean;
  holes?: (r: Rect) => Polygon[];
}

/**
 * A row of rectangular panels of the same `width`, laid along sheet x, joined by parallel
 * creases. `rootIndex` is the panel that stays still; the others hinge outward from it.
 * Returns the panel ids in order and each panel's sheet rect.
 */
export function chain(
  b: DielineBuilder,
  width: number,
  panels: ChainPanel[],
  rootIndex: number,
  opts: { prefix?: string; origin?: Pt; rootRole?: PanelRole } = {},
): { ids: string[]; rects: Rect[] } {
  const prefix = opts.prefix ?? "p";
  const ox = opts.origin?.x ?? 0;
  const oy = opts.origin?.y ?? 0;
  const rects: Rect[] = [];
  let x = ox;
  for (const p of panels) {
    rects.push({ x, y: oy, width: p.len, height: width });
    x += p.len;
  }
  const ids = panels.map((_, i) => `${prefix}${i}`);
  const r0 = rects[rootIndex];
  const root = panels[rootIndex];
  const rootPoly: Polygon = [
    { x: r0.x, y: r0.y },
    { x: r0.x + r0.width, y: r0.y },
    { x: r0.x + r0.width, y: r0.y + r0.height },
    { x: r0.x, y: r0.y + r0.height },
  ];
  const rp = b.root(ids[rootIndex], opts.rootRole ?? root.role ?? "bottom", rootPoly, root.label ?? ids[rootIndex], { holes: root.holes?.(r0) });
  if (root.printable === false) rp.printable = false;
  b.pieceLabels.set(rp.id, "Fitting");
  const attachOne = (i: number, parent: number, edge: "left" | "right") => {
    const p = panels[i];
    const fold = p.fold ?? 90;
    const hinge = rectEdges(rects[parent])[edge];
    const shape = p.glue ? { kind: "trapezoid" as const, taperA: Math.min(p.len * 0.6, width * 0.2), taperB: Math.min(p.len * 0.6, width * 0.2) } : { kind: "rect" as const };
    b.attach(ids[i], p.glue ? "glue" : (p.role ?? "inner"), ids[parent], hinge, p.len, shape, {
      fold,
      stage: p.stage ?? 0,
      stack: p.stack ?? 0,
      pivotDepth: p.pivotDepth ?? (fold > 135 ? 1 : 0),
      printable: p.printable ?? !p.glue,
      label: p.label ?? (p.glue ? "Glue tab" : ids[i]),
      holes: p.holes?.(rects[i]),
    });
  };
  for (let i = rootIndex + 1; i < panels.length; i++) attachOne(i, i - 1, "right");
  for (let i = rootIndex - 1; i >= 0; i--) attachOne(i, i + 1, "left");
  return { ids, rects };
}

/** Rect panel hinged on one edge of an existing rect panel. */
export function flapOn(
  b: DielineBuilder,
  id: string,
  parentId: string,
  parentRect: Rect,
  edge: "top" | "right" | "bottom" | "left",
  depth: number,
  o: { fold?: number; role?: PanelRole; stage?: number; stack?: number; pivotDepth?: number; label?: string; glue?: boolean; inset?: number; holes?: (r: Rect) => Polygon[] } = {},
): Rect {
  const fold = o.fold ?? 90;
  const [a0, b0] = rectEdges(parentRect)[edge];
  const ins = o.inset ?? 0;
  const dirx = Math.sign(b0.x - a0.x);
  const diry = Math.sign(b0.y - a0.y);
  const a = { x: a0.x + dirx * ins, y: a0.y + diry * ins };
  const bb = { x: b0.x - dirx * ins, y: b0.y - diry * ins };
  const taper = o.glue ? Math.min(depth * 0.6, Math.hypot(bb.x - a.x, bb.y - a.y) * 0.2) : 0;
  const p = b.attach(id, o.glue ? "glue" : (o.role ?? "inner"), parentId, [a, bb], depth, o.glue ? { kind: "trapezoid", taperA: taper, taperB: taper } : { kind: "rect" }, {
    fold,
    stage: o.stage ?? 0,
    stack: o.stack ?? 0,
    pivotDepth: o.pivotDepth ?? (fold > 135 ? 1 : 0),
    printable: !o.glue,
    label: o.label ?? id,
  });
  if (o.holes) {
    const hs = o.holes(p.bbox);
    if (hs.length) p.holes = hs;
  }
  return p.bbox;
}

/**
 * Right-triangle brace hinged on a panel (cushion rails, corner braces, corner posts): leg
 * folded 90°, hypotenuse face folded 135°, glue tab folded 135° back onto the parent's
 * unprinted face. Compensated for the board so the closed section is exactly `s` × `s`:
 * - the face pivots (√2 − 1)·t below its printed surface, so its bevelled end stays inside
 *   the leg instead of sticking out past it,
 * - the leg is shortened by (1 − 1/√2)·t, the depth that pivot adds below the leg,
 * - the face ends one caliper short of the parent, so the glue tab lies flat against the
 *   parent's back instead of inside it (no z-fighting with the parent).
 */
export function triangleBrace(s: number, glue: number, t: number, labels: { leg?: string; face?: string } = {}): ChainPanel[] {
  return [
    { len: s - (1 - Math.SQRT1_2) * t, fold: 90, label: labels.leg ?? "Leg" },
    { len: Math.SQRT2 * (s - t), fold: 135, pivotDepth: Math.SQRT2 - 1, label: labels.face ?? "Brace face" },
    { len: glue, fold: 135, glue: true },
  ];
}

/* ───────────────────────── params ───────────────────────── */

/** zod schema for one fitting's params (host dims within limits + declared options). */
export function fittingSchema(def: FittingDefinition) {
  const axis = (k: "L" | "W" | "H") =>
    z
      .number({ invalid_type_error: "INVALID", required_error: "INVALID" })
      .finite()
      .superRefine((v, ctx) => {
        const r = def.hostLimits[k];
        if (v < r.min) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_SMALL", limit: r.min } });
        else if (v > r.max) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_LARGE", limit: r.max } });
      });
  const optShape: Record<string, z.ZodTypeAny> = {};
  for (const [k, spec] of Object.entries(def.options)) {
    let n = z.number({ invalid_type_error: "INVALID" }).finite();
    if (spec!.int) n = n.int();
    optShape[k] = n
      .superRefine((v, ctx) => {
        if (v < spec!.min) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_SMALL", limit: spec!.min } });
        else if (v > spec!.max) ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_LARGE", limit: spec!.max } });
      })
      .optional();
  }
  return z.object({ host: z.object({ L: axis("L"), W: axis("W"), H: axis("H") }), ...optShape }).strip();
}

/** Simple rule strings over host dims ("W < L", "H <= W"), as in the core limits. */
function checkRule(rule: string, d: Dims): boolean | null {
  const m = /^\s*([LWH])\s*(<=|>=|==|<|>)\s*([LWH])\s*$/.exec(rule);
  if (!m) return null;
  const a = d[m[1] as keyof Dims];
  const c = d[m[3] as keyof Dims];
  switch (m[2]) {
    case "<=":
      return a <= c + 1e-9;
    case ">=":
      return a + 1e-9 >= c;
    case "==":
      return Math.abs(a - c) < 0.5;
    case "<":
      return a < c;
    default:
      return a > c;
  }
}

export type FittingValidation = { ok: true; params: ResolvedFittingParams } | { ok: false; issues: DimsIssue[] };

/** Validate host dims + options, apply defaults and option ranges that depend on the host. */
export function validateFittingParams(def: FittingDefinition, input: unknown): FittingValidation {
  const parsed = fittingSchema(def).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => {
        const params = (i as { params?: { code?: DimsIssue["code"]; limit?: number } }).params;
        return {
          path: i.path.join("."),
          code: params?.code ?? "INVALID",
          ...(params?.limit !== undefined ? { limit: params.limit } : {}),
        };
      }),
    };
  }
  const data = parsed.data as FittingParams;
  const issues: DimsIssue[] = [];
  for (const rule of def.hostLimits.rules ?? []) {
    if (checkRule(rule, data.host) === false) issues.push({ path: `host.${/^\s*([LWH])/.exec(rule)?.[1] ?? "L"}`, code: "RULE", rule });
  }
  const out: ResolvedFittingParams = { host: { ...data.host } };
  for (const [k, spec] of Object.entries(def.options) as [FittingOptionKey, NonNullable<FittingDefinition["options"][FittingOptionKey]>][]) {
    const v = data[k];
    out[k] = v ?? (typeof spec.default === "function" ? spec.default(data.host, data) : spec.default);
    if (spec.int) out[k] = Math.round(out[k]!);
    // Host-dependent defaults are clamped into the static range.
    if (v === undefined) out[k] = Math.min(spec.max, Math.max(spec.min, out[k]!));
  }
  // Height-like options never exceed the host's inner height.
  for (const k of ["heightMm", "highMm"] as const) {
    if (out[k] !== undefined && out[k]! > data.host.H + 1e-9) issues.push({ path: k, code: "TOO_LARGE", limit: data.host.H });
  }
  if (!issues.length && def.check) issues.push(...def.check(out));
  if (issues.length) return { ok: false, issues };
  return { ok: true, params: out };
}

/* ───────────────────────── finalize ───────────────────────── */

export interface FittingOptions {
  /** Board caliper, mm (BOARD_SPECS[material].thicknessMm). */
  thicknessMm: number;
  bleedMm?: number;
  safeMm?: number;
}

/**
 * Turn a draft into a FittingModel (same steps as the core engine's buildDieline: normalise
 * to the sheet, cut / crease / bleed / safe zones / faces / metrics), plus the placement in
 * the host box.
 */
export function finalizeFitting(def: FittingDefinition, params: ResolvedFittingParams, draft: FittingDraft, o: FittingOptions): FittingModel {
  const t = o.thicknessMm;
  const bleed = o.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = o.safeMm ?? DEFAULT_SAFE_MM;
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

  const bleedRegions = panels
    .filter((p) => p.printable)
    .map((p) => {
      const creases = panelCreases(p, panels);
      const distances = edgesOf(p.polygon).map((e) => edgeBleed(e, creases, panels, bleed));
      return { panelId: p.id, polygon: offsetConvex(p.polygon, distances) as Polygon };
    });

  const foldInput = { panels, rootId: draft.builder.rootId, thicknessMm: t, closedRotation: draft.closedRotation };
  const computed = computeFaces(foldInput, draft.faceDepthTol);
  const faces = draft.faces ? draft.faces(panels, computed.faces) : computed.faces;
  // Every printable panel gets a safe zone (fittings are often printed on several faces).
  const safeZones = draft.safeZones
    ? draft.safeZones(panels, safe)
    : panels.filter((p) => p.printable && p.role !== "glue").map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));
  const printPolys = bleedRegions.map((r) => r.polygon);

  const pieces: DielinePiece[] = panels
    .filter((p) => p.parentId === null)
    .sort((a, b) => (a.id === foldInput.rootId ? -1 : b.id === foldInput.rootId ? 1 : 0))
    .map((root) => ({
      rootId: root.id,
      label: draft.builder.pieceLabels.get(root.id) ?? root.label,
      bounds: bboxOf(panels.filter((p) => p.pieceId === root.id).flatMap((p) => p.polygon)),
    }));
  const blankArea = pieces.length > 1 ? pieces.reduce((s, p) => s + p.bounds.width * p.bounds.height, 0) : all.width * all.height;
  const holeArea = (p: DielinePanel) => (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0);

  // Placement: model space → host inner space.
  let matrix: Matrix4;
  if ("matrix" in draft.anchor) {
    matrix = new Matrix4().fromArray(draft.anchor.matrix);
  } else {
    const box = boundsAt(foldInput, 1);
    const a = draft.anchor;
    matrix = new Matrix4().makeTranslation(a.x - box.min.x, a.y - box.min.y, a.z - box.min.z);
  }

  return {
    structureCode: def.code,
    params,
    dims: { ...params.host },
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
    films: [],
    features: {},
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
    placement: { matrix: matrix.toArray(), slot: def.slot, host: { ...params.host } },
  };
}

/** Closed bounds of a fitting in host inner space (mm). */
export function placedBounds(model: FittingModel): { min: Vector3; max: Vector3 } {
  const box = boundsAt(model, 1).applyMatrix4(new Matrix4().fromArray(model.placement.matrix));
  return { min: box.min, max: box.max };
}

/** Printable board area (mm², no bleed) and safe-zone area (mm²) of a fitting. */
export function printArea(model: Pick<FittingModel, "panels" | "safeZones" | "bleedRegions">): { printableMm2: number; safeMm2: number; bleedMm2: number } {
  const printable = model.panels.filter((p) => p.printable);
  return {
    printableMm2: printable.reduce((s, p) => s + polygonArea(p.polygon) - (p.holes ?? []).reduce((h, q) => h + polygonArea(q), 0), 0),
    safeMm2: model.safeZones.reduce((s, z) => s + Math.max(0, z.rect.width) * Math.max(0, z.rect.height), 0),
    bleedMm2: model.bleedRegions.reduce((s, r) => s + polygonArea(r.polygon), 0),
  };
}

/** Generate a fitting. Throws DielineValidationError on invalid params / thickness. */
export function generateFittingFor(def: FittingDefinition, input: FittingParams, options: FittingOptions): FittingModel {
  const v = validateFittingParams(def, input);
  if (!v.ok) throw new DielineValidationError(v.issues);
  if (!thicknessSchema.safeParse(options.thicknessMm).success) throw new DielineValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  const draft = def.build(v.params, options.thicknessMm);
  return finalizeFitting(def, v.params, draft, options);
}

export { DielineBuilder };
