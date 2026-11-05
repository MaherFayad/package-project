import { DielineBuilder } from "../../builder";
import { rectPolygon } from "../../geometry";
import type { Polygon, Rect } from "../../types";
import { CLEARANCE, FULL_HEIGHT, clr, fitH, fitL, fitW, fitting, hgt, notAbove } from "./common";
import { FLAT_PRINT_DOWN, FLAT_PRINT_DOWN_ALONG_W, FLAT_PRINT_UP, IDENTITY, chain, flapOn, quatDeg, type ChainPanel, type Quat } from "./engine";
import { cellLayout, slotWidth } from "./partitions";
import type { FittingDefinition, FittingDraft, ResolvedFittingParams } from "./types";

/* ───────────────────────── pads (0900–0903) ───────────────────────── */

function pad(width: number, height: number, rotation: Quat, anchor: { x: number; y: number; z: number }, role: "bottom" | "front" | "left" = "bottom"): FittingDraft {
  const b = new DielineBuilder();
  b.root("pad", role, rectPolygon(0, 0, width, height), "Pad");
  b.pieceLabels.set("pad", "Pad");
  return { builder: b, closedRotation: rotation, anchor };
}

export const PADS: FittingDefinition[] = [
  fitting({
    fefco: "0900",
    slug: "inner-flap-fill-pad",
    subFamily: "PAD",
    name: { ar: "حشوة فراغ الألسنة الداخلية", en: "Inner flap fill-in pad" },
    description: {
      ar: "لوح مسطح يملأ الفراغ بين الألسنة الداخلية لقاع الكرتونة ليصبح القاع مستويا.",
      en: "Flat pad that fills the gap between the inner flaps of an RSC so the floor is level.",
    },
    interpretation: "RSC (0201) inner flaps are W/2 deep and leave a gap of (L − W) × W between them; the pad fills it, its top flush with the inner floor.",
    uses: ["shipping", "ecommerce"],
    slot: "floor-gap",
    hostLimits: { L: { min: 150, max: 800 }, W: { min: 80, max: 600 }, H: { min: 60, max: 800 }, rules: ["W < L"] },
    options: { clearanceMm: CLEARANCE },
    check: (p) => (p.host.L - p.host.W - clr(p) < 20 ? [{ path: "host.L", code: "RULE", rule: "L − W ≥ 20 + clearance" }] : []),
    outer: (p, t) => ({ L: p.host.L - p.host.W - clr(p), W: fitW(p), H: t }),
    build: (p, t) => pad(p.host.L - p.host.W - clr(p), fitW(p), FLAT_PRINT_UP, { x: p.host.W / 2 + clr(p) / 2, y: -t, z: clr(p) / 2 }),
  }),
  fitting({
    fefco: "0901",
    slug: "bottom-pad",
    subFamily: "PAD",
    name: { ar: "لوح قاع كامل", en: "Full bottom pad" },
    description: { ar: "لوح مسطح يغطي قاع الكرتونة بالكامل لتقويته أو لفصل الطبقات.", en: "Flat pad covering the whole floor: reinforces it or separates layers." },
    interpretation: "One flat sheet L × W lying on the inner floor.",
    uses: ["shipping", "ecommerce", "food"],
    materials: ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT", "SBS_350"],
    slot: "floor",
    options: { clearanceMm: CLEARANCE },
    outer: (p, t) => ({ L: fitL(p), W: fitW(p), H: t }),
    build: (p) => pad(fitL(p), fitW(p), FLAT_PRINT_UP, { x: clr(p) / 2, y: 0, z: clr(p) / 2 }),
  }),
  fitting({
    fefco: "0902",
    slug: "end-wall-pad",
    subFamily: "PAD",
    name: { ar: "لوح تغطية الجانب القصير", en: "Full W-side (end wall) pad" },
    description: { ar: "لوح مسطح يغطي الجدار الجانبي القصير للكرتونة لتقويته.", en: "Flat pad covering a short (W) side wall to stiffen it." },
    interpretation: "One flat sheet W × H standing against the left end wall (x = 0).",
    uses: ["shipping"],
    slot: "end-wall",
    options: { clearanceMm: CLEARANCE },
    outer: (p, t) => ({ L: t, W: fitW(p), H: fitH(p) }),
    build: (p) => pad(fitW(p), fitH(p), quatDeg(0, 90, 0), { x: 0, y: 0, z: clr(p) / 2 }, "left"),
  }),
  fitting({
    fefco: "0903",
    slug: "side-wall-pad",
    subFamily: "PAD",
    name: { ar: "لوح تغطية الجانب الطويل", en: "Full L-side wall pad" },
    description: { ar: "لوح مسطح يغطي الجدار الطويل للكرتونة لتقويته.", en: "Flat pad covering a long (L) side wall to stiffen it." },
    interpretation: "One flat sheet L × H standing against the back L-side wall (z = 0).",
    uses: ["shipping"],
    slot: "side-wall",
    options: { clearanceMm: CLEARANCE },
    outer: (p, t) => ({ L: fitL(p), W: t, H: fitH(p) }),
    build: (p) => pad(fitL(p), fitH(p), IDENTITY, { x: clr(p) / 2, y: 0, z: 0 }, "front"),
  }),
];

/* ───────────────────────── open liners (0904–0910, 0913, 0914, 0911) ───────────────────────── */

const W90 = (len: number, label: string, extra: Partial<ChainPanel> = {}): ChainPanel => ({ len, fold: 90, label, ...extra });

/** Scored strip liner (outside = printed face against the host walls). */
function strip(width: number, panels: ChainPanel[], rootIndex: number, rotation: Quat, p: ResolvedFittingParams): FittingDraft {
  const b = new DielineBuilder();
  chain(b, width, panels, rootIndex);
  return { builder: b, closedRotation: rotation, anchor: { x: clr(p) / 2, y: 0, z: clr(p) / 2 } };
}

const linerBase = {
  subFamily: "LINER" as const,
  uses: ["shipping", "ecommerce"] as FittingDefinition["uses"],
  slot: "walls" as const,
  options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT },
};
const fullBox = (p: ResolvedFittingParams) => ({ L: fitL(p), W: fitW(p), H: hgt(p) });

/** Bottom + 4 walls, corners free (unglued cross). Optional slots for divider tabs. */
function crossTray(p: ResolvedFittingParams, t: number, slots: number): FittingDraft {
  const b = new DielineBuilder();
  const L = fitL(p);
  const W = fitW(p);
  const h = hgt(p);
  const root: Rect = { x: h, y: h, width: L, height: W };
  b.root("bottom", "bottom", rectPolygon(root.x, root.y, L, W), "Bottom");
  b.pieceLabels.set("bottom", "Fitting");
  const sw = slotWidth(t);
  const slotHoles = (r: Rect): Polygon[] => {
    if (slots < 2) return [];
    // Divider slots at the cell pitch, from 5 mm below the top edge down to mid-height.
    const xs = cellLayout(L, W, 1, slots, t).xs;
    const top = r.y < root.y ? r.y : r.y + r.height;
    const s = r.y < root.y ? 1 : -1;
    const y0 = top + s * 5;
    const y1 = top + s * (h / 2);
    return xs.map((x) => rectPolygon(root.x + x - sw / 2, Math.min(y0, y1), sw, Math.abs(y1 - y0)));
  };
  flapOn(b, "back", "bottom", root, "bottom", h, { role: "back", label: "Back wall", holes: slotHoles });
  flapOn(b, "front", "bottom", root, "top", h, { role: "front", label: "Front wall", holes: slotHoles });
  flapOn(b, "left", "bottom", root, "left", h, { role: "left", label: "Left wall", inset: t });
  flapOn(b, "right", "bottom", root, "right", h, { role: "right", label: "Right wall", inset: t });
  return { builder: b, closedRotation: FLAT_PRINT_DOWN, anchor: { x: clr(p) / 2, y: 0, z: clr(p) / 2 } };
}

export const LINERS: FittingDefinition[] = [
  fitting({
    ...linerBase,
    fefco: "0904",
    slug: "u-liner-end-walls",
    name: { ar: "بطانة مفتوحة للقاع والجانبين القصيرين", en: "Open U-liner, bottom and end walls" },
    description: { ar: "شريحة كرتون بخطين للطي تبطن القاع والجدارين القصيرين.", en: "Two-score liner lining the floor and both short (W) end walls." },
    interpretation: "Notation LWH: panels H | L | H across the strip, strip width W.",
    outer: fullBox,
    build: (p) => strip(fitW(p), [W90(hgt(p), "Left wall"), { len: fitL(p), label: "Bottom" }, W90(hgt(p), "Right wall")], 1, FLAT_PRINT_DOWN, p),
  }),
  fitting({
    ...linerBase,
    fefco: "0905",
    slug: "u-liner-side-walls",
    name: { ar: "بطانة مفتوحة للقاع والجانبين الطويلين", en: "Open U-liner, bottom and long walls" },
    description: { ar: "شريحة كرتون بخطين للطي تبطن القاع والجدارين الطويلين.", en: "Two-score liner lining the floor and both long (L) side walls." },
    interpretation: "Notation HLW: panels H | W | H across the strip, strip width L.",
    outer: fullBox,
    build: (p) => strip(fitL(p), [W90(hgt(p), "Front wall"), { len: fitW(p), label: "Bottom" }, W90(hgt(p), "Back wall")], 1, FLAT_PRINT_DOWN_ALONG_W, p),
  }),
  fitting({
    ...linerBase,
    fefco: "0906",
    slug: "four-wall-liner",
    name: { ar: "بطانة مفتوحة للجدران الأربعة", en: "Open four-wall liner" },
    description: { ar: "شريحة كرتون بثلاثة خطوط طي تبطن الجدران الأربعة دون قاع أو غطاء.", en: "Three-score liner lining all four walls, open top and bottom." },
    interpretation: "Notation HWL: panels L | W | L | W of height H, last joint butted (unglued).",
    outer: fullBox,
    build: (p) =>
      strip(hgt(p), [{ len: fitL(p), label: "Front wall", role: "front" }, W90(fitW(p), "Right wall"), W90(fitL(p), "Back wall"), W90(fitW(p), "Left wall")], 0, IDENTITY, p),
  }),
  fitting({
    ...linerBase,
    fefco: "0907",
    slug: "l-liner-side-wall",
    name: { ar: "بطانة زاوية للقاع وجدار طويل", en: "Open L-liner, bottom and one long wall" },
    description: { ar: "شريحة كرتون بخط طي واحد تبطن القاع وجدارا طويلا واحدا.", en: "One-score liner lining the floor and one long (L) wall." },
    interpretation: "Notation HLW: panels W | H across the strip (bottom, back wall), strip width L.",
    outer: fullBox,
    build: (p) => strip(fitL(p), [{ len: fitW(p), label: "Bottom" }, W90(hgt(p), "Back wall")], 0, FLAT_PRINT_DOWN_ALONG_W, p),
  }),
  fitting({
    ...linerBase,
    fefco: "0908",
    slug: "l-liner-end-wall",
    name: { ar: "بطانة زاوية للقاع وجدار قصير", en: "Open L-liner, bottom and one end wall" },
    description: { ar: "شريحة كرتون بخط طي واحد تبطن القاع وجدارا قصيرا واحدا.", en: "One-score liner lining the floor and one short (W) end wall." },
    interpretation: "Notation LWH: panels H | L across the strip (left wall, bottom), strip width W.",
    outer: fullBox,
    build: (p) => strip(fitW(p), [W90(hgt(p), "Left wall"), { len: fitL(p), label: "Bottom" }], 1, FLAT_PRINT_DOWN, p),
  }),
  fitting({
    ...linerBase,
    fefco: "0909",
    slug: "wrap-liner-long",
    name: { ar: "بطانة ملتفة حول الطول", en: "Wrap liner around the length" },
    description: { ar: "شريحة كرتون تلتف حول القاع والجدارين الطويلين والغطاء، مفتوحة الطرفين.", en: "Liner wrapping floor, long walls and top; open at both ends." },
    interpretation: "Notation LHW: panels W | H | W | H wrapped about the L axis, strip width L.",
    options: { clearanceMm: CLEARANCE },
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: fitH(p) }),
    build: (p) =>
      strip(fitL(p), [{ len: fitW(p), label: "Bottom" }, W90(fitH(p), "Back wall"), W90(fitW(p), "Top"), W90(fitH(p), "Front wall")], 0, FLAT_PRINT_DOWN_ALONG_W, p),
  }),
  fitting({
    ...linerBase,
    fefco: "0910",
    slug: "wrap-liner-wide",
    name: { ar: "بطانة ملتفة حول العرض", en: "Wrap liner around the width" },
    description: { ar: "شريحة كرتون تلتف حول القاع والجدارين القصيرين والغطاء، مفتوحة من الأمام والخلف.", en: "Liner wrapping floor, end walls and top; open front and back." },
    interpretation: "Notation HWL: panels L | H | L | H wrapped about the W axis, strip width W.",
    options: { clearanceMm: CLEARANCE },
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: fitH(p) }),
    build: (p) => strip(fitW(p), [{ len: fitL(p), label: "Bottom" }, W90(fitH(p), "Right wall"), W90(fitL(p), "Top"), W90(fitH(p), "Left wall")], 0, FLAT_PRINT_DOWN, p),
  }),
  fitting({
    ...linerBase,
    fefco: "0911",
    slug: "side-slotted-tray",
    name: { ar: "صينية بطانة بجوانب مشقوقة", en: "Side-slotted liner tray" },
    description: { ar: "صينية بطانة بقاع وأربعة جدران، بشقوق في الجدارين الطويلين لتثبيت الفواصل.", en: "Liner tray (floor + 4 walls) with slots in the long walls that hold dividers." },
    interpretation: "Cross blank: bottom with four hinged walls (corners free); long walls slotted at the cell pitch.",
    options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT, cols: { min: 1, max: 12, default: 3, int: true } },
    check: (p) => notAbove("cols", p.cols!, Math.floor(fitL(p) / 30)),
    outer: fullBox,
    build: (p, t) => crossTray(p, t, p.cols!),
  }),
  fitting({
    ...linerBase,
    fefco: "0913",
    slug: "five-panel-liner",
    name: { ar: "بطانة مفتوحة للقاع والجدران الأربعة", en: "Open five-panel liner" },
    description: { ar: "بطانة من قطعة واحدة بقاع وأربعة جدران مطوية دون لصق.", en: "One-piece liner: floor plus four folded walls, unglued." },
    interpretation: "Cross blank: bottom with four hinged walls; corners left open.",
    outer: fullBox,
    build: (p, t) => crossTray(p, t, 0),
  }),
  fitting({
    ...linerBase,
    fefco: "0914",
    slug: "full-overlap-liner",
    name: { ar: "بطانة بغطاء متداخل كامل", en: "Full-overlap closure liner" },
    description: { ar: "بطانة تغطي القاع والجدارين الطويلين ويغلق لساناها العلويان فوق المنتج بتداخل كامل.", en: "Liner for floor and long walls whose two top flaps fully overlap over the contents." },
    interpretation: "Panels W | H | W | H | W across the strip, width L: both top flaps span the full W and overlap.",
    options: { clearanceMm: CLEARANCE },
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: fitH(p) }),
    build: (p) =>
      strip(
        fitL(p),
        [W90(fitW(p), "Top flap (inner)", { stack: -1, stage: 1 }), W90(fitH(p), "Front wall"), { len: fitW(p), label: "Bottom" }, W90(fitH(p), "Back wall"), W90(fitW(p), "Top flap (outer)", { stage: 2 })],
        2,
        FLAT_PRINT_DOWN_ALONG_W,
        p,
      ),
  }),
];

/* ───────────────────────── compartment liners (0920, 0921) ───────────────────────── */

/** Liner with end walls and (n − 1) double-wall risers folded up from the floor. */
function compartmentChain(len: number, n: number, h: number): ChainPanel[] {
  const a = len / n;
  const out: ChainPanel[] = [W90(h, "End wall")];
  for (let i = 0; i < n; i++) {
    out.push({ len: a, fold: 90, label: `Floor ${i + 1}` });
    if (i < n - 1) out.push(W90(h, `Divider ${i + 1} (rise)`), { len: h, fold: -180, pivotDepth: 0, label: `Divider ${i + 1} (return)` });
  }
  out.push(W90(h, "End wall"));
  return out;
}

const compartment = {
  subFamily: "COMPARTMENT" as const,
  uses: ["shipping", "food", "retail"] as FittingDefinition["uses"],
  slot: "cells" as const,
  options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT, compartments: { min: 2, max: 6, default: 2, int: true } },
  outer: fullBox,
};

export const COMPARTMENT_LINERS: FittingDefinition[] = [
  fitting({
    ...compartment,
    fefco: "0920",
    slug: "compartment-liner-across",
    name: { ar: "بطانة بحجرات عرضية", en: "Open compartment liner, cross dividers" },
    description: { ar: "بطانة من قطعة واحدة تبطن القاع والجدارين القصيرين وتنطوي في الوسط إلى فواصل مزدوجة.", en: "One-piece liner for floor and end walls, folded up into double-wall cross dividers." },
    interpretation: "Strip of width W: end wall | floor | rise | return | floor … | end wall; each riser is a double wall.",
    check: (p) => notAbove("compartments", p.compartments!, Math.floor(fitL(p) / 40)),
    build: (p) => strip(fitW(p), compartmentChain(fitL(p), p.compartments!, hgt(p)), 1, FLAT_PRINT_DOWN, p),
  }),
  fitting({
    ...compartment,
    fefco: "0921",
    slug: "compartment-liner-along",
    name: { ar: "بطانة بحجرات طولية", en: "Open compartment liner, long dividers" },
    description: { ar: "بطانة من قطعة واحدة تبطن القاع والجدارين الطويلين وتنطوي إلى فواصل مزدوجة بطول الكرتونة.", en: "One-piece liner for floor and long walls, folded up into double-wall dividers along L." },
    interpretation: "As 0920, turned 90°: strip of width L, dividers parallel to the L walls.",
    check: (p) => notAbove("compartments", p.compartments!, Math.floor(fitW(p) / 40)),
    build: (p) => strip(fitL(p), compartmentChain(fitW(p), p.compartments!, hgt(p)), 1, FLAT_PRINT_DOWN_ALONG_W, p),
  }),
];
