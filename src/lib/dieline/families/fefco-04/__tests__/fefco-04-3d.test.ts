import { describe, expect, it } from "vitest";
import { Mat4 as Matrix4, Vec3 as Vector3 } from "@/lib/dieline/math";
import { computePoses, panelLocalPoint, panelPivot, type DielineModel, type DielinePanel } from "../../..";
import { DEFINITIONS, generateFamilyDieline, type Fefco04Definition } from "..";

/**
 * 3D behaviour of every FEFCO 04 model in the live designer (PackagingModel renders the
 * computePoses output 1:1): the closed box has no board inside board (z-fighting / clipping),
 * and no panel sweeps through another while the blank folds.
 */

type P = { x: number; y: number };
function inPoly(x: number, y: number, poly: P[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

const asModel = (def: Fefco04Definition, t: number, dims = def.defaultDims) => generateFamilyDieline(def, dims, { thicknessMm: t }) as unknown as DielineModel;

/** Grid samples inside each panel outline (sheet mm). */
function samples(p: DielinePanel, n: number): P[] {
  const out: P[] = [];
  const b = p.bbox;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = b.x + ((i + 0.5) / n) * b.width;
      const y = b.y + ((j + 0.5) / n) * b.height;
      if (inPoly(x, y, p.polygon)) out.push({ x, y });
    }
  return out;
}

/**
 * `parallelOnly` keeps stacked (parallel) pairs: where perpendicular panels meet, each board's cut edge
 * ends inside the other's caliper by construction (as at every hinge) and nothing shows.
 *
 * Pairs (a, b) where at least `min` mid-surface samples of panel a lie inside the board of panel b
 * (within 0.45 t of b's mid-plane and inside b's outline). Parent/child pairs share a hinge and are skipped.
 */
function clashes(d: DielineModel, progress: number, n = 12, min = 3, parallelOnly = false): string[] {
  const t = d.thicknessMm;
  const poses = computePoses(d, progress);
  const frame = new Map(d.panels.map((p) => [p.id, { world: poses.get(p.id)!.world, inv: new Matrix4().copy(poses.get(p.id)!.world).invert(), pv: panelPivot(p, t) }]));
  const pts = new Map(d.panels.map((p) => [p.id, samples(p, n)]));
  const out: string[] = [];
  const v = new Vector3();
  for (const a of d.panels)
    for (const b of d.panels) {
      if (a === b || a.parentId === b.id || b.parentId === a.id) continue;
      const A = frame.get(a.id)!;
      const B = frame.get(b.id)!;
      if (parallelOnly && Math.abs(new Vector3(0, 0, 1).transformDirection(A.world).dot(new Vector3(0, 0, 1).transformDirection(B.world))) < 0.999) continue;
      const zc = (-0.5 + b.stackOffset) * t;
      let hits = 0;
      for (const s of pts.get(a.id)!) {
        panelLocalPoint(a, s, 0.5, A.pv, t, v).applyMatrix4(A.world).applyMatrix4(B.inv);
        if (Math.abs(v.z + B.pv.z - zc) < 0.45 * t && inPoly(v.x + B.pv.x, -(v.y + B.pv.y), b.polygon)) hits++;
      }
      if (hits >= min) out.push(`${a.id}→${b.id}@${progress}`);
    }
  return out;
}

describe("FEFCO 04 in 3D: closed boxes", () => {
  for (const def of DEFINITIONS)
    it(`${def.fefco}: no stacked board inside board (z-fighting), every preset, E and B flute`, () => {
      for (const t of [1.5, 3])
        for (const dims of [def.defaultDims, ...def.presets.map((p) => p.dims)]) expect(clashes(asModel(def, t, dims), 1, 16, 2, true), `${def.fefco} t=${t}`).toEqual([]);
    });
});

describe("FEFCO 04 in 3D: fold animation", () => {
  /** Transient contact while a tuck enters behind the front wall (0429 wrap-over lid). */
  const ALLOWED = new Set(["0429:lidTuck", "0429:front"]);
  /** The fifth panel lands on the base at the end of the wrap: one frame of contact inside the tube. */
  const LANDING = /^(base→fifth|fifth→base)/;
  for (const def of DEFINITIONS)
    it(`${def.fefco}: no panel sweeps through another`, () => {
      const d = asModel(def, 1.5);
      const bad: string[] = [];
      for (let k = 1; k < 20; k++)
        for (const c of clashes(d, k / 20))
          if (!LANDING.test(c) && !ALLOWED.has(`${def.fefco}:${c.split("→")[0]}`)) bad.push(c);
      expect(bad).toEqual([]);
    });

  it("ears fold before the wall that traps them rises", () => {
    for (const def of DEFINITIONS) {
      const d = asModel(def, 1.5);
      const ears = d.panels.filter((p) => p.role === "ear");
      const owners = new Set(ears.map((e) => e.parentId));
      const receivers = d.panels.filter((p) => p.parentId === d.rootId && !owners.has(p.id));
      for (const ear of ears) {
        const owner = d.panels.find((p) => p.id === ear.parentId)!;
        expect(ear.foldStage, `${def.fefco} ${ear.id}`).toBeLessThanOrEqual(owner.foldStage);
        for (const r of receivers) expect(ear.foldStage, `${def.fefco} ${ear.id} before ${r.id}`).toBeLessThan(r.foldStage);
      }
    }
  });

  it("interior bottom flaps rest on the base, one caliper above it", () => {
    for (const def of DEFINITIONS)
      for (const t of [1.5, 3]) {
        const d = asModel(def, t);
        const poses = computePoses(d, 1);
        for (const flap of d.panels.filter((p) => /BottomFlap$/.test(p.id))) {
          const lowest = Math.min(...flap.polygon.flatMap((q) => [0, 1].map((dep) => panelLocalPoint(flap, q, dep, panelPivot(flap, t), t).applyMatrix4(poses.get(flap.id)!.world).y)));
          const base = d.panels.find((p) => p.id === d.rootId)!;
          const baseTop = Math.max(...base.polygon.flatMap((q) => [0, 1].map((dep) => panelLocalPoint(base, q, dep, panelPivot(base, t), t).applyMatrix4(poses.get(base.id)!.world).y)));
          expect(lowest, `${def.fefco} ${flap.id} t=${t}`).toBeGreaterThanOrEqual(baseTop - 0.01);
          expect(lowest - baseTop, `${def.fefco} ${flap.id} t=${t}`).toBeLessThan(0.5);
        }
      }
  });
});

/** Distance from a point to the nearest outline edge. */
function edgeDist(x: number, y: number, poly: P[]) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - a.x - k * dx, y - a.y - k * dy));
  }
  return best;
}

describe("FEFCO 04 in 3D: printed faces", () => {
  /**
   * R5-3Q-C-01: no other board reaches a printed outside surface away from its edges. A stacked
   * ear / tuck / inner flap that pivoted on the parent's printed face ran through the parent's
   * board and its cut edge showed as a z-fighting kraft strip 1–3 calipers in from the corner.
   * (The shared corner strip of every hinge, within one caliper of the edge, is the engine's
   * corner convention and stays out of the check.)
   */
  for (const def of DEFINITIONS)
    it(`${def.fefco}: no cut edge shows on a printed face`, () => {
      for (const t of [1.5, 3]) {
        const d = asModel(def, t);
        const poses = computePoses(d, 1);
        const facePanels = new Set(Object.values(d.faces).flatMap((f) => f!.parts.map((x) => x.panelId)));
        const bad: string[] = [];
        for (const b of d.panels.filter((p) => facePanels.has(p.id))) {
          const B = poses.get(b.id)!.world;
          const inv = new Matrix4().copy(B).invert();
          const bp = panelPivot(b, t);
          const zPrinted = b.stackOffset * t - bp.z;
          const m = t + 0.3;
          const nb = new Vector3(0, 0, 1).transformDirection(B);
          for (const a of d.panels) {
            if (a === b) continue;
            const ap = panelPivot(a, t);
            const A = poses.get(a.id)!.world;
            // Stacked (parallel) panels are the closed-box test's job; an outside wrap flap lies ON the face.
            if (Math.abs(new Vector3(0, 0, 1).transformDirection(A).dot(nb)) > 0.999) continue;
            // Sample along every outline edge (a cut edge lying in the printed plane shows even when
            // its end points sit at the face border).
            const along = a.polygon.flatMap((q, i) => {
              const r = a.polygon[(i + 1) % a.polygon.length];
              return Array.from({ length: 9 }, (_, k) => ({ x: q.x + ((r.x - q.x) * k) / 8, y: q.y + ((r.y - q.y) * k) / 8 }));
            });
            for (const q of along)
              for (const dep of [0, 1]) {
                const v = panelLocalPoint(a, q, dep, ap, t).applyMatrix4(A).applyMatrix4(inv);
                const x = v.x + bp.x;
                const y = -(v.y + bp.y);
                if (Math.abs(v.z - zPrinted) < 0.05 && inPoly(x, y, b.polygon) && edgeDist(x, y, b.polygon) > m) bad.push(`${a.id}→${b.id} t=${t}`);
              }
          }
        }
        expect([...new Set(bad)]).toEqual([]);
      }
    });
});

describe("FEFCO 04 in 3D: corners", () => {
  /**
   * R6-3Q-C-01: at each vertical corner neither wall's cut end lies in the other wall's printed
   * face. Full-length walls met board-in-board, each end face coplanar with the neighbour's print:
   * a z-fighting board strip down all four corners, worst at small sizes (FEFCO_0400__min__d_hero).
   */
  const box = (d: DielineModel, p: DielinePanel, poses: ReturnType<typeof computePoses>) => {
    const t = d.thicknessMm;
    const pv = panelPivot(p, t);
    const pts = p.polygon.flatMap((q) => [0, 1].map((dep) => panelLocalPoint(p, q, dep, pv, t).applyMatrix4(poses.get(p.id)!.world)));
    const r = (k: "x" | "y" | "z") => [Math.min(...pts.map((v) => v[k])), Math.max(...pts.map((v) => v[k]))];
    return { x: r("x"), y: r("y"), z: r("z") };
  };
  for (const def of DEFINITIONS)
    it(`${def.fefco}: walls (and the lid) stop short of the neighbouring printed face`, () => {
      for (const t of [1.5, 3]) {
        const d = asModel(def, t);
        const poses = computePoses(d, 1);
        const wall = (role: string) => d.panels.find((p) => p.parentId === d.rootId && p.role === role);
        const long = ["front", "back"].map(wall).filter((p): p is DielinePanel => !!p);
        const ends = ["left", "right"].map(wall).filter((p): p is DielinePanel => !!p);
        // Rectangular kit trays only (octagon walls are not axis-aligned; wraps have no end walls).
        if (long.length < 2 || ends.length < 2 || d.panels.some((p) => /^corner/.test(p.id))) continue;
        const L = long.map((p) => box(d, p, poses));
        const E = ends.map((p) => box(d, p, poses));
        const outerX = Math.max(...E.map((e) => e.x[1]));
        const outerZ = Math.max(...L.map((l) => l.z[1]));
        for (const l of L) expect(Math.max(Math.abs(l.x[0]), Math.abs(l.x[1])), `${def.fefco} long wall end t=${t}`).toBeLessThan(outerX - 0.05);
        for (const e of E) expect(Math.max(Math.abs(e.z[0]), Math.abs(e.z[1])), `${def.fefco} end wall end t=${t}`).toBeLessThan(outerZ - 0.05);
        // Lid edges: the lid stops short of the front's print, the walls under it short of its print.
        const lidPanel = d.panels.find((p) => p.id === "top" && p.role === "top");
        if (lidPanel) {
          const lid = box(d, lidPanel, poses);
          expect(lid.z[1], `${def.fefco} lid front edge t=${t}`).toBeLessThan(outerZ - 0.05);
          for (const w of [wall("front"), ...ends]) if (w) expect(box(d, w, poses).y[1], `${def.fefco} ${w.id} under the lid t=${t}`).toBeLessThan(lid.y[1] - 0.05);
        }
      }
    });
});
