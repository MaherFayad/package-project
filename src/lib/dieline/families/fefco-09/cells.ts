import { DielineBuilder } from "../../builder";
import type { DimsIssue } from "../../limits";
import { CLEARANCE, CORRUGATED_OR_SBS, FULL_HEIGHT, PARTITION_PRESETS, RSC_PRESETS, clr, fitL, fitW, fitting, hgt, notAbove } from "./common";
import { FLAT_PRINT_DOWN, FLAT_PRINT_DOWN_ALONG_W, IDENTITY, chain, flapOn, quatDeg, triangleBrace, type ChainPanel, type Quat } from "./engine";
import { cellLayout, slottedGrid } from "./partitions";
import type { FittingDefinition, FittingDraft, OptionSpec, ResolvedFittingParams } from "./types";

/* ───────────────────────── partitions (0929–0935) ───────────────────────── */

/** Smallest clear cell opening a die maker will cut (mm). */
export const MIN_CELL_MM = 25;

const ROWS = (d: number, min = 1): OptionSpec => ({ min, max: 12, default: d, int: true });
const COLS = ROWS;

function cellCheck(p: ResolvedFittingParams): DimsIssue[] {
  const rows = p.rows ?? 1;
  const cols = p.cols ?? 1;
  const issues: DimsIssue[] = [];
  if (rows * cols < 2) issues.push({ path: "rows", code: "RULE", rule: "rows × cols ≥ 2" });
  // Thickness-free bound (worst case is checked again by the layout in tests).
  issues.push(...notAbove("cols", cols, Math.floor(p.host.L / MIN_CELL_MM)));
  issues.push(...notAbove("rows", rows, Math.floor(p.host.W / MIN_CELL_MM)));
  return issues;
}

const grid = (p: ResolvedFittingParams, t: number, high?: { indexes: number[]; heightMm: number }): FittingDraft =>
  slottedGrid({ L: p.host.L, W: p.host.W, rows: p.rows ?? 1, cols: p.cols ?? 1, t, heightMm: hgt(p), clearanceMm: clr(p), high });

const gridOuter = (p: ResolvedFittingParams, t: number) => {
  const rows = p.rows ?? 1;
  const cols = p.cols ?? 1;
  const lay = cellLayout(p.host.L, p.host.W, rows, cols, t);
  const h = Math.max(hgt(p), p.highMm ?? 0);
  // Only one direction of strips → that dimension is a single board thick.
  const L = rows > 1 ? fitL(p) : t;
  const W = cols > 1 ? fitW(p) : t;
  if (rows === 1) return { L: lay.xs[lay.xs.length - 1] - lay.xs[0] + t, W, H: h };
  if (cols === 1) return { L, W: lay.zs[lay.zs.length - 1] - lay.zs[0] + t, H: h };
  return { L, W, H: h };
};

const partition = {
  subFamily: "PARTITION" as const,
  slot: "cells" as const,
  uses: ["shipping", "food", "cosmetics", "retail"] as FittingDefinition["uses"],
  materials: CORRUGATED_OR_SBS,
  presets: PARTITION_PRESETS,
  hostLimits: { L: { min: 60, max: 800 }, W: { min: 50, max: 600 }, H: { min: 40, max: 600 } },
  defaultHost: { L: 360, W: 270, H: 130 },
};

/** Glued four-panel cell tube of height h (inner liner of one cell). */
function cellTube(p: ResolvedFittingParams, extra?: (b: DielineBuilder, rects: { x: number; y: number; width: number; height: number }[], ids: string[]) => void): FittingDraft {
  const b = new DielineBuilder();
  const L = fitL(p);
  const W = fitW(p);
  const g = Math.min(30, Math.max(15, W * 0.15));
  const { ids, rects } = chain(
    b,
    hgt(p),
    [{ len: L, label: "Front", role: "front" }, { len: W, fold: 90, label: "Right", role: "right" }, { len: L, fold: 90, label: "Back", role: "back" }, { len: W, fold: 90, label: "Left", role: "left" }, { len: g, fold: 90, glue: true, stack: -1 }],
    0,
  );
  extra?.(b, rects, ids);
  return { builder: b, closedRotation: IDENTITY, anchor: { x: clr(p) / 2, y: 0, z: clr(p) / 2 } };
}

export const PARTITIONS: FittingDefinition[] = [
  fitting({
    ...partition,
    fefco: "0929",
    slug: "c-partition",
    name: { ar: "فاصل بطرفين مثنيين", en: "C partition" },
    description: { ar: "فاصل من قطعة واحدة يقسم الكرتونة طوليا إلى نصفين وتستند طرفاه على الجدار الخلفي.", en: "One-piece divider splitting the box lengthwise; its two returns brace against the back wall." },
    interpretation: "Panels a | L | a of height h: the centre panel sits at W/2, both returns fold 90° back to the back wall.",
    options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT },
    presets: RSC_PRESETS,
    outer: (p, t) => ({ L: fitL(p), W: p.host.W / 2 + t / 2 - clr(p) / 2, H: hgt(p) }),
    build: (p, t) => {
      const a = p.host.W / 2 + t / 2 - clr(p) / 2;
      const b = new DielineBuilder();
      chain(b, hgt(p), [{ len: a, fold: 90, label: "Return" }, { len: fitL(p), label: "Divider", role: "front" }, { len: a, fold: 90, label: "Return" }], 1);
      return { builder: b, closedRotation: IDENTITY, anchor: { x: clr(p) / 2, y: 0, z: clr(p) / 2 } };
    },
  }),
  fitting({
    ...partition,
    fefco: "0930",
    slug: "four-cell-partition",
    pieces: "multi",
    name: { ar: "فاصل أربع خانات", en: "Four-cell partition" },
    description: { ar: "فاصلان متعاشقان بشقوق يقسمان الكرتونة إلى أربع خانات متساوية.", en: "Two interlocking slotted strips that divide the box into four equal cells." },
    interpretation: "Slotted grid fixed at 2 × 2 (one strip each way, half-height slots).",
    options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT },
    presets: [
      { id: "jar-x4", name: { ar: "4 برطمانات", en: "4 jars" }, dims: { L: 180, W: 180, H: 120 } },
      { id: "bottle-1l-x4", name: { ar: "4 زجاجات 1 لتر", en: "4 × 1 L bottles" }, dims: { L: 180, W: 180, H: 300 } },
    ],
    defaultHost: { L: 180, W: 180, H: 120 },
    outer: (p, t) => gridOuter({ ...p, rows: 2, cols: 2 }, t),
    build: (p, t) => grid({ ...p, rows: 2, cols: 2 }, t),
  }),
  fitting({
    ...partition,
    fefco: "0931",
    slug: "single-cell-extension",
    glued: true,
    name: { ar: "فاصل خانة واحدة ممتد", en: "Single-cell extension partition" },
    description: { ar: "أنبوب كرتون ملصوق من أربعة جدران يبطن الكرتونة كخانة واحدة ويزيد صلابة جدرانها.", en: "Glued four-wall tube lining the box as one cell; doubles and extends the walls." },
    interpretation: "Panels L | W | L | W + glue tab of height h, glued into a tube.",
    options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT },
    presets: RSC_PRESETS,
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: hgt(p) }),
    build: (p) => cellTube(p),
  }),
  fitting({
    ...partition,
    fefco: "0932",
    slug: "single-cell-support",
    glued: true,
    name: { ar: "فاصل خانة واحدة بحواف ارتكاز", en: "Single-cell support partition" },
    description: { ar: "أنبوب كرتون ملصوق بحواف علوية مطوية للداخل ترتكز عليها صينية أو منتج.", en: "Glued cell tube whose top edges fold inward as ledges that carry a tray or product." },
    interpretation: "0931 tube plus a ledge flap (depth s) on each wall's top edge, folded 90° inward.",
    options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT, sizeMm: { min: 8, max: 80, default: 20 } },
    presets: RSC_PRESETS,
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(fitL(p), fitW(p)) / 2 - 2),
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: hgt(p) }),
    build: (p, t) =>
      cellTube(p, (b, rects, ids) => {
        for (let i = 0; i < 4; i++) flapOn(b, `ledge${i}`, ids[i], rects[i], "top", p.sizeMm!, { fold: 90, inset: p.sizeMm! + t, label: "Support ledge", stage: 1 });
      }),
  }),
  fitting({
    ...partition,
    fefco: "0933",
    slug: "slotted-partition",
    pieces: "multi",
    name: { ar: "فاصل متعاشق متعدد الخانات", en: "Slotted cell partition (N × M)" },
    description: { ar: "شرائح كرتون متعاشقة بشقوق تقسم الكرتونة إلى خانات متساوية، 12 خانة افتراضيا.", en: "Interlocking slotted strips dividing the box into equal cells; 12 cells by default." },
    interpretation: "Slotted grid rows × cols (default 3 × 4): rows − 1 strips along L slotted from the bottom, cols − 1 along W slotted from the top.",
    options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT, rows: ROWS(3), cols: COLS(4) },
    check: cellCheck,
    outer: gridOuter,
    build: (p, t) => grid(p, t),
  }),
  fitting({
    ...partition,
    fefco: "0934",
    slug: "fifteen-cell-extension",
    pieces: "multi",
    name: { ar: "فاصل متعاشق 15 خانة", en: "Fifteen-cell extension partition" },
    description: { ar: "شرائح متعاشقة بارتفاع الكرتونة الكامل تقسمها إلى 15 خانة لحماية الزجاج.", en: "Full-height interlocking strips forming 15 cells; protects glassware." },
    interpretation: "Slotted grid, default 3 × 5, strips the full inner height.",
    options: { clearanceMm: CLEARANCE, heightMm: FULL_HEIGHT, rows: ROWS(3), cols: COLS(5) },
    defaultHost: { L: 450, W: 270, H: 140 },
    check: cellCheck,
    outer: gridOuter,
    build: (p, t) => grid(p, t),
  }),
  fitting({
    ...partition,
    fefco: "0935",
    slug: "twelve-cell-high-divider",
    pieces: "multi",
    name: { ar: "فاصل 12 خانة بحاجز مرتفع", en: "Twelve-cell partition with high divider" },
    description: { ar: "فاصل متعاشق 12 خانة يرتفع حاجزه الأوسط فوق باقي الشرائح للإمساك والتقسيم.", en: "12-cell slotted partition whose centre divider stands higher than the rest." },
    interpretation: "Slotted grid (default 4 × 3); the middle row divider is highMm tall, the others heightMm.",
    options: {
      clearanceMm: CLEARANCE,
      rows: ROWS(4, 2),
      cols: COLS(3),
      heightMm: { min: 20, max: 800, default: (h) => Math.round(h.H * 0.6) },
      highMm: FULL_HEIGHT,
    },
    check: (p) => [...cellCheck(p), ...(p.highMm! < p.heightMm! ? [{ path: "highMm", code: "TOO_SMALL" as const, limit: p.heightMm! }] : [])],
    outer: gridOuter,
    build: (p, t) => grid(p, t, { indexes: [Math.floor((p.rows! - 2) / 2)], heightMm: p.highMm! }),
  }),
];

/* ───────────────────────── corner / edge protectors (0970–0976a) ───────────────────────── */

/** Turn a standing chain whose convex corner faces +X/+Z into the host's back-left corner. */
const INTO_CORNER: Quat = quatDeg(0, 180, 0);
const atCorner = { x: 0, y: 0, z: 0 };

const corner = {
  subFamily: "CORNER" as const,
  uses: ["shipping", "ecommerce", "retail"] as FittingDefinition["uses"],
  materials: CORRUGATED_OR_SBS,
  defaultMaterial: "B_FLUTE_KRAFT" as const,
};
const LEG: OptionSpec = { min: 15, max: 150, default: 40 };
const legCheck = (p: ResolvedFittingParams) => [...notAbove("sizeMm", p.sizeMm!, Math.min(p.host.L, p.host.W) / 2)];

function standing(width: number, panels: ChainPanel[], rotation: Quat, anchor: { x: number; y: number; z: number }): FittingDraft {
  const b = new DielineBuilder();
  chain(b, width, panels, 0, { rootRole: "front" });
  return { builder: b, closedRotation: rotation, anchor };
}

const triangle = (a: number, g: number, t: number): ChainPanel[] => [{ len: a, label: "Leg" }, ...triangleBrace(a, g, t)];

export const CORNERS: FittingDefinition[] = [
  fitting({
    ...corner,
    fefco: "0970",
    slug: "angle-edge-protector",
    slot: "corner",
    name: { ar: "واقي حافة زاوي", en: "Angle edge protector" },
    description: { ar: "شريحة كرتون مطوية بزاوية قائمة تحمي الحواف الرأسية للمنتج أو الكرتونة.", en: "Board strip folded to a right angle that guards a vertical edge." },
    interpretation: "Panels a | a folded 90°, length h; sits in the back-left vertical corner.",
    options: { sizeMm: LEG, heightMm: { min: 20, max: 800, default: (h) => h.H } },
    check: legCheck,
    outer: (p) => ({ L: p.sizeMm!, W: p.sizeMm!, H: p.heightMm! }),
    build: (p) => standing(p.heightMm!, [{ len: p.sizeMm!, label: "Leg" }, { len: p.sizeMm!, fold: 90, label: "Leg" }], INTO_CORNER, atCorner),
  }),
  fitting({
    ...corner,
    fefco: "0971",
    slug: "corner-cap",
    slot: "corner",
    name: { ar: "واقي ركن ثلاثي الأوجه", en: "Three-face corner protector" },
    description: { ar: "قطعة كرتون مطوية تغطي ركن المنتج من ثلاثة أوجه.", en: "Folded piece that caps a product corner on three faces." },
    interpretation: "Square base a × a with two adjacent wall flaps (height h) folded 90°; open diagonal.",
    options: { sizeMm: LEG, heightMm: { min: 15, max: 300, default: 40 } },
    check: legCheck,
    outer: (p) => ({ L: p.sizeMm!, W: p.sizeMm!, H: p.heightMm! }),
    build: (p) => cornerCap(p, false),
  }),
  fitting({
    ...corner,
    fefco: "0971a",
    slug: "corner-cap-locked",
    slot: "corner",
    name: { ar: "واقي ركن ثلاثي الأوجه بلسان", en: "Three-face corner protector with tab" },
    description: { ar: "واقي ركن ثلاثي الأوجه بلسان يربط الجدارين لثبات أكبر.", en: "Three-face corner protector with a tab that ties both walls together." },
    interpretation: "0971 plus a tab on the back flap folded onto the left flap.",
    options: { sizeMm: LEG, heightMm: { min: 15, max: 300, default: 40 } },
    check: legCheck,
    outer: (p) => ({ L: p.sizeMm!, W: p.sizeMm!, H: p.heightMm! }),
    build: (p) => cornerCap(p, true),
  }),
  fitting({
    ...corner,
    fefco: "0972",
    slug: "u-edge-protector",
    slot: "edge",
    name: { ar: "واقي حافة على شكل قناة", en: "U edge protector" },
    description: { ar: "قناة كرتون بثلاثة أوجه تحتضن حافة المنتج على طولها.", en: "Three-sided board channel that hugs a product edge along its length." },
    interpretation: "Panels a | b | a across the strip (strip length L), lying along the bottom back edge.",
    hostLimits: { L: { min: 60, max: 1200 }, W: { min: 40, max: 600 }, H: { min: 20, max: 800 } },
    options: { clearanceMm: CLEARANCE, sizeMm: { min: 8, max: 150, default: 25 }, heightMm: { min: 15, max: 150, default: 40 } },
    check: (p) => [...notAbove("sizeMm", p.sizeMm!, p.host.W), ...notAbove("heightMm", p.heightMm!, p.host.H)],
    outer: (p) => ({ L: fitL(p), W: p.sizeMm!, H: p.heightMm! }),
    build: (p) =>
      edgeStrip(p, [{ len: p.heightMm!, fold: 90, label: "Leg" }, { len: p.sizeMm!, label: "Web" }, { len: p.heightMm!, fold: 90, label: "Leg" }], 1),
  }),
  fitting({
    ...corner,
    fefco: "0972a",
    slug: "u-edge-protector-lipped",
    slot: "edge",
    name: { ar: "واقي حافة قناة بشفتين", en: "Lipped U edge protector" },
    description: { ar: "قناة كرتون بشفتين مطويتين للداخل تمسكان المنتج.", en: "U channel with two inward lips that grip the product." },
    interpretation: "Panels l | a | b | a | l: lips fold 90° inward over the channel.",
    hostLimits: { L: { min: 60, max: 1200 }, W: { min: 40, max: 600 }, H: { min: 20, max: 800 } },
    options: { clearanceMm: CLEARANCE, sizeMm: { min: 20, max: 150, default: 40 }, heightMm: { min: 15, max: 150, default: 40 } },
    check: (p) => [...notAbove("sizeMm", p.sizeMm!, p.host.W), ...notAbove("heightMm", p.heightMm!, p.host.H)],
    outer: (p) => ({ L: fitL(p), W: p.sizeMm!, H: p.heightMm! }),
    build: (p) => {
      const lip = Math.min(15, p.sizeMm! / 2 - 2);
      return edgeStrip(p, [{ len: lip, fold: 90, label: "Lip" }, { len: p.heightMm!, fold: 90, label: "Leg" }, { len: p.sizeMm!, label: "Web" }, { len: p.heightMm!, fold: 90, label: "Leg" }, { len: lip, fold: 90, label: "Lip" }], 2);
    },
  }),
  fitting({
    ...corner,
    fefco: "0973",
    slug: "edge-brace",
    slot: "edge",
    glued: true,
    name: { ar: "دعامة حافة مثلثة", en: "Triangular edge brace" },
    description: { ar: "دعامة كرتون مثلثة المقطع تقوي الحافة السفلية للكرتونة وتمنع حركة المنتج.", en: "Triangular-section board brace that stiffens the bottom edge and stops the product moving." },
    interpretation: "Panels s | s | s√2 | glue (folds 90°, 135°, 135°) along the bottom back edge, length L.",
    options: { clearanceMm: CLEARANCE, sizeMm: LEG },
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(p.host.W / 2, p.host.H)),
    outer: (p) => ({ L: fitL(p), W: p.sizeMm!, H: p.sizeMm! }),
    build: (p, t) => edgeStrip(p, triangle(p.sizeMm!, Math.min(25, p.sizeMm! * 0.6), t), 0),
  }),
  fitting({
    ...corner,
    fefco: "0974",
    slug: "pad-with-brace",
    slot: "floor",
    glued: true,
    name: { ar: "لوح قاع بدعامة طرفية", en: "Corner brace pad, one end" },
    description: { ar: "لوح قاع تنطوي نهايته إلى دعامة مثلثة تسند جدار الكرتونة.", en: "Floor pad whose end folds into a triangular brace against the wall." },
    interpretation: "Pad W' (along W) + s | s√2 | glue at the back end; strip length L.",
    options: { clearanceMm: CLEARANCE, sizeMm: LEG },
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(fitW(p) / 3, p.host.H)),
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.sizeMm! }),
    build: (p, t) => {
      const s = p.sizeMm!;
      const g = Math.min(25, s * 0.6);
      return edgeStrip(p, [{ len: fitW(p), label: "Pad" }, ...triangleBrace(s, g, t, { leg: "Brace leg" })], 0, { z: clr(p) / 2 });
    },
  }),
  fitting({
    ...corner,
    fefco: "0975",
    slug: "pad-with-two-braces",
    slot: "floor",
    glued: true,
    name: { ar: "لوح قاع بدعامتين طرفيتين", en: "Corner brace pad, both ends" },
    description: { ar: "لوح قاع ينطوي طرفاه إلى دعامتين مثلثتين تسندان الجدارين الطويلين.", en: "Floor pad whose ends fold into two triangular braces against the long walls." },
    interpretation: "glue | s√2 | s | W' | s | s√2 | glue; strip length L.",
    options: { clearanceMm: CLEARANCE, sizeMm: LEG },
    check: (p) => notAbove("sizeMm", p.sizeMm!, Math.min(fitW(p) / 3, p.host.H)),
    outer: (p) => ({ L: fitL(p), W: fitW(p), H: p.sizeMm! }),
    build: (p, t) => {
      const s = p.sizeMm!;
      const g = Math.min(25, s * 0.6);
      const brace = triangleBrace(s, g, t, { leg: "Brace leg" });
      return edgeStrip(p, [...[...brace].reverse(), { len: fitW(p), label: "Pad" }, ...brace], 3, { z: clr(p) / 2 });
    },
  }),
  fitting({
    ...corner,
    fefco: "0976",
    slug: "triangular-corner-post",
    slot: "corner",
    glued: true,
    name: { ar: "عمود ركن مثلث", en: "Triangular corner post" },
    description: { ar: "عمود كرتون مثلث المقطع يوضع في ركن الكرتونة لتقوية التحميل الرأسي وحماية الأركان.", en: "Triangular-section board post for the box corner: adds stacking strength and corner protection." },
    interpretation: "Panels a | a | a√2 | glue (90°, 135°, 135°) of height h, convex corner into the host corner.",
    options: { sizeMm: LEG, heightMm: { min: 20, max: 800, default: (h) => h.H } },
    check: legCheck,
    outer: (p) => ({ L: p.sizeMm!, W: p.sizeMm!, H: p.heightMm! }),
    build: (p, t) => standing(p.heightMm!, triangle(p.sizeMm!, Math.min(25, p.sizeMm! * 0.6), t), INTO_CORNER, atCorner),
  }),
  fitting({
    ...corner,
    fefco: "0976a",
    slug: "square-corner-post",
    slot: "corner",
    glued: true,
    name: { ar: "عمود ركن مربع", en: "Square corner post" },
    description: { ar: "عمود كرتون مربع المقطع ملصوق يوضع في ركن الكرتونة لتحمل التستيف.", en: "Glued square-section board post for the box corner, for stacking loads." },
    interpretation: "Panels a | a | a | a | glue folded 90°, height h.",
    options: { sizeMm: LEG, heightMm: { min: 20, max: 800, default: (h) => h.H } },
    check: legCheck,
    outer: (p) => ({ L: p.sizeMm!, W: p.sizeMm!, H: p.heightMm! }),
    build: (p) => {
      const a = p.sizeMm!;
      return standing(p.heightMm!, [{ len: a, label: "Face" }, { len: a, fold: 90, label: "Face" }, { len: a, fold: 90, label: "Face" }, { len: a, fold: 90, label: "Face" }, { len: Math.min(25, a * 0.6), fold: 90, glue: true, stack: -1 }], INTO_CORNER, atCorner);
    },
  }),
];

/** Strip lying on the floor along L, chain across W (from the back wall toward the front). */
function edgeStrip(p: ResolvedFittingParams, panels: ChainPanel[], rootIndex: number, at: { z?: number } = {}): FittingDraft {
  const b = new DielineBuilder();
  chain(b, fitL(p), panels, rootIndex, { rootRole: "bottom" });
  return { builder: b, closedRotation: FLAT_PRINT_DOWN_ALONG_W, anchor: { x: clr(p) / 2, y: 0, z: at.z ?? 0 } };
}

function cornerCap(p: ResolvedFittingParams, tab: boolean): FittingDraft {
  const a = p.sizeMm!;
  const h = p.heightMm!;
  const b = new DielineBuilder();
  const base = { x: h, y: 0, width: a, height: a };
  b.root("base", "bottom", [{ x: h, y: 0 }, { x: h + a, y: 0 }, { x: h + a, y: a }, { x: h, y: a }], "Base");
  b.pieceLabels.set("base", "Fitting");
  // FLAT_PRINT_DOWN: sheet bottom edge → back (z = 0), sheet left edge → left (x = 0).
  flapOn(b, "left", "base", base, "left", h, { role: "left", label: "Left wall" });
  const back = flapOn(b, "back", "base", base, "bottom", h, { role: "back", label: "Back wall" });
  if (tab) flapOn(b, "tab", "back", back, "left", Math.min(20, a * 0.5), { glue: true, fold: 90, stack: -1, stage: 1, inset: 2 });
  return { builder: b, closedRotation: FLAT_PRINT_DOWN, anchor: atCorner };
}

