import { Matrix4 } from "three";
import type { Dims, FaceId, StructureFeatures } from "@/types";
import { DielineBuilder, rectEdges } from "../../builder";
import { tubeSegments } from "../../structures";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { DielinePanel, FaceInfo, FacePart, Polygon, Pt, Segment } from "../../types";
import { WRAP_VISUAL_MM, quat, rect, tabStack, turnInStack } from "./common";
import type { ConstructionSpec, FamilyDraft } from "./types";

/**
 * Paper tubes (composite cans). The dieline is the printed WRAP LABEL of each tube piece. In 3D
 * each label is bent from narrow strips on virtual "roll" hinges (no crease, no cut) into a
 * regular N-gon whose apothem is the tube's outer radius, so the folded inner diameter equals
 * the requested one. Layout of a label, left → right on the sheet: back seam … left side →
 * front → right side … back seam, with a glued overlap at the right end. The front half of the
 * tube is therefore one contiguous rectangle of the label (artwork runs straight across it).
 */

export const TUBE_CLEARANCE_MM = 0.4;
const LABEL_OVERLAP_MM = 10;
/** End discs sit this far proud of / in from the rim (see rolledLabel). */
export const DISC_SEAT_MM = 0.15;

type TubeVariant = "lidBase" | "telescoping" | "rolledEdge" | "pushUp" | "window" | "shoulder";

interface LabelPiece {
  pre: string;
  /** Outer apothem (mm). */
  R: number;
  s: number;
  height: number;
  /** Sheet position of strip 0's top-left corner. */
  x0: number;
  y0: number;
  /** Top edge in the body root's (unrotated) model frame. */
  topY: number;
  printable: boolean;
  /** Visible on the closed tube (faces). */
  visible: boolean;
}

interface LabelOpts {
  N: number;
  piece?: { label: string; matrix: number[]; stage: number; lift: number };
  rootLabel: string;
  window?: { k0: number; k1: number; yTop: number; yBot: number };
  curlTop?: number;
  curlBottom?: number;
  disc?: { where: "top" | "bottom"; printable: boolean };
  role: "front" | "inner";
}

/** Strip index → whether it belongs to the front half. */
const isFront = (k: number, N: number) => k >= N / 4 && k < (3 * N) / 4;

/**
 * Lay one wrap label on the sheet and build its strip tree. Root = strip N/4 (the left side),
 * chains run right (to the overlap) and left (to the seam).
 */
function rolledLabel(b: DielineBuilder, L: LabelPiece, o: LabelOpts, virtualEdges: Segment[], t: number) {
  const { N } = o;
  const { s, height: h, x0, y0, pre } = L;
  const roll = 360 / N;
  const kr = N / 4;
  const sr = (k: number) => rect(x0 + k * s, y0, s, h);
  const win = o.window;
  const split = (k: number) => !!win && k >= win.k0 && k < win.k1;
  const role = (k: number) => (o.role === "inner" ? "inner" : isFront(k, N) ? "front" : "back");
  const opts = (extra: object = {}) => ({ fold: roll, stage: 0, hingeKind: "roll" as const, printable: L.printable, label: `${o.rootLabel} strip`, ...extra });
  const ids = new Map<number, { full?: string; top?: string; bot?: string }>();
  const id = (k: number, part = "") => `${pre}${k}${part}`;

  const rootPoly = rectPolygon(sr(kr).x, y0, s, h);
  if (o.piece) b.piece(id(kr), role(kr), rootPoly, o.piece.label, { matrix: o.piece.matrix, stage: o.piece.stage, lift: o.piece.lift }, { label: o.rootLabel });
  else {
    b.root(id(kr), role(kr), rootPoly, o.rootLabel);
    b.pieceLabels.set(id(kr), o.rootLabel);
  }
  b.byId(id(kr)).printable = L.printable;
  ids.set(kr, { full: id(kr) });

  const yT = win ? y0 + win.yTop : 0;
  const yB = win ? y0 + win.yBot : 0;
  /** Edge between strip `k` and `k + side` at x, from ya to yb. */
  const vseg = (x: number, ya: number, yb: number): [Pt, Pt] => [pt(x, ya), pt(x, yb)];

  const step = (p: number, k: number, dir: 1 | -1) => {
    const x = dir === 1 ? x0 + k * s : x0 + (k + 1) * s; // shared edge
    const P = ids.get(p)!;
    const r = sr(k);
    if (!split(k)) {
      if (P.full) b.attach(id(k), role(k), P.full, vseg(x, y0, y0 + h), s, { kind: "rect" }, opts());
      else {
        b.attachPoly(id(k), role(k), P.top!, vseg(x, y0, yT), rectPolygon(r.x, r.y, s, h), opts());
        virtualEdges.push({ a: pt(x, yB), b: pt(x, y0 + h) });
      }
      ids.set(k, { full: id(k) });
      return;
    }
    const topParent = P.full ?? P.top!;
    const botParent = P.full ?? P.bot!;
    b.attachPoly(id(k, "t"), role(k), topParent, vseg(x, y0, yT), rectPolygon(r.x, y0, s, yT - y0), opts());
    b.attachPoly(id(k, "b"), role(k), botParent, vseg(x, yB, y0 + h), rectPolygon(r.x, yB, s, y0 + h - yB), opts());
    ids.set(k, { top: id(k, "t"), bot: id(k, "b") });
  };
  for (let k = kr + 1; k < N; k++) step(k - 1, k, 1);
  for (let k = kr - 1; k >= 0; k--) step(k + 1, k, -1);
  // Glued overlap at the right end (under strips 0, 1… when wrapped). It is wider than a strip
  // on most tubes (10 mm vs 3.7 mm on a 25 mm push-up), so it bends on the same roll hinges:
  // one flat panel cut a chord out through the curved wall (a grey stripe down the back).
  let parent = ids.get(N - 1)!.full!;
  let left = LABEL_OVERLAP_MM;
  for (let k = 0; left > 1e-6; k++) {
    const w = Math.min(s, left);
    const x = x0 + N * s + k * s;
    const id = k === 0 ? `${pre}Glue` : `${pre}Glue${k + 1}`;
    b.attach(id, "glue", parent, [pt(x, y0), pt(x, y0 + h)], w, { kind: "rect" }, { ...opts({ stack: tabStack(t), printable: false }), label: "Label overlap" });
    parent = id;
    left -= w;
  }

  // Curled / turned-in edges: one flap per strip, continuous paper (virtual seams).
  const curl = (where: "top" | "bottom", depth: number) => {
    for (let k = 0; k < N; k++) {
      const P = ids.get(k)!;
      const parent = where === "top" ? (P.full ?? P.top!) : (P.full ?? P.bot!);
      const e = where === "top" ? rectEdges(sr(k)).top : rectEdges(sr(k)).bottom;
      b.attach(`${pre}${k}C${where[0]}`, "inner", parent, e, depth, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 1, stack: turnInStack(t), printable: L.printable, label: "Curled edge" });
      if (k < N - 1) {
        const x = x0 + (k + 1) * s;
        virtualEdges.push(where === "top" ? { a: pt(x, y0 - depth), b: pt(x, y0) } : { a: pt(x, y0 + h), b: pt(x, y0 + h + depth) });
      }
    }
  };
  if (o.curlTop) curl("top", o.curlTop);
  if (o.curlBottom) curl("bottom", o.curlBottom);

  if (o.disc) {
    const rootId = id(kr);
    const hinge = o.disc.where === "top" ? rectEdges(sr(kr)).top : rectEdges(sr(kr)).bottom;
    const fr = b.frame(rootId, hinge);
    const poly: Polygon = [];
    let ux = 0;
    let uy = 0;
    for (let i = 0; i < N; i++) {
      poly.push(fr.at(fr.a, ux, uy));
      const a = (i * 2 * Math.PI) / N;
      ux += Math.cos(a) * s;
      uy += Math.sin(a) * s;
    }
    // Pivot DISC_SEAT_MM below the surface: the folded disc rises that much above the rim and
    // steps in from the hinge side, so its face never lies in the plane of the strips' rim
    // edges (pale flecks round the cap) and its side faces stay behind the label.
    b.attachPoly(`${pre}${o.disc.where === "top" ? "Top" : "Bottom"}`, o.disc.where, rootId, hinge, poly, { stage: 1, pivotDepth: DISC_SEAT_MM / t, label: o.disc.where === "top" ? "Lid top" : "End disc", printable: o.disc.printable });
  }
  return ids;
}

export interface TubeLayout {
  N: number;
  pieces: LabelPiece[];
}

/** Shared tube generator for all variants. L = W = inner diameter, H = inner height. */
export function tubeDraft(variant: TubeVariant, dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  const D = dims.L;
  const H = dims.H;
  const c = TUBE_CLEARANCE_MM;
  const b = new DielineBuilder();
  const virtualEdges: Segment[] = [];
  const shoulder = variant === "shoulder";
  const Rin = D / 2 + t; // outer apothem of the innermost load-bearing tube
  // Shoulder: the body sleeve sits on the neck; its label overlap (half a paper proud inside)
  // needs that much room.
  const Rbody = shoulder ? Rin + t + WRAP_VISUAL_MM / 2 : Rin;
  const N = tubeSegments(2 * Rbody);
  const tan = Math.tan(Math.PI / N);
  const sOf = (R: number) => 2 * R * tan;
  const kr = N / 4;

  // Depths.
  const lidDefault = variant === "telescoping" ? Math.round(H * 0.75) : clamp(Math.round(H * 0.28), 20, 60);
  const lidMax = variant === "telescoping" ? H : Math.max(15, H * 0.6);
  const lidD = clamp(f.lidHeightMm ?? lidDefault, 15, lidMax);
  const e = shoulder ? clamp(f.lidHeightMm ?? clamp(Math.round(H * 0.25), 15, 50), 10, H * 0.6) : 0;
  const curl = variant === "rolledEdge" ? clamp(Math.round(D * 0.08), 4, 8) : 0;
  const pushUp = variant === "pushUp";

  // Body label. Body has a bottom end disc (t) unless push-up (open bottom).
  const Hb = shoulder ? H - e + t : pushUp ? H : H + t;
  const bodyR = Rbody;
  const sb = sOf(bodyR);
  const topMargin = curl ? curl + 10 : 10;
  const body: LabelPiece = { pre: "body", R: bodyR, s: sb, height: Hb, x0: 0, y0: topMargin, topY: Hb / 2, printable: true, visible: true };
  const floorY = -Hb / 2 + (pushUp ? 0 : t);

  // Window on the body front, below the lid.
  let window: LabelOpts["window"];
  const visTop = shoulder ? 0 : lidD; // label y below which the body shows
  if (variant === "window" || f.window) {
    const wr = f.window?.widthRatio ?? 0.4;
    const hr = f.window?.heightRatio ?? 0.7;
    const nw = Math.max(2, Math.min(N / 2 - 4, Math.round((N / 2) * wr)));
    const k0 = N / 2 - Math.floor(nw / 2);
    const avail = Hb - (pushUp ? 0 : t) - visTop - 24;
    const wh = avail * hr;
    if (wh >= 15) {
      const yTop = visTop + 12 + (avail - wh) / 2;
      window = { k0, k1: k0 + nw, yTop, yBot: yTop + wh };
    }
  }
  const bodyIds = rolledLabel(b, body, { N, rootLabel: "Body label", window, curlTop: curl || undefined, disc: pushUp ? undefined : { where: "bottom", printable: false }, role: "front" }, virtualEdges, t);
  if (window) {
    const mid = bodyIds.get(N / 2)!;
    const x0 = body.x0 + window.k0 * sb;
    const x1 = body.x0 + window.k1 * sb;
    const g = 4;
    b.films.push({ panelId: mid.top ?? mid.full!, polygon: rectPolygon(x0 - g, body.y0 + window.yTop - g, x1 - x0 + 2 * g, window.yBot - window.yTop + 2 * g) });
  }

  // Concentric pieces: pose in the body root's frame, then the closing rotation.
  const closedRotation = quat(0, -Math.PI / 2 + Math.PI / N, 0);
  const rot = new Matrix4().makeRotationY(-Math.PI / 2 + Math.PI / N);
  const pieceMatrix = (p: LabelPiece) => {
    const xpc = p.x0 + kr * p.s + p.s / 2;
    return rot.clone().multiply(new Matrix4().makeTranslation(-xpc, p.topY + p.y0, p.R - bodyR)).toArray();
  };
  let y = body.y0 + Hb + 2 * bodyR + 25;
  const pieces: LabelPiece[] = [body];

  if (shoulder) {
    const Rn = Rin;
    const neck: LabelPiece = { pre: "neck", R: Rn, s: sOf(Rn), height: H, x0: 0, y0: y, topY: floorY + H, printable: true, visible: false };
    neck.x0 = body.x0 + kr * sb + sb / 2 - (kr * neck.s + neck.s / 2);
    rolledLabel(b, neck, { N, rootLabel: "Neck label", role: "inner", piece: { label: "Neck", matrix: pieceMatrix(neck), stage: 2, lift: H * 0.8 } }, virtualEdges, t);
    pieces.push(neck);
    y += H + 25;
  }
  if (pushUp) {
    const Rp = Rin - t - 0.3;
    const hp = clamp(Math.round(H * 0.25), 15, 40);
    const pusher: LabelPiece = { pre: "push", R: Rp, s: sOf(Rp), height: hp, x0: 0, y0: y + 2 * Rp, topY: floorY + hp, printable: false, visible: false };
    pusher.x0 = body.x0 + kr * sb + sb / 2 - (kr * pusher.s + pusher.s / 2);
    rolledLabel(b, pusher, { N, rootLabel: "Push-up platform", role: "inner", disc: { where: "top", printable: false }, piece: { label: "Push-up platform", matrix: pieceMatrix(pusher), stage: 2, lift: H * 0.6 } }, virtualEdges, t);
    pieces.push(pusher);
    y += hp + 2 * Rp + 25;
  }
  // Lid (cap).
  const Rl = shoulder ? Rin + t + c : bodyR + t + c;
  const lidDepth = shoulder ? e : lidD;
  const Hl = lidDepth + t;
  const lidTop = shoulder ? floorY + H + t : Hb / 2 + t;
  const lid: LabelPiece = { pre: "lid", R: Rl, s: sOf(Rl), height: Hl, x0: 0, y0: y + 2 * Rl + 5, topY: lidTop, printable: true, visible: true };
  lid.x0 = body.x0 + kr * sb + sb / 2 - (kr * lid.s + lid.s / 2);
  rolledLabel(b, lid, { N, rootLabel: "Lid label", role: "front", curlBottom: curl || undefined, disc: { where: "top", printable: true }, piece: { label: "Lid", matrix: pieceMatrix(lid), stage: 3, lift: H * 0.6 } }, virtualEdges, t);
  pieces.splice(0, 0, lid);

  const faceTop = lidTop;
  const faceHeight = faceTop - -Hb / 2;
  const stripOf = (id: string, pre: string): number => {
    const m = new RegExp(`^${pre}(\\d+)[tb]?$`).exec(id);
    return m ? Number(m[1]) : -1;
  };
  const halfFace = (face: "front" | "back", panels: DielinePanel[]): FaceInfo => {
    const order = face === "front" ? Array.from({ length: N / 2 }, (_, i) => N / 4 + i) : Array.from({ length: N / 2 }, (_, i) => ((3 * N) / 4 + i) % N);
    const parts: FacePart[] = [];
    let clipTop = 0;
    for (const p of pieces) {
      if (!p.visible) continue;
      const v0 = faceTop - p.topY;
      const visFrom = Math.max(v0, clipTop);
      const visTo = Math.min(faceHeight, v0 + p.height);
      const sc = p.s / sb;
      for (const panel of panels) {
        const k = stripOf(panel.id, p.pre);
        if (k < 0) continue;
        const idx = order.indexOf(k);
        if (idx < 0) continue;
        const u = idx * sb;
        const vp0 = v0 + (panel.bbox.y - p.y0);
        const a = Math.max(vp0, visFrom);
        const z = Math.min(vp0 + panel.bbox.height, visTo);
        if (z - a < 0.5) continue;
        parts.push({ panelId: panel.id, rect: { x: u, y: a, width: sb, height: z - a }, transform: [sc, 0, 0, 1, panel.bbox.x - u * sc, panel.bbox.y - vp0] });
      }
      clipTop = Math.max(clipTop, v0 + p.height);
    }
    return { face, width: (N / 2) * sb, height: faceHeight, parts };
  };

  return {
    builder: b,
    closedRotation,
    virtualEdges,
    faces: (panels, computed) => {
      const out: Partial<Record<FaceId, FaceInfo>> = { front: halfFace("front", panels), back: halfFace("back", panels) };
      if (computed.top) out.top = computed.top;
      return out;
    },
    safeZones: (panels, safe) =>
      panels
        .filter((p) => p.printable && p.role !== "glue" && p.role !== "inner")
        .map((p) => ({
          panelId: p.id,
          rect:
            p.role === "top" || p.role === "bottom"
              ? { x: p.bbox.x + safe, y: p.bbox.y + safe, width: Math.max(0, p.bbox.width - 2 * safe), height: Math.max(0, p.bbox.height - 2 * safe) }
              : { x: p.bbox.x, y: p.bbox.y + safe, width: p.bbox.width, height: Math.max(0, p.bbox.height - 2 * safe) },
        })),
  };
}

/** Tube lengths and ends (for vendors). */
export function tubeConstruction(variant: TubeVariant, dims: Dims, t: number, f: StructureFeatures = {}): ConstructionSpec {
  const H = dims.H;
  const D = dims.L;
  const shoulder = variant === "shoulder";
  const lidDefault = variant === "telescoping" ? Math.round(H * 0.75) : clamp(Math.round(H * 0.28), 20, 60);
  const lidD = clamp(f.lidHeightMm ?? lidDefault, 15, variant === "telescoping" ? H : Math.max(15, H * 0.6));
  const e = shoulder ? clamp(f.lidHeightMm ?? clamp(Math.round(H * 0.25), 15, 50), 10, H * 0.6) : 0;
  const boards = [] as ConstructionSpec["boards"];
  const circ = (d: number) => Math.round(Math.PI * d * 10) / 10;
  if (shoulder) {
    boards.push({ label: `Neck tube Ø${D} inner`, widthMm: circ(D + 2 * t), heightMm: H, qty: 1 });
    boards.push({ label: `Body tube Ø${(D + 2 * t).toFixed(1)} inner`, widthMm: circ(D + 4 * t), heightMm: H - e, qty: 1 });
    boards.push({ label: "Cap tube", widthMm: circ(D + 4 * t + 2 * TUBE_CLEARANCE_MM), heightMm: e, qty: 1 });
  } else {
    boards.push({ label: `Body tube Ø${D} inner`, widthMm: circ(D + 2 * t), heightMm: variant === "pushUp" ? H : H, qty: 1 });
    boards.push({ label: "Cap tube", widthMm: circ(D + 2 * t + 2 * TUBE_CLEARANCE_MM + 2 * t), heightMm: lidD, qty: 1 });
  }
  const extras = ["Wrap label printed, laminated, 10 mm glued overlap at the back seam"];
  if (variant === "pushUp") extras.push("Push-up platform tube with board disc; bottom stays open (push from below)");
  else extras.push("Board end disc glued in the base (or metal / plastic end on request)");
  if (variant === "rolledEdge") extras.push("Rolled (curled) rims on the body top and cap bottom");
  if (variant === "window" || f.window) extras.push("Clear PET film behind the label window");
  return { boards, extras };
}
