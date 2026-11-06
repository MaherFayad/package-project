import { Vec3 as Vector3 } from "@/lib/dieline/math";
import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { cutWindow, stadium } from "../../features";
import { clamp, pt, rectPolygon } from "../../geometry";
import { tuckEndCarton } from "../../structures";
import { crashLockBottom, cutWindowInBand, glueWidth, tube } from "../ecma-tuck/closures";
import type { Polygon } from "../../types";
import { IDENTITY, blockFace, circle, closedBounds, deg, maxStageOf, pieceMatrix, quat, rect, reshape, sheetBox, withDeepParts } from "./kit";
import type { EcmaDraft } from "./types";

/**
 * Open-top glued tube with an automatic crash-lock bottom (ECMA A60). Uses the ECMA tuck
 * family's crash-lock (both main flaps flush on the bottom plane, small chamfers at opposite
 * corners, tongues hooked one caliper in): the core `crashLockCarton` put both main-flap
 * chamfers at the same corner, leaving a triangular hole in the printed bottom that showed
 * the unprinted glue flap (R5-3Q-D-05, was 3d-ecma O-03).
 */
function crashLockTube(dims: Dims, t: number): DielineBuilder {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 5 * t; // up to three flap layers under the product
  const b = new DielineBuilder();
  const w = tube(b, Lp, Wp, Hp, glueWidth(dims.W));
  crashLockBottom(b, w, t, Wp, Lp);
  return b;
}

/* ───────────────────────── Gable carry box (crash-lock bottom, X81 handle) ───────────────────────── */

/**
 * Gable carry box: long-seam-glued carton with an automatic crash-lock bottom (ECMA A60) and
 * a gable top whose two main roof flaps rise into a double-thickness carrying handle (ECMA
 * Group X 81: handle formed of the 2 main flaps). Gable ends are pentagons; roof side tabs
 * tuck inside them. Differs from the catalogue GABLE_BOX by its pre-glued automatic bottom.
 */
export function gableCarry(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const b = crashLockTube(dims, t);
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const run = Wp / 2 - t;
  const rise = clamp(Wp * 0.42, 20, 90);
  const roofLen = Math.hypot(run, rise);
  const roofAngle = deg(Math.atan2(run, rise));
  const handleH = clamp(dims.H * 0.3, 35, 70);
  for (const side of ["left", "right"] as const) {
    const r = b.byId(side).bbox;
    reshape(b, side, [pt(r.x, r.y), pt(r.x + r.width / 2, r.y - rise), pt(r.x + r.width, r.y), pt(r.x + r.width, r.y + r.height), pt(r.x, r.y + r.height)]);
  }
  for (const side of ["front", "back"] as const) {
    const r = b.byId(side).bbox;
    const roofId = `roof_${side}`;
    b.attach(roofId, "top", side, rectEdges(r).top, roofLen, { kind: "rect" }, { fold: roofAngle, stage: 3, label: "Roof" });
    const roofR = rect(r.x, r.y - roofLen, Lp, roofLen);
    const hr = rect(r.x, roofR.y - handleH, Lp, handleH);
    const holes = f.handle ? [stadium(hr.x + Lp / 2, hr.y + handleH * 0.45, Math.min(90, Lp * 0.55), Math.min(26, handleH * 0.38))] : undefined;
    b.attach(`handle_${side}`, "top", roofId, rectEdges(roofR).top, handleH, { kind: "rect" }, { fold: -roofAngle, stage: 3, label: "Handle", holes });
    const tab = Math.min(12, roofLen * 0.25);
    for (const [k, edge] of [["L", rectEdges(roofR).left], ["R", rectEdges(roofR).right]] as const) {
      b.attach(`roofTab_${side}${k}`, "dust", roofId, insetSeg(edge, 2, roofLen * 0.2), tab, { kind: "trapezoid", taperA: tab * 0.6, taperB: tab * 0.3 }, { fold: 90, stage: 3, stack: -1, label: "Roof tab" });
    }
  }
  if (f.window) cutWindow(b, f.window.face === "back" ? "back" : "front", f.window);
  return {
    builder: b,
    closedRotation: IDENTITY,
    faces: (panels, computed) => {
      const { top: _top, ...rest } = computed;
      void _top;
      return { ...rest, front: blockFace("front", panels, ["handle_front", "roof_front", "front"])!, back: blockFace("back", panels, ["handle_back", "roof_back", "back"])! };
    },
  };
}

/* ───────────────────────── Cup carrier (E12 group) ───────────────────────── */

/** Cups held per deck half (one row along L). */
export const cupsPerSide = (dims: Dims) => (dims.L >= 1.8 * (dims.W / 2) ? 2 : 1);
/** Cup aperture diameter for the given carrier size. */
export const cupHoleDiameter = (dims: Dims) => Math.min(dims.L / cupsPerSide(dims), dims.W / 2) * 0.8;

/**
 * One-piece take-away cup carrier (2 or 4 cups): two deck halves with cup apertures, a
 * centre carrying handle of two glued plies rising between them, legs down to the counter
 * and feet folding under. Sheet, top → bottom: foot | leg | deck B | handle B | handle A |
 * deck A | leg | foot. L = carrier length (along the handle), W = total depth, H = deck height.
 */
export function cupCarrier(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const L = dims.L;
  const Dd = dims.W / 2;
  const Hl = dims.H;
  const Hh = clamp(dims.H * 0.8, 50, 90);
  const fd = clamp(Dd * 0.35, 15, 40);
  const b = new DielineBuilder();
  const deckA = rect(0, 0, L, Dd);
  const handleA = rect(0, -Hh, L, Hh);
  const handleB = rect(0, -2 * Hh, L, Hh);
  const deckB = rect(0, -2 * Hh - Dd, L, Dd);
  const legB = rect(0, deckB.y - Hl, L, Hl);
  const legA = rect(0, Dd, L, Hl);
  const n = cupsPerSide(dims);
  const r = cupHoleDiameter(dims) / 2;
  const cups = (d: { y: number }): Polygon[] => Array.from({ length: n }, (_, i) => circle(L * ((i + 0.5) / n), d.y + Dd / 2, r));
  b.root("deckA", "top", rectPolygon(0, 0, L, Dd), "Deck (front)", { holes: cups(deckA) });
  const hw = Math.min(90, L * 0.5);
  const hh = Math.min(26, Hh * 0.35);
  const e = Math.max(10, hh / 2 + 6);
  b.attach("handleA", "inner", "deckA", rectEdges(deckA).top, Hh, { kind: "rect" }, { fold: -90, stage: 1, label: "Handle ply", holes: [stadium(L / 2, handleA.y + e, hw, hh)] });
  b.attach("handleB", "inner", "handleA", rectEdges(handleA).top, Hh, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 1, label: "Handle ply", holes: [stadium(L / 2, handleB.y + Hh - e, hw, hh)] });
  b.attach("deckB", "top", "handleB", rectEdges(handleB).top, Dd, { kind: "rect" }, { fold: -90, stage: 1, label: "Deck (back)", holes: cups(deckB) });
  b.attach("legB", "back", "deckB", rectEdges(deckB).top, Hl, { kind: "rect" }, { fold: 90, stage: 2, label: "Back leg" });
  b.attach("footB", "bottom", "legB", rectEdges(legB).top, fd, { kind: "rect" }, { fold: 90, stage: 3, label: "Foot" });
  b.attach("legA", "front", "deckA", rectEdges(deckA).bottom, Hl, { kind: "rect" }, { fold: 90, stage: 2, label: "Front leg" });
  b.attach("footA", "bottom", "legA", rectEdges(legA).bottom, fd, { kind: "rect" }, { fold: 90, stage: 3, label: "Foot" });
  const closedRotation = quat(-Math.PI / 2, 0, 0);
  return {
    builder: b,
    closedRotation,
    // The decks (the printed top a customer sees) sit below the handle crest and the handle
    // plies stand behind the legs: neither is on the outermost plane, so add them explicitly.
    faces: (panels, computed) => {
      const input = { panels, rootId: b.rootId, thicknessMm: t, closedRotation };
      let faces = withDeepParts(computed, input, "top", ["deckA", "deckB"], Hh + 2 * t);
      faces = withDeepParts(faces, input, "front", ["handleA", "handleB"], Dd + 2 * t);
      faces = withDeepParts(faces, input, "back", ["handleA", "handleB"], Dd + 2 * t);
      return faces;
    },
  };
}

/* ───────────────────────── Bottle basket carrier (E23 group) ───────────────────────── */

/** Bottle cells of a basket carrier. */
export interface BasketGrid {
  rows: 2;
  cols: 2 | 3;
}

/** Handle height above the walls (mm). */
export const basketHandleRise = (dims: Dims) => clamp(dims.H * 0.45, 50, 90);

/**
 * Basket carrier for 4 or 6 bottles (2 × 2 or 2 × 3 cells): long-seam-glued open tube with an
 * automatic crash-lock bottom (ECMA A60 style), a centre handle partition rising above the
 * walls with a hand hole, and cross partitions separating the bottles. Partitions are cut as
 * separate blanks here (production baskets strike them from the side panels and pre-glue
 * them; see README). L = basket length along the handle, W = depth, H = wall height.
 */
export function basketCarrier(dims: Dims, t: number, grid: BasketGrid): EcmaDraft {
  const b = crashLockTube(dims, t);
  const box = closedBounds(b, t, IDENTITY);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const y0 = box.min.y + 3 * t;
  const stage = maxStageOf(b) + 1;
  const sb = sheetBox(b);
  let sx = sb.x;
  const sy = sb.y + sb.height + 15;

  // Centre handle partition: one blank folded double over its crest (two plies, each printed
  // side out), as on production baskets, so the handle carries artwork from front and back.
  const rise = basketHandleRise(dims);
  // Partitions are cut 1.5 mm short of the inner wall each side (production clearance for
  // erecting); 0.5 mm put their board edges inside the walls' edge-line depth bias, so a
  // seam line showed through the printed front and sides (R6-3Q-D).
  const len = dims.L - 3;
  const hD = dims.H + rise;
  const ch = Math.min(len * 0.22, rise * 0.9);
  const hy = sy + hD; // crest crease; ply A below it, ply B (mirrored) above
  const poly: Polygon = [pt(sx, hy + rise), pt(sx + ch, hy), pt(sx + len - ch, hy), pt(sx + len, hy + rise), pt(sx + len, hy + hD), pt(sx, hy + hD)];
  const holeY = Math.max(16, rise * 0.42);
  const holeW = Math.min(90, len * 0.5);
  const holeH = Math.min(28, rise * 0.4);
  const handleRect = rect(sx, hy, len, hD);
  // Ply A printed side toward the front, one caliper in front of the centre plane.
  b.piece("handle", "inner", poly, "Handle partition", { matrix: pieceMatrix(handleRect, new Vector3(cx, y0 + hD / 2, cz + t), false), stage, lift: dims.H * 1.3 }, { label: "Handle partition", holes: [stadium(sx + len / 2, hy + holeY, holeW, holeH)] });
  const plyB: Polygon = poly.map((q) => pt(q.x, 2 * hy - q.y));
  b.attachPoly("handleBack", "inner", "handle", [pt(sx + ch, hy), pt(sx + len - ch, hy)], plyB, { fold: 180, pivotDepth: 1, stage, label: "Handle partition (back ply)", holes: [stadium(sx + len / 2, hy - holeY, holeW, holeH)] });
  sx += len + 10;

  // Cross partitions (cols − 1), along W.
  const lenW = dims.W - 3;
  const hC = dims.H * 0.85;
  for (let i = 1; i < grid.cols; i++) {
    const x = cx - dims.L / 2 + (i * dims.L) / grid.cols;
    const r = rect(sx, sy, lenW, hC);
    b.piece(`divider${i}`, "inner", rectPolygon(sx, sy, lenW, hC), "Cross partition", { matrix: pieceMatrix(r, new Vector3(x + t / 2, y0 + hC / 2, cz), true), stage, lift: dims.H * 1.3 }, { label: "Cross partition" }).printable = false;
    sx += lenW + 10;
  }
  return {
    builder: b,
    closedRotation: IDENTITY,
    faces: (panels, computed) => {
      const input = { panels, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY };
      const deep = dims.W / 2 + 4 * t;
      return withDeepParts(withDeepParts(computed, input, "front", ["handle"], deep), input, "back", ["handleBack"], deep);
    },
  };
}

/* ───────────────────────── Counter display with tear-off header (A20 + X35) ───────────────────────── */

/** Height (mm, from the bottom) of the display front left after tearing. */
export const displayFrontHeight = (dims: Dims) => clamp(dims.H * 0.45, 30, Math.max(30, dims.H - 25));

/**
 * Counter display carton: straight tuck end carton (ECMA A20.20.03.03, both closures on the
 * back panel) with a perforated tear-off top front (ECMA X35, tuck closure usable as
 * display). Tearing along the perforation (straight across the front, diagonally up the
 * sides) removes the upper front; the lid swings back and stands as a printed header (print
 * BOTH sides for the header art). L = width, W = depth, H = height.
 */
export function counterDisplay(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const draft = tuckEndCarton(dims, t, false, { window: null });
  const b = draft.builder;
  const front = b.byId("front").bbox;
  const hD = displayFrontHeight(dims) + 2 * t;
  const yP = front.y + front.height - hD;
  // The window sits in the display front that stays after tearing: centred on the panel it
  // straddled the tear line (film glued across the perforation, half a window left behind).
  if (f.window) cutWindowInBand(b, "front", f.window, yP + 1, front.y + front.height, 8);
  b.perfLines.push({ a: pt(front.x + 0.5, yP), b: pt(front.x + front.width - 0.5, yP) });
  const left = b.byId("left").bbox;
  const right = b.byId("right").bbox;
  // Sides: from the front edge at the display height up to the back edge at the rim.
  b.perfLines.push({ a: pt(left.x + left.width - 0.5, yP), b: pt(left.x + 0.5, left.y + 0.5) });
  b.perfLines.push({ a: pt(right.x + 0.5, yP), b: pt(right.x + right.width - 0.5, right.y + 0.5) });
  return { builder: b, closedRotation: IDENTITY };
}
