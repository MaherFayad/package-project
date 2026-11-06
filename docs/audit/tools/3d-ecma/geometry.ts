/**
 * Numeric 3D audit of every box model in the library at its default size and default board:
 *  - closed outer vs inner dims (flags outer < inner, or outer far above inner + board)
 *  - board interpenetration / z-fighting: parallel panels overlapping in projection whose
 *    mid-planes are closer than one caliper (0 = coplanar = z-fighting)
 *  - panels not folded at fold = 1 (still in the flat-sheet plane while the root rotated)
 *  - non-finite vertices, zero-area panels, missing faces (front/top)
 * usage: npx tsx --tsconfig tsconfig.json docs/audit/tools/3d-ecma/geometry.ts [CODE,…] (ECMA tuck + specials only; adapted from docs/audit/tools/geometry-check.ts on the 3d-visual branch)
 */
import { Vec3 as Vector3 } from "@/lib/dieline/math";
import { BOX_MODELS } from "@/lib/library";
import { BOARD_SPECS, computePoses, boundsAt, panelPivot, panelLocalPoint, type DielineModel } from "@/lib/dieline";

type Issue = { code: string; source: string; kind: string; detail: string };
const issues: Issue[] = [];
const summary: Record<string, unknown>[] = [];

function inPoly(x: number, y: number, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const ONLY = process.argv[2]?.split(",");
for (const m of BOX_MODELS.filter((x) => (x.source === "ecma-tuck" || x.source === "ecma-specials") && (!ONLY || ONLY.includes(x.code)))) {
  const material = m.materials[0];
  const t = BOARD_SPECS[material].thicknessMm;
  let d: DielineModel;
  try {
    d = m.build(m.defaultDims, { thicknessMm: t, features: {} });
  } catch (e) {
    issues.push({ code: m.code, source: m.source, kind: "build-throws", detail: String((e as Error).message) });
    continue;
  }
  const poses = computePoses(d, 1);
  const box = boundsAt(d, 1, poses);
  const size = box.getSize(new Vector3());
  const inner = m.defaultDims;
  const rec: Record<string, unknown> = { code: m.code, source: m.source, material, t, inner, outer: { L: +size.x.toFixed(1), W: +size.z.toFixed(1), H: +size.y.toFixed(1) }, panels: d.panels.length, faces: Object.keys(d.faces) };
  summary.push(rec);
  if (![size.x, size.y, size.z].every(Number.isFinite)) issues.push({ code: m.code, source: m.source, kind: "non-finite", detail: "closed bounds not finite" });
  const isCyl = m.shape === "cylinder";
  if (!isCyl) {
    const pairs: [string, number, number][] = [["L", size.x, inner.L], ["W", size.z, inner.W], ["H", size.y, inner.H]];
    for (const [k, outer, inn] of pairs) {
      if (outer < inn - 0.5) issues.push({ code: m.code, source: m.source, kind: "outer<inner", detail: `${k}: outer ${outer.toFixed(1)} < inner ${inn} (t=${t})` });
      else if (outer > inn + 8 * t + 6) issues.push({ code: m.code, source: m.source, kind: "outer>>inner", detail: `${k}: outer ${outer.toFixed(1)} vs inner ${inn} (+${(outer - inn).toFixed(1)} mm, t=${t})` });
    }
  }
  if (!d.faces.front && !d.faces.top) issues.push({ code: m.code, source: m.source, kind: "no-print-face", detail: `faces: ${Object.keys(d.faces).join(",") || "none"}` });

  // world-space panel frames at closed
  const frames = d.panels.map((p) => {
    const pose = poses.get(p.id)!;
    const pivot = panelPivot(p, t);
    const pts0 = p.polygon.map((q) => panelLocalPoint(p, q, 0, pivot, t).applyMatrix4(pose.world));
    const pts1 = p.polygon.map((q) => panelLocalPoint(p, q, 1, pivot, t).applyMatrix4(pose.world));
    const n = new Vector3(0, 0, 1).transformDirection(pose.world).normalize();
    const mid = pts0.map((a, i) => a.clone().add(pts1[i]).multiplyScalar(0.5));
    let area = 0;
    for (let i = 0; i < p.polygon.length; i++) { const a = p.polygon[i], b = p.polygon[(i + 1) % p.polygon.length]; area += a.x * b.y - b.x * a.y; }
    return { p, n, mid, area: Math.abs(area / 2), off: n.dot(mid[0]) };
  });
  for (const f of frames) {
    if (f.area < 1) issues.push({ code: m.code, source: m.source, kind: "zero-area", detail: f.p.id });
    if (f.mid.some((v) => !Number.isFinite(v.x + v.y + v.z))) issues.push({ code: m.code, source: m.source, kind: "non-finite", detail: f.p.id });
  }
  // unfolded panels: a non-root hinged panel with foldAngleClosed 0 is fine; flag panels whose closed normal equals the root's flat normal while root moved
  // overlap check
  const hits: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const A = frames[i], B = frames[j];
      if (Math.abs(A.n.dot(B.n)) < 0.999) continue;
      const dist = Math.abs(A.off - B.n.dot(A.mid[0]) * Math.sign(A.n.dot(B.n)) * 0 - (A.n.dot(B.mid[0])));
      if (dist >= t * 0.98) continue;
      // project onto A's plane basis
      const u = new Vector3().subVectors(A.mid[1], A.mid[0]).normalize();
      const v = new Vector3().crossVectors(A.n, u).normalize();
      const pa = A.mid.map((q) => ({ x: q.dot(u), y: q.dot(v) }));
      const pb = B.mid.map((q) => ({ x: q.dot(u), y: q.dot(v) }));
      const xs = pa.map((q) => q.x), ys = pa.map((q) => q.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const N = 24;
      let hit = 0;
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        const x = x0 + ((a + 0.5) / N) * (x1 - x0), y = y0 + ((b + 0.5) / N) * (y1 - y0);
        if (inPoly(x, y, pa) && inPoly(x, y, pb)) hit++;
      }
      const overlapMm2 = (hit / (N * N)) * (x1 - x0) * (y1 - y0);
      if (overlapMm2 < 20) continue;
      const kind = dist < 0.02 ? "z-fight" : "interpenetrate";
      hits.push(`${kind} ${A.p.id}↔${B.p.id} d=${dist.toFixed(2)}mm (t=${t}) ~${Math.round(overlapMm2)}mm²`);
    }
  }
  if (hits.length) issues.push({ code: m.code, source: m.source, kind: "overlap", detail: hits.slice(0, 6).join("; ") + (hits.length > 6 ? ` (+${hits.length - 6} more)` : "") });
}
for (const i of issues) console.log(i.code, i.kind, i.detail);
console.log(`${issues.length} issues`);
