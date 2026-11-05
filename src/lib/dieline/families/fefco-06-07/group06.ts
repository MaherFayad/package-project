import { Matrix4, Vector3 } from "three";
import type { Dims } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "@/lib/dieline/builder";
import { panelPivot } from "@/lib/dieline/fold";
import { clamp, rectPolygon } from "@/lib/dieline/geometry";
import type { StructureDraft } from "@/lib/dieline/structures";
import { IDENTITY, TILT, closedBounds, placedPiece, rect, sheetBox } from "./parts";

/**
 * FEFCO group 06 — rigid-type boxes: "two separate end pieces and a body, requiring stitching
 * or a similar operation before they can be used" (FEFCO Code). Generators build the body as
 * the main tree (base root, tipped upright) and each end piece as a separate blank with its
 * closed pose, so the fold engine animates: body walls up → end pieces in → body flaps
 * stitched over the ends → lid closed.
 */

export interface BlissOpts {
  /** Tapered flaps on the body's L-edges, folded over the OUTSIDE of the end pieces (0601, 0602, 0606). */
  bodyFlaps: boolean;
  /** full: lid panel (0601, 0607, 0610); tuck: lid with tuck (0602, 0608); split: two ½W lids meeting at the centre (0606, 0620); rim: open top with v flanges (0605). */
  lid: "full" | "tuck" | "split" | "rim";
  /** End pieces with flaps folded INSIDE the body walls (0605, 0607, 0608, 0610, 0620). */
  endFlaps: "none" | "taper" | "rect";
}

export const blissDims = (dims: Dims, t: number, o: BlissOpts) => ({
  Lb: dims.L + (o.bodyFlaps ? 4 : 2) * t,
  Wp: dims.W + 2 * t,
  Hp: dims.H + (o.lid === "rim" ? 1 : 2) * t,
});

export const rimDepth = (W: number) => clamp(W * 0.12, 15, 40);

export function blissBox(dims: Dims, t: number, o: BlissOpts): StructureDraft {
  const { Lb, Wp, Hp } = blissDims(dims, t, o);
  const b = new DielineBuilder();
  const base = rect(0, 0, Lb, Wp);
  const front = rect(0, -Hp, Lb, Hp);
  const back = rect(0, Wp, Lb, Hp);
  b.root("bottom", "bottom", rectPolygon(0, 0, Lb, Wp), "Body bottom");
  b.pieceLabels.set("bottom", "Body");
  b.attach("front", "front", "bottom", rectEdges(base).top, Hp, { kind: "rect" }, { stage: 0, label: "Body front" });
  b.attach("back", "back", "bottom", rectEdges(base).bottom, Hp, { kind: "rect" }, { stage: 0, label: "Body back" });

  switch (o.lid) {
    case "full":
    case "tuck": {
      b.attach("top", "top", "back", rectEdges(back).bottom, Wp, { kind: "rect" }, { stage: 3, label: "Lid" });
      if (o.lid === "tuck") {
        const lid = rect(0, Wp + Hp, Lb, Wp);
        b.attach("tuck", "tuck", "top", insetSeg(rectEdges(lid).bottom, t + 1), clamp(dims.H * 0.3, 20, 50), { kind: "tuck", shoulder: 2 }, { stage: 3, stack: -1, label: "Lid tuck" });
      }
      break;
    }
    case "split":
      b.attach("topFront", "top", "front", rectEdges(front).top, Wp / 2 - 0.5, { kind: "rect" }, { stage: 3, label: "Half lid" });
      b.attach("topBack", "top", "back", rectEdges(back).bottom, Wp / 2 - 0.5, { kind: "rect" }, { stage: 3, label: "Half lid" });
      break;
    case "rim": {
      const v = rimDepth(dims.W);
      b.attach("rimFront", "flap", "front", rectEdges(front).top, v, { kind: "rect" }, { stage: 3, label: "Rim flange (v)" });
      b.attach("rimBack", "flap", "back", rectEdges(back).bottom, v, { kind: "rect" }, { stage: 3, label: "Rim flange (v)" });
      break;
    }
  }

  // Closed body walls → where the end pieces go.
  const box = closedBounds(b, ["bottom", "front", "back"], t, TILT);

  if (o.bodyFlaps) {
    const d = clamp(Math.min(dims.W, dims.H) * 0.3, 15, 60);
    for (const [id, r] of [["front", front], ["bottom", base], ["back", back]] as const) {
      for (const side of ["left", "right"] as const) {
        const edge = rectEdges(r)[side];
        const taper = Math.min(d * 0.9, (side === "left" ? r.height : r.height) * 0.3);
        b.attach(`${id}Flap_${side}`, "flap", id, edge, d, { kind: "trapezoid", taperA: taper, taperB: taper }, { stage: 2, label: "Body flap (stitched over the end)" });
      }
    }
  }

  // End pieces: W × H, inside the body tube.
  const sb = sheetBox(b);
  const e = clamp(Math.min(dims.W, dims.H) * 0.2, 15, 50);
  const yC = box.min.y + t + dims.H / 2;
  const zC = (box.min.z + box.max.z) / 2;
  const inset = o.bodyFlaps ? t : 0;
  let x = sb.x + (o.endFlaps === "none" ? 0 : e);
  const y = sb.y + sb.height + 15 + (o.endFlaps === "none" ? 0 : e);
  for (const side of ["L", "R"] as const) {
    const id = `end${side}`;
    const poly = rectPolygon(x, y, dims.W, dims.H);
    const target = new Vector3(side === "L" ? box.min.x + inset : box.max.x - inset, yC, zC);
    const rot = new Matrix4().makeRotationY(side === "L" ? -Math.PI / 2 : Math.PI / 2);
    placedPiece(b, id, side === "L" ? "left" : "right", poly, side === "L" ? "Left end" : "Right end", target, rot, 1, dims.H * 0.4);
    if (o.endFlaps !== "none") {
      const r = rect(x, y, dims.W, dims.H);
      const edges = rectEdges(r);
      for (const k of ["top", "right", "bottom", "left"] as const) {
        const len = k === "top" || k === "bottom" ? dims.W : dims.H;
        const taper = o.endFlaps === "taper" ? Math.min(e * 0.9, len * 0.3) : 1;
        b.attach(`${id}_flap_${k}`, "flap", id, edges[k], e, { kind: "trapezoid", taperA: taper, taperB: taper }, { stage: 0, label: "End flap (stitched inside the body)", printable: false });
      }
    }
    x += dims.W + 2 * e + 15;
  }
  return { builder: b, closedRotation: TILT, faceDepthTol: o.bodyFlaps ? t * 1.2 + 0.2 : undefined };
}

/* ───────────────────────── 0615 / 0616: tube + two end caps ───────────────────────── */

export const capClearance = (t: number, doubleRim: boolean) => (doubleRim ? t + 0.5 : 0.5);

/**
 * FEFCO 0615 / 0616: a four-panel body tube (open both ends) and two separate trays (end
 * caps) that slip over its ends. 0615 caps have rolled double rims, 0616 single rims.
 */
export function tubeWithCaps(dims: Dims, t: number, doubleRim: boolean): StructureDraft {
  const Lt = dims.L;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const b = new DielineBuilder();
  const base = rect(0, 0, Lt, Wp);
  const back = rect(0, Wp, Lt, Hp);
  const top = rect(0, Wp + Hp, Lt, Wp);
  b.root("bottom", "bottom", rectPolygon(0, 0, Lt, Wp), "Body bottom");
  b.pieceLabels.set("bottom", "Body");
  b.attach("front", "front", "bottom", rectEdges(base).top, Hp, { kind: "rect" }, { stage: 0, label: "Body front" });
  b.attach("back", "back", "bottom", rectEdges(base).bottom, Hp, { kind: "rect" }, { stage: 0, label: "Body back" });
  b.attach("top", "top", "back", rectEdges(back).bottom, Wp, { kind: "rect" }, { stage: 1, label: "Body top" });
  const j = clamp(dims.H * 0.25, 20, 35);
  b.attach("joint", "glue", "top", insetSeg(rectEdges(top).bottom, 2), j, { kind: "trapezoid", taperA: j * 0.3, taperB: j * 0.3 }, { stage: 1, stack: -1, label: "Joint (stitched)" });

  const box = closedBounds(b, b.subtree("bottom"), t, TILT);
  const clr = capClearance(t, doubleRim);
  const Wc = Wp + 2 * clr + 2 * t;
  const Hc = Hp + 2 * clr + 2 * t;
  const v = Math.min(clamp(Math.min(dims.W, dims.H) * 0.25, 20, 60), dims.L / 3);
  const sb = sheetBox(b);
  let x = sb.x + v * (doubleRim ? 2 : 1);
  const y = sb.y + sb.height + 15 + v * (doubleRim ? 2 : 1);
  const yC = (box.min.y + box.max.y) / 2;
  const zC = (box.min.z + box.max.z) / 2;
  for (const side of ["L", "R"] as const) {
    const id = `cap${side}`;
    const poly = rectPolygon(x, y, Wc, Hc);
    const target = new Vector3(side === "L" ? box.min.x - t : box.max.x + t, yC, zC);
    const rot = new Matrix4().makeRotationY(side === "L" ? -Math.PI / 2 : Math.PI / 2);
    placedPiece(b, id, side === "L" ? "left" : "right", poly, side === "L" ? "Left cap" : "Right cap", target, rot, 2, dims.H * 0.3);
    const r = rect(x, y, Wc, Hc);
    const edges = rectEdges(r);
    for (const k of ["top", "right", "bottom", "left"] as const) {
      const rimId = `${id}_rim_${k}`;
      b.attach(rimId, "flap", id, insetSeg(edges[k], 0.5), v, { kind: "trapezoid", taperA: 1, taperB: 1 }, { stage: 0, label: "Cap rim" });
      if (doubleRim) {
        const rim = b.byId(rimId);
        const far = farEdgeOf(rim.polygon, rim.hinge!);
        b.attach(`${rimId}_in`, "inner", rimId, insetSeg(far, t + 0.5), v - t - 0.5, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 0, label: "Cap rim (rolled)", printable: false });
      }
    }
    x += Wc + 2 * v * (doubleRim ? 2 : 1) + 15;
  }
  return { builder: b, closedRotation: TILT, faceDepthTol: clr + t + 0.6 };
}

/** The edge of a polygon farthest from (and parallel to) a hinge. */
export function farEdgeOf(poly: { x: number; y: number }[], h: { a: { x: number; y: number }; b: { x: number; y: number } }): [{ x: number; y: number }, { x: number; y: number }] {
  const hl = Math.hypot(h.b.x - h.a.x, h.b.y - h.a.y);
  const mx = (h.a.x + h.b.x) / 2;
  const my = (h.a.y + h.b.y) / 2;
  let best: [{ x: number; y: number }, { x: number; y: number }] = [poly[0], poly[1]];
  let bestD = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const c = poly[(i + 1) % poly.length];
    const l = Math.hypot(c.x - a.x, c.y - a.y);
    const d = Math.hypot((a.x + c.x) / 2 - mx, (a.y + c.y) / 2 - my);
    if (l > hl * 0.5 && d > bestD) {
      bestD = d;
      best = [a, c];
    }
  }
  return best;
}

/* ───────────────────────── 0621: two half shells ───────────────────────── */

export const shellSpacer = (t: number) => clamp(4 * t, 8, 20);

/**
 * FEFCO 0621: two identical half shells, each a long wall (L, with ½W top and bottom flaps)
 * plus a double end wall folded W | v | W and a joint tab. The second shell is turned 180°
 * about the vertical axis; the tabs are glued (M) to the opposite shell.
 * Thickness: each end is two walls with a v gap (the inner wall stands inside the gap), so
 * outer L = L + 2v.
 */
export function halfShells(dims: Dims, t: number): StructureDraft {
  const v = shellSpacer(t);
  const Lo = dims.L + 2 * v;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 4 * t;
  const b = new DielineBuilder();
  const shell = (pre: string, y0: number, asPiece?: { matrix: number[]; stage: number; lift?: number }) => {
    const id = (s: string) => pre + s;
    const fr = rect(0, y0, Lo, Hp);
    const poly = rectPolygon(0, y0, Lo, Hp);
    if (asPiece) b.piece(id("front"), "front", poly, "Shell B", asPiece, { label: "Long wall" });
    else {
      b.root(id("front"), "front", poly, "Long wall");
      b.pieceLabels.set(id("front"), "Shell A");
    }
    const endD = Wp - t;
    b.attach(id("endOuter"), "right", id("front"), rectEdges(fr).right, endD, { kind: "rect" }, { stage: 0, label: "End wall (outer)" });
    const eo = rect(Lo, y0, endD, Hp);
    b.attach(id("spacer"), "flap", id("endOuter"), rectEdges(eo).right, v, { kind: "rect" }, { stage: 0, label: "Spacer (v)" });
    const sp = rect(Lo + endD, y0, v, Hp);
    const innerD = Wp - 2 * t - 0.5;
    b.attach(id("endInner"), "inner", id("spacer"), rectEdges(sp).right, innerD, { kind: "rect" }, { stage: 0, label: "End wall (inner)" });
    const ei = rect(Lo + endD + v, y0, innerD, Hp);
    b.attach(id("tab"), "glue", id("endInner"), insetSeg(rectEdges(ei).right, 2), clamp(v * 1.5, 12, 25), { kind: "trapezoid", taperA: 3, taperB: 3 }, { fold: -90, stage: 0, label: "Joint tab (½v), glued to the long wall" });
    // ½W flaps on the long wall; short flaps on the outer end wall.
    b.attach(id("flapTop"), "flap", id("front"), rectEdges(fr).top, Wp / 2, { kind: "rect" }, { stage: 3, label: "Top flap (½W)" });
    b.attach(id("flapBottom"), "flap", id("front"), rectEdges(fr).bottom, Wp / 2, { kind: "rect" }, { stage: 2, label: "Bottom flap (½W)" });
    const ef = Math.min(Wp * 0.3, 40);
    b.attach(id("endFlapTop"), "flap", id("endOuter"), insetSeg(rectEdges(eo).top, 1), ef, { kind: "trapezoid", taperA: 2, taperB: ef * 0.5 }, { stage: 1, stack: -1, label: "End flap" });
    b.attach(id("endFlapBottom"), "flap", id("endOuter"), insetSeg(rectEdges(eo).bottom, 1), ef, { kind: "trapezoid", taperA: 2, taperB: ef * 0.5 }, { stage: 1, stack: -1, label: "End flap" });
  };
  shell("", 0);
  const boxA = closedBounds(b, b.subtree("front"), t, IDENTITY);
  const c = new Vector3((boxA.min.x + boxA.max.x) / 2, 0, boxA.max.z - Wp / 2);
  const sb = sheetBox(b);
  const D = sb.y + sb.height + 15 + Wp / 2;
  const pivotA = panelPivot(b.byId("front"), t);
  const m = new Matrix4()
    .makeTranslation(c.x, c.y, c.z)
    .multiply(new Matrix4().makeRotationY(Math.PI))
    .multiply(new Matrix4().makeTranslation(-c.x, -c.y, -c.z))
    .multiply(new Matrix4().makeTranslation(-pivotA.x, -pivotA.y, -pivotA.z))
    .multiply(new Matrix4().makeTranslation(0, D, 0));
  shell("b_", D, { matrix: m.toArray(), stage: 1, lift: dims.H * 0.5 });
  return { builder: b, closedRotation: IDENTITY };
}
