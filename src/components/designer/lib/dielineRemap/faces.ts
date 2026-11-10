import type { FaceId } from "@/types";
import type { SourceFace } from "./types";

/**
 * Fallback when no library model matches well enough: find the six visible faces of the closed
 * box in the art by topology and size alone. Works for the hinged-lid constructions printers
 * send most (mailers, trays with a lid, bakery boxes): a base with four walls round it and a lid
 * of the same size joined to one of them (the back wall). Returns null for any other layout.
 */

type Line = [number, number, number, number];
interface Cluster {
  pos: number;
  spans: [number, number][];
}
interface Cell {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** weakest side's line coverage, and the mean of the four */
  weak?: number;
  mean?: number;
}

function clusters(list: { pos: number; a: number; b: number }[], tol: number): Cluster[] {
  // single linkage along the axis: hand-drawn templates put one fold a few px off between panels
  const out: (Cluster & { last: number; w: number })[] = [];
  for (const l of [...list].sort((p, q) => p.pos - q.pos)) {
    const c = out[out.length - 1];
    const len = l.b - l.a;
    if (c && l.pos - c.last <= tol) {
      c.pos = (c.pos * c.w + l.pos * len) / (c.w + len);
      c.w += len;
      c.last = l.pos;
      c.spans.push([l.a, l.b]);
    } else out.push({ pos: l.pos, spans: [[l.a, l.b]], last: l.pos, w: len });
  }
  return out;
}

const area = (c: Cell) => (c.x1 - c.x0) * (c.y1 - c.y0);

/** Share of [a, b] covered by the union of the spans. */
function coverage(c: Cluster, a: number, b: number): number {
  const s = c.spans.map(([p, q]) => [Math.max(a, p), Math.min(b, q)] as const).filter(([p, q]) => q > p).sort((x, y) => x[0] - y[0]);
  let cov = 0;
  let end = a;
  for (const [p, q] of s) {
    if (q <= end) continue;
    cov += q - Math.max(p, end);
    end = q;
  }
  return cov / Math.max(1e-6, b - a);
}

/** Rectangular panels bounded on all four sides by drawn lines, with no full line across them. */
export function rectCells(lines: readonly Line[]): { cells: Cell[]; size: number } {
  const hs: { pos: number; a: number; b: number }[] = [];
  const vs: { pos: number; a: number; b: number }[] = [];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [ax, ay, bx, by] of lines) {
    x0 = Math.min(x0, ax, bx);
    y0 = Math.min(y0, ay, by);
    x1 = Math.max(x1, ax, bx);
    y1 = Math.max(y1, ay, by);
    if (Math.abs(bx - ax) >= Math.abs(by - ay)) hs.push({ pos: (ay + by) / 2, a: Math.min(ax, bx), b: Math.max(ax, bx) });
    else vs.push({ pos: (ax + bx) / 2, a: Math.min(ay, by), b: Math.max(ay, by) });
  }
  const size = Math.max(1, x1 - x0, y1 - y0);
  const tol = 0.005 * size;
  const xs = clusters(vs, tol);
  const ys = clusters(hs, tol);
  const min = 0.04 * size;
  // Bounds may be broken where the die runs over art of its own colour; a full line across splits.
  const COVER = 0.4;
  const SPLIT = 0.3;
  const cells: Cell[] = [];
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) {
      const xa = xs[i].pos;
      const xb = xs[j].pos;
      if (xb - xa < min) continue;
      for (let p = 0; p < ys.length; p++)
        for (let q = p + 1; q < ys.length; q++) {
          const ya = ys[p].pos;
          const yb = ys[q].pos;
          if (yb - ya < min) continue;
          const cov = [coverage(xs[i], ya, yb), coverage(xs[j], ya, yb), coverage(ys[p], xa, xb), coverage(ys[q], xa, xb)];
          if (cov.some((c) => c < 0.25) || cov.reduce((a, b) => a + b, 0) < 4 * COVER + 0.6) continue;
          let split = false;
          for (let k = i + 1; k < j && !split; k++) split = coverage(xs[k], ya, yb) >= SPLIT;
          for (let k = p + 1; k < q && !split; k++) split = coverage(ys[k], xa, xb) >= SPLIT;
          if (!split) cells.push({ x0: xa, y0: ya, x1: xb, y1: yb, weak: Math.min(...cov), mean: cov.reduce((a, b) => a + b, 0) / 4 });
        }
    }
  // Loose bounds also close boxes round several panels, or across a panel along a line of text:
  // keep a partition, best-drawn cells first (then the smaller), none overlapping another.
  const overlap = (p: Cell, q: Cell) => Math.max(0, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0)) * Math.max(0, Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0));
  const kept: Cell[] = [];
  for (const c of [...cells].sort((p, q) => (q.mean ?? 0) - (p.mean ?? 0) || area(p) - area(q)))
    if (!kept.some((k) => overlap(k, c) > 0.1 * Math.min(area(k), area(c)))) kept.push(c);
  return { cells: kept, size };
}

type V = { x: number; y: number };

/** Direction from a to b when they share a full edge (one cardinal unit vector), else null. */
function sharedEdge(a: Cell, b: Cell, tol: number): V | null {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  const minW = Math.min(a.x1 - a.x0, b.x1 - b.x0);
  const minH = Math.min(a.y1 - a.y0, b.y1 - b.y0);
  if (Math.abs(a.y1 - b.y0) <= tol && ox >= 0.8 * minW) return { x: 0, y: 1 };
  if (Math.abs(b.y1 - a.y0) <= tol && ox >= 0.8 * minW) return { x: 0, y: -1 };
  if (Math.abs(a.x1 - b.x0) <= tol && oy >= 0.8 * minH) return { x: 1, y: 0 };
  if (Math.abs(b.x1 - a.x0) <= tol && oy >= 0.8 * minH) return { x: -1, y: 0 };
  return null;
}

/** A face's frame on its cell: origin at the corner where both axes point inward. */
function frameOn(c: Cell, right: V, down: V): SourceFace {
  const ext = (v: V) => (v.x !== 0 ? c.x1 - c.x0 : c.y1 - c.y0);
  const ox = right.x < 0 || down.x < 0 ? c.x1 : c.x0;
  const oy = right.y < 0 || down.y < 0 ? c.y1 : c.y0;
  return { origin: { x: ox, y: oy }, right, down, width: ext(right), height: ext(down) };
}

/**
 * The six faces (outside-view frames, image px). `mirrored`: the art is drawn as seen from the
 * inside of the board (an inside print laid out like Elba's inside template).
 */
export function findFaces(lines: readonly Line[], mirrored: boolean): Partial<Record<FaceId, SourceFace>> | null {
  const { cells, size } = rectCells(lines);
  if (cells.length < 3) return null;
  const tol = 0.012 * size;
  const nbrs = (c: Cell) => cells.filter((d) => d !== c).map((d) => ({ d, dir: sharedEdge(c, d, tol) })).filter((n): n is { d: Cell; dir: V } => !!n.dir);
  const big = [...cells].sort((a, b) => area(b) - area(a)).slice(0, 6);
  // base and lid are the two biggest panels of these constructions
  const floor = 0.6 * area(big[0]);
  let best: { base: Cell; lid: Cell; back: Cell; f: V; score: number } | null = null;
  for (const a of big)
    for (const b of big) {
      if (a === b || area(a) < floor || area(b) < floor) continue;
      const wa = a.x1 - a.x0;
      const ha = a.y1 - a.y0;
      const wb = b.x1 - b.x0;
      const hb = b.y1 - b.y0;
      if (Math.abs(Math.log(wa / wb)) > 0.15 || Math.abs(Math.log(ha / hb)) > 0.15) continue;
      // a = base, b = lid, joined by a common neighbour (the back wall) on opposite sides of it
      for (const n of nbrs(a)) {
        const toLid = sharedEdge(n.d, b, tol);
        if (!toLid || toLid.x !== n.dir.x || toLid.y !== n.dir.y) continue;
        const f = { x: -n.dir.x, y: -n.dir.y };
        // walls run the full length of the base's edges; a lid's dust flaps are usually shorter
        const full = (c: Cell, d: V) => (d.x !== 0 ? Math.min(c.y1, a.y1) - Math.max(c.y0, a.y0) >= 0.9 * (a.y1 - a.y0) : Math.min(c.x1, a.x1) - Math.max(c.x0, a.x0) >= 0.9 * (a.x1 - a.x0));
        const round = nbrs(a).filter((m) => full(m.d, m.dir)).length;
        const front = nbrs(a).find((m) => m.dir.x === f.x && m.dir.y === f.y);
        const depth = (c: Cell, d: V) => (d.x !== 0 ? c.x1 - c.x0 : c.y1 - c.y0);
        const frontMatch = front ? 1 - Math.min(1, Math.abs(depth(front.d, f) - depth(n.d, f)) / depth(n.d, f)) : 0;
        // the base's walls carry more panels (rolled-in walls, ears); a lid's flaps carry none
        const ring = nbrs(a).filter((m) => m.d !== n.d).reduce((k, m) => k + nbrs(m.d).filter((q) => q.d !== a).length, 0);
        const score = round + frontMatch + 0.5 * ring + area(a) / (area(a) + area(b));
        if (!best || score > best.score) best = { base: a, lid: b, back: n.d, f, score };
      }
    }
  if (!best) return null;
  const { base, lid, back, f } = best;
  const rot = { x: f.y, y: -f.x };
  const l = mirrored ? { x: -rot.x, y: -rot.y } : rot;
  const neg = (v: V) => ({ x: -v.x, y: -v.y });
  const around = nbrs(base);
  const at = (d: V) => around.find((m) => m.dir.x === d.x && m.dir.y === d.y)?.d ?? null;
  const out: Partial<Record<FaceId, SourceFace>> = {
    bottom: frameOn(base, neg(l), neg(f)),
    top: frameOn(lid, neg(l), neg(f)),
    back: frameOn(back, l, f),
  };
  const front = at(f);
  const left = at(l);
  const right = at(neg(l));
  if (front) out.front = frameOn(front, neg(l), neg(f));
  if (left) out.left = frameOn(left, f, neg(l));
  if (right) out.right = frameOn(right, neg(f), l);
  return out;
}

/**
 * The detected lines worth reading faces from: solid cuts, and dashed runs long enough to be a
 * fold (a short dashed run inside a panel is usually art, a rule under a line of text).
 */
export function faceLinesOf(segments: readonly { x1: number; y1: number; x2: number; y2: number; fill: number }[]): Line[] {
  const size = Math.max(1, ...segments.flatMap((s) => [Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1)]));
  return segments.filter((s) => s.fill >= 0.75 || Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 0.2 * size).map((s) => [s.x1, s.y1, s.x2, s.y2]);
}
