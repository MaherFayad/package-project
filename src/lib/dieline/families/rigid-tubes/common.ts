import { Box3, Euler, Mat4 as Matrix4, Quat as Quaternion, Vec3 as Vector3 } from "@/lib/dieline/math";
import type { DielineBuilder } from "../../builder";
import { boundsAt } from "../../fold";
import { bboxOf } from "../../geometry";
import type { Pt, Rect } from "../../types";

/* ───────────── Wrap paper drawn thin ───────────── */

/**
 * Thickness the wrap paper is DRAWN with where it lies on the inside of a wall (turn-ins,
 * corner tabs, glue flaps). The fold engine gives every panel the full caliper t, but these
 * parts are paper: a turn-in drawn 2 mm thick eats the lid clearance and pierces the base
 * walls (a tube cap's curl pierces the body). Turn-ins are pushed into their own wall
 * (mesh-only `stackOffset`) so only this much stands proud of the board; tabs, glue flaps and
 * label overlaps stand half as proud, under them.
 */
export const WRAP_VISUAL_MM = 0.3;
/** stackOffset that leaves a turn-in `WRAP_VISUAL_MM` proud of its wall's inside face. */
export const turnInStack = (t: number) => -Math.max(0, t - WRAP_VISUAL_MM) / t;
/** stackOffset for corner tabs / glue flaps: inside the wall they lie on, half a paper proud. */
export const tabStack = (t: number) => -(WRAP_VISUAL_MM / 2) / t;
/**
 * Hinge depth (mm) of a corner tab / glue flap that folds 90° in behind its neighbour. Hinged on
 * the printed face itself, the tab's hinge end face (one caliper wide, unprinted) lay IN the
 * parent wall's printed face and z-fought with it: a ragged white slab down every corner of the
 * lid and base, and along the drawer sleeve's glued edge (R5-3Q-E-01, same fix as the core
 * RIGID_BOX). 0.08 mm deep puts that end face just behind the print.
 */
export const TAB_PIVOT_MM = 0.08;
/** pivotDepth (in calipers) for corner tabs / glue flaps (see TAB_PIVOT_MM). */
export const tabPivot = (t: number) => TAB_PIVOT_MM / t;
/**
 * Hinge depth (mm) of a printed board that folds 90° off its neighbour (tray walls, sleeve and
 * cover boards). Hinged on the printed face, each board's fold edge face (the end face along the
 * crease, which the renderer paints with the crease's print) lay IN the other board's printed
 * face over one caliper: a ragged band of the neighbour's colour along every lid / base / sleeve
 * edge, 2 mm wide on greyboard (R5-3Q-E-03). 0.05 mm deep puts both end faces just behind the
 * print; the open notch at the corner is 0.05 mm, far below a pixel.
 */
export const WALL_PIVOT_MM = 0.05;
/** pivotDepth (in calipers) for printed 90° boards (see WALL_PIVOT_MM). */
export const wallPivot = (t: number) => WALL_PIVOT_MM / t;

export const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

export const quat = (x: number, y: number, z: number, order: "XYZ" | "YXZ" = "YXZ"): [number, number, number, number] => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, order));
  return [q.x, q.y, q.z, q.w];
};

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Model-space bounds (mm) of the main tree when closed, used to place extra pieces. */
export function mainClosedBounds(b: DielineBuilder, t: number, closedRotation: [number, number, number, number]): Box3 {
  const ids = new Set(b.subtree(b.rootId));
  return boundsAt({ panels: b.panels.filter((p) => ids.has(p.id)), rootId: b.rootId, thicknessMm: t, closedRotation }, 1);
}

/** Bounds of every panel drawn so far. */
export const sheetBox = (b: DielineBuilder) => bboxOf(b.panels.flatMap((p) => p.polygon));
export const sheetBottom = (b: DielineBuilder) => {
  const r = sheetBox(b);
  return r.y + r.height;
};
export const sheetRight = (b: DielineBuilder) => {
  const r = sheetBox(b);
  return r.x + r.width;
};

export const maxStageOf = (b: DielineBuilder) => b.panels.reduce((m, p) => Math.max(m, p.foldStage, p.assembly?.stage ?? 0), 0);

/**
 * Closed pose of an extra piece whose root panel `flat` (sheet rect) is turned by `rotation`
 * (radians about model X) and whose flat centre lands on `target` (model mm).
 */
export function poseMatrix(flat: Rect, target: Vector3, rotationX: number, rotationY = 0): number[] {
  const c = new Vector3(flat.x + flat.width / 2, -(flat.y + flat.height / 2), 0);
  return new Matrix4()
    .makeTranslation(target.x, target.y, target.z)
    .multiply(new Matrix4().makeRotationY(rotationY))
    .multiply(new Matrix4().makeRotationX(rotationX))
    .multiply(new Matrix4().makeTranslation(-c.x, -c.y, 0))
    .toArray();
}

export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const r2 = (v: number) => Math.round(v * 100) / 100;
