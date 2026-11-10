import type { BagHandleKind, Dims, DimsPreset, MaterialCode } from "@/types";
import type { FeatureSupport } from "../../features";
import type { BagDefinition } from "./types";

/**
 * Store (carrier) bags. Sizes are width x gusset x height in mm (L x W x H here), crease to crease,
 * the order Egyptian printers and EU suppliers quote (see README.md and docs/audit/bags.md for
 * the source of every preset). Presets marked `standard` are sizes Egyptian sellers list.
 */

const p = (id: string, ar: string, en: string, dims: Dims, standard = true): DimsPreset => ({ id, name: { ar, en }, dims, ...(standard ? { standard } : {}) });

const NONE: FeatureSupport = { windowFaces: [], thumbNotch: false, handle: false, tearStrip: false, partitions: false, lidHeight: false, displayFront: false };

const KRAFT: MaterialCode[] = ["BAG_KRAFT_120", "BAG_WHITE_KRAFT_120", "BAG_KRAFT_80"];
const ART: MaterialCode[] = ["BAG_ART_210", "BAG_ART_170", "BAG_ART_250"];
const CARRIER_LIMITS = { L: { min: 120, max: 550 }, W: { min: 50, max: 220 }, H: { min: 150, max: 600 }, rules: ["W <= L"] };
const STANDARD = "W x G x H (EN 13590 carrier bag; ISO 6591-1 sack designation)";
const ROPES: BagHandleKind[] = ["COTTON_ROPE", "PP_ROPE", "SATIN_RIBBON", "GROSGRAIN_RIBBON"];

export const DEFINITIONS: BagDefinition[] = [
  {
    code: "BAG_TWISTED_KRAFT",
    slug: "kraft-bag-twisted-handle",
    name: { ar: "كيس كرافت بيد ورقية مجدولة", en: "Kraft bag, twisted paper handle" },
    description: {
      ar: "كيس تسوق من ورق الكرافت البني أو الأبيض بقاع مربع وثنية علوية ويد ورقية مجدولة ملصقة من الداخل على رقعة تقوية. للمحلات والصيدليات والمطاعم.",
      en: "Brown or white kraft shopping bag with a pasted square bottom, a top turnover and twisted paper handles glued inside on a reinforcement patch. For shops, pharmacies and restaurants.",
    },
    subFamily: "kraft-carrier",
    line: "machine",
    standard: STANDARD,
    materials: KRAFT,
    params: CARRIER_LIMITS,
    defaultDims: { L: 260, W: 120, H: 350 },
    presets: [
      p("xs", "صغير جدا (مجوهرات)", "Extra small (jewellery)", { L: 180, W: 80, H: 230 }),
      p("small", "صغير", "Small", { L: 220, W: 100, H: 320 }),
      p("medium", "متوسط", "Medium", { L: 260, W: 120, H: 350 }),
      p("large", "كبير", "Large", { L: 320, W: 120, H: 410 }),
      p("xl", "كبير جدا", "Extra large", { L: 460, W: 160, H: 490 }),
    ],
    handles: ["TWISTED_PAPER", "FLAT_PAPER"],
    defaultHandle: "TWISTED_PAPER",
    defaultColor: "KRAFT",
    baseInsert: false,
    features: NONE,
    orderMode: "instant",
    uses: ["retail", "apparel", "food", "ecommerce"],
  },
  {
    code: "BAG_FLAT_KRAFT",
    slug: "kraft-bag-flat-handle",
    name: { ar: "كيس كرافت بيد ورقية مسطحة", en: "Kraft bag, flat paper handle" },
    description: {
      ar: "كيس كرافت بقاع مربع ويد من شريط ورقي مسطح ملصق تحت الثنية العلوية. للطلبات الخارجية والبقالة والمخابز.",
      en: "Kraft bag with a square bottom and flat paper tape handles glued under the top turnover. For takeaway, groceries and bakeries.",
    },
    subFamily: "kraft-carrier",
    line: "machine",
    standard: STANDARD,
    materials: KRAFT,
    params: CARRIER_LIMITS,
    defaultDims: { L: 280, W: 160, H: 290 },
    presets: [
      p("small", "صغير", "Small", { L: 220, W: 110, H: 300 }),
      p("takeaway", "طلبات خارجية", "Takeaway", { L: 280, W: 160, H: 290 }),
      p("medium", "متوسط", "Medium", { L: 300, W: 140, H: 300 }),
      p("large", "كبير", "Large", { L: 350, W: 140, H: 400 }),
    ],
    handles: ["FLAT_PAPER", "TWISTED_PAPER"],
    defaultHandle: "FLAT_PAPER",
    defaultColor: "KRAFT",
    baseInsert: false,
    features: NONE,
    orderMode: "instant",
    uses: ["food", "grocery", "retail"],
  },
  {
    code: "BAG_SOS",
    slug: "sos-paper-bag",
    name: { ar: "كيس ورقي بقاع مربع دون يد", en: "SOS bag, no handle" },
    description: {
      ar: "كيس ورقي ينفتح ويقف وحده بقاع مربع وجوانب مطوية ودون يد، مع فتحة إبهام اختيارية. للمخابز والبقالة والطلبات.",
      en: "Self-opening square-bottom bag with side gussets and no handle, optional thumb notch. For bakeries, groceries and takeaway.",
    },
    subFamily: "sos",
    line: "machine",
    standard: STANDARD,
    materials: ["BAG_KRAFT_80", "BAG_KRAFT_120", "BAG_WHITE_KRAFT_120"],
    params: { L: { min: 100, max: 350 }, W: { min: 50, max: 200 }, H: { min: 150, max: 450 }, rules: ["W <= L"] },
    defaultDims: { L: 159, W: 97, H: 318 },
    presets: [
      p("no4", "مقاس 4", "#4", { L: 127, W: 79, H: 244 }),
      p("no6", "مقاس 6", "#6", { L: 152, W: 92, H: 281 }),
      p("no8", "مقاس 8", "#8", { L: 159, W: 97, H: 318 }),
      p("takeaway", "طلبات خارجية", "Takeaway", { L: 260, W: 150, H: 300 }, false),
    ],
    handles: ["NONE"],
    defaultHandle: "NONE",
    defaultColor: "KRAFT",
    baseInsert: false,
    features: { ...NONE, thumbNotch: true },
    orderMode: "instant",
    uses: ["food", "grocery"],
  },
  {
    code: "BAG_ROPE_ART",
    slug: "art-paper-bag-rope-handle",
    name: { ar: "كيس كوشيه مسلفن بيد حبل", en: "Laminated art-paper bag, rope handle" },
    description: {
      ar: "كيس فاخر من ورق الكوشيه المطبوع والمسلفن بيد حبل تمر في ثقوب وتعقد من الداخل، مع قاعدة كرتون وشريط تقوية تحت الثنية. للملابس والعطور والهدايا.",
      en: "Premium bag in printed, laminated art paper with rope handles threaded through punched holes and knotted inside, a board base insert and a board strip under the turnover. For fashion, fragrance and gifts.",
    },
    subFamily: "boutique",
    line: "handmade",
    standard: STANDARD,
    materials: ART,
    params: CARRIER_LIMITS,
    defaultDims: { L: 240, W: 90, H: 320 },
    presets: [
      p("small", "صغير", "Small", { L: 150, W: 80, H: 250 }),
      p("medium", "متوسط", "Medium", { L: 240, W: 90, H: 320 }),
      p("large", "كبير", "Large", { L: 320, W: 120, H: 410 }),
      p("landscape", "عرضي", "Landscape", { L: 420, W: 120, H: 350 }),
      p("shoe", "حذاء", "Shoe box", { L: 380, W: 210, H: 300 }, false),
      p("garment", "ملابس", "Garment", { L: 460, W: 160, H: 490 }),
    ],
    handles: [...ROPES, "TWISTED_PAPER"],
    defaultHandle: "COTTON_ROPE",
    defaultColor: "BLACK",
    baseInsert: true,
    features: NONE,
    orderMode: "instant",
    uses: ["apparel", "cosmetics", "gift", "retail"],
  },
  {
    code: "BAG_GIFT_ART",
    slug: "gift-bag-ribbon-handle",
    name: { ar: "كيس هدايا كوشيه بيد شريط", en: "Gift bag, ribbon handle" },
    description: {
      ar: "كيس هدايا صغير من الكوشيه المسلفن بيد شريط ساتان أو جروجرين وقاعدة كرتون. للمجوهرات والشوكولاتة ومستحضرات التجميل.",
      en: "Small laminated art-paper gift bag with satin or grosgrain ribbon handles and a board base. For jewellery, chocolate and cosmetics.",
    },
    subFamily: "boutique",
    line: "handmade",
    standard: STANDARD,
    materials: ART,
    params: { L: { min: 100, max: 400 }, W: { min: 50, max: 160 }, H: { min: 120, max: 450 }, rules: ["W <= L"] },
    defaultDims: { L: 180, W: 80, H: 230 },
    presets: [
      p("jewellery", "مجوهرات", "Jewellery", { L: 180, W: 80, H: 230 }),
      p("medium", "متوسط", "Medium", { L: 240, W: 110, H: 310 }),
      p("large", "كبير", "Large", { L: 320, W: 120, H: 410 }),
    ],
    handles: ["SATIN_RIBBON", "GROSGRAIN_RIBBON", "COTTON_ROPE", "PP_ROPE"],
    defaultHandle: "SATIN_RIBBON",
    defaultColor: "GOLD",
    baseInsert: true,
    features: NONE,
    orderMode: "instant",
    uses: ["gift", "cosmetics", "retail"],
  },
  {
    code: "BAG_DIECUT_PATCH",
    slug: "die-cut-handle-bag",
    name: { ar: "كيس بيد مفرغة", en: "Die-cut handle bag" },
    description: {
      ar: "كيس بقاع مربع وفتحة يد مفرغة في الوجهين، مقواة بثنية علوية عميقة ورقعة كرتون. للمعارض والكتب والهدايا الترويجية.",
      en: "Square-bottom bag with a die-cut hand hole through both faces, reinforced by a deep turnover and a board patch. For events, books and promotional gifts.",
    },
    subFamily: "die-cut",
    line: "machine",
    standard: STANDARD,
    materials: ["BAG_KRAFT_120", "BAG_WHITE_KRAFT_120", "BAG_ART_210"],
    params: { L: { min: 180, max: 500 }, W: { min: 60, max: 180 }, H: { min: 200, max: 550 }, rules: ["W <= L"] },
    defaultDims: { L: 300, W: 120, H: 400 },
    presets: [
      p("small", "صغير", "Small", { L: 220, W: 100, H: 320 }, false),
      p("medium", "متوسط", "Medium", { L: 300, W: 120, H: 400 }, false),
      p("large", "كبير", "Large", { L: 400, W: 120, H: 450 }, false),
    ],
    handles: ["DIE_CUT"],
    defaultHandle: "DIE_CUT",
    defaultColor: "KRAFT",
    baseInsert: false,
    features: NONE,
    orderMode: "quote",
    uses: ["retail", "gift"],
  },
  {
    code: "BAG_BOTTLE",
    slug: "bottle-bag-rope-handle",
    name: { ar: "كيس زجاجة بيد حبل", en: "Bottle bag, rope handle" },
    description: {
      ar: "كيس طويل لزجاجة واحدة بقاع مربع وقاعدة كرتون ويد حبل. للزيوت والعصائر والعطور الكبيرة والهدايا.",
      en: "Tall single-bottle bag with a square bottom, a board base and rope handles. For oils, juices, large fragrances and gifts.",
    },
    subFamily: "bottle",
    line: "handmade",
    standard: STANDARD,
    materials: ["BAG_ART_210", "BAG_KRAFT_120", "BAG_WHITE_KRAFT_120", "BAG_ART_250"],
    params: { L: { min: 90, max: 180 }, W: { min: 60, max: 130 }, H: { min: 280, max: 450 }, rules: ["W <= L"] },
    defaultDims: { L: 140, W: 80, H: 390 },
    presets: [
      p("one-bottle", "زجاجة واحدة", "One bottle", { L: 140, W: 80, H: 390 }),
      p("one-bottle-tall", "زجاجة طويلة", "Tall bottle", { L: 140, W: 80, H: 400 }),
      p("oil-1l", "زيت 1 لتر", "Oil 1 l", { L: 120, W: 90, H: 370 }, false),
    ],
    handles: ["COTTON_ROPE", "PP_ROPE", "SATIN_RIBBON", "TWISTED_PAPER"],
    defaultHandle: "COTTON_ROPE",
    defaultColor: "BLACK",
    baseInsert: true,
    features: NONE,
    orderMode: "quote",
    uses: ["beverage", "gift", "food"],
  },
];

/** Earlier quote-only catalogue codes (foodservice family) promoted to these designer models. */
export const BAG_CODE_ALIASES: Record<string, string> = {
  FS_BAG_TWISTED_HANDLE: "BAG_TWISTED_KRAFT",
  FS_BAG_FLAT_HANDLE: "BAG_FLAT_KRAFT",
  FS_BAG_SOS: "BAG_SOS",
  FS_BAG_BOTTLE: "BAG_BOTTLE",
};

/** Definition of a bag model (or a promoted FS_BAG code); null for anything else. */
export function bagDefinitionOf(code: string | null | undefined): BagDefinition | null {
  if (!code) return null;
  const c = BAG_CODE_ALIASES[code] ?? code;
  return DEFINITIONS.find((d) => d.code === c) ?? null;
}
