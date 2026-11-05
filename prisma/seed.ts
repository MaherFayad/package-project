/**
 * Dev seed: realistic (fictional) Egyptian sample data.
 * Run: npm run db:seed   (idempotent: wipes and re-creates all rows)
 *
 * Sign-in phones (OTP code is printed to the server console / dev banner):
 *   ADMIN  +201000000001   (01000000001)
 *   BUYER  +201000000002   (01000000002)
 *   VENDOR +201000000010 … +201000000014 (one per vendor, in the order below)
 */
import { PrismaClient } from "@prisma/client";
import type {
  Artwork,
  Dims,
  DimsPreset,
  FinishCode,
  MaterialCode,
  RateTier,
  StructureCode,
  StructureParamLimits,
  VendorCapabilities,
  VendorCertification,
  VendorMachine,
  EgyptCity,
} from "../src/types";
import { canonicalJson, toJson } from "../src/lib/json";
import { STRUCTURES } from "../src/lib/dieline/registry";

const db = new PrismaClient();
const egp = (n: number) => Math.round(n * 100);

// ───────────────────────── Structures ─────────────────────────
interface StructureSeed {
  code: StructureCode;
  slug: string;
  family: "CORRUGATED" | "FOLDING_CARTON" | "RIGID" | "TUBE";
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  /** Reference blank area (m²) used by rate cards, and base tier prices in EGP. */
  refArea: number;
  baseTiers: [number, number, number, number, number];
  dieCost: number;
}

const structures: StructureSeed[] = [
  {
    code: "FEFCO_0427",
    slug: "mailer-box",
    family: "CORRUGATED",
    nameAr: "علبة بريدية",
    nameEn: "Mailer box",
    descriptionAr: "علبة كرتون مضلع بغطاء متصل ولسان أمامي، مثالية لتجربة فتح مميزة للمتاجر الإلكترونية.",
    descriptionEn: "Corrugated roll-end tuck-front mailer, the go-to e-commerce unboxing box.",
    params: { L: { min: 80, max: 600 }, W: { min: 60, max: 450 }, H: { min: 25, max: 250 }, rules: ["H <= W"] },
    defaultDims: { L: 250, W: 180, H: 80 },
    presets: [
      { id: "accessories", name: { ar: "إكسسوارات", en: "Accessories" }, dims: { L: 180, W: 120, H: 50 }, standard: true },
      { id: "tshirt", name: { ar: "تيشيرت", en: "T-shirt" }, dims: { L: 300, W: 220, H: 60 }, standard: true },
      { id: "shoe", name: { ar: "حذاء", en: "Shoe box" }, dims: { L: 330, W: 200, H: 120 }, standard: true },
      { id: "cosmetics-kit", name: { ar: "طقم مستحضرات", en: "Cosmetics kit" }, dims: { L: 250, W: 180, H: 80 } },
    ],
    refArea: 0.25,
    baseTiers: [38, 27, 19, 14, 11],
    dieCost: 1800,
  },
  {
    code: "FEFCO_0201",
    slug: "shipping-box",
    family: "CORRUGATED",
    nameAr: "علبة شحن",
    nameEn: "Shipping box",
    descriptionAr: "علبة شحن كرتون مضلع قياسية بأربعة ألسنة علوية وسفلية، قوية وموفرة.",
    descriptionEn: "Regular slotted container (RSC): the standard, economical corrugated shipping carton.",
    params: { L: { min: 100, max: 800 }, W: { min: 80, max: 600 }, H: { min: 60, max: 800 } },
    defaultDims: { L: 300, W: 200, H: 150 },
    presets: [
      { id: "small", name: { ar: "صغيرة", en: "Small" }, dims: { L: 200, W: 150, H: 100 }, standard: true },
      { id: "medium", name: { ar: "متوسطة", en: "Medium" }, dims: { L: 300, W: 200, H: 150 }, standard: true },
      { id: "large", name: { ar: "كبيرة", en: "Large" }, dims: { L: 400, W: 300, H: 250 }, standard: true },
    ],
    refArea: 0.55,
    baseTiers: [42, 31, 23, 18, 15],
    dieCost: 0,
  },
  {
    code: "ECMA_RTE",
    slug: "reverse-tuck-end",
    family: "FOLDING_CARTON",
    nameAr: "علبة كرتون بلسان عكسي",
    nameEn: "Reverse tuck end carton",
    descriptionAr: "علبة كرتون دوبلكس خفيفة بلسانين في اتجاهين متعاكسين، شائعة لمستحضرات التجميل والعطور.",
    descriptionEn: "Lightweight SBS folding carton with tucks on opposite panels; classic for cosmetics and perfume.",
    params: { L: { min: 30, max: 200 }, W: { min: 20, max: 150 }, H: { min: 40, max: 300 } },
    defaultDims: { L: 60, W: 60, H: 140 },
    presets: [
      { id: "perfume-50ml", name: { ar: "عطر 50 مل", en: "Perfume 50 ml" }, dims: { L: 55, W: 45, H: 130 }, standard: true },
      { id: "perfume-100ml", name: { ar: "عطر 100 مل", en: "Perfume 100 ml" }, dims: { L: 65, W: 55, H: 160 }, standard: true },
      { id: "cream-jar", name: { ar: "برطمان كريم", en: "Cream jar" }, dims: { L: 70, W: 70, H: 70 } },
    ],
    refArea: 0.06,
    baseTiers: [18, 10, 6.5, 4.2, 3.1],
    dieCost: 950,
  },
  {
    code: "ECMA_STE",
    slug: "straight-tuck-end",
    family: "FOLDING_CARTON",
    nameAr: "علبة كرتون بلسان مستقيم",
    nameEn: "Straight tuck end carton",
    descriptionAr: "علبة كرتون دوبلكس بلسانين في نفس الاتجاه لواجهة أمامية نظيفة، مناسبة للأغذية الجافة والهدايا.",
    descriptionEn: "SBS folding carton with both tucks on the same side for a clean front; good for dry food and gifts.",
    params: { L: { min: 30, max: 220 }, W: { min: 20, max: 160 }, H: { min: 40, max: 300 } },
    defaultDims: { L: 90, W: 50, H: 150 },
    presets: [
      { id: "tea", name: { ar: "علبة شاي", en: "Tea box" }, dims: { L: 90, W: 60, H: 140 }, standard: true },
      { id: "soap", name: { ar: "صابون", en: "Soap bar" }, dims: { L: 95, W: 35, H: 65 }, standard: true },
    ],
    refArea: 0.07,
    baseTiers: [19, 11, 7, 4.5, 3.3],
    dieCost: 950,
  },
  {
    code: "PIZZA",
    slug: "pizza-box",
    family: "CORRUGATED",
    nameAr: "علبة بيتزا",
    nameEn: "Pizza box",
    descriptionAr: "علبة بيتزا كرتون مضلع آمنة للأغذية مع فتحات تهوية اختيارية.",
    descriptionEn: "Food-safe corrugated pizza box (FEFCO 0426 style).",
    params: { L: { min: 200, max: 500 }, W: { min: 200, max: 500 }, H: { min: 30, max: 60 }, rules: ["L == W"] },
    defaultDims: { L: 300, W: 300, H: 40 },
    presets: [
      { id: "pizza-25", name: { ar: "بيتزا 25 سم", en: "Pizza 25 cm" }, dims: { L: 260, W: 260, H: 40 }, standard: true },
      { id: "pizza-30", name: { ar: "بيتزا 30 سم", en: "Pizza 30 cm" }, dims: { L: 310, W: 310, H: 40 }, standard: true },
      { id: "pizza-35", name: { ar: "بيتزا 35 سم", en: "Pizza 35 cm" }, dims: { L: 360, W: 360, H: 45 }, standard: true },
    ],
    refArea: 0.36,
    baseTiers: [22, 15, 11, 8.5, 7],
    dieCost: 1200,
  },
  {
    code: "SLEEVE",
    slug: "sleeve",
    family: "FOLDING_CARTON",
    nameAr: "غلاف منزلق",
    nameEn: "Sleeve",
    descriptionAr: "غلاف كرتون مطبوع ينزلق حول علبة أو منتج، طريقة اقتصادية لإضافة علامتك التجارية.",
    descriptionEn: "Printed board sleeve that slides over a box or tray: an economical way to brand stock packaging.",
    params: { L: { min: 60, max: 450 }, W: { min: 40, max: 350 }, H: { min: 20, max: 200 } },
    defaultDims: { L: 220, W: 150, H: 60 },
    presets: [
      { id: "dessert-tray", name: { ar: "علبة حلويات", en: "Dessert tray" }, dims: { L: 220, W: 150, H: 60 }, standard: true },
      { id: "meal-box", name: { ar: "علبة وجبة", en: "Meal box" }, dims: { L: 230, W: 160, H: 70 } },
    ],
    refArea: 0.08,
    baseTiers: [12, 7, 4.5, 3, 2.3],
    dieCost: 600,
  },
];

// Structure-library styles: catalogue facts come from the dieline registry
// (src/lib/dieline/registry.ts); only the sample rate-card economics live here.
const LIBRARY_PRICING: Partial<Record<StructureCode, Pick<StructureSeed, "refArea" | "baseTiers" | "dieCost">>> = {
  FEFCO_0320: { refArea: 0.56, baseTiers: [55, 40, 29, 22, 18], dieCost: 0 },
  ECMA_CLB: { refArea: 0.12, baseTiers: [22, 13, 8.5, 5.6, 4.2], dieCost: 1100 },
  ECMA_SLB: { refArea: 0.08, baseTiers: [19, 11, 7, 4.6, 3.4], dieCost: 1000 },
  FEFCO_0422: { refArea: 0.38, baseTiers: [26, 18, 13, 10, 8], dieCost: 1300 },
  GABLE_BOX: { refArea: 0.16, baseTiers: [24, 15, 10, 7, 5.5], dieCost: 1300 },
  PAPER_TUBE: { refArea: 0.09, baseTiers: [60, 42, 30, 24, 20], dieCost: 0 },
  RIGID_BOX: { refArea: 0.27, baseTiers: [140, 105, 80, 65, 55], dieCost: 700 },
};
for (const [code, money] of Object.entries(LIBRARY_PRICING) as [StructureCode, Pick<StructureSeed, "refArea" | "baseTiers" | "dieCost">][]) {
  const def = STRUCTURES[code];
  structures.push({
    code,
    slug: def.slug,
    family: def.family,
    nameAr: def.name.ar,
    nameEn: def.name.en,
    descriptionAr: def.description.ar,
    descriptionEn: def.description.en,
    params: def.params,
    defaultDims: def.defaultDims,
    presets: def.presets,
    ...money,
  });
}

// ───────────────────────── Materials & finishes ─────────────────────────
const materials = [
  { code: "E_FLUTE_KRAFT", family: "CORRUGATED", boardType: "CORRUGATED", flute: "E", color: "KRAFT", gsm: 380, thicknessMm: 1.5, nameAr: "كرتون مضلع E كرافت", nameEn: "E-flute kraft", foodSafe: false, mult: 1 },
  { code: "E_FLUTE_WHITE", family: "CORRUGATED", boardType: "CORRUGATED", flute: "E", color: "WHITE", gsm: 400, thicknessMm: 1.5, nameAr: "كرتون مضلع E أبيض", nameEn: "E-flute white", foodSafe: true, mult: 1.15 },
  { code: "B_FLUTE_KRAFT", family: "CORRUGATED", boardType: "CORRUGATED", flute: "B", color: "KRAFT", gsm: 450, thicknessMm: 3, nameAr: "كرتون مضلع B كرافت", nameEn: "B-flute kraft", foodSafe: false, mult: 1.2 },
  { code: "SBS_300", family: "FOLDING_CARTON", boardType: "SBS", flute: null, color: "WHITE", gsm: 300, thicknessMm: 0.4, nameAr: "كرتون دوبلكس SBS 300 جم", nameEn: "SBS board 300 gsm", foodSafe: true, mult: 1 },
  { code: "SBS_350", family: "FOLDING_CARTON", boardType: "SBS", flute: null, color: "WHITE", gsm: 350, thicknessMm: 0.48, nameAr: "كرتون دوبلكس SBS 350 جم", nameEn: "SBS board 350 gsm", foodSafe: true, mult: 1.12 },
  { code: "GREYBOARD_WRAP", family: "RIGID", boardType: "GREYBOARD", flute: null, color: "WHITE", gsm: 1360, thicknessMm: 2.15, nameAr: "كرتون رمادي 2 مم بورق تغليف مطبوع", nameEn: "Greyboard 2 mm, printed wrap", foodSafe: false, mult: 1 },
  { code: "KRAFT_TUBE", family: "TUBE", boardType: "TUBE", flute: null, color: "WHITE", gsm: 950, thicknessMm: 1.5, nameAr: "أنبوب كرافت 1.5 مم بملصق مطبوع", nameEn: "Kraft tube 1.5 mm, printed label", foodSafe: true, mult: 1 },
] as const;

const finishes = [
  { code: "NONE", nameAr: "بدون تشطيب", nameEn: "No finish", unit: 0, setup: 0 },
  { code: "MATTE_LAMINATION", nameAr: "سلوفان مطفي", nameEn: "Matte lamination", unit: 0.9, setup: 250 },
  { code: "GLOSS_LAMINATION", nameAr: "سلوفان لامع", nameEn: "Gloss lamination", unit: 0.8, setup: 250 },
  { code: "SPOT_UV", nameAr: "يو في موضعي", nameEn: "Spot UV", unit: 1.6, setup: 900 },
] as const;

// ───────────────────────── Vendors ─────────────────────────
interface VendorSeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  city: EgyptCity;
  cityAr: string;
  cityEn: string;
  bioAr: string;
  bioEn: string;
  machines: VendorMachine[];
  capabilities: VendorCapabilities;
  certifications: VendorCertification[];
  rating: number;
  ratingCount: number;
  onTimePct: number;
  leadTimeDays: number;
  minOrderQty: number;
  serviceAreas: EgyptCity[];
  priceMult: number;
  portfolio: { captionAr: string; captionEn: string; structureCode: StructureCode }[];
}

const allFinishes: FinishCode[] = ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION", "SPOT_UV"];
const corr: MaterialCode[] = ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"];
const fc: MaterialCode[] = ["SBS_300", "SBS_350"];

const vendors: VendorSeed[] = [
  {
    slug: "nile-pack",
    nameAr: "نايل باك للطباعة والتغليف",
    nameEn: "Nile Pack Printing & Packaging",
    city: "SIXTH_OF_OCTOBER", cityAr: "السادس من أكتوبر", cityEn: "6th of October",
    bioAr: "مصنع متكامل للكرتون المضلع منذ 2009 في المنطقة الصناعية الثالثة بأكتوبر. نخدم المتاجر الإلكترونية والعلامات الناشئة بكميات تبدأ من 100 علبة.",
    bioEn: "Integrated corrugated plant in October's 3rd Industrial Zone since 2009. We serve e-commerce shops and young brands from 100 boxes.",
    machines: [
      { kind: "FLEXO", model: "Flexo 4-colour printer-slotter", count: 1 },
      { kind: "DIGITAL", model: "Single-pass digital corrugated press", count: 1 },
      { kind: "DIE_CUTTER", model: "Bobst SP 102 die-cutter", count: 1 },
      { kind: "FOLDER_GLUER", model: "Automatic folder-gluer", count: 1 },
    ],
    capabilities: { structures: ["FEFCO_0427", "FEFCO_0201", "PIZZA", "FEFCO_0320", "FEFCO_0422"], materials: corr, finishes: ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION"], maxColors: 4, digitalShortRun: true, monthlyCapacityUnits: 400_000 },
    certifications: [{ code: "ISO_9001", issuer: "Bureau Veritas", validUntil: "2027-06-30" }],
    rating: 4.7, ratingCount: 128, onTimePct: 96, leadTimeDays: 6, minOrderQty: 100,
    serviceAreas: ["CAIRO", "GIZA", "SIXTH_OF_OCTOBER", "ALEXANDRIA"],
    priceMult: 1.0,
    portfolio: [
      { captionAr: "علب بريدية لعلامة ملابس محلية، طباعة لونين", captionEn: "Mailer boxes for a local fashion label, 2-colour print", structureCode: "FEFCO_0427" },
      { captionAr: "علب شحن كرافت بشعار بلون واحد", captionEn: "Kraft shipping boxes with a one-colour logo", structureCode: "FEFCO_0201" },
      { captionAr: "علب هدايا رمضان لشركة اتصالات", captionEn: "Ramadan gift boxes for a telecom company", structureCode: "FEFCO_0427" },
    ],
  },
  {
    slug: "delta-cartons",
    nameAr: "دلتا كرتون",
    nameEn: "Delta Cartons",
    city: "TENTH_OF_RAMADAN", cityAr: "العاشر من رمضان", cityEn: "10th of Ramadan",
    bioAr: "مطبعة أوفست متخصصة في علب الكرتون الدوبلكس لمستحضرات التجميل والأدوية والأغذية، بخطوط إنتاج معتمدة للتعامل مع الأغذية.",
    bioEn: "Offset printer specialising in SBS folding cartons for cosmetics, pharma and food, with food-contact certified lines.",
    machines: [
      { kind: "OFFSET", model: "Heidelberg Speedmaster SM 102 (5 colours + coater)", count: 2 },
      { kind: "DIE_CUTTER", model: "Bobst Novacut", count: 1 },
      { kind: "FOLDER_GLUER", model: "Bobst Expertfold", count: 1 },
      { kind: "UV_COATER", model: "Spot UV screen coater", count: 1 },
      { kind: "LAMINATOR", model: "Thermal laminator", count: 1 },
    ],
    capabilities: { structures: ["ECMA_RTE", "ECMA_STE", "SLEEVE", "ECMA_CLB", "ECMA_SLB", "GABLE_BOX"], materials: fc, finishes: allFinishes, maxColors: 5, digitalShortRun: false, monthlyCapacityUnits: 1_500_000 },
    certifications: [
      { code: "FOOD_SAFE", issuer: "NFSA", validUntil: "2027-03-31" },
      { code: "ISO_22000", issuer: "TÜV", validUntil: "2027-09-30" },
    ],
    rating: 4.8, ratingCount: 94, onTimePct: 93, leadTimeDays: 9, minOrderQty: 250,
    serviceAreas: ["CAIRO", "GIZA", "TENTH_OF_RAMADAN", "OBOUR"],
    priceMult: 1.06,
    portfolio: [
      { captionAr: "علب عطور بسلوفان مطفي ويو في موضعي", captionEn: "Perfume cartons with matte lamination and spot UV", structureCode: "ECMA_RTE" },
      { captionAr: "علب شاي بطباعة أربعة ألوان", captionEn: "Tea cartons, 4-colour print", structureCode: "ECMA_STE" },
      { captionAr: "أغلفة منزلقة لعلب حلويات", captionEn: "Sleeves for dessert trays", structureCode: "SLEEVE" },
    ],
  },
  {
    slug: "obour-box-works",
    nameAr: "العبور لصناعة العلب",
    nameEn: "Obour Box Works",
    city: "OBOUR", cityAr: "العبور", cityEn: "Obour",
    bioAr: "ورشة رقمية سريعة للكميات الصغيرة والعينات، مع طباعة رقمية عالية الجودة على الكرتون المضلع والدوبلكس.",
    bioEn: "Fast digital shop for short runs and samples, printing on both corrugated and SBS board.",
    machines: [
      { kind: "DIGITAL", model: "HP Indigo-class digital press", count: 1 },
      { kind: "DIGITAL", model: "Flatbed UV printer", count: 2 },
      { kind: "DIE_CUTTER", model: "Digital cutting table", count: 2 },
    ],
    capabilities: { structures: ["FEFCO_0427", "ECMA_RTE", "ECMA_STE", "SLEEVE", "ECMA_SLB", "GABLE_BOX", "RIGID_BOX", "PAPER_TUBE"], materials: ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "SBS_300", "SBS_350", "GREYBOARD_WRAP", "KRAFT_TUBE"], finishes: ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION"], maxColors: 4, digitalShortRun: true, monthlyCapacityUnits: 60_000 },
    certifications: [],
    rating: 4.5, ratingCount: 61, onTimePct: 98, leadTimeDays: 4, minOrderQty: 50,
    serviceAreas: ["CAIRO", "GIZA", "OBOUR"],
    priceMult: 1.12,
    portfolio: [
      { captionAr: "عينات علب بريدية لعلامة شموع", captionEn: "Sample mailer boxes for a candle brand", structureCode: "FEFCO_0427" },
      { captionAr: "علب كريمات بكمية 150 قطعة", captionEn: "Cream cartons, 150-piece run", structureCode: "ECMA_RTE" },
      { captionAr: "أغلفة مطبوعة لعلب صابون يدوي", captionEn: "Printed sleeves for handmade soap", structureCode: "SLEEVE" },
    ],
  },
  {
    slug: "alex-print-house",
    nameAr: "دار الإسكندرية للطباعة",
    nameEn: "Alex Print House",
    city: "ALEXANDRIA", cityAr: "الإسكندرية", cityEn: "Alexandria",
    bioAr: "مطبعة عائلية في برج العرب تجمع بين الأوفست والكرتون المضلع، وتخدم المطاعم والمخابز في الإسكندرية والساحل.",
    bioEn: "Family-run printer in Borg El Arab combining offset and corrugated, serving restaurants and bakeries in Alexandria and the North Coast.",
    machines: [
      { kind: "OFFSET", model: "KBA Rapida 105 (4 colours)", count: 1 },
      { kind: "FLEXO", model: "2-colour flexo printer", count: 1 },
      { kind: "DIE_CUTTER", model: "Automatic platen die-cutter", count: 2 },
      { kind: "LAMINATOR", model: "Water-based laminator", count: 1 },
    ],
    capabilities: { structures: ["PIZZA", "FEFCO_0201", "FEFCO_0427", "ECMA_STE", "FEFCO_0422", "ECMA_CLB"], materials: ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT", "SBS_300"], finishes: ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION"], maxColors: 4, digitalShortRun: false, monthlyCapacityUnits: 300_000 },
    certifications: [{ code: "FOOD_SAFE", issuer: "NFSA", validUntil: "2027-01-31" }],
    rating: 4.4, ratingCount: 77, onTimePct: 89, leadTimeDays: 8, minOrderQty: 250,
    serviceAreas: ["ALEXANDRIA", "CAIRO"],
    priceMult: 0.94,
    portfolio: [
      { captionAr: "علب بيتزا لسلسلة مطاعم في الإسكندرية", captionEn: "Pizza boxes for an Alexandria restaurant chain", structureCode: "PIZZA" },
      { captionAr: "علب حلويات بطباعة لونين", captionEn: "Pastry boxes, 2-colour print", structureCode: "ECMA_STE" },
      { captionAr: "علب شحن لمصنع ملابس", captionEn: "Shipping cartons for a garment factory", structureCode: "FEFCO_0201" },
    ],
  },
  {
    slug: "damietta-packaging",
    nameAr: "دمياط للتغليف الحديث",
    nameEn: "Damietta Modern Packaging",
    city: "NEW_DAMIETTA", cityAr: "دمياط الجديدة", cityEn: "New Damietta",
    bioAr: "متخصصون في علب الشحن الكبيرة وعلب الأثاث والتصدير من الكرتون المضلع B، بأسعار تنافسية للكميات الكبيرة.",
    bioEn: "Specialists in large B-flute shipping and export cartons for furniture makers, competitive on volume.",
    machines: [
      { kind: "FLEXO", model: "3-colour flexo folder-gluer inline", count: 1 },
      { kind: "DIE_CUTTER", model: "Rotary die-cutter", count: 1 },
      { kind: "FOLDER_GLUER", model: "Semi-automatic folder-gluer", count: 1 },
    ],
    capabilities: { structures: ["FEFCO_0201", "FEFCO_0427", "FEFCO_0320"], materials: ["E_FLUTE_KRAFT", "B_FLUTE_KRAFT"], finishes: ["NONE"], maxColors: 3, digitalShortRun: false, monthlyCapacityUnits: 800_000 },
    certifications: [{ code: "FSC", issuer: "FSC (supplier chain)", validUntil: "2026-12-31" }],
    rating: 4.2, ratingCount: 39, onTimePct: 87, leadTimeDays: 10, minOrderQty: 500,
    serviceAreas: ["NEW_DAMIETTA", "CAIRO", "ALEXANDRIA"],
    priceMult: 0.9,
    portfolio: [
      { captionAr: "علب تصدير أثاث بكرتون B", captionEn: "B-flute furniture export cartons", structureCode: "FEFCO_0201" },
      { captionAr: "علب بريدية كرافت بلون واحد", captionEn: "One-colour kraft mailers", structureCode: "FEFCO_0427" },
      { captionAr: "علب شحن مطبوعة لمصنع أحذية", captionEn: "Printed shipping boxes for a shoe factory", structureCode: "FEFCO_0201" },
    ],
  },
];

const QTY = [100, 250, 500, 1000, 2000];

async function wipe() {
  // Children first (FK order).
  await db.review.deleteMany();
  await db.dispute.deleteMany();
  await db.invoice.deleteMany();
  await db.payout.deleteMany();
  await db.payment.deleteMany();
  await db.shipment.deleteMany();
  await db.qcPhoto.deleteMany();
  await db.productionEvent.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.quote.deleteMany();
  await db.proof.deleteMany();
  await db.design.deleteMany();
  await db.rateCard.deleteMany();
  await db.vendorPortfolioItem.deleteMany();
  await db.session.deleteMany();
  await db.consent.deleteMany();
  await db.otpCode.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();
  await db.vendorApplication.deleteMany(); // vendor portal onboarding
  await db.dataRequest.deleteMany(); // added by admin: rows point at users recreated below
  await db.auditLog.deleteMany(); // added by admin
  await db.platformSetting.deleteMany(); // added by admin
  await db.vendor.deleteMany();
  await db.finish.deleteMany();
  await db.material.deleteMany();
  await db.structure.deleteMany();
}

async function main() {
  await wipe();

  const structureRows = new Map<StructureCode, { id: string; seed: StructureSeed }>();
  for (const [i, s] of structures.entries()) {
    const row = await db.structure.create({
      data: {
        code: s.code, slug: s.slug, family: s.family, nameAr: s.nameAr, nameEn: s.nameEn,
        descriptionAr: s.descriptionAr, descriptionEn: s.descriptionEn,
        params: s.params as object, defaultDims: s.defaultDims as object, presets: s.presets as object[],
        sortOrder: i,
      },
    });
    structureRows.set(s.code, { id: row.id, seed: s });
  }

  const materialRows = new Map<MaterialCode, { id: string; mult: number; family: string }>();
  for (const [i, m] of materials.entries()) {
    const { mult, ...data } = m;
    const row = await db.material.create({ data: { ...data, sortOrder: i } });
    materialRows.set(m.code, { id: row.id, mult, family: m.family });
  }

  for (const [i, f] of finishes.entries()) {
    await db.finish.create({
      data: { code: f.code, nameAr: f.nameAr, nameEn: f.nameEn, unitSurchargePiasters: egp(f.unit), setupPiasters: egp(f.setup), sortOrder: i },
    });
  }

  const vendorIds: string[] = [];
  for (const v of vendors) {
    const row = await db.vendor.create({
      data: {
        slug: v.slug, nameAr: v.nameAr, nameEn: v.nameEn, city: v.city, cityAr: v.cityAr, cityEn: v.cityEn,
        bioAr: v.bioAr, bioEn: v.bioEn,
        logoUrl: `/seed/vendors/${v.slug}.svg`,
        coverUrl: `/seed/portfolio/${v.slug}-1.svg`,
        machines: v.machines as object[], capabilities: v.capabilities as object, certifications: v.certifications as object[],
        foodSafe: v.certifications.some((c) => c.code === "FOOD_SAFE"),
        rating: v.rating, ratingCount: v.ratingCount, onTimePct: v.onTimePct, leadTimeDays: v.leadTimeDays,
        minOrderQty: v.minOrderQty, serviceAreas: v.serviceAreas, verified: true, status: "ACTIVE",
        portfolio: {
          create: v.portfolio.map((p, i) => ({ ...p, imageUrl: `/seed/portfolio/${v.slug}-${i + 1}.svg`, sortOrder: i })),
        },
      },
    });
    vendorIds.push(row.id);

    for (const sc of v.capabilities.structures) {
      const st = structureRows.get(sc)!;
      for (const mc of v.capabilities.materials) {
        const mat = materialRows.get(mc)!;
        if (mat.family !== st.seed.family) continue;
        const tiers: RateTier[] = QTY.map((q, i) => ({
          minQty: q,
          unitPiasters: egp(st.seed.baseTiers[i] * mat.mult * v.priceMult),
        }));
        const finishSurcharges: Partial<Record<FinishCode, number>> = {};
        for (const f of v.capabilities.finishes) {
          const base = finishes.find((x) => x.code === f)!;
          finishSurcharges[f] = egp(base.unit * v.priceMult);
        }
        await db.rateCard.create({
          data: {
            vendorId: row.id, structureId: st.id, materialId: mat.id,
            qtyTiers: tiers as object[], referenceAreaM2: st.seed.refArea,
            setupPiasters: egp(st.seed.family === "CORRUGATED" ? 600 : 450),
            dieCostPiasters: egp(st.seed.dieCost * v.priceMult),
            printSidesSurchargePct: 35,
            finishSurcharges, leadTimeDays: v.leadTimeDays,
          },
        });
      }
    }
  }

  // ── Users
  const now = new Date();
  await db.user.create({
    data: { phone: "+201000000001", name: "Elba Ops Admin", role: "ADMIN", locale: "ar", consentAt: now },
  });
  const org = await db.organization.create({ data: { name: "Bloom Candles", city: "CAIRO" } });
  const buyer = await db.user.create({
    data: {
      phone: "+201000000002", name: "منى عادل", role: "BUYER", locale: "ar",
      organizationId: org.id, marketingConsent: true, consentAt: now,
      consents: {
        create: [
          { kind: "TERMS", granted: true, textVersion: "2026-11-05", locale: "ar" },
          { kind: "PRIVACY", granted: true, textVersion: "2026-11-05", locale: "ar" },
          { kind: "MARKETING", granted: true, textVersion: "2026-11-05", locale: "ar" },
        ],
      },
    },
  });
  for (const [i, vid] of vendorIds.entries()) {
    await db.user.create({
      data: {
        phone: `+2010000000${10 + i}`, name: `${vendors[i].nameEn} staff`, role: "VENDOR",
        locale: "ar", vendorId: vid, consentAt: now,
      },
    });
  }

  // ── A sample saved design + one in-production order (Nile Pack) for portal/admin screens
  const mailer = structureRows.get("FEFCO_0427")!;
  const artwork: Artwork = {
    outside: {
      background: "#1f3d2b",
      layers: [
        {
          id: "txt-1", kind: "text", face: "top", surface: "outside", x: 125, y: 90, width: 180, height: 40,
          rotation: 0, text: "Bloom Candles", fontFamily: "Inter", fontSizePt: 28, fontWeight: 700,
          color: "#f2c14e", align: "center", direction: "ltr",
        },
      ],
    },
    inside: { background: null, layers: [] },
  };
  const design = await db.design.create({
    data: {
      ownerId: buyer.id, name: "Bloom mailer", structureCode: "FEFCO_0427", dims: mailer.seed.defaultDims as object,
      materialId: materialRows.get("E_FLUTE_KRAFT")!.id, finishCode: "MATTE_LAMINATION", printSides: "OUTSIDE",
      artwork: artwork as object, thumbnailUrl: "/seed/portfolio/nile-pack-1.svg",
    },
  });
  const snapshot = {
    v: 1, id: design.id, name: design.name, structureCode: "FEFCO_0427", dims: mailer.seed.defaultDims,
    materialCode: "E_FLUTE_KRAFT", finishCode: "MATTE_LAMINATION", printSides: "OUTSIDE", artwork,
  };
  const { createHash } = await import("node:crypto");
  const proof = await db.proof.create({
    data: {
      designId: design.id, snapshot: toJson(snapshot), hash: createHash("sha256").update(canonicalJson(snapshot)).digest("hex"),
      approvedAt: now, approvedIp: "127.0.0.1", approvedById: buyer.id,
    },
  });

  const qty = 500;
  const unit = egp(19 * 1.0 * 1.3); // sell price incl. margin, ex-VAT
  const subtotal = unit * qty + egp(600);
  const vat = Math.round(subtotal * 0.14);
  const shipping = egp(150);
  const order = await db.order.create({
    data: {
      number: "ELB-26001", buyerId: buyer.id, vendorId: vendorIds[0], status: "IN_PRODUCTION",
      subtotalPiasters: subtotal, vatPiasters: vat, shippingPiasters: shipping, totalPiasters: subtotal + vat + shipping,
      vendorCostPiasters: egp(19) * qty + egp(600),
      shippingAddress: { name: "منى عادل", phone: "+201000000002", governorate: "Cairo", city: "Nasr City", street: "14 Abbas El Akkad St", building: "14", floor: "3", apartment: "7" },
      paidAt: now, dueDate: new Date(now.getTime() + 6 * 86_400_000),
      items: {
        create: [{
          proofId: proof.id, structureCode: "FEFCO_0427", dims: mailer.seed.defaultDims as object, materialCode: "E_FLUTE_KRAFT",
          finishCode: "MATTE_LAMINATION", printSides: "OUTSIDE", quantity: qty, unitPiasters: unit, lineTotalPiasters: unit * qty,
        }],
      },
      productionEvents: {
        create: [
          { type: "ORDER_PLACED", createdAt: new Date(now.getTime() - 3 * 3600_000) },
          { type: "PROOF_APPROVED", createdAt: new Date(now.getTime() - 3 * 3600_000) },
          { type: "PAYMENT_CONFIRMED", createdAt: new Date(now.getTime() - 2 * 3600_000) },
          { type: "VENDOR_ACCEPTED", createdAt: new Date(now.getTime() - 3600_000) },
          { type: "PRODUCTION_STARTED" },
        ],
      },
      payments: { create: [{ provider: "mock", method: "CARD", status: "PAID", amountPiasters: subtotal + vat + shipping, providerRef: "mock_txn_0001" }] },
      invoices: { create: [{ number: "INV-26001", subtotalPiasters: subtotal, vatPiasters: vat, totalPiasters: subtotal + vat }] },
    },
  });
  await db.payout.create({
    data: { vendorId: vendorIds[0], orderId: order.id, kind: "ADVANCE", amountPiasters: Math.round((egp(19) * qty + egp(600)) * 0.4), status: "PAID", approvedAt: now, paidAt: now },
  });

  // ── Vendor portal sample jobs (added by vendor portal): one job per state the portal shows.
  //    ELB-26201 Delta Cartons, paid and awaiting acceptance (used by e2e/vendor.spec.ts, which resets it).
  //    ELB-26202 Nile Pack, paid and awaiting acceptance.  ELB-26203 Nile Pack, delivered (balance waits on e-invoice).
  {
    const shippingBox = structureRows.get("FEFCO_0201")!;
    const portalJobs = [
      { number: "ELB-26201", vendor: 1, status: "PAID", structure: "FEFCO_0201" as const, material: "B_FLUTE_KRAFT" as const, finish: "NONE" as const, qty: 250, unitEgp: 24, costEgp: 18, dueDays: 9, placedH: -5 },
      { number: "ELB-26202", vendor: 0, status: "PAID", structure: "FEFCO_0427" as const, material: "E_FLUTE_WHITE" as const, finish: "GLOSS_LAMINATION" as const, qty: 1000, unitEgp: 21, costEgp: 15.5, dueDays: 2, placedH: -20 },
      { number: "ELB-26203", vendor: 0, status: "DELIVERED", structure: "FEFCO_0427" as const, material: "E_FLUTE_KRAFT" as const, finish: "NONE" as const, qty: 250, unitEgp: 26, costEgp: 19.5, dueDays: -12, placedH: -24 * 20 },
    ];
    for (const j of portalJobs) {
      const st = j.structure === "FEFCO_0201" ? shippingBox : mailer;
      const placed = new Date(now.getTime() + j.placedH * 3600_000);
      const doc = {
        v: 1, name: `${j.number} box`, structureCode: j.structure, dims: st.seed.defaultDims,
        materialCode: j.material, finishCode: j.finish, printSides: "OUTSIDE", artwork,
      };
      const d = await db.design.create({
        data: {
          ownerId: buyer.id, name: doc.name, structureCode: j.structure, dims: st.seed.defaultDims as object,
          materialId: materialRows.get(j.material)!.id, finishCode: j.finish, printSides: "OUTSIDE", artwork: artwork as object,
        },
      });
      const snap = { ...doc, id: d.id };
      const pr = await db.proof.create({
        data: {
          designId: d.id, snapshot: toJson(snap), hash: createHash("sha256").update(canonicalJson(snap)).digest("hex"),
          approvedAt: placed, approvedIp: "127.0.0.1", approvedById: buyer.id,
        },
      });
      const sub = egp(j.unitEgp) * j.qty;
      const ship = egp(120);
      const vat = Math.round((sub + ship) * 0.14);
      const cost = egp(j.costEgp) * j.qty;
      const o = await db.order.create({
        data: {
          number: j.number, buyerId: buyer.id, vendorId: vendorIds[j.vendor], status: j.status,
          subtotalPiasters: sub + ship, vatPiasters: vat, shippingPiasters: ship, totalPiasters: sub + ship + vat, vendorCostPiasters: cost,
          shippingAddress: { name: "منى عادل", phone: "+201000000002", governorate: "Giza", city: "Dokki", street: "5 Mesaha Sq" },
          placedAt: placed, paidAt: new Date(placed.getTime() + 600_000),
          dueDate: new Date(now.getTime() + j.dueDays * 86_400_000),
          deliveredAt: j.status === "DELIVERED" ? new Date(now.getTime() - 10 * 86_400_000) : null,
          items: {
            create: [{
              proofId: pr.id, structureCode: j.structure, dims: st.seed.defaultDims as object, materialCode: j.material,
              finishCode: j.finish, printSides: "OUTSIDE", quantity: j.qty, unitPiasters: egp(j.unitEgp), lineTotalPiasters: sub,
            }],
          },
          productionEvents: {
            create: [
              { type: "ORDER_PLACED", createdAt: placed },
              { type: "PROOF_APPROVED", createdAt: placed },
              { type: "PAYMENT_CONFIRMED", createdAt: new Date(placed.getTime() + 600_000) },
              ...(j.status === "DELIVERED"
                ? [
                    { type: "VENDOR_ACCEPTED", createdAt: new Date(placed.getTime() + 3 * 3600_000) },
                    { type: "PRODUCTION_STARTED", createdAt: new Date(placed.getTime() + 24 * 3600_000) },
                    { type: "QC_UPLOADED", createdAt: new Date(placed.getTime() + 5 * 86_400_000) },
                    { type: "QC_APPROVED", createdAt: new Date(placed.getTime() + 5.2 * 86_400_000) },
                    { type: "SHIPPED", createdAt: new Date(placed.getTime() + 6 * 86_400_000) },
                    { type: "DELIVERED", createdAt: new Date(placed.getTime() + 7 * 86_400_000) },
                  ]
                : []),
            ],
          },
          payments: { create: [{ provider: "mock", method: "CARD", status: "PAID", amountPiasters: sub + ship + vat, providerRef: `mock_${j.number}` }] },
        },
      });
      if (j.status === "DELIVERED") {
        const adv = Math.round(cost * 0.4);
        await db.payout.create({ data: { vendorId: vendorIds[j.vendor], orderId: o.id, kind: "ADVANCE", amountPiasters: adv, status: "PAID", approvedAt: placed, paidAt: placed } });
        await db.payout.create({ data: { vendorId: vendorIds[j.vendor], orderId: o.id, kind: "BALANCE", amountPiasters: cost - adv, status: "PENDING" } });
      }
    }
  }

  // ── Admin sample data (added by admin): one job waiting for QC review, an open dispute on the
  //    delivered job ELB-26203, a pending vendor application and an open PDPL data request.
  //    e2e/admin.spec.ts resets ELB-26301 before it runs.
  {
    const qcVendor = vendors[2];
    const placed = new Date(now.getTime() - 6 * 86_400_000);
    const qty = 500;
    const sub = egp(17) * qty;
    const ship = egp(150);
    const vat = Math.round((sub + ship) * 0.14);
    const qcDesign = await db.design.create({
      data: {
        ownerId: buyer.id, name: "ELB-26301 box", structureCode: "FEFCO_0427", dims: mailer.seed.defaultDims as object,
        materialId: materialRows.get("E_FLUTE_KRAFT")!.id, finishCode: "NONE", printSides: "OUTSIDE", artwork: artwork as object,
      },
    });
    const qcSnap = { v: 1, id: qcDesign.id, name: qcDesign.name, structureCode: "FEFCO_0427", dims: mailer.seed.defaultDims, materialCode: "E_FLUTE_KRAFT", finishCode: "NONE", printSides: "OUTSIDE", artwork };
    const qcProof = await db.proof.create({
      data: { designId: qcDesign.id, snapshot: toJson(qcSnap), hash: createHash("sha256").update(canonicalJson(qcSnap)).digest("hex"), approvedAt: placed, approvedIp: "127.0.0.1", approvedById: buyer.id },
    });
    await db.order.create({
      data: {
        number: "ELB-26301", buyerId: buyer.id, vendorId: vendorIds[2], status: "QC_PENDING",
        subtotalPiasters: sub + ship, vatPiasters: vat, shippingPiasters: ship, totalPiasters: sub + ship + vat, vendorCostPiasters: egp(12.5) * qty,
        shippingAddress: { name: "منى عادل", phone: "+201000000002", governorate: "Cairo", city: "Nasr City", street: "12 Makram Ebeid" },
        placedAt: placed, paidAt: new Date(placed.getTime() + 600_000), dueDate: new Date(now.getTime() + 2 * 86_400_000),
        items: { create: [{ proofId: qcProof.id, structureCode: "FEFCO_0427", dims: mailer.seed.defaultDims as object, materialCode: "E_FLUTE_KRAFT", finishCode: "NONE", printSides: "OUTSIDE", quantity: qty, unitPiasters: egp(17), lineTotalPiasters: sub }] },
        productionEvents: {
          create: [
            { type: "ORDER_PLACED", createdAt: placed },
            { type: "PAYMENT_CONFIRMED", createdAt: new Date(placed.getTime() + 600_000) },
            { type: "VENDOR_ACCEPTED", createdAt: new Date(placed.getTime() + 4 * 3600_000) },
            { type: "PRODUCTION_STARTED", createdAt: new Date(placed.getTime() + 86_400_000) },
            { type: "QC_UPLOADED", createdAt: new Date(now.getTime() - 3600_000) },
          ],
        },
        qcPhotos: {
          create: [
            { url: `/seed/portfolio/${qcVendor.slug}-2.svg`, kind: "FIRST_SHEET" },
            { url: `/seed/portfolio/${qcVendor.slug}-3.svg`, kind: "PACKED_BUNDLE" },
          ],
        },
        payments: { create: [{ provider: "mock", method: "WALLET", status: "PAID", amountPiasters: sub + ship + vat, providerRef: "mock_ELB-26301" }] },
      },
    });

    const delivered = await db.order.findUnique({ where: { number: "ELB-26203" } });
    if (delivered) {
      await db.dispute.create({
        data: {
          orderId: delivered.id, openedById: buyer.id, reason: "PRINT_DEFECT", status: "OPEN",
          description: "The logo on the lid is shifted about 4 mm to the left on most boxes.",
          createdAt: new Date(now.getTime() - 2 * 86_400_000),
        },
      });
    }

    const applicant = await db.user.create({ data: { phone: "+201000000020", name: "Karim Fathy", role: "BUYER", locale: "ar", consentAt: now } });
    const pendingVendor = await db.vendor.create({
      data: {
        slug: "giza-carton-lab", nameAr: "معمل الجيزة للكرتون", nameEn: "Giza Carton Lab", city: "GIZA", cityAr: "الجيزة", cityEn: "Giza",
        bioAr: "مطبعة كرتون مضلع في أبو رواش.", bioEn: "Corrugated print shop in Abu Rawash.",
        machines: [{ kind: "FLEXO", model: "2-colour flexo", count: 1 }, { kind: "DIE_CUTTER", model: "Flatbed die cutter", count: 1 }],
        capabilities: { structures: ["FEFCO_0201", "FEFCO_0427"], materials: ["B_FLUTE_KRAFT", "E_FLUTE_KRAFT"], finishes: ["NONE"], maxColors: 2, digitalShortRun: false, monthlyCapacityUnits: 40000 },
        certifications: [], serviceAreas: ["GIZA", "CAIRO"], verified: false, status: "PENDING", minOrderQty: 250, leadTimeDays: 8,
      },
    });
    await db.vendorApplication.create({
      data: {
        applicantId: applicant.id, vendorId: pendingVendor.id, legalName: "Giza Carton Lab LLC", commercialRegisterNo: "CR-118204",
        taxCardNo: "512-339-870", factoryAddress: "Industrial zone, Abu Rawash", factoryCity: "GIZA", contactName: "Karim Fathy",
        contactPhone: "+201000000020", documents: [], message: "We print shipping boxes for furniture and appliance makers.",
        createdAt: new Date(now.getTime() - 86_400_000),
      },
    });

    await db.dataRequest.create({ data: { userId: buyer.id, kind: "EXPORT", status: "OPEN", createdAt: new Date(now.getTime() - 3 * 86_400_000) } });
  }

  const counts = {
    structures: await db.structure.count(), materials: await db.material.count(), finishes: await db.finish.count(),
    vendors: await db.vendor.count(), portfolio: await db.vendorPortfolioItem.count(), rateCards: await db.rateCard.count(),
    users: await db.user.count(), orders: await db.order.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
