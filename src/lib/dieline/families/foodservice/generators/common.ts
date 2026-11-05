import { Euler, Quaternion } from "three";
import { DielineBuilder } from "../../../builder";
import { bboxOf, pt } from "../../../geometry";
import type { Polygon, Pt, Rect } from "../../../types";

export const quat = (x: number, y: number, z: number): [number, number, number, number] => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, "YXZ"));
  return [q.x, q.y, q.z, q.w];
};
export const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];
/** Tray-style closing: the base lies flat, the sheet tips toward the viewer (front at the top of the sheet). */
export const TRAY_ROTATION = quat(Math.PI / 2, 0, 0);

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
export const deg = (rad: number) => (rad * 180) / Math.PI;

/** Rotate every panel 180° in the sheet plane (the core tray convention, see trayWithLid). */
export function flipLayout(b: DielineBuilder) {
  for (const panel of b.panels) {
    panel.polygon = panel.polygon.map((q) => ({ x: -q.x, y: -q.y }));
    if (panel.hinge) panel.hinge = { a: { x: -panel.hinge.a.x, y: -panel.hinge.a.y }, b: { x: -panel.hinge.b.x, y: -panel.hinge.b.y } };
    if (panel.holes) panel.holes = panel.holes.map((h) => h.map((q) => ({ x: -q.x, y: -q.y })));
    panel.bbox = bboxOf(panel.polygon);
  }
  for (const s of [...b.extraCreases, ...b.perfLines]) {
    s.a = { x: -s.a.x, y: -s.a.y };
    s.b = { x: -s.b.x, y: -s.b.y };
  }
  for (const f of b.films) f.polygon = f.polygon.map((q) => ({ x: -q.x, y: -q.y }));
}

/** Trapezoid grown from hinge a→b: far edge widened by `grow` mm at each end, `depth` mm away. */
export function flaredPoly(b: DielineBuilder, parentId: string, edge: [Pt, Pt], depth: number, growA: number, growB = growA): { poly: Polygon; far: [Pt, Pt] } {
  const f = b.frame(parentId, edge);
  const p0 = f.at(f.a, 0, 0);
  const p1 = f.at(f.a, f.length, 0);
  const p2 = f.at(f.a, f.length + growB, depth);
  const p3 = f.at(f.a, -growA, depth);
  return { poly: [p0, p1, p2, p3], far: [p3, p2] };
}

/** Narrow slot (stadium-ish rectangle) centred at c, `w` long along x. */
export function slot(c: Pt, w: number, h: number): Polygon {
  return [pt(c.x - w / 2, c.y - h / 2), pt(c.x + w / 2, c.y - h / 2), pt(c.x + w / 2, c.y + h / 2), pt(c.x - w / 2, c.y + h / 2)];
}
