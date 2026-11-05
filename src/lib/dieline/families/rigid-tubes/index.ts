import { NO_FEATURES, defineModel, preset as p, type Rule } from "./define";
import { octabin, palletBox, palletBoxWithLid } from "./corrugated";
import { envelopeDraft } from "./envelopes";
import { bookBox, collapsibleBox, drawerBox, hingedLidBox, lidAndBase, rigidConstruction, shoulderBox } from "./rigid";
import { tubeConstruction, tubeDraft } from "./tubes";
import type { CatalogueDefinition, FamilyMaterialCode } from "./types";

/**
 * Rigid set-up boxes, paper tubes, bulk corrugated (pallet box, octabin) and envelopes /
 * mailers. Every entry is parametric (inner mm; envelopes: finished size), validated with
 * zod, and generates a DielineModel the shared fold engine animates.
 */

const RIGID_BOARDS: FamilyMaterialCode[] = ["GREYBOARD_WRAP", "GREYBOARD_1500_WRAP", "GREYBOARD_2500_WRAP"];
const TUBE_BOARDS: FamilyMaterialCode[] = ["KRAFT_TUBE", "WHITE_TUBE"];
const ENVELOPE_PAPERS: FamilyMaterialCode[] = ["OFFSET_PAPER_100", "KRAFT_PAPER_120", "CARD_PAPER_160"];

const round: Rule = { text: "L == W", path: "W", test: (d) => Math.abs(d.L - d.W) < 1e-6 };
const flatThin: Rule = { text: "W <= 0.1 × min(L, H)", path: "W", test: (d) => d.W <= 0.1 * Math.min(d.L, d.H) + 1e-9 };

const RIGID_LIMITS = { L: { min: 50, max: 450 }, W: { min: 40, max: 350 }, H: { min: 20, max: 200 } };
const TUBE_LIMITS = { L: { min: 30, max: 150 }, W: { min: 30, max: 150 }, H: { min: 50, max: 350 } };

export const DEFINITIONS: CatalogueDefinition[] = [
  /* ───────────── Rigid set-up boxes ───────────── */
  defineModel({
    code: "RIGID_LID_BASE",
    slug: "rigid-lid-and-base-box",
    family: "RIGID",
    subFamily: "two-piece",
    standard: "none",
    name: { ar: "علبة صلبة بغطاء وقاعدة", en: "Rigid lid and base box" },
    description: {
      ar: "علبة فاخرة من كرتون رمادي مكسو بورق مطبوع، بقاعدة وغطاء منفصل بعمق قابل للتعديل حتى الغطاء الكامل.",
      en: "Wrapped greyboard base with a separate lid-off lid, depth adjustable up to a full telescope lid.",
    },
    params: RIGID_LIMITS,
    defaultDims: { L: 200, W: 150, H: 80 },
    presets: [
      p("jewellery", "مجوهرات", "Jewellery", { L: 90, W: 90, H: 40 }),
      p("watch", "ساعة", "Watch", { L: 120, W: 120, H: 80 }, true),
      p("perfume-gift", "طقم عطر", "Perfume gift set", { L: 200, W: 150, H: 80 }, true),
      p("apparel-gift", "هدية ملابس", "Apparel gift", { L: 300, W: 250, H: 80 }),
    ],
    materials: RIGID_BOARDS,
    defaultMaterial: "GREYBOARD_WRAP",
    features: { ...NO_FEATURES, windowFaces: ["top"], thumbNotch: true, lidHeight: true },
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["gift", "cosmetics", "apparel", "jewellery"],
    baseCode: "RIGID_BOX",
    generator: (d, t, f) => lidAndBase(d, t, f),
    constructionOf: (d, t, f) => rigidConstruction("lidBase", d, t, f),
  }),
  defineModel({
    code: "RIGID_SHOULDER",
    slug: "rigid-shoulder-neck-box",
    family: "RIGID",
    subFamily: "shoulder",
    standard: "none",
    name: { ar: "علبة صلبة بكتف", en: "Shoulder box (neck box)" },
    description: {
      ar: "علبة صلبة من ثلاث قطع: قاعدة وعنق داخلي بارز وغطاء يستقر على الكتف بمحاذاة القاعدة، للعطور والشموع والساعات.",
      en: "Three-piece rigid box: base, a proud inner neck and a lid that rests on the shoulder flush with the base.",
    },
    params: { L: { min: 40, max: 300 }, W: { min: 40, max: 300 }, H: { min: 40, max: 300 } },
    defaultDims: { L: 90, W: 90, H: 150 },
    presets: [
      p("perfume-100", "عطر 100 مل", "Perfume 100 ml", { L: 80, W: 60, H: 160 }, true),
      p("candle", "شمعة", "Candle", { L: 100, W: 100, H: 110 }),
      p("watch", "ساعة", "Watch", { L: 110, W: 110, H: 90 }),
      p("oud-oil", "دهن عود", "Oud oil set", { L: 160, W: 120, H: 70 }),
    ],
    materials: RIGID_BOARDS,
    defaultMaterial: "GREYBOARD_WRAP",
    features: { ...NO_FEATURES, windowFaces: ["top"], lidHeight: true },
    shape: "box",
    pieces: 3,
    glued: true,
    uses: ["cosmetics", "gift", "jewellery"],
    baseCode: "RIGID_BOX",
    rules: [{ text: "H >= 40", path: "H", test: (d) => d.H >= 40 }],
    generator: shoulderBox,
    constructionOf: (d, t, f) => rigidConstruction("shoulder", d, t, f),
  }),
  defineModel({
    code: "RIGID_BOOK_MAGNETIC",
    slug: "rigid-book-box-magnetic",
    family: "RIGID",
    subFamily: "book",
    standard: "none",
    name: { ar: "علبة صلبة على شكل كتاب بغلق مغناطيسي", en: "Book-style magnetic box" },
    description: {
      ar: "صينية صلبة مثبتة داخل غلاف بكعب وغطاء ولسان أمامي يغلق بمغناطيس مخفي، لتجربة فتح فاخرة.",
      en: "Rigid tray glued into a wrapped cover with spine, lid and a front flap that closes on hidden magnets.",
    },
    params: { L: { min: 60, max: 450 }, W: { min: 50, max: 350 }, H: { min: 20, max: 150 } },
    defaultDims: { L: 220, W: 160, H: 70 },
    presets: [
      p("phone-accessory", "إكسسوار هاتف", "Phone accessory", { L: 180, W: 120, H: 50 }),
      p("perfume-set", "طقم عطر", "Perfume set", { L: 220, W: 160, H: 70 }, true),
      p("chocolates", "شوكولاتة", "Chocolates", { L: 250, W: 180, H: 50 }, true),
      p("abaya", "عباية", "Abaya / apparel", { L: 330, W: 250, H: 70 }),
    ],
    materials: RIGID_BOARDS,
    defaultMaterial: "GREYBOARD_WRAP",
    features: NO_FEATURES,
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["gift", "cosmetics", "apparel", "ecommerce"],
    baseCode: "RIGID_BOX",
    generator: bookBox,
    constructionOf: (d, t, f) => rigidConstruction("book", d, t, f),
  }),
  defineModel({
    code: "RIGID_DRAWER",
    slug: "rigid-drawer-box",
    family: "RIGID",
    subFamily: "drawer",
    standard: "none",
    name: { ar: "علبة صلبة بدرج", en: "Drawer box with ribbon pull" },
    description: {
      ar: "درج صلب ينزلق داخل غلاف مفتوح الطرفين ويسحب بشريط، للمجوهرات والشوكولاتة والإكسسوارات.",
      en: "Rigid drawer sliding in an open-ended sleeve, pulled by a ribbon; jewellery, chocolates and accessories.",
    },
    params: { L: { min: 50, max: 400 }, W: { min: 40, max: 300 }, H: { min: 20, max: 150 } },
    defaultDims: { L: 200, W: 120, H: 40 },
    presets: [
      p("jewellery", "مجوهرات", "Jewellery", { L: 100, W: 80, H: 35 }, true),
      p("chocolates", "شوكولاتة", "Chocolates", { L: 200, W: 120, H: 40 }, true),
      p("tea-sampler", "تشكيلة شاي", "Tea sampler", { L: 240, W: 160, H: 60 }),
    ],
    materials: RIGID_BOARDS,
    defaultMaterial: "GREYBOARD_1500_WRAP",
    features: { ...NO_FEATURES, thumbNotch: true },
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["gift", "food", "jewellery"],
    baseCode: "RIGID_BOX",
    generator: drawerBox,
    constructionOf: (d, t, f) => rigidConstruction("drawer", d, t, f),
  }),
  defineModel({
    code: "RIGID_HINGED_LID",
    slug: "rigid-hinged-lid-box",
    family: "RIGID",
    subFamily: "hinged",
    standard: "none",
    name: { ar: "علبة صلبة بغطاء مفصلي", en: "Hinged lid rigid box" },
    description: {
      ar: "قاعدة وغطاء صلبان بنفس المقاس متصلان بمفصل ورقي في الخلف، يفتح الغطاء دون أن ينفصل.",
      en: "Base and lid of the same footprint joined by a paper hinge at the back; the lid opens without coming off.",
    },
    params: { L: { min: 50, max: 400 }, W: { min: 40, max: 300 }, H: { min: 25, max: 200 } },
    defaultDims: { L: 180, W: 130, H: 60 },
    presets: [
      p("watch", "ساعة", "Watch", { L: 120, W: 100, H: 70 }, true),
      p("pen-set", "طقم أقلام", "Pen set", { L: 180, W: 80, H: 35 }),
      p("cosmetics-kit", "طقم مستحضرات", "Cosmetics kit", { L: 220, W: 160, H: 70 }),
    ],
    materials: RIGID_BOARDS,
    defaultMaterial: "GREYBOARD_WRAP",
    features: { ...NO_FEATURES, windowFaces: ["top"], thumbNotch: true, lidHeight: true },
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["gift", "cosmetics", "jewellery"],
    baseCode: "RIGID_BOX",
    generator: hingedLidBox,
    constructionOf: (d, t, f) => rigidConstruction("hinged", d, t, f),
  }),
  defineModel({
    code: "RIGID_COLLAPSIBLE",
    slug: "rigid-collapsible-magnetic-box",
    family: "RIGID",
    subFamily: "collapsible",
    standard: "none",
    name: { ar: "علبة صلبة قابلة للطي", en: "Collapsible rigid box" },
    description: {
      ar: "علبة صلبة تشحن مسطحة وتجمع يدويا بجدران جانبية مزدوجة وغطاء بلسان مغناطيسي، توفر مساحة التخزين والشحن.",
      en: "Ships flat and folds up by hand: double side walls lock the corners, lid with a magnetic flap. Saves freight.",
    },
    params: { L: { min: 80, max: 450 }, W: { min: 60, max: 350 }, H: { min: 30, max: 200 } },
    defaultDims: { L: 300, W: 220, H: 100 },
    presets: [
      p("apparel", "ملابس", "Apparel", { L: 330, W: 250, H: 100 }, true),
      p("shoes", "حذاء", "Shoes", { L: 330, W: 210, H: 120 }, true),
      p("gift-hamper", "سلة هدايا", "Gift hamper", { L: 350, W: 280, H: 150 }),
    ],
    materials: RIGID_BOARDS,
    defaultMaterial: "GREYBOARD_WRAP",
    features: NO_FEATURES,
    shape: "box",
    pieces: 1,
    glued: false,
    uses: ["apparel", "gift", "ecommerce"],
    baseCode: "RIGID_BOX",
    generator: collapsibleBox,
    constructionOf: (d, t, f) => rigidConstruction("collapsible", d, t, f),
  }),
  defineModel({
    code: "RIGID_WINDOW",
    slug: "rigid-window-box",
    family: "RIGID",
    subFamily: "two-piece",
    standard: "none",
    name: { ar: "علبة صلبة بنافذة", en: "Two-piece rigid box with window" },
    description: {
      ar: "علبة صلبة بقاعدة وغطاء بنافذة مقطوعة ومغطاة بفيلم شفاف لعرض المنتج دون فتح العلبة.",
      en: "Lid and base rigid box with a die-cut lid window backed by clear film to show the product.",
    },
    params: RIGID_LIMITS,
    defaultDims: { L: 200, W: 200, H: 60 },
    presets: [
      p("sweets", "حلويات", "Sweets", { L: 200, W: 200, H: 60 }, true),
      p("dates", "تمور", "Dates", { L: 250, W: 170, H: 50 }, true),
      p("macarons", "ماكرون", "Macarons", { L: 230, W: 60, H: 60 }),
    ],
    materials: RIGID_BOARDS,
    defaultMaterial: "GREYBOARD_WRAP",
    features: { ...NO_FEATURES, windowFaces: ["top"], lidHeight: true },
    defaultFeatures: { window: { face: "top", film: true } },
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["food", "gift", "retail"],
    baseCode: "RIGID_BOX",
    generator: (d, t, f) => lidAndBase(d, t, f),
    constructionOf: (d, t, f) => rigidConstruction("window", d, t, f),
  }),

  /* ───────────── Paper tubes ───────────── */
  ...(
    [
      ["TUBE_LID_BASE", "paper-tube-lid-and-base", "lidBase", "lid-base", { ar: "أسطوانة ورقية بغطاء وقاعدة", en: "Paper tube with lid" }, { ar: "أسطوانة ورقية ملفوفة بملصق مطبوع وقاعدة ورقية وغطاء منزلق قصير، للشاي والبن والحلويات.", en: "Wound paper tube with a printed wrap label, paper end disc and a short slip-on cap." }],
      ["TUBE_ROLLED_EDGE", "paper-tube-rolled-edge", "rolledEdge", "rolled-edge", { ar: "أسطوانة ورقية بحافة ملفوفة", en: "Rolled-edge paper tube" }, { ar: "أسطوانة ورقية بحواف ملفوفة على فوهة الجسم وأسفل الغطاء لمظهر ناعم ومتانة أعلى.", en: "Tube with curled rims on the body mouth and cap edge for a soft finish and a stronger rim." }],
      ["TUBE_TELESCOPING", "paper-tube-telescoping", "telescoping", "telescoping", { ar: "أسطوانة ورقية تلسكوبية", en: "Telescoping paper tube" }, { ar: "أسطوانة بغطاء طويل ينزلق على معظم طول الجسم، مناسبة للزجاجات والملصقات.", en: "Tube with a deep cap that slides over most of the body; bottles, posters and gift sets." }],
      ["TUBE_PUSH_UP", "paper-tube-push-up", "pushUp", "push-up", { ar: "أسطوانة ورقية بدفع سفلي", en: "Push-up paper tube" }, { ar: "أنبوب ورقي بقاعدة داخلية تدفع المنتج للأعلى، لمرطب الشفاه ومزيل العرق الصلب.", en: "Paper tube with an inner platform pushed up from below; lip balm and solid deodorant." }],
      ["TUBE_WINDOW", "paper-tube-window", "window", "window", { ar: "أسطوانة ورقية بنافذة", en: "Paper tube with window" }, { ar: "أسطوانة ورقية بنافذة مقطوعة في الواجهة ومغطاة بفيلم شفاف لعرض المنتج.", en: "Paper tube with a front window backed by clear film to show the product." }],
      ["TUBE_SHOULDER", "paper-tube-shoulder", "shoulder", "shoulder", { ar: "أسطوانة ورقية بكتف", en: "Shoulder paper tube" }, { ar: "أسطوانة من ثلاث قطع بعنق داخلي بارز وغطاء يستقر على الكتف بمحاذاة الجسم، للعطور والمستحضرات الفاخرة.", en: "Three-piece tube: a proud inner neck and a cap that rests on the shoulder flush with the body." }],
    ] as const
  ).map(([code, slug, variant, sub, name, description]) =>
    defineModel({
      code,
      slug,
      family: "TUBE",
      subFamily: sub,
      standard: "none",
      name,
      description,
      params: variant === "pushUp" ? { L: { min: 18, max: 60 }, W: { min: 18, max: 60 }, H: { min: 50, max: 160 } } : TUBE_LIMITS,
      defaultDims: variant === "pushUp" ? { L: 25, W: 25, H: 70 } : variant === "telescoping" ? { L: 90, W: 90, H: 320 } : { L: 75, W: 75, H: 150 },
      presets:
        variant === "pushUp"
          ? [
              p("lip-balm", "مرطب شفاه", "Lip balm", { L: 20, W: 20, H: 70 }, true),
              p("balm-stick", "بلسم", "Balm stick", { L: 34, W: 34, H: 80 }),
              p("deodorant", "مزيل عرق", "Solid deodorant", { L: 50, W: 50, H: 110 }, true),
            ]
          : variant === "telescoping"
            ? [
                p("wine-bottle", "زجاجة 75 سل", "Bottle 75 cl", { L: 90, W: 90, H: 330 }, true),
                p("poster", "ملصق A2", "Poster A2", { L: 60, W: 60, H: 350 }),
                p("olive-oil", "زيت زيتون 500 مل", "Olive oil 500 ml", { L: 75, W: 75, H: 300 }),
              ]
            : [
                p("tea-75", "شاي قطر 75", "Tea Ø75", { L: 75, W: 75, H: 150 }, true),
                p("coffee-99", "بن قطر 99", "Coffee Ø99", { L: 99, W: 99, H: 200 }, true),
                p("cosmetics-50", "مستحضرات قطر 50", "Cosmetics Ø50", { L: 50, W: 50, H: 120 }),
                p("perfume-60", "عطر قطر 60", "Perfume Ø60", { L: 60, W: 60, H: 160 }),
              ],
      materials: TUBE_BOARDS,
      defaultMaterial: "KRAFT_TUBE",
      features: { ...NO_FEATURES, lidHeight: true, windowFaces: variant === "window" ? ["front"] : [] },
      defaultFeatures: variant === "window" ? { window: { face: "front", film: true, widthRatio: 0.4, heightRatio: 0.7 } } : undefined,
      shape: "cylinder",
      pieces: variant === "shoulder" || variant === "pushUp" ? 3 : 2,
      glued: true,
      uses: variant === "pushUp" ? ["cosmetics"] : ["food", "cosmetics", "gift"],
      baseCode: "PAPER_TUBE",
      rules: [round],
      generator: (d, t, f) => tubeDraft(variant, d, t, f),
      constructionOf: (d, t, f) => tubeConstruction(variant, d, t, f),
    }),
  ),

  /* ───────────── Bulk corrugated ───────────── */
  defineModel({
    code: "PALLET_BOX",
    slug: "pallet-box",
    family: "CORRUGATED",
    subFamily: "bulk",
    standard: "FEFCO 0201",
    name: { ar: "صندوق بالتة", en: "Pallet box" },
    description: {
      ar: "صندوق شحن كبير من الكرتون المضلع المزدوج أو الثلاثي بمقاس البالتة القياسية، للشحنات الصناعية والتصدير.",
      en: "FEFCO 0201 slotted container in double or triple wall, sized to a standard pallet; industrial and export loads.",
    },
    params: { L: { min: 500, max: 1200 }, W: { min: 400, max: 1200 }, H: { min: 300, max: 1200 } },
    defaultDims: { L: 1160, W: 960, H: 800 },
    presets: [
      p("pallet-1200x1000", "بالتة 1200×1000", "Pallet 1200×1000", { L: 1160, W: 960, H: 800 }, true),
      p("pallet-1200x800", "بالتة 1200×800", "Euro pallet 1200×800", { L: 1160, W: 760, H: 700 }, true),
      p("pallet-1100x1100", "بالتة 1100×1100", "Pallet 1100×1100", { L: 1060, W: 1060, H: 800 }),
      p("half-pallet", "نصف بالتة", "Half pallet 800×600", { L: 760, W: 560, H: 500 }),
    ],
    materials: ["BC_FLUTE_KRAFT", "AAA_TRIPLE_KRAFT", "B_FLUTE_KRAFT"],
    defaultMaterial: "BC_FLUTE_KRAFT",
    features: { ...NO_FEATURES, handle: true },
    shape: "box",
    pieces: 1,
    glued: true,
    uses: ["industrial", "shipping"],
    baseCode: "FEFCO_0201",
    generator: palletBox,
  }),
  defineModel({
    code: "PALLET_BOX_LID",
    slug: "pallet-box-telescope-lid",
    family: "CORRUGATED",
    subFamily: "bulk",
    standard: "FEFCO 0320",
    name: { ar: "صندوق بالتة بغطاء تلسكوبي", en: "Pallet box with telescope lid" },
    description: {
      ar: "صندوق بالتة من قطعتين: جسم مفتوح من أعلى وغطاء منفصل ينزلق فوقه، يسهل التعبئة والتفريغ.",
      en: "Two-piece FEFCO 0320 pallet box: an open-top body and a separate telescoping lid for easy filling.",
    },
    params: { L: { min: 500, max: 1200 }, W: { min: 400, max: 1200 }, H: { min: 300, max: 1200 } },
    defaultDims: { L: 1140, W: 940, H: 700 },
    presets: [
      p("pallet-1200x1000", "بالتة 1200×1000", "Pallet 1200×1000", { L: 1140, W: 940, H: 700 }, true),
      p("pallet-1200x800", "بالتة 1200×800", "Euro pallet 1200×800", { L: 1140, W: 740, H: 600 }, true),
      p("half-pallet", "نصف بالتة", "Half pallet 800×600", { L: 740, W: 540, H: 500 }),
    ],
    materials: ["BC_FLUTE_KRAFT", "AAA_TRIPLE_KRAFT"],
    defaultMaterial: "BC_FLUTE_KRAFT",
    features: { ...NO_FEATURES, handle: true, lidHeight: true },
    shape: "box",
    pieces: 2,
    glued: true,
    uses: ["industrial", "shipping"],
    baseCode: "FEFCO_0320",
    generator: palletBoxWithLid,
  }),
  defineModel({
    code: "OCTABIN",
    slug: "octabin",
    family: "CORRUGATED",
    subFamily: "bulk",
    standard: "none",
    name: { ar: "صندوق ثماني الأضلاع", en: "Octabin (octagonal bulk bin)" },
    description: {
      ar: "حاوية كرتون مضلع ثلاثي ثمانية الأضلاع على بالتة للمواد السائبة مثل الحبيبات البلاستيكية والبذور والمكونات الغذائية.",
      en: "Octagonal triple-wall bin on a pallet for bulk granules, seeds and food ingredients.",
    },
    params: { L: { min: 600, max: 1200 }, W: { min: 600, max: 1200 }, H: { min: 500, max: 1300 } },
    defaultDims: { L: 1150, W: 950, H: 1000 },
    presets: [
      p("pallet-1200x1000", "بالتة 1200×1000", "Pallet 1200×1000", { L: 1150, W: 950, H: 1000 }, true),
      p("pallet-1200x800", "بالتة 1200×800", "Euro pallet 1200×800", { L: 1150, W: 750, H: 900 }),
      p("pallet-1100x1100", "بالتة 1100×1100", "Pallet 1100×1100", { L: 1050, W: 1050, H: 1000 }),
    ],
    materials: ["AAA_TRIPLE_KRAFT", "BC_FLUTE_KRAFT"],
    defaultMaterial: "AAA_TRIPLE_KRAFT",
    features: { ...NO_FEATURES, handle: true },
    shape: "octagon",
    pieces: 1,
    glued: true,
    uses: ["industrial", "food", "shipping"],
    baseCode: "FEFCO_0201",
    rules: [{ text: "W >= 0.6 × L", path: "W", test: (d) => d.W >= 0.6 * d.L }],
    generator: octabin,
  }),

  /* ───────────── Envelopes and mailers ───────────── */
  defineModel({
    code: "ENVELOPE_DOCUMENT",
    slug: "document-envelope",
    family: "ENVELOPE",
    subFamily: "envelope",
    standard: "ISO 269",
    name: { ar: "ظرف مستندات", en: "Document envelope" },
    description: {
      ar: "ظرف ورقي بمقاسات ISO القياسية بلسان مستقيم للإغلاق، للمستندات والفواتير والمراسلات.",
      en: "ISO-size paper envelope with a straight seal flap for documents, invoices and letters.",
    },
    params: { L: { min: 90, max: 400 }, W: { min: 0, max: 25 }, H: { min: 90, max: 450 } },
    defaultDims: { L: 229, W: 0, H: 324 },
    presets: [
      p("c4", "C4 لورقة A4", "C4 (A4 flat)", { L: 229, W: 0, H: 324 }, true),
      p("c5", "C5 لورقة A5", "C5 (A5 / A4 folded)", { L: 229, W: 0, H: 162 }, true),
      p("dl", "DL لورقة A4 مطوية", "DL (A4 folded in 3)", { L: 220, W: 0, H: 110 }, true),
      p("b4", "B4 للملفات", "B4 (bulky A4)", { L: 250, W: 0, H: 353 }),
    ],
    materials: ENVELOPE_PAPERS,
    defaultMaterial: "OFFSET_PAPER_100",
    features: NO_FEATURES,
    shape: "flat",
    pieces: 1,
    glued: true,
    uses: ["stationery", "shipping"],
    baseCode: "SLEEVE",
    rules: [flatThin],
    generator: (d, t, f) => envelopeDraft(d, t, f, { side: "flaps", bottomRatio: 0.55, sealDepth: 45, sealShape: "straight" }),
  }),
  defineModel({
    code: "MAILER_BAG",
    slug: "paper-mailer-bag",
    family: "ENVELOPE",
    subFamily: "mailer",
    standard: "none",
    name: { ar: "كيس بريدي ورقي", en: "Paper mailer bag" },
    description: {
      ar: "كيس شحن من ورق الكرافت بلسان لاصق وشريط فتح، بديل ورقي للأكياس البلاستيكية للملابس والمنتجات المسطحة.",
      en: "Kraft paper mailer bag with a self-seal flap and tear strip; a paper alternative to poly mailers.",
    },
    params: { L: { min: 150, max: 500 }, W: { min: 0, max: 40 }, H: { min: 200, max: 600 } },
    defaultDims: { L: 320, W: 20, H: 420 },
    presets: [
      p("small", "صغير", "Small", { L: 250, W: 15, H: 350 }, true),
      p("medium", "متوسط", "Medium", { L: 320, W: 20, H: 420 }, true),
      p("large", "كبير", "Large", { L: 400, W: 30, H: 500 }),
    ],
    materials: ["KRAFT_PAPER_120", "OFFSET_PAPER_100"],
    defaultMaterial: "KRAFT_PAPER_120",
    features: { ...NO_FEATURES, tearStrip: true },
    defaultFeatures: { tearStrip: true },
    shape: "flat",
    pieces: 1,
    glued: true,
    uses: ["ecommerce", "apparel", "shipping"],
    baseCode: "SLEEVE",
    rules: [{ text: "W <= 0.1 × L", path: "W", test: (d) => d.W <= 0.1 * d.L + 1e-9 }],
    generator: (d, t, f) => envelopeDraft(d, t, f, { side: "seams", bottomRatio: 1, sealDepth: 50, sealShape: "straight" }),
  }),
  defineModel({
    code: "PADDED_MAILER",
    slug: "padded-mailer",
    family: "ENVELOPE",
    subFamily: "mailer",
    standard: "none",
    name: { ar: "ظرف مبطن", en: "Padded mailer" },
    description: {
      ar: "ظرف شحن من الكرافت مبطن بوسادة ورقية لحماية الإكسسوارات والكتب والأجهزة الصغيرة، المقاس المذكور داخلي.",
      en: "Kraft mailer with paper cushioning for accessories, books and small devices; sizes are internal.",
    },
    params: { L: { min: 100, max: 400 }, W: { min: 0, max: 30 }, H: { min: 150, max: 500 } },
    defaultDims: { L: 180, W: 10, H: 260 },
    presets: [
      p("a-000", "مقاس A/000", "Size A/000", { L: 110, W: 5, H: 160 }, true),
      p("c-0", "مقاس C/0", "Size C/0", { L: 150, W: 8, H: 210 }, true),
      p("d-1", "مقاس D/1", "Size D/1", { L: 180, W: 10, H: 260 }, true),
      p("f-3", "مقاس F/3", "Size F/3", { L: 220, W: 15, H: 330 }),
    ],
    materials: ["PADDED_KRAFT"],
    defaultMaterial: "PADDED_KRAFT",
    features: NO_FEATURES,
    shape: "flat",
    pieces: 1,
    glued: true,
    uses: ["ecommerce", "shipping"],
    baseCode: "SLEEVE",
    rules: [{ text: "W <= 0.1 × L", path: "W", test: (d) => d.W <= 0.1 * d.L + 1e-9 }],
    // Internal size: the folded padding takes t on each side.
    mapDims: (d, t) => ({ L: d.L + 2 * t, W: d.W, H: d.H + 2 * t }),
    generator: (d, t, f) => envelopeDraft(d, t, f, { side: "seams", bottomRatio: 1, sealDepth: 40, sealShape: "straight" }),
  }),
  defineModel({
    code: "ENVELOPE_CARD",
    slug: "card-envelope",
    family: "ENVELOPE",
    subFamily: "envelope",
    standard: "ISO 269",
    name: { ar: "ظرف بطاقة", en: "Card envelope" },
    description: {
      ar: "ظرف لبطاقات التهنئة والدعوات بلسان مدبب، بمقاسات C6 وDL والمربع الشائع.",
      en: "Greeting card and invitation envelope with a pointed flap; C6, DL and the common square size.",
    },
    params: { L: { min: 90, max: 260 }, W: { min: 0, max: 10 }, H: { min: 90, max: 260 } },
    defaultDims: { L: 162, W: 0, H: 114 },
    presets: [
      p("c6", "C6 لبطاقة A6", "C6 (A6 card)", { L: 162, W: 0, H: 114 }, true),
      p("dl", "DL للدعوات", "DL (invitation)", { L: 220, W: 0, H: 110 }, true),
      p("square-155", "مربع 155", "Square 155", { L: 155, W: 0, H: 155 }),
      p("c5", "C5 لبطاقة A5", "C5 (A5 card)", { L: 229, W: 0, H: 162 }),
    ],
    materials: ENVELOPE_PAPERS,
    defaultMaterial: "CARD_PAPER_160",
    features: NO_FEATURES,
    shape: "flat",
    pieces: 1,
    glued: true,
    uses: ["stationery", "gift"],
    baseCode: "SLEEVE",
    rules: [flatThin],
    generator: (d, t, f) => envelopeDraft(d, t, f, { side: "flaps", bottomRatio: 0.5, sealDepth: Math.min(70, d.H * 0.45), sealShape: "pointed" }),
  }),
];

export const DEFINITION_BY_CODE: Record<string, CatalogueDefinition> = Object.fromEntries(DEFINITIONS.map((d) => [d.code, d]));

export function definitionBySlug(slug: string): CatalogueDefinition | null {
  return DEFINITIONS.find((d) => d.slug === slug) ?? null;
}

export * from "./types";
export { FAMILY_MATERIALS } from "./materials";
export { FamilyValidationError, defineModel, dimsSchemaFor, supported } from "./define";
export { assembleDieline } from "./assemble";
export { printAreas } from "./print";
export { lidAndBase, shoulderBox, bookBox, drawerBox, hingedLidBox, collapsibleBox, wrapTray, rigidConstruction, boardCaliper, turnInFor } from "./rigid";
export { tubeDraft, tubeConstruction } from "./tubes";
export { octabin, octabinChamfer, palletBox, palletBoxWithLid } from "./corrugated";
export { envelopeDraft } from "./envelopes";
