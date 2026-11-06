import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { FaceId } from "@/types";
import { DielineBuilder, rectEdges } from "../../builder";
import { boundsAt, computeFaces, computePoses, panelLocalPoint, panelPivot } from "../../fold";
import { bboxOf, pt, rectPolygon } from "../../geometry";
import type { DielinePanel, FaceInfo, FacePart, Polygon, Pt, Rect } from "../../types";

export type Quat = [number, number, number, number];
export const IDENTITY: Quat = [0, 0, 0, 1];

export const quat = (x: number, y: number, z: number): Quat => {
  const q = new Quaternion().setFromEuler(new Euler(x, y, z, "YXZ"));
  return [q.x, q.y, q.z, q.w];
};

/** Root lying flat with its printed side down (trays): front wall at the top of the sheet. */
export const TRAY_ROTATION: Quat = quat(Math.PI / 2, 0, 0);

export const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
export const deg = (rad: number) => (rad * 180) / Math.PI;

/** Folding-carton glue flap width (ECMA practice 12–15 mm, narrower on small cartons). */
export const glueWidth = (W: number) => Math.min(15, Math.max(10, W * 0.3));

export type Walls = { front: Rect; back: Rect; left: Rect; right: Rect };

/**
 * Long-seam-glued four-panel tube, left → right: glue | left | front | right | back.
 * Front is the root (closed: faces the viewer). `sideShape` replaces the side outlines.
 */
export function tube4(b: DielineBuilder, Lp: number, Wp: number, Hp: number, g: number, sideShape?: (r: Rect) => Polygon): Walls {
  const w: Walls = { left: rect(g, 0, Wp, Hp), front: rect(g + Wp, 0, Lp, Hp), right: rect(g + Wp + Lp, 0, Wp, Hp), back: rect(g + 2 * Wp + Lp, 0, Lp, Hp) };
  b.root("front", "front", rectPolygon(w.front.x, 0, Lp, Hp), "Front");
  for (const side of ["left", "right"] as const) {
    const edge = side === "left" ? rectEdges(w.front).left : rectEdges(w.front).right;
    if (sideShape) b.attachPoly(side, side, "front", edge, sideShape(w[side]), { stage: 0, label: side === "left" ? "Left side" : "Right side" });
    else b.attach(side, side, "front", edge, Wp, { kind: "rect" }, { stage: 0, label: side === "left" ? "Left side" : "Right side" });
  }
  b.attach("back", "back", "right", rectEdges(w.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("glue", "glue", "left", rectEdges(w.left).left, g, { kind: "trapezoid", taperA: g * 0.6, taperB: g * 0.6 }, { stage: 0, stack: -1, label: "Glue flap" });
  return w;
}

/** Regular n-gon of side `edge` length grown outward from a hinge (first two vertices = hinge). */
export function ngonOnEdge(b: DielineBuilder, parentId: string, hinge: [Pt, Pt], n: number, shrink = 0): Polygon {
  const f = b.frame(parentId, hinge);
  const s = f.length;
  const ext = (2 * Math.PI) / n;
  const out: Polygon = [f.a, f.b];
  let p = { u: s, v: 0 };
  let ang = 0;
  for (let i = 2; i < n; i++) {
    ang += ext;
    p = { u: p.u + Math.cos(ang) * s, v: p.v + Math.sin(ang) * s };
    out.push(f.at(f.a, p.u, p.v));
  }
  if (shrink > 0) {
    // Pull the far vertices toward the polygon centre (clearance inside the walls).
    const c = out.reduce((acc, q) => ({ x: acc.x + q.x / n, y: acc.y + q.y / n }), { x: 0, y: 0 });
    for (let i = 2; i < n; i++) {
      const q = out[i];
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      out[i] = pt(q.x + ((c.x - q.x) / d) * shrink, q.y + ((c.y - q.y) / d) * shrink);
    }
  }
  return out;
}

export function circle(cx: number, cy: number, r: number, seg = 32): Polygon {
  return Array.from({ length: seg }, (_, i) => pt(cx + Math.cos((i / seg) * 2 * Math.PI) * r, cy + Math.sin((i / seg) * 2 * Math.PI) * r));
}

/** Thin slit (die cut, ~0.6 mm kerf rendered as a hole) centred at (cx, cy). */
export function slit(cx: number, cy: number, length: number, horizontal = true, kerf = 0.6): Polygon {
  return horizontal ? rectPolygon(cx - length / 2, cy - kerf / 2, length, kerf) : rectPolygon(cx - kerf / 2, cy - length / 2, kerf, length);
}

/** Remove panels (and their descendants) from a builder. */
export function removePanels(b: DielineBuilder, ids: string[]) {
  const drop = new Set(ids.flatMap((id) => b.subtree(id)));
  for (let i = b.panels.length - 1; i >= 0; i--) if (drop.has(b.panels[i].id)) b.panels.splice(i, 1);
}

/** Replace a panel outline (keeps its hinge). */
export function reshape(b: DielineBuilder, id: string, polygon: Polygon) {
  const p = b.byId(id);
  p.polygon = polygon;
  p.bbox = bboxOf(polygon);
}

/** Bounds (model mm) of the main tree when closed. */
export function closedBounds(b: DielineBuilder, t: number, closedRotation: Quat): Box3 {
  const ids = new Set(b.subtree(b.rootId));
  return boundsAt({ panels: b.panels.filter((p) => ids.has(p.id)), rootId: b.rootId, thicknessMm: t, closedRotation }, 1);
}

export const sheetBox = (b: DielineBuilder) => bboxOf(b.panels.flatMap((p) => p.polygon));

/**
 * A face made of panels printed contiguously on the sheet (strips of a rolled wall, a lid
 * with its flap): face-local mm map to sheet mm by a translation.
 */
export function blockFace(face: FaceId, panels: DielinePanel[], ids: string[]): FaceInfo | null {
  const ps = ids.map((id) => panels.find((p) => p.id === id)).filter((p): p is DielinePanel => !!p);
  if (!ps.length) return null;
  const box = bboxOf(ps.flatMap((p) => p.polygon));
  const parts: FacePart[] = ps.map((p) => ({
    panelId: p.id,
    rect: { x: p.bbox.x - box.x, y: p.bbox.y - box.y, width: p.bbox.width, height: p.bbox.height },
    transform: [1, 0, 0, 1, box.x, box.y],
  }));
  return { face, width: box.width, height: box.height, parts };
}

/**
 * Closing rotation from the folded shape: take the tree closed with no root rotation, and
 * return the rotation that turns `up` (model direction) to +Y and the root's printed normal
 * toward +Z.
 */
export function orientClosed(b: DielineBuilder, t: number, up: (world: (panelId: string, p: Pt) => Vector3) => Vector3): Quat {
  const input = { panels: b.panels, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY };
  const poses = computePoses(input, 1);
  const world = (id: string, p: Pt) => {
    const panel = b.byId(id);
    return panelLocalPoint(panel, p, 0, panelPivot(panel, t), t).applyMatrix4(poses.get(id)!.world);
  };
  const y = up(world).normalize();
  const front = new Vector3(0, 0, 1);
  const z = front.sub(y.clone().multiplyScalar(front.dot(y))).normalize();
  const x = new Vector3().crossVectors(y, z);
  const src = new Matrix4().makeBasis(x, y, z);
  const q = new Quaternion().setFromRotationMatrix(src.transpose());
  return [q.x, q.y, q.z, q.w];
}

/**
 * Place a flat extra blank (divider, handle partition) in the closed box: its sheet bbox
 * centre goes to `target` (model mm), optionally turned 90° about Y.
 */
export function pieceMatrix(sheetRect: Rect, target: Vector3, alongZ: boolean): number[] {
  const flatC = new Vector3(sheetRect.x + sheetRect.width / 2, -(sheetRect.y + sheetRect.height / 2), 0);
  const m = new Matrix4().makeTranslation(target.x, target.y, target.z);
  if (alongZ) m.multiply(new Matrix4().makeRotationY(Math.PI / 2));
  m.multiply(new Matrix4().makeTranslation(-flatC.x, -flatC.y, -flatC.z));
  return m.toArray();
}

export const maxStageOf = (b: DielineBuilder) => b.panels.reduce((m, p) => Math.max(m, p.foldStage, p.assembly?.stage ?? 0), 0);

/**
 * Add panels that are visible from a face direction but sit behind its outermost plane
 * (carrier decks below the handle, a handle partition behind the front wall's rim) to that
 * face. Same face frame and origin as the automatic face, so the artwork lines up; only the
 * listed panels are taken from a search `depthTolMm` deep.
 */
export function withDeepParts(
  faces: Partial<Record<FaceId, FaceInfo>>,
  input: { panels: DielinePanel[]; rootId: string; thicknessMm: number; closedRotation: Quat },
  face: FaceId,
  ids: string[],
  depthTolMm: number,
): Partial<Record<FaceId, FaceInfo>> {
  const deep = computeFaces(input, depthTolMm).faces[face];
  const extra = deep?.parts.filter((p) => ids.includes(p.panelId)) ?? [];
  if (!deep || !extra.length) return faces;
  const base = faces[face];
  const parts = [...(base?.parts ?? []).filter((p) => !ids.includes(p.panelId)), ...extra];
  return { ...faces, [face]: { face, width: deep.width, height: deep.height, parts } };
}
