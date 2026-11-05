import { DielineBuilder } from "../../builder";
import { rectPolygon } from "../../geometry";
import type { Rect } from "../../types";
import { CLEARANCE, CORRUGATED, clr, fitL, fitW, fitting, notAbove } from "./common";
import { FLAT_PRINT_UP, FLAT_PRINT_UP_ALONG_W, chain, flapOn, type ChainPanel, type Quat } from "./engine";
import type { FittingDefinition, FittingDraft, OptionSpec, ResolvedFittingParams } from "./types";

/**
 * Cushion and clearance pads: one blank folded into extra layers, rails or legs. The top
 * (printed) face is up; positive folds go under the pad.
 */

const onFloor = (p: ResolvedFittingParams) => ({ x: clr(p) / 2, y: 0, z: clr(p) / 2 });

function folded(width: number, panels: ChainPanel[], rootIndex: number, p: ResolvedFittingParams, rotation: Quat = FLAT_PRINT_UP): FittingDraft {
  const b = new DielineBuilder();
  chain(b, width, panels, rootIndex, { rootRole: "top" });
  return { builder: b, closedRotation: rotation, anchor: onFloor(p) };
}

const UNDER = (len: number, label: string, extra: Partial<ChainPanel> = {}): ChainPanel => ({ len, fold: 180, pivotDepth: 1, label, ...extra });

/** Accordion: n layers of length `len`, alternating folds. */
export function accordion(len: number, n: number): ChainPanel[] {
  return Array.from({ length: n }, (_, i): ChainPanel =>
    i === 0 ? { len, label: "Layer 1" } : i % 2 === 1 ? UNDER(len, `Layer ${i + 1}`) : { len, fold: -180, pivotDepth: 0, label: `Layer ${i + 1}` },
  );
}

/** Rail under one end of the pad: triangle (legs s, s, hyp s√2) or square (s × s). */
function rail(s: number, kind: "triangle" | "square", glue: number): ChainPanel[] {
  if (kind === "triangle") return [{ len: s, fold: 90, label: "Rail leg" }, { len: s * Math.SQRT2, fold: 135, label: "Rail face" }, { len: glue, fold: 135, glue: true }];
  return [{ len: s, fold: 90, label: "Rail outer" }, { len: s, fold: 90, label: "Rail bottom" }, { len: s, fold: 90, label: "Rail inner" }, { len: glue, fold: 90, glue: true }];
}
/** The same rail on the left side of the root (chain order reversed). */
const leftRail = (r: ChainPanel[]) => [...r].reverse();
const glueOf = (s: number) => Math.min(25, Math.max(10, s * 0.6));

const LAYERS = (n: number): OptionSpec => ({ min: 2, max: 8, default: n, int: true });
const SIZE = (dflt: number | ((h: ResolvedFittingParams["host"]) => number), max = 150): OptionSpec => ({ min: 8, max, default: dflt });

const base = {
  subFamily: "CUSHION" as const,
  slot: "floor" as const,
  uses: ["shipping", "ecommerce"] as FittingDefinition["uses"],
  materials: CORRUGATED,
  defaultMaterial: "B_FLUTE_KRAFT" as const,
};

export const CUSHIONS: FittingDefinition[] = [
  fitting({
    ...base,
    fefco: "0940",
    slug: "cushion-pad-ends-under",
    name: { ar: "وسادة حماية بطرفين مطويين", en: "Cushion pad, ends folded under" },
    description: { ar: "لوح حماية تنطوي أطرافه تحته لتضاعف السمك عند الأطراف.", en: "Pad whose two ends fold underneath, doubling the board at the ends." },
    interpretation: "Panels f | L | f, both end flaps folded 180° under the pad.",
    options: { clearanceMm: CLEARANCE, sizeMm: SIZE((h) => Math.round((h.L - 3) / 4), 400) },
    check: (p) => notAbove("sizeMm", p.sizeMm!, fitL(p) / 2 - 1),
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: 2 * t }),
    build: (p) => folded(fitW(p), [UNDER(p.sizeMm!, "End flap"), { len: fitL(p), label: "Pad" }, UNDER(p.sizeMm!, "End flap")], 1, p),
  }),
  fitting({
    ...base,
    fefco: "0941",
    slug: "cushion-pad-double",
    name: { ar: "وسادة حماية مزدوجة", en: "Double-layer cushion pad" },
    description: { ar: "لوح حماية ينطوي على نفسه مرة واحدة ليصبح بطبقتين.", en: "Pad folded once onto itself: two full layers." },
    interpretation: "Panels L | L, the second folded 180° under the first.",
    options: { clearanceMm: CLEARANCE },
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: 2 * t }),
    build: (p) => folded(fitW(p), accordion(fitL(p), 2), 0, p),
  }),
  fitting({
    ...base,
    fefco: "0942",
    slug: "cushion-pad-z-fold",
    name: { ar: "وسادة حماية مطوية ثلاث طبقات", en: "Z-fold cushion pad" },
    description: { ar: "لوح حماية مطوي على شكل حرف Z بثلاث طبقات أو أكثر.", en: "Pad Z-folded into three (or more) layers." },
    interpretation: "Accordion of n equal panels, folds alternating 180° under / over.",
    options: { clearanceMm: CLEARANCE, layers: LAYERS(3) },
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: p.layers! * t }),
    build: (p) => folded(fitW(p), accordion(fitL(p), p.layers!), 0, p),
  }),
  fitting({
    ...base,
    fefco: "0943",
    subFamily: "CLEARANCE",
    slug: "clearance-pad-two-legs",
    name: { ar: "لوح رفع بساقين", en: "Clearance pad, two legs" },
    description: { ar: "لوح يرتكز على ساقين مطويتين لترك فراغ حماية فوق المنتج أو تحته.", en: "Pad standing on two folded legs, leaving protective head or foot space." },
    interpretation: "Panels h | L | h, both end panels folded 90° down as legs.",
    options: { clearanceMm: CLEARANCE, heightMm: { min: 10, max: 300, default: (h) => Math.round(h.H / 4) } },
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.heightMm! }),
    build: (p) => folded(fitW(p), [{ len: p.heightMm!, fold: 90, label: "Leg" }, { len: fitL(p), label: "Pad" }, { len: p.heightMm!, fold: 90, label: "Leg" }], 1, p),
  }),
  fitting({
    ...base,
    fefco: "0944",
    subFamily: "CLEARANCE",
    slug: "clearance-pad-four-legs",
    name: { ar: "لوح رفع بأربع جوانب", en: "Clearance pad, four skirts" },
    description: { ar: "لوح ترتكز أطرافه الأربعة على جوانب مطوية لأسفل لترك فراغ حماية.", en: "Pad on four folded-down skirts that leave a protective space." },
    interpretation: "Cross blank: pad with a skirt on each edge folded 90° down; corners open.",
    options: { clearanceMm: CLEARANCE, heightMm: { min: 10, max: 300, default: (h) => Math.round(h.H / 4) } },
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.heightMm! }),
    build: (p, t) => perimeter(p, p.heightMm!, 90, t),
  }),
  fitting({
    ...base,
    fefco: "0945",
    slug: "cushion-pad-edges-under",
    name: { ar: "وسادة حماية بحواف مطوية", en: "Cushion pad, four edges folded under" },
    description: { ar: "لوح حماية تنطوي حوافه الأربع تحته لتقوية المحيط.", en: "Pad with all four edges folded underneath to stiffen the rim." },
    interpretation: "Cross blank: pad with a flap on each edge folded 180° under; end flaps inset to clear the corners.",
    options: { clearanceMm: CLEARANCE, sizeMm: SIZE((h) => Math.round(Math.min(h.L, h.W) / 6), 150) },
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(fitL(p), fitW(p)) / 2 - 1),
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: 2 * t }),
    build: (p, t) => perimeter(p, p.sizeMm!, 180, t),
  }),
  fitting({
    ...base,
    fefco: "0946",
    slug: "cushion-pad-end-rails",
    name: { ar: "وسادة حماية بقضبان مثلثة طرفية", en: "Cushion pad, triangular end rails" },
    description: { ar: "لوح حماية يرتكز على قضيبين مثلثين مطويين عند طرفيه.", en: "Pad raised on two triangular rails folded under its ends." },
    interpretation: "Each end: leg s down, face s√2 back under the pad, glue tab: a right-triangle rail.",
    options: { clearanceMm: CLEARANCE, sizeMm: SIZE((h) => Math.round(Math.min(40, h.H / 4))) },
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(fitL(p) / 3, p.host.H - 1)),
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.sizeMm! }),
    build: (p) => {
      const r = rail(p.sizeMm!, "triangle", glueOf(p.sizeMm!));
      return folded(fitW(p), [...leftRail(r), { len: fitL(p), label: "Pad" }, ...r], 3, p);
    },
  }),
  fitting({
    ...base,
    fefco: "0947",
    slug: "cushion-pad-side-rails",
    name: { ar: "وسادة حماية بقضبان مثلثة جانبية", en: "Cushion pad, triangular side rails" },
    description: { ar: "لوح حماية يرتكز على قضيبين مثلثين بطول الجانبين الطويلين.", en: "Pad raised on two triangular rails along its long edges." },
    interpretation: "As 0946 with the rails along L (strip width L, chain across W).",
    options: { clearanceMm: CLEARANCE, sizeMm: SIZE((h) => Math.round(Math.min(40, h.H / 4))) },
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(fitW(p) / 3, p.host.H - 1)),
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.sizeMm! }),
    build: (p) => {
      const r = rail(p.sizeMm!, "triangle", glueOf(p.sizeMm!));
      return folded(fitL(p), [...leftRail(r), { len: fitW(p), label: "Pad" }, ...r], 3, p, FLAT_PRINT_UP_ALONG_W);
    },
  }),
  fitting({
    ...base,
    fefco: "0948",
    slug: "cushion-pad-box-rails",
    name: { ar: "وسادة حماية بقضبان مربعة", en: "Cushion pad, square end rails" },
    description: { ar: "لوح حماية يرتكز على قضيبين مربعين مطويين عند طرفيه.", en: "Pad raised on two square tube rails folded under its ends." },
    interpretation: "Each end: outer s, bottom s, inner s, glue tab, all folded 90°: a square rail.",
    options: { clearanceMm: CLEARANCE, sizeMm: SIZE((h) => Math.round(Math.min(40, h.H / 4))) },
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(fitL(p) / 3, p.host.H - 1)),
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.sizeMm! }),
    build: (p) => {
      const r = rail(p.sizeMm!, "square", glueOf(p.sizeMm!));
      return folded(fitW(p), [...leftRail(r), { len: fitL(p), label: "Pad" }, ...r], 4, p);
    },
  }),
  fitting({
    ...base,
    fefco: "0949",
    slug: "cushion-tray-end-walls",
    name: { ar: "وسادة حماية بجدارين قائمين", en: "Cushion pad, raised end walls" },
    description: { ar: "لوح حماية ترتفع أطرافه كجدارين يثبتان المنتج من الطرفين.", en: "Pad whose ends fold up into two walls that hold the product." },
    interpretation: "Panels h | L | h, end panels folded 90° up.",
    options: { clearanceMm: CLEARANCE, heightMm: { min: 10, max: 300, default: (h) => Math.round(h.H / 3) } },
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.heightMm! }),
    build: (p) => folded(fitW(p), [{ len: p.heightMm!, fold: -90, pivotDepth: 0, label: "End wall" }, { len: fitL(p), label: "Pad" }, { len: p.heightMm!, fold: -90, pivotDepth: 0, label: "End wall" }], 1, p),
  }),
  fitting({
    ...base,
    fefco: "0949a",
    slug: "cushion-tray-double-walls",
    name: { ar: "وسادة حماية بجدارين مزدوجين", en: "Cushion pad, double end walls" },
    description: { ar: "لوح حماية بجدارين طرفيين مزدوجين لامتصاص الصدمات.", en: "Pad with doubled end walls for impact absorption." },
    interpretation: "Panels h | h | L | h | h: each end wall folds up, its return folds back down inside.",
    options: { clearanceMm: CLEARANCE, heightMm: { min: 10, max: 300, default: (h) => Math.round(h.H / 3) } },
    check: (p) => notAbove("heightMm", p.heightMm!, fitL(p) / 2 - 1),
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.heightMm! }),
    build: (p) => {
      const h = p.heightMm!;
      const wall: ChainPanel = { len: h, fold: -90, pivotDepth: 0, label: "End wall" };
      const ret: ChainPanel = { len: h, fold: -180, pivotDepth: 0, label: "Wall return" };
      return folded(fitW(p), [ret, wall, { len: fitL(p), label: "Pad" }, wall, ret], 2, p);
    },
  }),
  fitting({
    ...base,
    fefco: "0950",
    slug: "accordion-cushion-four",
    name: { ar: "وسادة حماية أكورديون أربع طبقات", en: "Accordion cushion pad, four layers" },
    description: { ar: "لوح حماية مطوي أكورديون بأربع طبقات لامتصاص الصدمات.", en: "Pad accordion-folded into four layers for shock absorption." },
    interpretation: "Accordion of n equal panels (default 4).",
    options: { clearanceMm: CLEARANCE, layers: LAYERS(4) },
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: p.layers! * t }),
    build: (p) => folded(fitW(p), accordion(fitL(p), p.layers!), 0, p),
  }),
  fitting({
    ...base,
    fefco: "0950a",
    slug: "accordion-cushion-five",
    name: { ar: "وسادة حماية أكورديون خمس طبقات", en: "Accordion cushion pad, five layers" },
    description: { ar: "لوح حماية مطوي أكورديون بخمس طبقات للمنتجات الأثقل.", en: "Pad accordion-folded into five layers for heavier products." },
    interpretation: "Accordion of n equal panels (default 5).",
    options: { clearanceMm: CLEARANCE, layers: LAYERS(5) },
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: p.layers! * t }),
    build: (p) => folded(fitW(p), accordion(fitL(p), p.layers!), 0, p),
  }),
];

/** Pad with a flap on every edge (legs at 90°, or edges folded under at 180°). */
function perimeter(p: ResolvedFittingParams, depth: number, fold: number, t: number): FittingDraft {
  const b = new DielineBuilder();
  const L = fitL(p);
  const W = fitW(p);
  const root: Rect = { x: depth, y: depth, width: L, height: W };
  b.root("pad", "top", rectPolygon(root.x, root.y, L, W), "Pad");
  b.pieceLabels.set("pad", "Fitting");
  const o = fold > 135 ? { fold, pivotDepth: 1 } : { fold };
  flapOn(b, "edgeBack", "pad", root, "top", depth, { ...o, label: "Back edge" });
  flapOn(b, "edgeFront", "pad", root, "bottom", depth, { ...o, label: "Front edge" });
  // End flaps clear the corners: inset by the side flap depth (180°) or the board (90°).
  const inset = fold > 135 ? depth : t;
  flapOn(b, "edgeLeft", "pad", root, "left", depth, { ...o, inset, label: "Left edge", stack: fold > 135 ? -1 : 0 });
  flapOn(b, "edgeRight", "pad", root, "right", depth, { ...o, inset, label: "Right edge", stack: fold > 135 ? -1 : 0 });
  return { builder: b, closedRotation: FLAT_PRINT_UP, anchor: onFloor(p) };
}

/* ───────────────────────── scored sheets (0951, 0967) ───────────────────────── */

export const SCORED_SHEETS: FittingDefinition[] = [
  fitting({
    fefco: "0951",
    slug: "scored-sheet",
    subFamily: "SCORED_SHEET",
    name: { ar: "لوح مسطح بخطوط طي", en: "Scored sheet" },
    description: { ar: "لوح كرتون مسطح بخطوط طي متوازية يلف حول المنتج أو يفصل الطبقات.", en: "Flat sheet with parallel score lines, wrapped round a product or used as a layer pad." },
    interpretation: "One sheet L × W with n equally spaced scores across L (delivered flat).",
    uses: ["shipping", "ecommerce", "food"],
    slot: "floor",
    options: { clearanceMm: CLEARANCE, scores: { min: 1, max: 20, default: 3, int: true } },
    check: (p) => notAbove("scores", p.scores!, Math.floor(fitL(p) / 15) - 1),
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: t }),
    build: (p) => {
      const n = p.scores! + 1;
      const b = new DielineBuilder();
      chain(b, fitW(p), Array.from({ length: n }, (_, i) => ({ len: fitL(p) / n, fold: 0, label: `Panel ${i + 1}` })), 0, { rootRole: "top" });
      return { builder: b, closedRotation: FLAT_PRINT_UP, anchor: onFloor(p) };
    },
  }),
  fitting({
    fefco: "0967",
    slug: "cross-scored-sheet",
    subFamily: "SCORED_SHEET",
    name: { ar: "لوح مسطح بخطوط طي متقاطعة", en: "Cross-scored sheet" },
    description: { ar: "لوح كرتون مسطح بخطوط طي في الاتجاهين، يطوى حسب المنتج.", en: "Flat sheet scored in both directions, folded to suit the product." },
    interpretation: "One sheet L × W with n scores across L and n across W (creases only, delivered flat).",
    uses: ["shipping", "ecommerce"],
    slot: "floor",
    options: { clearanceMm: CLEARANCE, scores: { min: 1, max: 20, default: 2, int: true } },
    check: (p) => notAbove("scores", p.scores!, Math.floor(Math.min(fitL(p), fitW(p)) / 15) - 1),
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: t }),
    build: (p) => {
      const L = fitL(p);
      const W = fitW(p);
      const n = p.scores!;
      const b = new DielineBuilder();
      b.root("sheet", "top", rectPolygon(0, 0, L, W), "Scored sheet");
      b.pieceLabels.set("sheet", "Fitting");
      for (let i = 1; i <= n; i++) {
        const x = (i * L) / (n + 1);
        const y = (i * W) / (n + 1);
        b.extraCreases.push({ a: { x, y: 0 }, b: { x, y: W } }, { a: { x: 0, y }, b: { x: L, y } });
      }
      return { builder: b, closedRotation: FLAT_PRINT_UP, anchor: onFloor(p) };
    },
  }),
];
