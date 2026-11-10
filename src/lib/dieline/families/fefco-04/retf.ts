import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { cutWindow, tearStripLines } from "../../features";
import { centroid, clamp, pt } from "../../geometry";
import { addPartitions, type StructureDraft } from "../../structures";
import type { DielinePanel, Polygon, Pt, Rect } from "../../types";
import { CORNER_GAP, TILT_UP, rect, turn180 } from "./kit";

/**
 * Roll end tuck front (RETF) mailer, drawn after the owner's die (docs/owner-input/2026-11-10,
 * docs/audit/gift-box-tuck-front.md):
 *
 *                     [  tuck + wings  ]        thumb notch on the tuck's free edge
 *           ( dust )  [      lid       ]  ( dust )   rounded side flaps, angled at the hinge ends
 *                 [ear][     back     ][ear]
 *   [inner][ end ]    [     base       ]    [ end ][inner]   rolled double end walls, two locking
 *                 [ear][    front     ][ear]                 tabs on each inner wall into base slots
 *
 * (Shown before the final 180° in-plane turn; on the printed sheet the front wall is at the top.)
 *
 * Differences from the core FEFCO_0427 mailer: the front wall is SINGLE (no rolled inner front),
 * the front and back walls carry square ears about as deep as the box is high, the rolled inner
 * end walls lock into the base with tabs, and the tuck carries rounded side wings.
 *
 * Thickness compensation follows the tray kit: end walls stack 3 layers (outer, ear, inner),
 * front and back 1 layer each; walls are H + base (+ lid) calipers.
 */
export interface RetfOpts {
  /** Rounded wings on the tuck ends (owner's die). Without them the tuck has rounded corners. */
  tuckWings: boolean;
  /** Lid side flap outline: rounded (owner's die) or a plain trapezoid. */
  dust: "rounded" | "trapezoid";
  /** Tuck depth as a share of the front wall height (owner's die: about 1). */
  tuckRatio: number;
}

/** Owner's die, measured (fractions of the panel they sit on, see docs/audit/gift-box-tuck-front.md). */
export const RETF_RATIOS = {
  /** Ear depth: min(H, share of the end wall length). */
  earMaxOfW: 0.38,
  /** Tab centres along the inner end wall, and tab length. */
  tabCentres: [0.23, 0.77] as const,
  tabLength: 0.18,
  /** Tuck wing width as a share of the tuck depth. */
  wingOfTuck: 0.7,
  /** Lid side flap: the angled cut leaves the hinge end at (along, out) × depth, corner reaches the far edge at `cornerAlong`. */
  dustAngle: { along: 0.24, out: 0.75 },
  dustCornerAlong: 0.5,
  /** Thumb notch radius (mm, capped by the tuck size). */
  notchMm: 12,
} as const;

const g = CORNER_GAP;

/** Points of a quadratic Bezier from p0 to p2 with control c (excluding p0). */
function bezier(p0: Pt, c: Pt, p2: Pt, seg = 6): Pt[] {
  const out: Pt[] = [];
  for (let k = 1; k <= seg; k++) {
    const s = k / seg;
    const u = 1 - s;
    out.push(pt(u * u * p0.x + 2 * u * s * c.x + s * s * p2.x, u * u * p0.y + 2 * u * s * c.y + s * s * p2.y));
  }
  return out;
}

export function retfMailer(dims: Dims, t: number, o: RetfOpts, f: StructureFeatures = {}): StructureDraft {
  const lay = { ends: 3, front: 1, back: 1 };
  const Lp = dims.L + 2 * lay.ends * t;
  const Wp = dims.W + (lay.front + lay.back) * t;
  const Hbase = dims.H + t;
  // Single front and back run up to the lid's top face (front CORNER_GAP short of it); the rolled
  // end walls stop at the lid's underside (see trayKit).
  const Hf = Hbase + t - g;
  const Hb = Hbase + t;
  const He = Hbase;

  const b = new DielineBuilder();
  const base: Rect = rect(0, 0, Lp, Wp);
  const E = (r: Rect) => rectEdges(r);
  b.root(
    "base",
    "bottom",
    [pt(0, 0), pt(g, 0), pt(Lp - g, 0), pt(Lp, 0), pt(Lp, g), pt(Lp, Wp - g), pt(Lp, Wp), pt(Lp - g, Wp), pt(g, Wp), pt(0, Wp), pt(0, Wp - g), pt(0, g)],
    "Base",
  );

  const backR = rect(g, -Hb, Lp - 2 * g, Hb);
  const frontR = rect(g, Wp, Lp - 2 * g, Hf);
  const rightR = rect(-He, g, He, Wp - 2 * g);
  const leftR = rect(Lp, g, He, Wp - 2 * g);

  // Stages as the blank is erected: front and back with their ears → end walls outside the ears →
  // rolled inner end walls (tabs into the base) → lid side flaps and tuck wings → lid with tuck.
  b.attach("back", "back", "base", insetSeg(E(base).top, g), Hb, { kind: "rect" }, { stage: 0, label: "Back wall" });
  b.attach("front", "front", "base", insetSeg(E(base).bottom, g), Hf, { kind: "rect" }, { stage: 0, label: "Front wall" });
  // Turned 180° at the end: the panel on the sheet's left becomes the box's right end.
  b.attach("right", "right", "base", insetSeg(E(base).left, g), He, { kind: "rect" }, { stage: 1, label: "Right wall" });
  b.attach("left", "left", "base", insetSeg(E(base).right, g), He, { kind: "rect" }, { stage: 1, label: "Left wall" });

  // ── square ears on the front and back walls (owner: as deep as the box is high)
  const earD = clamp(Math.min(dims.H, Wp * RETF_RATIOS.earMaxOfW), 10, 160);
  const earSides: [string, [Pt, Pt][]][] = [
    ["back", [[E(backR).left[0], E(backR).left[1]], [E(backR).right[0], E(backR).right[1]]]],
    ["front", [[E(frontR).left[1], E(frontR).left[0]], [E(frontR).right[1], E(frontR).right[0]]]],
  ];
  for (const [id, sides] of earSides) {
    const height = id === "back" ? Hb : Hf;
    sides.forEach(([rim, basePt], i) => {
      const h = Math.min(height, He) - 0.5;
      const k = h / Math.hypot(rim.x - basePt.x, rim.y - basePt.y);
      const rimPt = pt(basePt.x + (rim.x - basePt.x) * k, basePt.y + (rim.y - basePt.y) * k);
      b.attach(`ear_${id}_${i}`, "ear", id, [rimPt, basePt], earD, { kind: "trapezoid", taperA: Math.min(2, earD * 0.1), taperB: 1 }, { stage: 0, stack: -1 + g / t, label: "Locking ear" });
    });
  }

  // ── rolled inner end walls with two locking tabs each; matching slots in the base
  const innerInset = t + 0.5;
  const innerDepth = He - 2 * t - 0.5;
  // Rolled in, the tab tip stops half-way into the base board: at the outer face its cut edge
  // lay in the printed bottom.
  const tabD = 1.5 * t + 0.5;
  const innerLen = Wp - 2 * g - 2 * innerInset;
  const tabHalf = clamp((RETF_RATIOS.tabLength * innerLen) / 2, 6, 30);
  const tabCentres = RETF_RATIOS.tabCentres.map((c) => c * innerLen);
  for (const [id, far] of [
    ["right", E(rightR).left],
    ["left", E(leftR).right],
  ] as const) {
    const hinge = insetSeg(far, innerInset);
    const fr = b.frame(id, hinge);
    const ch = 0.5;
    const poly: Polygon = [fr.a, fr.b, fr.at(fr.a, fr.length, innerDepth)];
    for (const c of [...tabCentres].reverse()) {
      poly.push(fr.at(fr.a, c + tabHalf, innerDepth), fr.at(fr.a, c + tabHalf - ch, innerDepth + tabD), fr.at(fr.a, c - tabHalf + ch, innerDepth + tabD), fr.at(fr.a, c - tabHalf, innerDepth));
    }
    poly.push(fr.at(fr.a, 0, innerDepth));
    b.attachPoly(`${id}Inner`, "inner", id, hinge, poly, { fold: 180, pivotDepth: 1.5, stage: 2, label: "Inner wall" });
  }
  {
    const y0 = g + innerInset;
    const slots: Polygon[] = [];
    for (const c of tabCentres) {
      const ya = y0 + c - tabHalf - 0.5;
      const yb = y0 + c + tabHalf + 0.5;
      for (const [xa, xb] of [
        [t, 3 * t + 0.5],
        [Lp - 3 * t - 0.5, Lp - t],
      ])
        slots.push([pt(xa, ya), pt(xb, ya), pt(xb, yb), pt(xa, yb)]);
    }
    b.byId("base").holes = slots;
  }

  // ── lid with rounded side flaps and the tuck
  const topBase = 3;
  const lidR = rect(g, -Hb - Wp + g, Lp - 2 * g, Wp - g);
  b.attach("top", "top", "back", E(backR).top, Wp - g, { kind: "rect" }, { stage: topBase + 1, label: "Lid" });

  const dd = Math.max(6, He - 2 * t - 2);
  for (const [id, edge] of [
    ["lidSideR", E(lidR).left],
    ["lidSideL", E(lidR).right],
  ] as const) {
    const hinge = insetSeg(edge, lay.front * t + 1);
    const fr = b.frame("top", hinge);
    const len = fr.length;
    let poly: Polygon;
    if (o.dust === "rounded") {
      const k = Math.min(1, (0.35 * len) / (RETF_RATIOS.dustCornerAlong * dd));
      const sa = RETF_RATIOS.dustAngle.along * dd * k;
      const so = RETF_RATIOS.dustAngle.out * dd;
      const sc = RETF_RATIOS.dustCornerAlong * dd * k;
      // Control point: where the angled cut, extended, meets the far edge.
      const cc = (sa * dd) / so;
      const p1 = fr.at(fr.a, sa, so);
      const p2 = fr.at(fr.a, sc, dd);
      const p3 = fr.at(fr.a, len - sc, dd);
      const p4 = fr.at(fr.a, len - sa, so);
      poly = [fr.a, p1, ...bezier(p1, fr.at(fr.a, cc, dd), p2), p3, ...bezier(p3, fr.at(fr.a, len - cc, dd), p4), fr.b];
    } else {
      const taper = Math.min(dd * 0.6, Wp * 0.3);
      poly = [fr.a, fr.at(fr.a, taper, dd), fr.at(fr.a, len - 2, dd), fr.b];
    }
    b.attachPoly(id, "dust", "top", hinge, poly, { stage: topBase, stack: -lay.ends, label: "Lid side flap" });
  }

  const tuckD = Math.max(8, (Hf - 2 * t - 2) * o.tuckRatio);
  // The tuck fits between the end walls' inner faces (owner's die: its creases on the lid sides).
  const tuckInset = lay.ends * t + 1;
  const tuckHinge = insetSeg(E(lidR).top, tuckInset);
  const tf = b.frame("top", tuckHinge);
  const tl = tf.length;
  const notchR = Math.min(RETF_RATIOS.notchMm, tl * 0.1, tuckD * 0.35);
  const notch: Pt[] = [];
  for (let k = 0; k <= 10; k++) {
    const th = (k / 10) * Math.PI;
    notch.push(tf.at(tf.a, tl / 2 + notchR * Math.cos(th), tuckD - notchR * Math.sin(th)));
  }
  let tuckPoly: Polygon;
  if (o.tuckWings) {
    tuckPoly = [tf.a, tf.b, tf.at(tf.a, tl, tuckD), ...notch, tf.at(tf.a, 0, tuckD)];
  } else {
    const r = Math.min(tuckD * 0.45, tl * 0.2);
    const cB = tf.at(tf.a, tl, tuckD);
    const cA = tf.at(tf.a, 0, tuckD);
    const pB = tf.at(tf.a, tl, tuckD - r);
    const pA = tf.at(tf.a, 0, tuckD - r);
    tuckPoly = [tf.a, tf.b, pB, ...bezier(pB, cB, tf.at(tf.a, tl - r, tuckD)), ...notch, ...bezier(tf.at(tf.a, r, tuckD), cA, pA)];
  }
  b.attachPoly("lidTuck", "tuck", "top", tuckHinge, tuckPoly, { stage: topBase + 1, stack: -lay.front, label: "Lid tuck" });

  if (o.tuckWings) {
    const wb = 1.5;
    for (const [i, along] of [
      [0, 0],
      [1, tl],
    ] as const) {
      const hinge: [Pt, Pt] = [tf.at(tf.a, along, wb), tf.at(tf.a, along, tuckD)];
      const wf = b.frame("lidTuck", hinge);
      const l2 = wf.length;
      const ww = Math.min(RETF_RATIOS.wingOfTuck * tuckD, l2 * 0.95);
      const arc: Pt[] = [];
      for (let k = 1; k <= 8; k++) {
        const ph = (k / 8) * (Math.PI / 2);
        arc.push(wf.at(wf.a, l2 - ww + ww * Math.cos(ph), ww * Math.sin(ph)));
      }
      b.attachPoly(`tuckWing${i}`, "dust", "lidTuck", hinge, [wf.a, wf.b, ...arc, wf.at(wf.a, 0, ww)], {
        stage: topBase,
        // The tuck sits 2 calipers in (stack -2, pivot 1 after the family pivot fix): a pivot 3 calipers
        // deep puts the wing's hinge on the tuck's inner face (on the printed face the wing ran through
        // the front wall), and stack -4 lays the wing one caliper inside the lid side flaps.
        pivotDepth: 3,
        stack: -4,
        label: "Tuck wing",
      });
    }
  }

  turn180(b);

  // ── features (final sheet coordinates)
  if (f.window) cutWindow(b, "top", f.window, { margin: Math.max(12, lay.ends * t + 8) });
  if (f.tearStrip) {
    // Two perforations across the lid just behind the tuck crease (tear-open e-commerce mailer).
    const tuck = b.byId("lidTuck").hinge!;
    const lid = b.byId("top");
    const ext = { a: pt(lid.bbox.x, tuck.a.y), b: pt(lid.bbox.x + lid.bbox.width, tuck.b.y) };
    b.perfLines.push(...tearStripLines(ext, centroid(lid.polygon), 10, 8, 1));
  }
  if (f.partitions) {
    // Dividers go in before the lid closes.
    for (const p of b.panels as DielinePanel[]) if (p.id === "top" || p.id.startsWith("lid") || p.id.startsWith("tuckWing")) p.foldStage += 1;
    addPartitions(b, t, TILT_UP, dims, f.partitions, t, topBase);
  }

  return { builder: b, closedRotation: TILT_UP };
}
