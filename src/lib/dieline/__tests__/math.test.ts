/**
 * The dieline engine's local math (../math.ts) must stay bit-identical to three r180 for every
 * operation the engine uses, and the engine must never import `three` again (PERF-03).
 */
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Box3, Euler, Mat4, Quat, Vec3 } from "../math";

let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 200 - 100;
};
const q3 = () => {
  const e = [rnd() / 30, rnd() / 30, rnd() / 30] as const;
  return [new Quat().setFromEuler(new Euler(...e, "YXZ")), new THREE.Quaternion().setFromEuler(new THREE.Euler(...e, "YXZ"))] as const;
};
const sameM = (a: Mat4, b: THREE.Matrix4) => expect(a.elements).toEqual(Array.from(b.elements));
const sameV = (a: Vec3, b: THREE.Vector3) => expect([a.x, a.y, a.z]).toEqual([b.x, b.y, b.z]);
const sameQ = (a: Quat, b: THREE.Quaternion) => expect([a.x, a.y, a.z, a.w]).toEqual([b.x, b.y, b.z, b.w]);

describe("dieline math matches three exactly", () => {
  it("quaternions, matrices, vectors and boxes", () => {
    for (let i = 0; i < 300; i++) {
      const [qa, qb] = q3();
      const [ra, rb] = q3();
      sameQ(qa, qb);
      const t = Math.abs(rnd()) / 100;
      sameQ(qa.clone().slerp(ra, t), qb.clone().slerp(rb, t));
      const axis = [rnd(), rnd(), rnd()] as const;
      const ang = rnd() / 20;
      const ma = new Mat4().makeRotationAxis(new Vec3(...axis).normalize(), ang).multiply(new Mat4().makeTranslation(rnd(), rnd(), rnd()));
      const mb = new THREE.Matrix4().fromArray(ma.elements);
      sameM(new Mat4().makeRotationFromQuaternion(qa), new THREE.Matrix4().makeRotationFromQuaternion(qb));
      sameM(ma.clone().invert(), mb.clone().invert());
      sameM(ma.clone().multiply(new Mat4().makeRotationFromQuaternion(qa)), mb.clone().multiply(new THREE.Matrix4().makeRotationFromQuaternion(qb)));
      sameM(ma.clone().premultiply(new Mat4().makeRotationX(ang)), mb.clone().premultiply(new THREE.Matrix4().makeRotationX(ang)));
      sameM(new Mat4().makeRotationY(ang), new THREE.Matrix4().makeRotationY(ang));
      sameM(ma.clone().transpose(), mb.clone().transpose());
      expect(ma.determinant()).toBe(mb.determinant());
      const [pa, sa, qd] = [new Vec3(), new Vec3(), new Quat()];
      const [pb, sb, qe] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Quaternion()];
      ma.decompose(pa, qd, sa);
      mb.decompose(pb, qe, sb);
      sameV(pa, pb);
      sameV(sa, sb);
      sameQ(qd, qe);
      sameM(new Mat4().compose(pa, qd, sa), new THREE.Matrix4().compose(pb, qe, sb));
      const v = [rnd(), rnd(), rnd()] as const;
      sameV(new Vec3(...v).applyMatrix4(ma), new THREE.Vector3(...v).applyMatrix4(mb));
      sameV(new Vec3(...v).transformDirection(ma), new THREE.Vector3(...v).transformDirection(mb));
      sameV(new Vec3(...v).applyQuaternion(qa), new THREE.Vector3(...v).applyQuaternion(qb));
      sameV(new Vec3(...v).cross(new Vec3(...axis)), new THREE.Vector3(...v).cross(new THREE.Vector3(...axis)));
      sameV(new Vec3(...v).lerp(new Vec3(...axis), t), new THREE.Vector3(...v).lerp(new THREE.Vector3(...axis), t));
      const ba = new Box3().expandByPoint(new Vec3(...v)).expandByPoint(new Vec3(...axis)).applyMatrix4(ma);
      const bb = new THREE.Box3().expandByPoint(new THREE.Vector3(...v)).expandByPoint(new THREE.Vector3(...axis)).applyMatrix4(mb);
      sameV(ba.min, bb.min);
      sameV(ba.max, bb.max);
      sameV(ba.getSize(new Vec3()), bb.getSize(new THREE.Vector3()));
      sameV(ba.getCenter(new Vec3()), bb.getCenter(new THREE.Vector3()));
    }
  });

  it("empty boxes behave like three's", () => {
    expect(new Box3().isEmpty()).toBe(true);
    const s = new Box3().getSize(new Vec3(9, 9, 9));
    expect([s.x, s.y, s.z]).toEqual([0, 0, 0]);
  });
});

describe("the dieline engine does not import three", () => {
  it("no file under src/lib/dieline (tests excepted) imports three", () => {
    const root = path.resolve(__dirname, "..");
    const offenders: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__") walk(p);
        } else if (/\.tsx?$/.test(e.name) && /from ["']three(\/[^"']*)?["']/.test(fs.readFileSync(p, "utf8"))) {
          offenders.push(path.relative(root, p));
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
