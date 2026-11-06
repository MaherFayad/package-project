import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, DoubleSide, MeshPhysicalMaterial, TubeGeometry, Vector3, type Material } from "three";
import type { DielineAccessory } from "@/lib/dieline";

/**
 * Non-board parts of a closed box (ribbon pull, wire bail, cord), from `DielineModel.accessories`.
 * Closed-pose frame in mm: origin bottom centre, x right, y up, z front.
 */
export function buildAccessoryGeometry(a: DielineAccessory, samples = 32): BufferGeometry {
  const curve = new CatmullRomCurve3(a.path.map(([x, y, z]) => new Vector3(x, y, z)), false, "centripetal");
  if (a.kind !== "ribbon") return new TubeGeometry(curve, samples, a.radiusMm ?? 1, 10, false);
  // flat satin ribbon: a strip swept along the centre line, its width across the path's side vector
  const w = (a.widthMm ?? 10) / 2;
  const pos = new Float32Array((samples + 1) * 2 * 3);
  const nor = new Float32Array((samples + 1) * 2 * 3);
  const uv = new Float32Array((samples + 1) * 2 * 2);
  const up = new Vector3(0, 1, 0);
  const side = new Vector3();
  const n = new Vector3();
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    side.crossVectors(tan, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    n.crossVectors(side, tan).normalize();
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? -w : w;
      const j = i * 2 + k;
      pos.set([p.x + side.x * s, p.y + side.y * s, p.z + side.z * s], j * 3);
      nor.set([n.x, n.y, n.z], j * 3);
      uv.set([k, t], j * 2);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < samples; i++) {
    const a0 = i * 2;
    index.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("normal", new BufferAttribute(nor, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

export function createAccessoryMaterial(a: DielineAccessory): Material {
  if (a.kind === "wire") return new MeshPhysicalMaterial({ color: new Color(a.color ?? "#b9bdc2"), metalness: 1, roughness: 0.3 });
  return new MeshPhysicalMaterial({ color: new Color(a.color ?? "#2b2b2b"), roughness: 0.38, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new Color("#ffffff"), side: DoubleSide });
}
