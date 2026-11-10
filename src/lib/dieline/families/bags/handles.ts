import { BAG_HANDLE_COLORS, type BagHandleChoice, type BagHandleColor, type BagHandleKind, type Dims } from "@/types";
import { clamp } from "../../geometry";
import type { DielineAccessory } from "../../types";
import type { BagDefinition } from "./types";

/**
 * Bag handles: the size rules (from the research in docs/audit/bags.md) and their 3D centre lines.
 * Pure maths, no three.js: the renderer sweeps each path (src/components/three/accessories.ts).
 *
 * Accessory frame (DielineModel.accessories): mm, origin at the bottom centre of the standing bag,
 * x right, y up, z toward the front face.
 */

/** Paper handles are stocked in fewer colours (white, black, brown, red, green, navy: twisted-handle suppliers). */
export const PAPER_HANDLE_COLORS: BagHandleColor[] = ["KRAFT", "WHITE", "BLACK", "NAVY", "RED", "GREEN"];
export const ALL_HANDLE_COLORS = Object.keys(BAG_HANDLE_COLORS) as BagHandleColor[];

export function handleColors(kind: BagHandleKind): BagHandleColor[] {
  if (kind === "NONE" || kind === "DIE_CUT") return [];
  if (kind === "TWISTED_PAPER" || kind === "FLAT_PAPER") return PAPER_HANDLE_COLORS;
  return ALL_HANDLE_COLORS;
}

/** The handle a design gets: the requested one when the model offers it, else the model's default. */
export function resolveHandle(def: Pick<BagDefinition, "handles" | "defaultHandle" | "defaultColor">, req?: Partial<BagHandleChoice> | null): BagHandleChoice {
  const kind = req?.kind && def.handles.includes(req.kind) ? req.kind : def.defaultHandle;
  const colors = handleColors(kind);
  const fallback = colors.includes(def.defaultColor) ? def.defaultColor : (colors[0] ?? def.defaultColor);
  const color = req?.color && colors.includes(req.color) ? req.color : fallback;
  return { kind, color };
}

export const isRope = (k: BagHandleKind) => k === "COTTON_ROPE" || k === "PP_ROPE";
export const isThreaded = (k: BagHandleKind) => isRope(k) || k === "SATIN_RIBBON";
export const isRibbon = (k: BagHandleKind) => k === "SATIN_RIBBON" || k === "GROSGRAIN_RIBBON";

/** Top turnover depth (mm). Machine bags 30 to 50 mm; die-cut bags need room for the hand hole. */
export function turnoverFor(kind: BagHandleKind, dims: Dims): number {
  if (kind === "NONE") return 0;
  if (kind === "DIE_CUT") return clamp(dims.H * 0.15, 55, 70);
  if (isThreaded(kind) || kind === "GROSGRAIN_RIBBON") return clamp(dims.H * 0.13, 40, 50);
  return clamp(dims.H * 0.12, 35, 50);
}

export interface HandleGeometry {
  kind: BagHandleKind;
  /** Centre distance between the two legs (mm). */
  spanMm: number;
  /** Loop height above the mouth (mm). */
  loopHeightMm: number;
  /** Cord diameter or ribbon / tape width (mm). */
  sizeMm: number;
  /** Punched eyelet hole diameter for threaded handles (mm). */
  holeDiameterMm: number | null;
  /** Depth of the hole centre (or glued end) below the mouth (mm). */
  anchorDepthMm: number;
  /** Die-cut hand hole (width x height, mm). */
  hole?: { width: number; height: number };
}

/**
 * Handle proportions. Twisted cord 4.5 mm (suppliers quote 2 to 6 mm, bag machines take 4 to 5 mm),
 * flat tape 15 mm (10 to 20), cotton rope 6 mm (5 to 8), PP rope 5 mm, ribbon 20 mm (15 to 25).
 * Spans and loop heights scale with the face width; die-cut hole 90 x 28 mm (estimate).
 */
export function handleGeometry(kind: BagHandleKind, dims: Dims, turnover: number): HandleGeometry {
  const L = dims.L;
  switch (kind) {
    case "TWISTED_PAPER":
      return { kind, spanMm: clamp(L * 0.36, 55, 100), loopHeightMm: clamp(L * 0.42, 70, 115), sizeMm: 4.5, holeDiameterMm: null, anchorDepthMm: turnover - 10 };
    case "FLAT_PAPER":
      return { kind, spanMm: clamp(L * 0.4, 70, 120), loopHeightMm: clamp(L * 0.3, 55, 90), sizeMm: 15, holeDiameterMm: null, anchorDepthMm: turnover * 0.55 };
    case "COTTON_ROPE":
    case "PP_ROPE": {
      const d = kind === "COTTON_ROPE" ? 6 : 5;
      return { kind, spanMm: clamp(L * 0.4, 50, 130), loopHeightMm: clamp(L * 0.5, 80, 170), sizeMm: d, holeDiameterMm: d + 2, anchorDepthMm: turnover / 2 };
    }
    case "SATIN_RIBBON":
      return { kind, spanMm: clamp(L * 0.4, 50, 130), loopHeightMm: clamp(L * 0.5, 80, 170), sizeMm: clamp(L * 0.09, 15, 25), holeDiameterMm: 10, anchorDepthMm: turnover / 2 };
    case "GROSGRAIN_RIBBON":
      return { kind, spanMm: clamp(L * 0.4, 50, 130), loopHeightMm: clamp(L * 0.45, 75, 160), sizeMm: clamp(L * 0.09, 15, 25), holeDiameterMm: null, anchorDepthMm: turnover - 8 };
    case "DIE_CUT":
      return { kind, spanMm: 0, loopHeightMm: 0, sizeMm: 0, holeDiameterMm: null, anchorDepthMm: turnover / 2, hole: { width: clamp(L * 0.32, 70, 100), height: 28 } };
    default:
      return { kind, spanMm: 0, loopHeightMm: 0, sizeMm: 0, holeDiameterMm: null, anchorDepthMm: 0 };
  }
}

/* ───────────────────────── 3D paths ───────────────────────── */

type V3 = [number, number, number];

/** Uniform Catmull-Rom through `pts`, `per` samples per segment (ends included once). */
export function catmullRom(pts: V3[], per = 8): V3[] {
  if (pts.length < 3) return pts.map((q) => [...q] as V3);
  const out: V3[] = [];
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)) as V3);
    }
  }
  out.push([...pts[pts.length - 1]] as V3);
  return out;
}

const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** `n` strands twisted round a centre line (twisted paper cord, laid cotton rope). */
export function twistedStrands(centre: V3[], radius: number, n: number, pitchMm: number, axis: V3 = [0, 0, 1]): V3[][] {
  const strands: V3[][] = Array.from({ length: n }, () => []);
  let s = 0;
  for (let i = 0; i < centre.length; i++) {
    if (i > 0) s += Math.hypot(...sub3(centre[i], centre[i - 1]));
    const tan = unit3(sub3(centre[Math.min(centre.length - 1, i + 1)], centre[Math.max(0, i - 1)]));
    let nrm = cross3(tan, axis);
    if (Math.hypot(...nrm) < 1e-6) nrm = cross3(tan, [1, 0, 0]);
    nrm = unit3(nrm);
    const bin = unit3(cross3(tan, nrm));
    const phi = (2 * Math.PI * s) / pitchMm;
    for (let k = 0; k < n; k++) {
      const a = phi + (2 * Math.PI * k) / n;
      const c = Math.cos(a) * radius;
      const d = Math.sin(a) * radius;
      strands[k].push([centre[i][0] + nrm[0] * c + bin[0] * d, centre[i][1] + nrm[1] * c + bin[1] * d, centre[i][2] + nrm[2] * c + bin[2] * d]);
    }
  }
  return strands;
}

const r1 = (v: number) => Math.round(v * 100) / 100;
const round3 = (p: V3): V3 => [r1(p[0]), r1(p[1]), r1(p[2])];

export interface HandleFrame {
  /** Finished height (mouth at y = H). */
  H: number;
  /** Outer face plane, front (z = +zFace) and back (z = -zFace). */
  zFace: number;
  /** Paper caliper (mm). */
  t: number;
}

/**
 * Accessory paths for the two handles (front and back), in the accessory frame. Paper cords and
 * tapes are glued inside under the turnover; ropes and satin ribbon pass out through the eyelet
 * holes and are knotted inside; grosgrain is glued inside the turnover.
 */
export function handleAccessories(g: HandleGeometry, color: BagHandleColor, f: HandleFrame): DielineAccessory[] {
  const hex = BAG_HANDLE_COLORS[color];
  const out: DielineAccessory[] = [];
  if (g.kind === "NONE" || g.kind === "DIE_CUT") return out;
  const { H, t } = f;
  const s = g.spanMm / 2;
  const h = g.loopHeightMm;
  const r = g.sizeMm / 2;
  for (const side of [1, -1] as const) {
    const zf = f.zFace * side;
    const inward = -side; // toward the bag's inside
    const zIn = zf + inward * (2 * t + r + 0.3); // just inside the turnover
    const zOut = zf - inward * (r + 0.8); // just outside the face
    const yA = H - g.anchorDepthMm;
    const label = side === 1 ? "Front handle" : "Back handle";
    const norm: V3 = [0, 0, side];
    if (g.kind === "TWISTED_PAPER") {
      const ctrl: V3[] = [
        [-s, yA, zIn],
        [-s, H - 3, zIn],
        [-s * 1.04, H + h * 0.4, zIn - inward * 3],
        [-s * 0.6, H + h * 0.9, zIn - inward * 5],
        [0, H + h, zIn - inward * 5.5],
        [s * 0.6, H + h * 0.9, zIn - inward * 5],
        [s * 1.04, H + h * 0.4, zIn - inward * 3],
        [s, H - 3, zIn],
        [s, yA, zIn],
      ];
      const centre = catmullRom(ctrl, 10);
      for (const strand of twistedStrands(centre, r * 0.42, 2, 11, norm)) {
        out.push({ kind: "cord", path: strand.map(round3), radiusMm: r * 0.56, color: hex, finish: "paper", samples: strand.length * 2, label });
      }
    } else if (g.kind === "FLAT_PAPER") {
      const ctrl: V3[] = [
        [-s - 28, yA, zIn],
        [-s - 6, yA, zIn],
        [-s, yA + 6, zIn],
        [-s, H - 2, zIn],
        [-s * 0.98, H + h * 0.7, zIn - inward * 2],
        [-s * 0.55, H + h, zIn - inward * 3],
        [s * 0.55, H + h, zIn - inward * 3],
        [s * 0.98, H + h * 0.7, zIn - inward * 2],
        [s, H - 2, zIn],
        [s, yA + 6, zIn],
        [s + 6, yA, zIn],
        [s + 28, yA, zIn],
      ];
      out.push({ kind: "ribbon", path: catmullRom(ctrl, 8).map(round3), widthMm: g.sizeMm, normal: norm, color: hex, finish: "paper", label });
    } else if (isThreaded(g.kind)) {
      const ribbon = g.kind === "SATIN_RIBBON";
      const zKnot = zf + inward * (3 * t + r + 1.2);
      const ctrl: V3[] = [
        [-s, yA, zKnot],
        [-s, yA, zf],
        [-s, yA + 4, zOut],
        [-s * 1.05, yA + (H - yA) + h * 0.35, zOut - inward * 4],
        [-s * 0.6, H + h * 0.88, zOut - inward * 7],
        [0, H + h, zOut - inward * 8],
        [s * 0.6, H + h * 0.88, zOut - inward * 7],
        [s * 1.05, yA + (H - yA) + h * 0.35, zOut - inward * 4],
        [s, yA + 4, zOut],
        [s, yA, zf],
        [s, yA, zKnot],
      ];
      const centre = catmullRom(ctrl, 10).map(round3);
      if (ribbon) out.push({ kind: "ribbon", path: centre, widthMm: g.sizeMm, normal: norm, color: hex, finish: "satin", label });
      else if (g.kind === "COTTON_ROPE") {
        for (const strand of twistedStrands(centre, r * 0.45, 3, 14, norm)) out.push({ kind: "cord", path: strand.map(round3), radiusMm: r * 0.5, color: hex, finish: "cotton", samples: strand.length * 2, label });
      } else out.push({ kind: "cord", path: centre, radiusMm: r, color: hex, finish: "plastic", samples: centre.length * 2, label });
      // Knots inside (a short thick cord across the hole) and the free tails hanging down.
      for (const x of [-s, s]) {
        const kr = ribbon ? 4.5 : r * 1.25;
        out.push({ kind: "cord", path: [round3([x, yA + 1, zKnot]), round3([x, yA - 1, zKnot + inward * kr * 1.2])], radiusMm: kr, color: hex, finish: ribbon ? "satin" : g.kind === "COTTON_ROPE" ? "cotton" : "plastic", label: `${label} knot` });
        const tail: V3[] = [round3([x, yA - 1, zKnot + inward * kr]), round3([x + (x < 0 ? -2 : 2), yA - 10, zKnot + inward * (kr + 1)]), round3([x + (x < 0 ? -3 : 3), yA - 20, zKnot + inward * (kr + 1.5)])];
        out.push(ribbon ? { kind: "ribbon", path: tail, widthMm: g.sizeMm * 0.8, normal: norm, color: hex, finish: "satin", label: `${label} tail` } : { kind: "cord", path: tail, radiusMm: r * 0.9, color: hex, finish: g.kind === "COTTON_ROPE" ? "cotton" : "plastic", label: `${label} tail` });
      }
    } else if (g.kind === "GROSGRAIN_RIBBON") {
      const ctrl: V3[] = [
        [-s, yA, zIn],
        [-s, H - 2, zIn],
        [-s * 1.05, H + h * 0.4, zIn - inward * 4],
        [-s * 0.6, H + h * 0.88, zIn - inward * 6],
        [0, H + h, zIn - inward * 7],
        [s * 0.6, H + h * 0.88, zIn - inward * 6],
        [s * 1.05, H + h * 0.4, zIn - inward * 4],
        [s, H - 2, zIn],
        [s, yA, zIn],
      ];
      out.push({ kind: "ribbon", path: catmullRom(ctrl, 10).map(round3), widthMm: g.sizeMm, normal: norm, color: hex, finish: "grosgrain", label });
    }
  }
  return out;
}

/** Highest point of the handles above the base (mm), for camera framing and tests. */
export function handleTopMm(g: HandleGeometry, H: number): number {
  return g.loopHeightMm > 0 ? H + g.loopHeightMm : H;
}

/* ───────────────────────── names (catalogue data, MSA noun forms) ───────────────────────── */

export const HANDLE_NAMES: Record<BagHandleKind, { ar: string; en: string }> = {
  TWISTED_PAPER: { ar: "يد ورقية مجدولة", en: "Twisted paper handle" },
  FLAT_PAPER: { ar: "يد ورقية مسطحة", en: "Flat paper handle" },
  COTTON_ROPE: { ar: "حبل قطن", en: "Cotton rope" },
  PP_ROPE: { ar: "حبل بولي بروبيلين", en: "PP rope" },
  SATIN_RIBBON: { ar: "شريط ساتان", en: "Satin ribbon" },
  GROSGRAIN_RIBBON: { ar: "شريط جروجرين", en: "Grosgrain ribbon" },
  DIE_CUT: { ar: "يد مفرغة", en: "Die-cut hand hole" },
  NONE: { ar: "دون يد", en: "No handle" },
};

/** One line under each handle card. */
export const HANDLE_LINES: Record<BagHandleKind, { ar: string; en: string }> = {
  TWISTED_PAPER: { ar: "ملصقة من الداخل على رقعة تقوية", en: "Glued inside on a reinforcement patch" },
  FLAT_PAPER: { ar: "شريط ورقي ملصق تحت الثنية", en: "Paper tape glued under the turnover" },
  COTTON_ROPE: { ar: "تمر في ثقوب وتعقد من الداخل", en: "Threaded through holes, knotted inside" },
  PP_ROPE: { ar: "حبل ناعم يمر في ثقوب ويعقد", en: "Smooth cord, threaded and knotted" },
  SATIN_RIBBON: { ar: "شريط لامع يعقد من الداخل", en: "Glossy ribbon, knotted inside" },
  GROSGRAIN_RIBBON: { ar: "شريط مضلع ملصق داخل الثنية", en: "Ribbed ribbon glued inside the turnover" },
  DIE_CUT: { ar: "فتحة في الوجهين بثنية مقواة", en: "Hole through both faces, reinforced top" },
  NONE: { ar: "كيس مفتوح دون يد", en: "Open bag, no handle" },
};

export const HANDLE_COLOR_NAMES: Record<BagHandleColor, { ar: string; en: string }> = {
  KRAFT: { ar: "بني كرافت", en: "Kraft brown" },
  WHITE: { ar: "أبيض", en: "White" },
  BLACK: { ar: "أسود", en: "Black" },
  NAVY: { ar: "كحلي", en: "Navy" },
  RED: { ar: "أحمر", en: "Red" },
  BURGUNDY: { ar: "نبيتي", en: "Burgundy" },
  GREEN: { ar: "أخضر", en: "Green" },
  BEIGE: { ar: "بيج", en: "Beige" },
  PINK: { ar: "وردي", en: "Pink" },
  GOLD: { ar: "ذهبي", en: "Gold" },
  SILVER: { ar: "فضي", en: "Silver" },
};
