import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { DielineBuilder } from "../../builder";
import { boundsAt } from "../../fold";
import { bboxOf } from "../../geometry";
import type { Pt, Rect } from "../../types";

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
