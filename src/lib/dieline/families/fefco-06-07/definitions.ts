import type { Dims, DimsPreset, MaterialCode, StructureParamLimits } from "@/types";
import { CRASH_LAYERS, handleHeight, type CaseTop } from "./parts";
import { blissBox, blissDims, capClearance, halfShells, shellSpacer, tubeWithCaps, type BlissOpts } from "./group06";
import {
  autoBottomCase,
  autoBottomTelescope,
  caseDims,
  cellTube,
  lugHeight,
  readyGluedTray,
  telescopeClearance,
  trayDims,
  type CaseOpts,
  type TrayOpts,
} from "./group07";
import type { FamilyCode, FamilyStructureDef, FefcoSubFamily, FoldStep, Use } from "./types";

const CORRUGATED: MaterialCode[] = ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"];
const HEAVY: MaterialCode[] = ["B_FLUTE_KRAFT", "E_FLUTE_KRAFT"];

const p = (id: string, ar: string, en: string, L: number, W: number, H: number, standard?: boolean): DimsPreset => ({ id, name: { ar, en }, dims: { L, W, H }, ...(standard ? { standard } : {}) });

const lim = (L: [number, number], W: [number, number], H: [number, number], rules?: string[]): StructureParamLimits => ({
  L: { min: L[0], max: L[1] },
  W: { min: W[0], max: W[1] },
  H: { min: H[0], max: H[1] },
  ...(rules ? { rules } : {}),
});

/* ───────────────────────── fold sequences ───────────────────────── */

const step = (stage: number, ar: string, en: string): FoldStep => ({ stage, ar, en });

/** Auto-erect (crash-lock) bottom: what happens when the flat case is squared up. */
export const AUTO_BOTTOM_SEQUENCE: FoldStep[] = [
  step(0, "فتح الأنبوب الملصوق وتربيعه", "Open the flat glued tube and square it"),
  step(1, "انطواء ألسنة القاع الجانبية الملصوقة على الخط المائل", "Glued side flaps swing in on their 45° creases"),
  step(2, "انغلاق ألسنة القاع الطولية وتعشيق اللسان", "Long bottom flaps close and the tongue locks: bottom set"),
];

const topSteps: Record<CaseTop, FoldStep[]> = {
  open: [],
  rsc: [step(3, "طي الألسنة العلوية الصغيرة", "Fold the minor top flaps"), step(4, "طي الألسنة العلوية الكبيرة وغلق الصندوق", "Fold the major top flaps and seal")],
  fol: [step(3, "طي الألسنة الجانبية واللسان الخلفي", "Fold the end flaps and the back full-overlap flap"), step(4, "طي اللسان الأمامي فوقه", "Fold the front full-overlap flap on top")],
  halfHalf: [step(3, "طي الألسنة الطولية", "Fold the long flaps"), step(4, "طي الألسنة الطرفية حتى تتلاقى في المنتصف", "Fold the end flaps to meet at the centre")],
  tuckLid: [step(3, "طي ألسنة الغبار", "Fold the dust flaps"), step(4, "غلق الغطاء وإدخال اللسان", "Close the lid and push the tuck in")],
  handle: [step(3, "رفع لوحي المقبض وتلاقيهما ظهرا لظهر", "Raise the two handle panels back to back")],
};

const BLISS_SEQUENCE = (o: BlissOpts): FoldStep[] => [
  step(0, o.endFlaps === "none" ? "رفع جدران الجسم" : "رفع جدران الجسم وطي ألسنة الطرفين", o.endFlaps === "none" ? "Raise the body walls" : "Raise the body walls and fold the end-panel flaps"),
  step(1, o.endFlaps === "none" ? "تركيب الطرفين داخل الجسم" : "تركيب الطرفين وتدبيس ألسنتهما داخل الجسم", o.endFlaps === "none" ? "Set the two end panels inside the body" : "Set the end panels and stitch their flaps inside the body"),
  ...(o.bodyFlaps ? [step(2, "تدبيس ألسنة الجسم على الطرفين من الخارج", "Stitch the body flaps over the outside of the ends")] : []),
  step(3, o.lid === "rim" ? "طي الحافة العلوية للداخل" : "غلق الغطاء", o.lid === "rim" ? "Fold the rim flanges in" : "Close the lid"),
];

const TRAY_SEQUENCE = (o: TrayOpts): FoldStep[] => [
  step(0, "رفع الجدران مع انطواء الأركان الملصوقة", "Raise the walls; the pre-glued web corners fold in"),
  ...(o.doubleLong || o.doubleEnds ? [step(1, "طي الجدران الداخلية فوق الحافة", "Roll the inner walls over the rim")] : []),
  ...(o.lid ? [step(2, "غلق الغطاء", "Close the lid"), step(3, o.lid === "skirt" ? "إنزال الحافة الأمامية للغطاء" : "إدخال لسان الغطاء", o.lid === "skirt" ? "Drop the lid's front skirt" : "Push the lid tuck in")] : []),
];

/* ───────────────────────── definition builders ───────────────────────── */

interface Meta {
  num: string;
  slug: string;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  uses: Use[];
  presets: DimsPreset[];
  defaultDims: Dims;
  params: StructureParamLimits;
  materials?: MaterialCode[];
  joint: FamilyStructureDef["joint"];
}

const base = (m: Meta, subFamily: FefcoSubFamily, pieces: 1 | 2 | 3, glued: boolean) => ({
  code: `FEFCO_${m.num}` as FamilyCode,
  slug: m.slug,
  family: "CORRUGATED" as const,
  subFamily,
  standard: `FEFCO ${m.num}`,
  name: { ar: m.ar, en: m.en },
  description: { ar: m.descAr, en: m.descEn },
  params: m.params,
  defaultDims: m.defaultDims,
  presets: m.presets,
  materials: m.materials ?? CORRUGATED,
  shape: "box" as const,
  pieces,
  glued,
  joint: m.joint,
  uses: m.uses,
});

function bliss(m: Meta, o: BlissOpts): FamilyStructureDef {
  return {
    ...base(m, "bliss-box", 3, false),
    foldSequence: BLISS_SEQUENCE(o),
    outerSize: (d, t) => {
      const s = blissDims(d, t, o);
      return { L: s.Lb, W: s.Wp, H: s.Hp };
    },
    generate: (d, t) => blissBox(d, t, o),
  };
}

function autoCase(m: Meta, o: CaseOpts, subFamily: FefcoSubFamily = "auto-bottom-case"): FamilyStructureDef {
  return {
    // Partition strips are extra blanks; `pieces` counts the case + one partition set.
    ...base(m, subFamily, o.cells ? 2 : 1, true),
    foldSequence: [...AUTO_BOTTOM_SEQUENCE, ...topSteps[o.top], ...(o.cells ? [step(Math.max(2, ...topSteps[o.top].map((s) => s.stage)) + 1, "تركيب الفواصل", "Drop the partitions in")] : [])],
    outerSize: (d, t) => {
      const s = caseDims(d, t, o.top);
      return { L: s.Lp, W: s.Wp, H: s.Hp + (o.top === "handle" ? handleHeight(s.Wp) : 0) };
    },
    generate: (d, t) => autoBottomCase(d, t, o),
  };
}

function tray(m: Meta, o: TrayOpts): FamilyStructureDef {
  return {
    ...base(m, "ready-glued-tray", 1, true),
    foldSequence: TRAY_SEQUENCE(o),
    outerSize: (d, t) => {
      const s = trayDims(d, t, o);
      return { L: s.Lp, W: s.Wp + (o.lid === "skirt" ? t : 0), H: s.Hp + (o.lugs ? lugHeight(d.H) : 0) };
    },
    generate: (d, t) => readyGluedTray(d, t, o),
  };
}

/* ───────────────────────── shared limits / presets ───────────────────────── */

const BLISS_LIMITS = lim([150, 800], [100, 600], [80, 600]);
/** Crash-lock bottoms need W <= L: the side glue-assist flaps travel along L. */
const CASE_LIMITS = lim([100, 800], [80, 600], [60, 800], ["W <= L"]);
const TRAY_LIMITS = lim([150, 800], [100, 600], [30, 300], ["H <= W"]);
const PRODUCE_LIMITS = lim([250, 800], [200, 600], [60, 300], ["H <= W", "W <= L"]);

const BLISS_PRESETS = [
  p("fruit-export", "تصدير فاكهة", "Fruit export", 400, 300, 250, true),
  p("vegetables", "خضر", "Vegetables", 500, 300, 250, true),
  p("industrial", "قطع غيار", "Spare parts", 600, 400, 300),
];
const CASE_PRESETS = [
  p("small", "صغيرة", "Small", 250, 200, 150, true),
  p("medium", "متوسطة", "Medium", 350, 250, 200, true),
  p("large", "كبيرة", "Large", 450, 350, 300, true),
  p("pharma", "أدوية", "Pharma shipper", 300, 200, 200),
];
const TRAY_LID_PRESETS = [
  p("bakery", "مخبوزات", "Bakery", 300, 200, 80, true),
  p("ecommerce", "متجر إلكتروني", "E-commerce", 350, 250, 100, true),
  p("sweets", "حلويات", "Sweets", 400, 300, 90),
];
const PRODUCE_PRESETS = [
  p("produce-60x40", "خضر وفاكهة 60×40", "Produce 60×40", 580, 380, 150, true),
  p("produce-50x30", "خضر وفاكهة 50×30", "Produce 50×30", 480, 280, 120, true),
  p("produce-40x30", "خضر وفاكهة 40×30", "Produce 40×30", 380, 280, 100, true),
  p("grapes", "عنب", "Grapes", 480, 280, 80),
];

/* ───────────────────────── Group 06 ───────────────────────── */

export const GROUP_06: FamilyStructureDef[] = [
  bliss(
    {
      num: "0601",
      slug: "fefco-0601-bliss-box",
      ar: "صندوق بطرفين منفصلين وألسنة خارجية",
      en: "Bliss box, body flaps over separate ends",
      descAr: "جسم ملفوف بغطاء وطرفان منفصلان، تدبس ألسنة الجسم على الطرفين من الخارج.",
      descEn: "Wrap-around body with lid and two separate end panels; body flaps are stitched over the ends.",
      uses: ["produce", "shipping", "industrial"],
      presets: BLISS_PRESETS,
      defaultDims: { L: 400, W: 300, H: 250 },
      params: BLISS_LIMITS,
      joint: "A",
    },
    { bodyFlaps: true, lid: "full", endFlaps: "none" },
  ),
  bliss(
    {
      num: "0602",
      slug: "fefco-0602-bliss-box-tuck",
      ar: "صندوق بطرفين منفصلين وغطاء بلسان",
      en: "Bliss box with tuck lid",
      descAr: "مثل 0601 مع لسان على الغطاء يدخل خلف الجدار الأمامي.",
      descEn: "As 0601, with a tuck on the lid that slides behind the front wall.",
      uses: ["produce", "shipping", "retail"],
      presets: BLISS_PRESETS,
      defaultDims: { L: 400, W: 300, H: 250 },
      params: BLISS_LIMITS,
      joint: "A",
    },
    { bodyFlaps: true, lid: "tuck", endFlaps: "none" },
  ),
  bliss(
    {
      num: "0605",
      slug: "fefco-0605-open-bliss-tray",
      ar: "صندوق مفتوح بطرفين بألسنة وحافة علوية",
      en: "Open bliss case with flanged ends and rim",
      descAr: "جسم على شكل حرف U بحافة علوية مطوية وطرفان بألسنة تدبس داخل الجسم.",
      descEn: "U-shaped body with folded-in rim flanges and two flapped end panels stitched inside.",
      uses: ["produce", "industrial"],
      presets: BLISS_PRESETS,
      defaultDims: { L: 400, W: 300, H: 200 },
      params: BLISS_LIMITS,
      joint: "A",
    },
    { bodyFlaps: false, lid: "rim", endFlaps: "taper" },
  ),
  bliss(
    {
      num: "0606",
      slug: "fefco-0606-bliss-box-split-lid",
      ar: "صندوق بطرفين منفصلين وغطاء من نصفين",
      en: "Bliss box with two half lids",
      descAr: "جسم بغطاءين يتلاقيان في المنتصف وطرفان منفصلان تدبس عليهما ألسنة الجسم.",
      descEn: "Body with two ½W lids meeting at the centre and two separate ends covered by body flaps.",
      uses: ["produce", "shipping"],
      presets: BLISS_PRESETS,
      defaultDims: { L: 400, W: 300, H: 250 },
      params: BLISS_LIMITS,
      joint: "A",
    },
    { bodyFlaps: true, lid: "split", endFlaps: "none" },
  ),
  bliss(
    {
      num: "0607",
      slug: "fefco-0607-bliss-box-flapped-ends",
      ar: "صندوق بطرفين بألسنة داخلية وغطاء",
      en: "Bliss box, flapped ends inside the body",
      descAr: "جسم بسيط بغطاء وطرفان لهما ألسنة مائلة تدبس على الجدران من الداخل.",
      descEn: "Plain body with lid; end panels carry tapered flaps stitched to the inside of the walls.",
      uses: ["produce", "shipping", "industrial"],
      presets: BLISS_PRESETS,
      defaultDims: { L: 400, W: 300, H: 250 },
      params: BLISS_LIMITS,
      joint: "A",
    },
    { bodyFlaps: false, lid: "full", endFlaps: "taper" },
  ),
  bliss(
    {
      num: "0608",
      slug: "fefco-0608-bliss-box-flapped-ends-tuck",
      ar: "صندوق بطرفين بألسنة داخلية وغطاء بلسان",
      en: "Bliss box, flapped ends and tuck lid",
      descAr: "مثل 0607 مع لسان على الغطاء.",
      descEn: "As 0607, with a tuck on the lid.",
      uses: ["produce", "retail", "shipping"],
      presets: BLISS_PRESETS,
      defaultDims: { L: 400, W: 300, H: 250 },
      params: BLISS_LIMITS,
      joint: "A",
    },
    { bodyFlaps: false, lid: "tuck", endFlaps: "taper" },
  ),
  bliss(
    {
      num: "0610",
      slug: "fefco-0610-bliss-box-square-flaps",
      ar: "صندوق بطرفين بألسنة مستقيمة وغطاء",
      en: "Bliss box, square-flapped ends",
      descAr: "جسم بغطاء وطرفان بألسنة مستقيمة على الجوانب الأربعة، تلصق أو تدبس داخل الجسم.",
      descEn: "Body with lid; end panels with square flaps on all four sides, glued or stitched inside.",
      uses: ["industrial", "shipping"],
      presets: BLISS_PRESETS,
      defaultDims: { L: 400, W: 300, H: 250 },
      params: BLISS_LIMITS,
      joint: "M/A",
    },
    { bodyFlaps: false, lid: "full", endFlaps: "rect" },
  ),
  {
    ...base(
      {
        num: "0615",
        slug: "fefco-0615-tube-double-rim-caps",
        ar: "صندوق أنبوبي بغطاءين طرفيين بحافة مزدوجة",
        en: "Tube with double-rim end caps",
        descAr: "أنبوب بأربعة ألواح مفتوح الطرفين، ينغلق بغطاءين منفصلين بحافة مزدوجة.",
        descEn: "Open-ended four-panel tube closed by two separate end caps with rolled double rims.",
        uses: ["industrial", "shipping"],
        presets: [p("poster", "لوحات", "Posters", 700, 120, 120, true), p("textile", "أقمشة", "Textile rolls", 800, 200, 200), p("fixtures", "إضاءة", "Light fixtures", 600, 150, 150)],
        defaultDims: { L: 600, W: 150, H: 150 },
        params: lim([200, 1200], [60, 400], [60, 400]),
        joint: "M/A",
      },
      "rigid-sleeve-caps",
      3,
      false,
    ),
    foldSequence: [step(0, "رفع ألواح الأنبوب وحواف الغطاءين", "Raise the tube panels and the cap rims"), step(1, "غلق الأنبوب وتدبيس الوصلة", "Close the tube and stitch the joint"), step(2, "تركيب الغطاءين على الطرفين", "Slip the caps over both ends")],
    outerSize: (d, t) => ({ L: d.L + 2 * t, W: d.W + 4 * t + 2 * capClearance(t, true), H: d.H + 4 * t + 2 * capClearance(t, true) }),
    generate: (d, t) => tubeWithCaps(d, t, true),
  },
  {
    ...base(
      {
        num: "0616",
        slug: "fefco-0616-tube-end-caps",
        ar: "صندوق أنبوبي بغطاءين طرفيين",
        en: "Tube with end caps",
        descAr: "أنبوب بأربعة ألواح مفتوح الطرفين، ينغلق بغطاءين منفصلين بحافة مفردة.",
        descEn: "Open-ended four-panel tube closed by two separate single-rim end caps.",
        uses: ["industrial", "shipping", "retail"],
        presets: [p("poster", "لوحات", "Posters", 700, 120, 120, true), p("umbrella", "مظلات", "Umbrellas", 900, 120, 120), p("fixtures", "إضاءة", "Light fixtures", 600, 150, 150)],
        defaultDims: { L: 600, W: 150, H: 150 },
        params: lim([200, 1200], [60, 400], [60, 400]),
        joint: "M/A",
      },
      "rigid-sleeve-caps",
      3,
      false,
    ),
    foldSequence: [step(0, "رفع ألواح الأنبوب وحواف الغطاءين", "Raise the tube panels and the cap rims"), step(1, "غلق الأنبوب وتدبيس الوصلة", "Close the tube and stitch the joint"), step(2, "تركيب الغطاءين على الطرفين", "Slip the caps over both ends")],
    outerSize: (d, t) => ({ L: d.L + 2 * t, W: d.W + 4 * t + 2 * capClearance(t, false), H: d.H + 4 * t + 2 * capClearance(t, false) }),
    generate: (d, t) => tubeWithCaps(d, t, false),
  },
  bliss(
    {
      num: "0620",
      slug: "fefco-0620-long-bliss-split-lid",
      ar: "صندوق طولي بطرفين بألسنة وغطاء من نصفين",
      en: "Long bliss box, flapped ends and split lid",
      descAr: "جسم طولي بغطاءين يتلاقيان في المنتصف وطرفان بألسنة تدبس داخل الجسم.",
      descEn: "Long body with two ½W lids meeting at the centre; flapped end panels stitched inside.",
      uses: ["industrial", "shipping"],
      presets: [p("long", "طويلة", "Long goods", 800, 300, 300, true), p("pipes", "مواسير", "Pipes and profiles", 800, 200, 200)],
      defaultDims: { L: 700, W: 300, H: 300 },
      params: lim([300, 1200], [100, 600], [100, 600]),
      joint: "A",
    },
    { bodyFlaps: false, lid: "split", endFlaps: "rect" },
  ),
  {
    ...base(
      {
        num: "0621",
        slug: "fefco-0621-half-shell-case",
        ar: "صندوق من نصفين بجدران طرفية مزدوجة",
        en: "Two half-shell case with double ends",
        descAr: "نصفان متماثلان، لكل منهما جدار طولي بألسنة وجدار طرفي مزدوج، يلصقان عند الأركان.",
        descEn: "Two identical half shells, each a flapped long wall and a double end wall, joined at the corners.",
        uses: ["industrial", "shipping"],
        presets: [p("appliance", "أجهزة", "Appliances", 600, 400, 400, true), p("parts", "قطع غيار", "Spare parts", 500, 300, 300)],
        defaultDims: { L: 600, W: 400, H: 400 },
        params: lim([250, 1200], [150, 800], [150, 800]),
        joint: "M",
      },
      "rigid-half-shells",
      2,
      true,
    ),
    foldSequence: [step(0, "طي الجدار الطرفي المزدوج لكل نصف", "Fold each shell's double end wall"), step(1, "ضم النصفين ولصق الوصلات", "Bring the shells together and glue the joints"), step(2, "طي الألسنة السفلية", "Close the bottom flaps"), step(3, "طي الألسنة العلوية", "Close the top flaps")],
    outerSize: (d, t) => ({ L: d.L + 2 * shellSpacer(t), W: d.W + 2 * t, H: d.H + 4 * t }),
    generate: (d, t) => halfShells(d, t),
  },
];

/* ───────────────────────── Group 07 ───────────────────────── */

const caseMeta = (num: string, slug: string, ar: string, en: string, descAr: string, descEn: string, uses: Use[], extra: Partial<Meta> = {}): Meta => ({
  num,
  slug,
  ar,
  en,
  descAr,
  descEn,
  uses,
  presets: CASE_PRESETS,
  defaultDims: { L: 350, W: 250, H: 200 },
  params: CASE_LIMITS,
  joint: "M",
  ...extra,
});

export const GROUP_07: FamilyStructureDef[] = [
  autoCase(caseMeta("0700", "fefco-0700-auto-bottom-open", "صندوق بقاع أوتوماتيكي مفتوح من أعلى", "Auto-bottom case, open top", "أنبوب ملصوق بقاع ينفتح ويقفل تلقائيا عند الفتح، دون ألسنة علوية.", "Glued tube with a crash-lock bottom that sets as it opens; no top flaps.", ["retail", "shipping", "food"]), { top: "open" }),
  autoCase(caseMeta("0701", "fefco-0701-auto-bottom-full-flap", "صندوق بقاع أوتوماتيكي كامل وألسنة علوية", "Auto-bottom case, full bottom flap", "قاع أوتوماتيكي بلسان طولي يغطي القاع كله، وألسنة علوية قياسية.", "Crash-lock bottom with one long flap covering the whole bottom, standard top flaps.", ["shipping", "ecommerce"]), { top: "rsc", fullBottom: true }),
  autoCase(caseMeta("0703", "fefco-0703-auto-bottom-full-overlap", "صندوق بقاع أوتوماتيكي وألسنة علوية متراكبة", "Auto-bottom case, full-overlap top", "قاع أوتوماتيكي كامل وألسنة علوية طولية بعمق كامل تتراكب لحماية أقوى.", "Full crash-lock bottom and full-depth long top flaps that overlap for extra strength.", ["shipping", "industrial"]), { top: "fol", fullBottom: true }),
  autoCase(caseMeta("0711", "fefco-0711-auto-bottom-rsc", "صندوق شحن بقاع أوتوماتيكي", "Auto-bottom shipping case", "أنبوب ملصوق بقاع أوتوماتيكي وأربعة ألسنة علوية بعمق نصف العرض.", "Glued tube with crash-lock bottom and four W/2 top flaps (RSC top).", ["shipping", "ecommerce", "food"]), { top: "rsc" }),
  autoCase(caseMeta("0712", "fefco-0712-auto-bottom-centre-meet", "صندوق بقاع أوتوماتيكي وألسنة علوية متلاقية", "Auto-bottom case, centre-meeting top", "قاع أوتوماتيكي وألسنة علوية طولية وطرفية تتلاقى كلها في المنتصف.", "Crash-lock bottom; long and end top flaps all meet at the centre.", ["shipping", "ecommerce"]), { top: "halfHalf" }),
  autoCase(caseMeta("0713", "fefco-0713-auto-bottom-tuck-lid", "صندوق بقاع أوتوماتيكي وغطاء بلسان", "Auto-bottom case with tuck lid", "قاع أوتوماتيكي وغطاء متصل بلسان وألسنة غبار، يعاد فتحه بسهولة.", "Crash-lock bottom with a hinged tuck lid and dust flaps; re-closable.", ["ecommerce", "retail", "gift"]), { top: "tuckLid" }),
  {
    ...base(
      caseMeta("0714", "fefco-0714-auto-bottom-telescope", "صندوق بقاع أوتوماتيكي وغطاء تلسكوبي", "Auto-bottom case with telescope lid", "قاعدة بقاع أوتوماتيكي وغطاء بنفس التركيب مقلوب ينزلق فوقها.", "Crash-lock base and a crash-lock lid of the same build turned over it.", ["gift", "ecommerce", "apparel"], {
        presets: [p("shoe", "حذاء", "Shoe box", 330, 210, 120, true), p("gift", "هدية", "Gift box", 300, 300, 150), p("apparel", "ملابس", "Apparel", 400, 300, 120, true)],
        defaultDims: { L: 330, W: 220, H: 120 },
        params: lim([100, 800], [80, 600], [60, 600], ["W <= L"]),
      }),
      "auto-bottom-telescope",
      2,
      true,
    ),
    foldSequence: [...AUTO_BOTTOM_SEQUENCE, step(3, "فتح الغطاء بنفس الطريقة وقلبه فوق القاعدة", "Erect the lid the same way and turn it over the base")],
    outerSize: (d, t) => {
      const s = caseDims(d, t, "open");
      const c = telescopeClearance(t);
      return { L: s.Lp + 2 * c + 2 * t, W: s.Wp + 2 * c + 2 * t, H: s.Hp + CRASH_LAYERS * t };
    },
    generate: (d, t) => autoBottomTelescope(d, t),
  },
  autoCase(
    caseMeta("0715", "fefco-0715-auto-bottom-six-cells", "صندوق بقاع أوتوماتيكي بفواصل لست زجاجات", "Auto-bottom case with six cells", "قاع أوتوماتيكي وألسنة علوية مع فواصل تقسم الصندوق إلى ست خانات.", "Crash-lock bottom, RSC top and partitions forming six cells (L = 1.5 W).", ["food", "retail", "shipping"], {
      presets: [p("bottles-1l", "6 زجاجات 1 لتر", "6 × 1 L bottles", 270, 180, 300, true), p("jars", "6 برطمانات", "6 jars", 240, 160, 130), p("bottles-330", "6 زجاجات 330 مل", "6 × 330 ml", 200, 135, 200, true)],
      defaultDims: { L: 270, W: 180, H: 300 },
      params: lim([120, 600], [80, 400], [80, 450], ["W <= L"]),
    }),
    { top: "rsc", cells: { cols: 3, rows: 2 } },
    "auto-bottom-divided",
  ),
  autoCase(
    caseMeta("0716", "fefco-0716-auto-bottom-tear-off-display", "صندوق عرض بقاع أوتوماتيكي وغطاء قابل للنزع", "Auto-bottom display case, tear-off top", "صندوق شحن ينزع جزؤه العلوي عند خط التثقيب فيتحول إلى صندوق عرض بواجهة منخفضة.", "Shipping case whose top tears off along a perforation, leaving a low-front display tray.", ["retail", "food", "shipping"]),
    { top: "halfHalf", tearOff: true },
  ),
  autoCase(
    caseMeta("0717", "fefco-0717-auto-bottom-carrier", "حامل زجاجات بقاع أوتوماتيكي ومقبض", "Auto-bottom bottle carrier with handle", "حامل بقاع أوتوماتيكي ومقبض مزدوج في المنتصف وفواصل لست زجاجات.", "Carrier with crash-lock bottom, centre double handle and six bottle cells.", ["food", "retail"], {
      presets: [p("six-pack-330", "6 زجاجات 330 مل", "6 × 330 ml", 200, 135, 210, true), p("six-pack-500", "6 زجاجات 500 مل", "6 × 500 ml", 230, 155, 240), p("juice-1l", "6 عبوات عصير 1 لتر", "6 × 1 L juice", 270, 180, 260)],
      defaultDims: { L: 200, W: 135, H: 210 },
      params: lim([150, 450], [100, 300], [120, 400], ["W <= L"]),
    }),
    { top: "handle", cells: { cols: 3, rows: 2 } },
    "auto-bottom-divided",
  ),
  tray(
    { num: "0718", slug: "fefco-0718-glued-tray-double-long", ar: "صينية ملصوقة بجدران طولية مزدوجة", en: "Ready-glued tray, double long walls", descAr: "صينية بأركان مطوية ملصوقة مسبقا وجدران طولية مزدوجة، تفتح في حركة واحدة.", descEn: "Tray with pre-glued web corners and rolled double long walls; erects in one move.", uses: ["food", "retail", "produce"], presets: PRODUCE_PRESETS, defaultDims: { L: 480, W: 280, H: 100 }, params: TRAY_LIMITS, joint: "M" },
    { webs: "ends", doubleLong: true },
  ),
  tray(
    { num: "0747", slug: "fefco-0747-glued-tray-tuck-lid", ar: "صينية ملصوقة بغطاء بلسان", en: "Ready-glued tray with tuck lid", descAr: "صينية بركنين خلفيين مطويين ولسانين لاصقين أماميين، وغطاء بلسان.", descEn: "Tray with web back corners, glued front corner flaps and a tuck lid.", uses: ["ecommerce", "food", "gift"], presets: TRAY_LID_PRESETS, defaultDims: { L: 350, W: 250, H: 100 }, params: TRAY_LIMITS, joint: "M" },
    { webs: "back", lid: "tuck" },
  ),
  tray(
    { num: "0748", slug: "fefco-0748-glued-tray-webs-tuck-lid", ar: "صينية ملصوقة بأركان مطوية وغطاء بلسان", en: "Ready-glued tray, four web corners, tuck lid", descAr: "صينية بأربعة أركان مطوية ملصوقة مسبقا وغطاء بلسان أمامي.", descEn: "Tray with four pre-glued web corners and a front tuck lid.", uses: ["ecommerce", "food", "gift"], presets: TRAY_LID_PRESETS, defaultDims: { L: 350, W: 250, H: 100 }, params: TRAY_LIMITS, joint: "M" },
    { webs: "ends", lid: "tuck" },
  ),
  tray(
    { num: "0751", slug: "fefco-0751-glued-tray-perforated-lid", ar: "صينية ملصوقة بغطاء مثقب", en: "Ready-glued tray, holed lid", descAr: "صينية بأركان مطوية وغطاء به فتحات دائرية لتثبيت العبوات أو التهوية.", descEn: "Web-corner tray whose lid has round holes to hold bottle necks or vent produce.", uses: ["food", "produce", "retail"], presets: TRAY_LID_PRESETS, defaultDims: { L: 350, W: 250, H: 100 }, params: TRAY_LIMITS, joint: "M" },
    { webs: "ends", lid: "tuck", lidHoles: true },
  ),
  {
    ...base(
      { num: "0752", slug: "fefco-0752-glued-cell-tube", ar: "أنبوب ملصوق بخلايا", en: "Glued tube with cells", descAr: "أنبوب طويل مفتوح الطرفين ينقسم إلى صف من الخلايا لحماية العبوات.", descEn: "Long open-ended glued tube divided into a row of cells to protect packs.", uses: ["food", "retail", "shipping"], presets: [p("cups", "أكواب", "Cups", 480, 90, 110, true), p("bottles", "زجاجات", "Bottles", 400, 80, 250), p("jars", "برطمانات", "Jars", 360, 90, 120)], defaultDims: { L: 480, W: 90, H: 110 }, params: lim([200, 1200], [50, 300], [50, 300]), joint: "M" },
      "ready-glued-tube",
      2,
      true,
    ),
    foldSequence: [step(0, "فتح الأنبوب الملصوق", "Open the glued tube"), step(1, "تركيب الفواصل", "Set the cell partitions")],
    outerSize: (d, t) => ({ L: d.L, W: d.W + 2 * t, H: d.H + 2 * t }),
    generate: (d, t) => cellTube(d, t),
  },
  tray(
    { num: "0759", slug: "fefco-0759-glued-tray-skirt-lid", ar: "صينية ملصوقة بغطاء بحافة أمامية", en: "Ready-glued tray, skirted lid", descAr: "صينية بأركان مطوية وغطاء له حافة أمامية تنزل خارج الجدار وألسنة جانبية.", descEn: "Web-corner tray with a lid whose front skirt drops outside the front wall, plus side flaps.", uses: ["ecommerce", "gift", "food"], presets: TRAY_LID_PRESETS, defaultDims: { L: 350, W: 250, H: 100 }, params: TRAY_LIMITS, joint: "M" },
    { webs: "ends", lid: "skirt" },
  ),
  tray(
    { num: "0761", slug: "fefco-0761-glued-tray-lid-side-flaps", ar: "صينية ملصوقة بغطاء بلسان وألسنة جانبية", en: "Ready-glued tray, tuck lid with side flaps", descAr: "صينية بأركان مطوية وغطاء بلسان أمامي وألسنة جانبية تدخل خلف الجدران.", descEn: "Web-corner tray with a tuck lid and side flaps (v) that slip inside the end walls.", uses: ["ecommerce", "gift", "food"], presets: TRAY_LID_PRESETS, defaultDims: { L: 350, W: 250, H: 100 }, params: TRAY_LIMITS, joint: "M" },
    { webs: "ends", lid: "tuckDust" },
  ),
  tray(
    { num: "0770", slug: "fefco-0770-produce-tray-lugs", ar: "صينية خضر وفاكهة بنتوءات تكديس", en: "Produce tray with stacking lugs", descAr: "صينية بأركان مطوية ونتوءات على الجدران الطرفية تثبت الصواني فوق بعضها.", descEn: "Web-corner produce tray with stacking lugs on the end-wall rims.", uses: ["produce", "food"], presets: PRODUCE_PRESETS, defaultDims: { L: 580, W: 380, H: 150 }, params: PRODUCE_LIMITS, materials: HEAVY, joint: "M" },
    { webs: "ends", lugs: true },
  ),
  tray(
    { num: "0771", slug: "fefco-0771-produce-tray-cut-down", ar: "صينية خضر وفاكهة بجدران منخفضة وفتحات تهوية", en: "Produce tray, cut-down walls and vents", descAr: "صينية بأركان مطوية وجدران طولية منخفضة في الوسط وفتحات تهوية ومقابض.", descEn: "Web-corner produce tray with cut-down long walls, base vents and end hand holes.", uses: ["produce", "food"], presets: PRODUCE_PRESETS, defaultDims: { L: 580, W: 380, H: 150 }, params: PRODUCE_LIMITS, materials: HEAVY, joint: "M" },
    { webs: "ends", cutDown: true, baseHoles: 3, endHandHoles: true },
  ),
  tray(
    { num: "0772", slug: "fefco-0772-produce-tray-double-ends", ar: "صينية خضر وفاكهة بجدران طرفية مزدوجة", en: "Produce tray, double end walls", descAr: "صينية بأركان مطوية وجدران طرفية مزدوجة بمقابض وفتحات تهوية في القاع.", descEn: "Produce tray with web corners, rolled double end walls with hand holes and base vents.", uses: ["produce", "food"], presets: PRODUCE_PRESETS, defaultDims: { L: 580, W: 380, H: 150 }, params: PRODUCE_LIMITS, materials: HEAVY, joint: "M" },
    { webs: "long", doubleEnds: true, baseHoles: 5, endHandHoles: true },
  ),
  tray(
    { num: "0773", slug: "fefco-0773-produce-tray-double-long", ar: "صينية خضر وفاكهة بجدران طولية مزدوجة", en: "Produce tray, double long walls", descAr: "صينية بأركان مطوية وجدران طولية مزدوجة لتستيف أقوى.", descEn: "Produce tray with web corners and rolled double long walls for stronger stacking.", uses: ["produce", "food"], presets: PRODUCE_PRESETS, defaultDims: { L: 580, W: 380, H: 150 }, params: PRODUCE_LIMITS, materials: HEAVY, joint: "M" },
    { webs: "ends", doubleLong: true },
  ),
  tray(
    { num: "0774", slug: "fefco-0774-produce-tray-double-walls-handles", ar: "صينية خضر وفاكهة بجدران طولية مزدوجة وفتحات يد", en: "Produce tray, double long walls with hand holes", descAr: "صينية بأركان مطوية وجدران طولية مزدوجة بها فتحات يد.", descEn: "Produce tray with web corners and rolled double long walls carrying hand holes.", uses: ["produce", "food"], presets: PRODUCE_PRESETS, defaultDims: { L: 580, W: 380, H: 150 }, params: PRODUCE_LIMITS, materials: HEAVY, joint: "M" },
    { webs: "ends", doubleLong: true, longHandHoles: true },
  ),
];

export const ALL_DEFINITIONS: FamilyStructureDef[] = [...GROUP_06, ...GROUP_07];
