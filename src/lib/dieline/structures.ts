import { Euler, Quaternion } from "three";
import type { Dims, StructureCode } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "./builder";
import { bboxOf, clamp, rectPolygon } from "./geometry";
import type { Rect } from "./types";

/**
 * Parametric generators. Every generator works in inner dimensions (L front width,
 * W depth, H height) and board thickness t, and lays the blank out as seen from the
 * printed side. Crease-to-crease panel sizes use inner + 2t so the inner space of the
 * folded 3D model equals the requested inner size and its outer size is inner + 2t.
 */
export interface StructureDraft {
  builder: DielineBuilder;
  /** Quaternion [x, y, z, w] taking the root panel from flat to upright-closed. */
  closedRotation: [number, number, number, number];
}

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

const quat = (x: number, y: number, z: number, order: "XYZ" | "YXZ" = "YXZ"): [number, number, number, number] => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, order));
  return [q.x, q.y, q.z, q.w];
};

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/* ───────────────────────── Tuck end folding cartons (ECMA) ───────────────────────── */

/**
 * Straight tuck end (both closures hinged on the back panel) or reverse tuck end
 * (top closure on the back, bottom closure on the front).
 * Layout, left → right: glue flap | left | front | right | back.
 */
export function tuckEndCarton(dims: Dims, t: number, reverse: boolean): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const g = clamp(dims.W * 0.3, 8, 15);
  const tuckD = Math.min(clamp(Wp * 0.35 + 5, 10, 30), Hp * 0.4);
  const dustD = Math.min(Wp * 0.8, Lp * 0.45);
  const b = new DielineBuilder();

  const xL = g;
  const xF = xL + Wp;
  const xR = xF + Lp;
  const xB = xR + Wp;
  const front = rect(xF, 0, Lp, Hp);
  const left = rect(xL, 0, Wp, Hp);
  const right = rect(xR, 0, Wp, Hp);
  const back = rect(xB, 0, Lp, Hp);

  b.root("front", "front", rectPolygon(front.x, front.y, front.width, front.height), "Front");
  b.attach("left", "left", "front", rectEdges(front).left, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
  b.attach("right", "right", "front", rectEdges(front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach("back", "back", "right", rectEdges(right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("glue", "glue", "left", rectEdges(left).left, g, { kind: "trapezoid", taperA: g * 0.6, taperB: g * 0.6 }, {
    stage: 0,
    stack: -1,
    label: "Glue flap",
  });

  const closure = (where: "top" | "bottom", owner: "front" | "back") => {
    const ownerRect = owner === "front" ? front : back;
    const lidY = where === "top" ? -Wp : Hp;
    const lid = rect(ownerRect.x, lidY, Lp, Wp);
    const hinge = where === "top" ? rectEdges(ownerRect).top : rectEdges(ownerRect).bottom;
    b.attach(where, where, owner, hinge, Wp, { kind: "rect" }, { stage: 2, label: where === "top" ? "Top closure" : "Bottom closure" });
    const far = where === "top" ? rectEdges(lid).top : rectEdges(lid).bottom;
    b.attach(`${where}Tuck`, "tuck", where, insetSeg(far, t + 0.5), tuckD, { kind: "tuck", shoulder: 1 }, {
      stage: 2,
      stack: -1,
      label: "Tuck flap",
    });
    for (const [side, r] of [["L", left], ["R", right]] as const) {
      const edge = where === "top" ? rectEdges(r).top : rectEdges(r).bottom;
      const taper = Math.min(dustD * 0.4, Wp * 0.3);
      b.attach(`${where}Dust${side}`, "dust", side === "L" ? "left" : "right", edge, dustD, {
        kind: "trapezoid",
        taperA: taper * 0.5,
        taperB: taper,
      }, { stage: 1, stack: -1, label: "Dust flap" });
    }
  };
  closure("top", "back");
  closure("bottom", reverse ? "front" : "back");
  return { builder: b, closedRotation: IDENTITY };
}

/* ───────────────────────── FEFCO 0201 regular slotted container ───────────────────────── */

/** Layout, left → right: manufacturer's joint | front | right | back | left; flaps top + bottom. */
export function rsc(dims: Dims, t: number): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const j = Math.min(35, Hp * 0.4);
  const slot = clamp(2 * t + 2, 4, 8);
  const flapD = Wp / 2;
  const b = new DielineBuilder();

  const xF = j;
  const xR = xF + Lp;
  const xB = xR + Wp;
  const xLe = xB + Lp;
  const walls = {
    front: rect(xF, 0, Lp, Hp),
    right: rect(xR, 0, Wp, Hp),
    back: rect(xB, 0, Lp, Hp),
    left: rect(xLe, 0, Wp, Hp),
  };
  b.root("front", "front", rectPolygon(xF, 0, Lp, Hp), "Front");
  b.attach("right", "right", "front", rectEdges(walls.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach("back", "back", "right", rectEdges(walls.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("left", "left", "back", rectEdges(walls.back).right, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
  b.attach("glue", "glue", "front", rectEdges(walls.front).left, j, { kind: "trapezoid", taperA: j * 0.25, taperB: j * 0.25 }, {
    stage: 0,
    stack: -1,
    label: "Manufacturer's joint",
  });

  for (const where of ["top", "bottom"] as const) {
    for (const [id, r] of Object.entries(walls)) {
      const major = id === "front" || id === "back";
      const edge = where === "top" ? rectEdges(r).top : rectEdges(r).bottom;
      // Minor flaps never reach past the middle, even when W > L.
      const depth = major ? flapD : Math.min(flapD, Lp / 2 - t);
      b.attach(`${where}Flap_${id}`, "flap", id, insetSeg(edge, slot / 2), depth, { kind: "rect" }, {
        stage: major ? 2 : 1,
        stack: major ? 0 : -1,
        label: major ? "Major flap" : "Minor flap",
      });
    }
  }
  return { builder: b, closedRotation: IDENTITY };
}

/* ───────────────────────── Tray with hinged lid: mailer (FEFCO 0427) and pizza ───────────────────────── */

interface TrayOpts {
  doubleFront: boolean;
  doubleSides: boolean;
  ears: boolean;
  lidDust: boolean;
  tuckRatio: number;
}

/**
 * Base in the middle; back wall + lid + front tuck above it; front wall (optionally
 * rolled double) below; side walls (optionally rolled double, trapping ears) left/right.
 */
export function trayWithLid(dims: Dims, t: number, o: TrayOpts): StructureDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const b = new DielineBuilder();

  const base = rect(0, 0, Lp, Wp);
  const back = rect(0, -Hp, Lp, Hp);
  const lid = rect(0, -Hp - Wp, Lp, Wp);
  const front = rect(0, Wp, Lp, Hp);
  const sideL = rect(-Hp, 0, Hp, Wp);
  const sideR = rect(Lp, 0, Hp, Wp);

  b.root("base", "bottom", rectPolygon(base.x, base.y, base.width, base.height), "Base");
  b.attach("back", "back", "base", rectEdges(base).top, Hp, { kind: "rect" }, { stage: 0, label: "Back wall" });
  b.attach("front", "front", "base", rectEdges(base).bottom, Hp, { kind: "rect" }, { stage: 0, label: "Front wall" });
  // The closed tray is turned 180° so its front faces the viewer: the panel on the
  // dieline's right becomes the box's left side.
  b.attach("right", "right", "base", rectEdges(base).left, Hp, { kind: "rect" }, { stage: 0, label: "Right wall" });
  b.attach("left", "left", "base", rectEdges(base).right, Hp, { kind: "rect" }, { stage: 0, label: "Left wall" });

  const sideLayers = o.doubleSides ? (o.ears ? 3 : 2) : o.ears ? 2 : 1;
  const frontLayers = o.doubleFront ? 2 : 1;

  if (o.ears) {
    const earD = Wp * 0.4;
    const taper = Math.min(earD * 0.5, Hp * 0.3);
    // Back wall: box top is its top edge (a-end of left/right edges).
    b.attach("earBackL", "ear", "back", rectEdges(back).left, earD, { kind: "trapezoid", taperA: taper, taperB: 1 }, { stage: 1, stack: -1, label: "Ear" });
    b.attach("earBackR", "ear", "back", rectEdges(back).right, earD, { kind: "trapezoid", taperA: taper, taperB: 1 }, { stage: 1, stack: -1, label: "Ear" });
    // Front wall: box top is its bottom edge (b-end).
    b.attach("earFrontL", "ear", "front", rectEdges(front).left, earD, { kind: "trapezoid", taperA: 1, taperB: taper }, { stage: 1, stack: -1, label: "Ear" });
    b.attach("earFrontR", "ear", "front", rectEdges(front).right, earD, { kind: "trapezoid", taperA: 1, taperB: taper }, { stage: 1, stack: -1, label: "Ear" });
  }

  if (o.doubleSides) {
    const inset = (frontLayers + 1) * t + 0.5;
    const depth = Hp - 2 * t - 0.5;
    const pivotDepth = o.ears ? 1.5 : 1;
    b.attach("rightInner", "inner", "right", insetSeg(rectEdges(sideL).left, inset), depth, { kind: "rect" }, { fold: 180, pivotDepth, stage: 2, label: "Inner wall" });
    b.attach("leftInner", "inner", "left", insetSeg(rectEdges(sideR).right, inset), depth, { kind: "rect" }, { fold: 180, pivotDepth, stage: 2, label: "Inner wall" });
  }
  if (o.doubleFront) {
    const inset = sideLayers * t + 0.5;
    b.attach("frontInner", "inner", "front", insetSeg(rectEdges(front).bottom, inset), Hp - 2 * t - 0.5, { kind: "rect" }, {
      fold: 180,
      pivotDepth: 1,
      stage: 2,
      label: "Inner front wall",
    });
  }

  b.attach("top", "top", "back", rectEdges(back).top, Wp, { kind: "rect" }, { stage: 3, label: "Lid" });
  const tuckInset = sideLayers * t + 1;
  const tuckD = Math.max(8, (Hp - 2 * t - 2) * o.tuckRatio);
  b.attach("lidTuck", "tuck", "top", insetSeg(rectEdges(lid).top, tuckInset), tuckD, { kind: "tuck", shoulder: 2 }, {
    stage: 3,
    stack: -frontLayers,
    label: "Lid tuck",
  });
  if (o.lidDust) {
    const inset = frontLayers * t + 1;
    const d = Math.max(6, Hp - 2 * t - 2);
    const taper = Math.min(d * 0.6, Wp * 0.3);
    // Lid left edge runs from its far (front) end at the top to the back hinge at the bottom.
    b.attach("lidDustL", "dust", "top", insetSeg(rectEdges(lid).left, inset), d, { kind: "trapezoid", taperA: taper, taperB: 2 }, {
      stage: 3,
      stack: -sideLayers,
      label: "Lid side flap",
    });
    b.attach("lidDustR", "dust", "top", insetSeg(rectEdges(lid).right, inset), d, { kind: "trapezoid", taperA: taper, taperB: 2 }, {
      stage: 3,
      stack: -sideLayers,
      label: "Lid side flap",
    });
  }
  // Turn the layout 180° in its plane (front wall at the top of the sheet) so closing is
  // a single +90° tilt about X: the sheet tips toward the viewer and the front faces them.
  for (const panel of b.panels) {
    panel.polygon = panel.polygon.map((q) => ({ x: -q.x, y: -q.y }));
    if (panel.hinge) panel.hinge = { a: { x: -panel.hinge.a.x, y: -panel.hinge.a.y }, b: { x: -panel.hinge.b.x, y: -panel.hinge.b.y } };
    panel.bbox = bboxOf(panel.polygon);
  }
  return { builder: b, closedRotation: quat(Math.PI / 2, 0, 0) };
}

export function mailer(dims: Dims, t: number): StructureDraft {
  return trayWithLid(dims, t, { doubleFront: true, doubleSides: true, ears: true, lidDust: true, tuckRatio: 0.75 });
}

export function pizza(dims: Dims, t: number): StructureDraft {
  return trayWithLid(dims, t, { doubleFront: false, doubleSides: true, ears: true, lidDust: true, tuckRatio: 0.7 });
}

/* ───────────────────────── Sleeve ───────────────────────── */

/**
 * Sleeve that slides over a tray: wraps top, front, bottom and back; open at the left
 * and right ends (so there are no left/right faces). L is the sleeve's length along the
 * open axis. Layout, top → bottom: glue | top | front | bottom | back.
 */
export function sleeve(dims: Dims, t: number): StructureDraft {
  const Lx = dims.L;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const g = clamp(dims.W * 0.25, 10, 20);
  const b = new DielineBuilder();
  const top = rect(0, g, Lx, Wp);
  const front = rect(0, g + Wp, Lx, Hp);
  const bottom = rect(0, g + Wp + Hp, Lx, Wp);
  b.root("front", "front", rectPolygon(front.x, front.y, front.width, front.height), "Front");
  b.attach("top", "top", "front", rectEdges(front).top, Wp, { kind: "rect" }, { stage: 0, label: "Top" });
  b.attach("bottom", "bottom", "front", rectEdges(front).bottom, Wp, { kind: "rect" }, { stage: 0, label: "Bottom" });
  b.attach("back", "back", "bottom", rectEdges(bottom).bottom, Hp, { kind: "rect" }, { stage: 1, label: "Back" });
  b.attach("glue", "glue", "top", rectEdges(top).top, g, { kind: "trapezoid", taperA: g * 0.6, taperB: g * 0.6 }, {
    stage: 1,
    stack: -1,
    label: "Glue flap",
  });
  return { builder: b, closedRotation: IDENTITY };
}

export const GENERATORS: Record<StructureCode, (dims: Dims, t: number) => StructureDraft> = {
  FEFCO_0427: mailer,
  FEFCO_0201: rsc,
  ECMA_RTE: (d, t) => tuckEndCarton(d, t, true),
  ECMA_STE: (d, t) => tuckEndCarton(d, t, false),
  PIZZA: pizza,
  SLEEVE: sleeve,
};
