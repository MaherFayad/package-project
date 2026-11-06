import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureCode, StructureFamily, StructureParamLimits } from "@/types";
import { MATERIAL_CODES, STRUCTURE_CODES } from "@/types";
import { FEATURE_SUPPORT, type FeatureSupport } from "./features";
import { DEFAULT_DIMS, STRUCTURE_LIMITS } from "./limits";
import { STRUCTURE_FAMILY, materialFitsStructure } from "./materials";

/**
 * STRUCTURES: the structure library the designer, catalogue, seed and pricing consume.
 * One entry per StructureCode with its industry reference, names (Arabic MSA noun form,
 * no diacritics), size limits, allowed boards, feature support and size presets common in
 * Egypt. Dimensions are INNER mm.
 */
export interface StructureDef {
  code: StructureCode;
  slug: string;
  family: StructureFamily;
  /** Industry style reference printers recognise ("FEFCO 0427", "ECMA A60.20"). */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  /** Boards the structure can be made from (same family). */
  materials: MaterialCode[];
  features: FeatureSupport;
  /** "cylinder": L = W = diameter, H = height (show one "diameter" field). "flat": a container print part (label, pouch web, tube body). */
  shape: "box" | "cylinder" | "flat";
  /** Separately cut blanks before optional dividers (2 = lid + base). */
  pieces: 1 | 2;
  /** Delivered glued flat (needs a gluer) vs. flat unglued (folded by the buyer). */
  glued: boolean;
  /** Typical uses (marketing chips / catalogue filters). */
  uses: ("ecommerce" | "food" | "cosmetics" | "apparel" | "retail" | "gift" | "shipping")[];
}

const p = (id: string, ar: string, en: string, dims: Dims, standard?: boolean): DimsPreset => ({ id, name: { ar, en }, dims, ...(standard ? { standard } : {}) });

type Entry = Omit<StructureDef, "code" | "family" | "params" | "defaultDims" | "materials" | "features">;

const ENTRIES: Record<StructureCode, Entry> = {
  FEFCO_0427: {
    slug: "mailer-box",
    standard: "FEFCO 0427",
    name: { ar: "علبة بريدية", en: "Mailer box" },
    description: {
      ar: "علبة كرتون مضلع بغطاء متصل ولسان أمامي، مثالية لتجربة فتح مميزة للمتاجر الإلكترونية.",
      en: "Corrugated roll-end tuck-front mailer, the go-to e-commerce unboxing box.",
    },
    presets: [
      p("accessories", "إكسسوارات", "Accessories", { L: 180, W: 120, H: 50 }, true),
      p("tshirt", "تيشيرت", "T-shirt", { L: 300, W: 220, H: 60 }, true),
      p("shoe", "حذاء", "Shoe box", { L: 330, W: 200, H: 120 }, true),
      p("cosmetics-kit", "طقم مستحضرات", "Cosmetics kit", { L: 250, W: 180, H: 80 }),
    ],
    shape: "box",
    pieces: 1,
    glued: false,
    uses: ["ecommerce", "apparel", "cosmetics", "gift"],
  },
  FEFCO_0201: {
    slug: "shipping-box",
    standard: "FEFCO 0201",
    name: { ar: "علبة شحن", en: "Shipping box" },
    description: {
      ar: "علبة شحن كرتون مضلع قياسية بأربعة ألسنة علوية وسفلية، قوية وموفرة.",
      en: "Regular slotted container (RSC): the standard, economical corrugated shipping carton.",
    },
    presets: [
      p("small", "صغيرة", "Small", { L: 200, W: 150, H: 100 }, true),
      p("medium", "متوسطة", "Medium", { L: 300, W: 200, H: 150 }, true),
      p("large", "كبيرة", "Large", { L: 400, W: 300, H: 250 }, true),
    ],
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["shipping", "ecommerce"],
  },
  ECMA_RTE: {
    slug: "reverse-tuck-end",
    standard: "ECMA A20 (reverse tuck)",
    name: { ar: "علبة كرتون بلسان عكسي", en: "Reverse tuck end carton" },
    description: {
      ar: "علبة كرتون دوبلكس خفيفة بلسانين في اتجاهين متعاكسين، شائعة لمستحضرات التجميل والعطور.",
      en: "Lightweight SBS folding carton with tucks on opposite panels; classic for cosmetics and perfume.",
    },
    presets: [
      p("perfume-50ml", "عطر 50 مل", "Perfume 50 ml", { L: 55, W: 45, H: 130 }, true),
      p("perfume-100ml", "عطر 100 مل", "Perfume 100 ml", { L: 65, W: 55, H: 160 }, true),
      p("cream-jar", "برطمان كريم", "Cream jar", { L: 70, W: 70, H: 70 }),
    ],
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["cosmetics", "retail"],
  },
  ECMA_STE: {
    slug: "straight-tuck-end",
    standard: "ECMA A20 (straight tuck)",
    name: { ar: "علبة كرتون بلسان مستقيم", en: "Straight tuck end carton" },
    description: {
      ar: "علبة كرتون دوبلكس بلسانين في نفس الاتجاه لواجهة أمامية نظيفة، مناسبة للأغذية الجافة والهدايا.",
      en: "SBS folding carton with both tucks on the same side for a clean front; good for dry food and gifts.",
    },
    presets: [
      p("tea", "علبة شاي", "Tea box", { L: 90, W: 60, H: 140 }, true),
      p("soap", "صابون", "Soap bar", { L: 95, W: 35, H: 65 }, true),
    ],
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["food", "retail", "gift"],
  },
  PIZZA: {
    slug: "pizza-box",
    standard: "FEFCO 0426",
    name: { ar: "علبة بيتزا", en: "Pizza box" },
    description: {
      ar: "علبة بيتزا كرتون مضلع آمنة للأغذية مع فتحات تهوية اختيارية.",
      en: "Food-safe corrugated pizza box (FEFCO 0426 style).",
    },
    presets: [
      p("pizza-25", "بيتزا 25 سم", "Pizza 25 cm", { L: 260, W: 260, H: 40 }, true),
      p("pizza-30", "بيتزا 30 سم", "Pizza 30 cm", { L: 310, W: 310, H: 40 }, true),
      p("pizza-35", "بيتزا 35 سم", "Pizza 35 cm", { L: 360, W: 360, H: 45 }, true),
    ],
    shape: "box",
    pieces: 1,
    glued: false,
    uses: ["food"],
  },
  SLEEVE: {
    slug: "sleeve",
    standard: "ECMA A01 (sleeve)",
    name: { ar: "غلاف منزلق", en: "Sleeve" },
    description: {
      ar: "غلاف كرتون مطبوع ينزلق حول علبة أو منتج، طريقة اقتصادية لإضافة علامتك التجارية.",
      en: "Printed board sleeve that slides over a box or tray: an economical way to brand stock packaging.",
    },
    presets: [
      p("dessert-tray", "علبة حلويات", "Dessert tray", { L: 220, W: 150, H: 60 }, true),
      p("meal-box", "علبة وجبة", "Meal box", { L: 230, W: 160, H: 70 }),
    ],
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["food", "retail"],
  },
  FEFCO_0320: {
    slug: "telescope-box",
    standard: "FEFCO 0320",
    name: { ar: "علبة تلسكوبية بغطاء منفصل", en: "Telescope box (lid and base)" },
    description: {
      ar: "علبة من قطعتين من الكرتون المضلع: قاعدة وغطاء ينزلق فوقها، مناسبة لعلب الهدايا والأحذية والملابس.",
      en: "Two-piece corrugated box (FEFCO 0320): an open base and a lid that slides over it. Gift, shoe and apparel boxes.",
    },
    presets: [
      p("shirt", "قميص", "Shirt box", { L: 330, W: 250, H: 60 }, true),
      p("shoe", "حذاء", "Shoe box", { L: 330, W: 210, H: 120 }, true),
      p("gift", "هدية", "Gift box", { L: 250, W: 250, H: 100 }),
    ],
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["apparel", "gift", "ecommerce"],
  },
  ECMA_CLB: {
    slug: "crash-lock-carton",
    standard: "ECMA A60.20",
    name: { ar: "علبة كرتون بقاع أوتوماتيكي", en: "Crash-lock bottom carton" },
    description: {
      ar: "علبة كرتون دوبلكس بقاع ملصوق مسبقا ينفتح ويقفل بضغطة واحدة ولسان علوي، تتحمل الزجاجات والبرطمانات الثقيلة.",
      en: "SBS carton with a pre-glued crash-lock bottom that pops open in one move and a tuck top; holds heavier bottles and jars.",
    },
    presets: [
      p("oil-1l", "زيت 1 لتر", "Oil bottle 1 L", { L: 85, W: 85, H: 300 }, true),
      p("honey-500g", "عسل 500 جم", "Honey jar 500 g", { L: 85, W: 85, H: 115 }),
      p("perfume-100ml", "عطر 100 مل", "Perfume 100 ml", { L: 65, W: 55, H: 160 }, true),
      p("candle", "شمعة", "Candle", { L: 90, W: 90, H: 110 }),
    ],
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["food", "cosmetics", "retail"],
  },
  ECMA_SLB: {
    slug: "snap-lock-carton",
    standard: "ECMA A55.20",
    name: { ar: "علبة كرتون بقاع مقفل 1-2-3", en: "Snap-lock bottom carton (1-2-3)" },
    description: {
      ar: "علبة كرتون دوبلكس بقاع يقفل يدويا في ثلاث خطوات دون لصق ولسان علوي، أوفر من القاع الأوتوماتيكي للكميات الصغيرة.",
      en: "SBS carton with a 1-2-3 snap-lock bottom folded by hand (no glue) and a tuck top; cheaper than crash-lock for short runs.",
    },
    presets: [
      p("cream-tube", "أنبوب كريم", "Cream tube", { L: 45, W: 35, H: 160 }, true),
      p("tea", "علبة شاي", "Tea box", { L: 90, W: 60, H: 140 }, true),
      p("cosmetics-jar", "برطمان مستحضرات", "Cosmetics jar", { L: 70, W: 70, H: 80 }),
    ],
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["cosmetics", "food", "retail"],
  },
  FEFCO_0422: {
    slug: "display-tray",
    standard: "FEFCO 0422",
    name: { ar: "صينية عرض ذاتية القفل", en: "Self-locking display tray" },
    description: {
      ar: "صينية كرتون مضلع تقفل أركانها بجدران مزدوجة دون لصق، للعرض على الأرفف وتعبئة الخضر والفاكهة.",
      en: "Corrugated tray whose rolled double end walls lock the corners without glue; shelf display and produce packing.",
    },
    presets: [
      p("produce-30x40", "فاكهة 30×40", "Produce 30×40", { L: 380, W: 280, H: 100 }, true),
      p("produce-40x60", "فاكهة 40×60", "Produce 40×60", { L: 580, W: 380, H: 120 }, true),
      p("shelf-display", "عرض على الرف", "Shelf display", { L: 300, W: 200, H: 80 }),
    ],
    shape: "box",
    pieces: 1,
    glued: false,
    uses: ["retail", "food"],
  },
  GABLE_BOX: {
    slug: "gable-box",
    standard: "Gable carrier",
    name: { ar: "علبة حمل بمقبض", en: "Gable box with handle" },
    description: {
      ar: "علبة كرتون دوبلكس بسقف جملوني ومقبض مدمج وقاع مقفل، للحلويات ووجبات الأطفال والهدايا.",
      en: "SBS gable box with a built-in carry handle and snap-lock bottom; for pastries, kids' meals and gifts.",
    },
    presets: [
      p("cake-slice", "قطعة كيك", "Cake slice", { L: 160, W: 100, H: 120 }, true),
      p("kids-meal", "وجبة أطفال", "Kids' meal", { L: 140, W: 100, H: 100 }),
      p("gift", "هدية", "Gift", { L: 200, W: 120, H: 150 }),
    ],
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["food", "gift", "retail"],
  },
  PAPER_TUBE: {
    slug: "paper-tube",
    standard: "Composite can",
    name: { ar: "علبة أسطوانية ورقية", en: "Paper tube" },
    description: {
      ar: "أسطوانة ورقية ملفوفة بملصق مطبوع وغطاء منزلق، للشاي والبن والحلويات ومستحضرات التجميل.",
      en: "Spiral-wound paper tube with a printed label and a slip-on lid, for tea, coffee, sweets and cosmetics.",
    },
    presets: [
      p("tea-75", "شاي قطر 75", "Tea Ø75", { L: 75, W: 75, H: 150 }, true),
      p("cosmetics-50", "مستحضرات قطر 50", "Cosmetics Ø50", { L: 50, W: 50, H: 120 }),
      p("sweets-99", "حلويات قطر 99", "Sweets Ø99", { L: 99, W: 99, H: 200 }, true),
      p("bottle-90", "زجاجة قطر 90", "Bottle Ø90", { L: 90, W: 90, H: 330 }),
    ],
    shape: "cylinder",
    pieces: 2,
    glued: true,
    uses: ["food", "cosmetics", "gift"],
  },
  RIGID_BOX: {
    slug: "rigid-box",
    standard: "Rigid set-up box",
    name: { ar: "علبة صلبة بغطاء وقاعدة", en: "Rigid box (lid and base)" },
    description: {
      ar: "علبة فاخرة من كرتون رمادي سميك مكسو بورق مطبوع، بغطاء وقاعدة منفصلين، للعطور والساعات والهدايا.",
      en: "Premium box of thick greyboard wrapped in printed paper, separate lid and base; perfume, watches and gifts.",
    },
    presets: [
      p("jewelry", "مجوهرات", "Jewellery", { L: 90, W: 90, H: 40 }),
      p("watch", "ساعة", "Watch", { L: 120, W: 120, H: 80 }, true),
      p("perfume-gift", "طقم عطر", "Perfume gift set", { L: 200, W: 150, H: 80 }, true),
      p("apparel-gift", "هدية ملابس", "Apparel gift", { L: 300, W: 250, H: 80 }),
    ],
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["gift", "cosmetics", "apparel"],
  },
  // Added by 3D integration: printed parts for containers. Designed on the container model
  // (src/lib/library); L × H here is the flat part the printer cuts per unit.
  ROLL_LABEL: {
    slug: "roll-labels",
    standard: "Die-cut roll labels / shrink sleeves",
    name: { ar: "ملصقات رول", en: "Roll labels" },
    description: {
      ar: "ملصقات مطبوعة على رول من الورق أو البولي بروبيلين أو أكمام حرارية، بمقاس العبوة.",
      en: "Printed roll labels on paper or BOPP, or PETG shrink sleeves, sized to the container.",
    },
    presets: [p("wrap-500ml", "زجاجة 500 مل", "500 ml bottle wrap", { L: 215, W: 1, H: 70 }, true), p("jar-front", "برطمان", "Jar front", { L: 90, W: 1, H: 60 }, true)],
    shape: "flat",
    pieces: 1,
    glued: false,
    uses: ["food", "cosmetics", "retail"],
  },
  PRINTED_POUCH: {
    slug: "printed-pouches",
    standard: "Laminated flexible pouch",
    name: { ar: "أكياس مطبوعة", en: "Printed pouches" },
    description: {
      ar: "أكياس مرنة مطبوعة من رقائق PET/PE أو كرافت/PE بسحاب وقاع قائم.",
      en: "Printed flexible pouches in PET/PE or kraft/PE laminate, with zipper and stand-up base.",
    },
    presets: [p("pouch-250g", "250 جم", "250 g", { L: 320, W: 1, H: 230 }, true), p("pouch-500g", "500 جم", "500 g", { L: 400, W: 1, H: 280 }, true)],
    shape: "flat",
    pieces: 1,
    glued: false,
    uses: ["food", "retail"],
  },
  PRINTED_TUBE: {
    slug: "printed-tubes",
    standard: "PE / laminate squeeze tube",
    name: { ar: "أنابيب مطبوعة", en: "Printed squeeze tubes" },
    description: {
      ar: "أنابيب بلاستيكية مرنة مطبوعة للكريمات ومعجون الأسنان.",
      en: "Printed PE squeeze tubes for creams, gels and toothpaste.",
    },
    presets: [p("tube-50ml", "50 مل", "50 ml", { L: 100, W: 1, H: 100 }, true), p("tube-100ml", "100 مل", "100 ml", { L: 120, W: 1, H: 120 }, true)],
    shape: "flat",
    pieces: 1,
    glued: false,
    uses: ["cosmetics"],
  },
};

export const STRUCTURES: Record<StructureCode, StructureDef> = Object.fromEntries(
  STRUCTURE_CODES.map((code) => [
    code,
    {
      code,
      family: STRUCTURE_FAMILY[code],
      params: STRUCTURE_LIMITS[code],
      defaultDims: DEFAULT_DIMS[code],
      materials: MATERIAL_CODES.filter((m) => materialFitsStructure(m, code)),
      features: FEATURE_SUPPORT[code],
      ...ENTRIES[code],
    } satisfies StructureDef,
  ]),
) as Record<StructureCode, StructureDef>;

export const STRUCTURE_LIST: StructureDef[] = STRUCTURE_CODES.map((c) => STRUCTURES[c]);

/** Box structures only (no container print parts): what box catalogues list. */
export const BOX_STRUCTURE_LIST: StructureDef[] = STRUCTURE_LIST.filter((s) => s.shape !== "flat");

export function structureBySlug(slug: string): StructureDef | null {
  return STRUCTURE_LIST.find((s) => s.slug === slug) ?? null;
}
