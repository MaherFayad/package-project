import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import type { Dims, FaceId } from "@/types";
import type { Affine, DielineModel, DielinePanel, FaceInfo, FacePart, Pt } from "./types";
import { bboxOf, centroid } from "./geometry";

/**
 * Fold kinematics, shared by the 3D view (src/components/three) and the tests.
 *
 * 3D "flat frame": X = sheet x, Y = -sheet y (up), Z = 0 on the printed (outside) surface,
 * board extends to Z = -thickness. Units are millimetres. A panel folds about its hinge;
 * positive angles move it toward -Z (the inside). The root panel turns by
 * `closedRotation` so the closed box stands upright with its front toward +Z.
 */
export type FoldInput = Pick<DielineModel, "panels" | "rootId" | "thicknessMm" | "closedRotation">;

export interface PanelPose {
  /** Relative to the parent panel's group (for a nested scene graph). */
  local: Matrix4;
  /** Model space (before centring). */
  world: Matrix4;
}

const Z = new Vector3(0, 0, 1);

export const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Parents before children. The main root's tree first, then each extra piece. */
export function panelOrder(input: Pick<DielineModel, "panels" | "rootId">): DielinePanel[] {
  const children = new Map<string | null, DielinePanel[]>();
  for (const p of input.panels) {
    const list = children.get(p.parentId) ?? [];
    list.push(p);
    children.set(p.parentId, list);
  }
  const out: DielinePanel[] = [];
  const queue = [
    ...input.panels.filter((p) => p.id === input.rootId),
    ...input.panels.filter((p) => p.parentId === null && p.id !== input.rootId),
  ];
  while (queue.length) {
    const p = queue.shift()!;
    out.push(p);
    queue.push(...(children.get(p.id) ?? []));
  }
  return out;
}

export function maxStage(input: Pick<DielineModel, "panels">): number {
  return input.panels.reduce((m, p) => Math.max(m, p.foldStage, p.assembly?.stage ?? 0), 0);
}

/** Root ids: the main root first, then extra pieces (lid, dividers…). */
export function rootIds(input: Pick<DielineModel, "panels" | "rootId">): string[] {
  return [input.rootId, ...input.panels.filter((p) => p.parentId === null && p.id !== input.rootId).map((p) => p.id)];
}

/**
 * Local pose of an extra piece's root at a progress. `assembly.matrix` maps flat-frame
 * points (X = sheet x, Y = -sheet y) to model space; flat on the sheet it sits where it
 * was cut, next to the main blank, then moves to its assembled place.
 */
export function assemblyPoseAt(
  panel: DielinePanel,
  progress: number,
  stages: number,
  mainPivot: Vector3,
  ownPivot: Vector3,
  /** Main root's rotation now × its closed rotation⁻¹: pieces ride along while it tilts. */
  follow: Matrix4 = new Matrix4(),
): Matrix4 {
  const flat = new Matrix4().makeTranslation(-mainPivot.x, -mainPivot.y, -mainPivot.z);
  const target = follow.clone().multiply(new Matrix4().fromArray(panel.assembly!.matrix));
  const a = panelFoldAmount({ ...panel, foldStage: panel.assembly!.stage }, progress, stages);
  const own = new Matrix4().makeTranslation(ownPivot.x, ownPivot.y, ownPivot.z);
  if (a <= 0) return flat.multiply(own);
  if (a >= 1) return target.multiply(own);
  const p0 = new Vector3();
  const q0 = new Quaternion();
  const p1 = new Vector3();
  const q1 = new Quaternion();
  const sc = new Vector3();
  flat.decompose(p0, q0, sc);
  target.decompose(p1, q1, sc);
  const p = p0.lerp(p1, a);
  // Arc over the box (no flying through walls): lift along model +Y mid-way.
  p.y += Math.sin(Math.PI * a) * (panel.assembly!.lift ?? 0);
  return new Matrix4().compose(p, q0.slerp(q1, a), new Vector3(1, 1, 1)).multiply(own);
}

/** 0..1 fold amount of a panel at overall progress `progress` (stages overlap a little). */
export function panelFoldAmount(panel: DielinePanel, progress: number, stages: number): number {
  const n = stages + 1;
  const overlap = 0.2 / n;
  const start = Math.max(0, panel.foldStage / n - overlap);
  const end = Math.min(1, (panel.foldStage + 1) / n + overlap);
  return smoothstep((progress - start) / (end - start));
}

/** Pivot of a panel in the flat frame. */
export function panelPivot(panel: DielinePanel, thicknessMm: number): Vector3 {
  if (!panel.hinge) {
    // Bounding-box centre (stable when a notch adds outline vertices).
    const b = bboxOf(panel.polygon);
    return new Vector3(b.x + b.width / 2, -(b.y + b.height / 2), 0);
  }
  const mx = (panel.hinge.a.x + panel.hinge.b.x) / 2;
  const my = (panel.hinge.a.y + panel.hinge.b.y) / 2;
  return new Vector3(mx, -my, -panel.pivotDepth * thicknessMm);
}

/** Unit axis such that a positive rotation folds the panel toward -Z. */
export function panelAxis(panel: DielinePanel): Vector3 {
  if (!panel.hinge) return new Vector3(1, 0, 0);
  const { a, b } = panel.hinge;
  const h = new Vector3(b.x - a.x, -(b.y - a.y), 0).normalize();
  const c = centroid(panel.polygon);
  const toC = new Vector3(c.x - a.x, -(c.y - a.y), 0);
  const d = toC.sub(h.clone().multiplyScalar(toC.dot(h))).normalize();
  return new Vector3().crossVectors(Z, d).normalize();
}

/** Mesh-space point of a panel vertex: `depth` 0 = printed surface, 1 = back surface. */
export function panelLocalPoint(
  panel: DielinePanel,
  p: Pt,
  depth: number,
  pivot: Vector3,
  thicknessMm: number,
  target = new Vector3(),
): Vector3 {
  return target.set(p.x - pivot.x, -p.y - pivot.y, (-depth + panel.stackOffset) * thicknessMm - pivot.z);
}

export function rootRotationAt(input: FoldInput, progress: number): Quaternion {
  const q = new Quaternion(...input.closedRotation);
  return new Quaternion().slerp(q, smoothstep(progress));
}

/** Poses of every panel at a fold progress (0 = flat sheet, 1 = closed box). */
export function computePoses(input: FoldInput, progress: number): Map<string, PanelPose> {
  const t = input.thicknessMm;
  const stages = maxStage(input);
  const poses = new Map<string, PanelPose>();
  const pivots = new Map<string, Vector3>();
  for (const panel of panelOrder(input)) {
    const pivot = panelPivot(panel, t);
    pivots.set(panel.id, pivot);
    const local = new Matrix4();
    if (!panel.parentId) {
      if (panel.assembly) {
        const follow = new Matrix4()
          .makeRotationFromQuaternion(rootRotationAt(input, progress))
          .multiply(new Matrix4().makeRotationFromQuaternion(new Quaternion(...input.closedRotation)).invert());
        local.copy(assemblyPoseAt(panel, progress, stages, pivots.get(input.rootId)!, pivot, follow));
      }
      else local.makeRotationFromQuaternion(rootRotationAt(input, progress));
      poses.set(panel.id, { local, world: local.clone() });
      continue;
    }
    const parentPose = poses.get(panel.parentId)!;
    const parentPivot = pivots.get(panel.parentId)!;
    const angle = ((panel.foldAngleClosed * Math.PI) / 180) * panelFoldAmount(panel, progress, stages);
    const rot = new Matrix4().makeRotationAxis(panelAxis(panel), angle);
    const offset = pivot.clone().sub(parentPivot);
    local.makeTranslation(offset.x, offset.y, offset.z).multiply(rot);
    poses.set(panel.id, { local, world: parentPose.world.clone().multiply(local) });
  }
  return poses;
}

/** Model-space bounding box (mm) of the whole board at a fold progress. */
export function boundsAt(input: FoldInput, progress: number, poses = computePoses(input, progress)): Box3 {
  const box = new Box3();
  const v = new Vector3();
  for (const panel of input.panels) {
    const pose = poses.get(panel.id);
    if (!pose) continue;
    const pivot = panelPivot(panel, input.thicknessMm);
    for (const p of panel.polygon) {
      for (const depth of [0, 1]) {
        panelLocalPoint(panel, p, depth, pivot, input.thicknessMm, v).applyMatrix4(pose.world);
        box.expandByPoint(v);
      }
    }
  }
  return box;
}

interface FaceFrame {
  n: Vector3;
  r: Vector3;
  d: Vector3;
}

/** Outside-view frames of the six faces of an upright box (front toward +Z). */
export const FACE_FRAMES: Record<FaceId, FaceFrame> = {
  front: { n: new Vector3(0, 0, 1), r: new Vector3(1, 0, 0), d: new Vector3(0, -1, 0) },
  back: { n: new Vector3(0, 0, -1), r: new Vector3(-1, 0, 0), d: new Vector3(0, -1, 0) },
  left: { n: new Vector3(-1, 0, 0), r: new Vector3(0, 0, 1), d: new Vector3(0, -1, 0) },
  right: { n: new Vector3(1, 0, 0), r: new Vector3(0, 0, -1), d: new Vector3(0, -1, 0) },
  top: { n: new Vector3(0, 1, 0), r: new Vector3(1, 0, 0), d: new Vector3(0, 0, 1) },
  bottom: { n: new Vector3(0, -1, 0), r: new Vector3(1, 0, 0), d: new Vector3(0, 0, -1) },
};

const axisPick = (box: Box3, i: 0 | 1 | 2, wantMax: boolean) =>
  wantMax ? box.max.getComponent(i) : box.min.getComponent(i);

/**
 * Detect which panels form each face of the closed box (outer surface on the box's
 * outermost plane, facing out, not stacked inward) and the face↔sheet transforms.
 */
export function computeFaces(input: FoldInput, depthTolMm?: number): { faces: Partial<Record<FaceId, FaceInfo>>; closedOuter: Dims } {
  const t = input.thicknessMm;
  const poses = computePoses(input, 1);
  const box = boundsAt(input, 1, poses);
  const size = box.getSize(new Vector3());
  const closedOuter: Dims = { L: size.x, W: size.z, H: size.y };
  const faces: Partial<Record<FaceId, FaceInfo>> = {};
  const tol = Math.max(0.05, t * 0.25, depthTolMm ?? 0);

  for (const face of Object.keys(FACE_FRAMES) as FaceId[]) {
    const { n, r, d } = FACE_FRAMES[face];
    const origin = new Vector3();
    for (const i of [0, 1, 2] as const) {
      if (n.getComponent(i) !== 0) origin.setComponent(i, axisPick(box, i, n.getComponent(i) > 0));
      else if (r.getComponent(i) !== 0) origin.setComponent(i, axisPick(box, i, r.getComponent(i) < 0));
      else origin.setComponent(i, axisPick(box, i, d.getComponent(i) < 0));
    }
    const width = Math.abs(size.dot(r));
    const height = Math.abs(size.dot(d));
    const parts: FacePart[] = [];

    for (const panel of input.panels) {
      if (panel.stackOffset < 0) continue;
      const pose = poses.get(panel.id)!;
      const pivot = panelPivot(panel, t);
      const normal = Z.clone().transformDirection(pose.world);
      if (normal.dot(n) < 0.99) continue;
      const toFace = (p: Pt) => {
        const w = panelLocalPoint(panel, p, 0, pivot, t).applyMatrix4(pose.world).sub(origin);
        return { u: w.dot(r), v: w.dot(d), h: w.dot(n) };
      };
      const c0 = toFace(panel.polygon[0]);
      if (c0.h > 1e-6 + Math.max(0.05, t * 0.25) || -c0.h > tol) continue;

      // q = M p + c  (sheet → face); invert for face → sheet.
      const o = toFace({ x: 0, y: 0 });
      const ex = toFace({ x: 1, y: 0 });
      const ey = toFace({ x: 0, y: 1 });
      const m00 = ex.u - o.u;
      const m10 = ex.v - o.v;
      const m01 = ey.u - o.u;
      const m11 = ey.v - o.v;
      const det = m00 * m11 - m01 * m10;
      if (Math.abs(det) < 1e-9) continue;
      const i00 = m11 / det;
      const i01 = -m01 / det;
      const i10 = -m10 / det;
      const i11 = m00 / det;
      const transform: Affine = [i00, i10, i01, i11, -(i00 * o.u + i01 * o.v), -(i10 * o.u + i11 * o.v)].map(
        (x) => (Math.abs(x) < 1e-12 ? 0 : x),
      ) as Affine;

      const local = bboxOf(panel.polygon.map((p) => {
        const q = toFace(p);
        return { x: q.u, y: q.v };
      }));
      const x0 = Math.max(0, local.x);
      const y0 = Math.max(0, local.y);
      const x1 = Math.min(width, local.x + local.width);
      const y1 = Math.min(height, local.y + local.height);
      if (x1 - x0 < 0.5 || y1 - y0 < 0.5) continue;
      parts.push({ panelId: panel.id, rect: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, transform });
    }
    if (parts.length) faces[face] = { face, width, height, parts };
  }
  return { faces, closedOuter };
}

/** Apply a canvas-style affine to a point. */
export function applyAffine(m: Affine, u: number, v: number): Pt {
  return { x: m[0] * u + m[2] * v + m[4], y: m[1] * u + m[3] * v + m[5] };
}

/** Multiply affines: result maps p → a(b(p)). */
export function composeAffine(a: Affine, b: Affine): Affine {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/**
 * Face-local → sheet transform for a printed surface. The inside surface is seen from
 * inside the box, so its face frame is mirrored left↔right (the inside texture still
 * uses sheet coordinates as seen from the outside; the press sheet for the inside is
 * the horizontal mirror of it).
 */
export function faceTransform(face: FaceInfo, part: FacePart, surface: "outside" | "inside"): Affine {
  if (surface === "outside") return part.transform;
  return composeAffine(part.transform, [-1, 0, 0, 1, face.width, 0]);
}

/** Face-local rect of a part as seen on the given surface. */
export function partRect(face: FaceInfo, part: FacePart, surface: "outside" | "inside") {
  if (surface === "outside") return part.rect;
  return { ...part.rect, x: face.width - part.rect.x - part.rect.width };
}
