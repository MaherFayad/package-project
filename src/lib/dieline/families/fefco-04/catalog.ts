import type { Dims, DimsPreset, MaterialCode, StructureFeatures, StructureParamLimits } from "@/types";
import type { FeatureSupport } from "../../features";
import { blissContainer } from "./bliss";
import { trayKit, type TrayKitOpts } from "./kit";
import { octagonalTray } from "./octagon";
import { retfMailer } from "./retf";
import type { Fefco04Code, Fefco04Definition, Fefco04SubFamily, FamilyGenerator } from "./types";
import { wrapFolder, type WrapOpts } from "./wraps";

/* ───────────────────────── shared metadata by kind ───────────────────────── */

type Kind = "folder" | "fpf" | "wrap" | "bliss" | "tray" | "lidTray" | "display" | "octagon" | "container";

const NONE: FeatureSupport = { windowFaces: [], thumbNotch: false, handle: false, tearStrip: false, partitions: false, lidHeight: false, displayFront: false };

const ALL_CORRUGATED: MaterialCode[] = ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"];
const HEAVY: MaterialCode[] = ["B_FLUTE_KRAFT", "E_FLUTE_KRAFT"];

const p = (id: string, ar: string, en: string, dims: Dims, standard?: boolean): DimsPreset => ({ id, name: { ar, en }, dims, ...(standard ? { standard } : {}) });

interface KindMeta {
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: MaterialCode[];
  features: FeatureSupport;
  uses: Fefco04Definition["uses"];
}

/** Size presets are inner mm, common in the Egyptian market (books, produce, bakery, e-commerce). */
const KIND: Record<Kind, KindMeta> = {
  folder: {
    params: { L: { min: 100, max: 1000 }, W: { min: 60, max: 700 }, H: { min: 10, max: 250 }, rules: ["H <= W"] },
    defaultDims: { L: 310, W: 225, H: 40 },
    presets: [
      p("book", "كتاب", "Book", { L: 240, W: 170, H: 40 }, true),
      p("a4-documents", "مستندات A4", "A4 documents", { L: 310, W: 225, H: 30 }, true),
      p("picture-frame", "إطار صورة", "Picture frame", { L: 420, W: 320, H: 35 }),
      p("ceramic-tile", "بلاط سيراميك", "Ceramic tile 30×60", { L: 605, W: 305, H: 40 }),
    ],
    materials: ALL_CORRUGATED,
    features: NONE,
    uses: ["shipping", "ecommerce", "retail"],
  },
  fpf: {
    params: { L: { min: 200, max: 2000 }, W: { min: 30, max: 400 }, H: { min: 30, max: 400 } },
    defaultDims: { L: 700, W: 100, H: 100 },
    presets: [
      p("poster-roll", "لوحات ملفوفة", "Poster / roll", { L: 700, W: 80, H: 80 }, true),
      p("curtain-rod", "ستارة ومواسير", "Curtain rod", { L: 1000, W: 60, H: 60 }),
      p("aluminium-profile", "قطاعات ألومنيوم", "Aluminium profiles", { L: 1200, W: 100, H: 50 }, true),
      p("lamp", "أباجورة", "Floor lamp", { L: 900, W: 200, H: 200 }),
    ],
    materials: HEAVY,
    features: NONE,
    uses: ["shipping", "retail"],
  },
  wrap: {
    params: { L: { min: 100, max: 1200 }, W: { min: 40, max: 500 }, H: { min: 20, max: 500 } },
    defaultDims: { L: 300, W: 200, H: 150 },
    presets: [
      p("bottles-6", "6 زجاجات", "6 bottles", { L: 240, W: 160, H: 230 }, true),
      p("cans-24", "24 علبة مشروب", "24 cans", { L: 400, W: 270, H: 125 }, true),
      p("books", "كتب", "Books", { L: 300, W: 220, H: 150 }),
    ],
    materials: ALL_CORRUGATED,
    features: NONE,
    uses: ["shipping", "food", "retail"],
  },
  bliss: {
    params: { L: { min: 150, max: 800 }, W: { min: 100, max: 600 }, H: { min: 60, max: 600 } },
    defaultDims: { L: 400, W: 300, H: 250 },
    presets: [
      p("appliance", "جهاز منزلي صغير", "Small appliance", { L: 400, W: 300, H: 300 }, true),
      p("fruit-export", "فاكهة للتصدير", "Export fruit", { L: 500, W: 300, H: 250 }, true),
      p("heavy-parts", "قطع غيار", "Spare parts", { L: 350, W: 250, H: 200 }),
    ],
    materials: HEAVY,
    features: NONE,
    uses: ["shipping", "food"],
  },
  tray: {
    params: { L: { min: 120, max: 800 }, W: { min: 80, max: 600 }, H: { min: 25, max: 300 } },
    defaultDims: { L: 380, W: 280, H: 100 },
    presets: [
      p("produce-30x40", "خضر وفاكهة 30×40", "Produce 30×40", { L: 380, W: 280, H: 100 }, true),
      p("produce-40x60", "خضر وفاكهة 40×60", "Produce 40×60", { L: 580, W: 380, H: 120 }, true),
      p("bakery", "مخبوزات", "Bakery tray", { L: 400, W: 300, H: 60 }),
      p("shelf-ready", "جاهزة للرف", "Shelf-ready", { L: 300, W: 200, H: 80 }),
    ],
    materials: ALL_CORRUGATED,
    features: { ...NONE, thumbNotch: true, handle: true },
    uses: ["retail", "food", "shipping"],
  },
  lidTray: {
    params: { L: { min: 80, max: 600 }, W: { min: 60, max: 450 }, H: { min: 20, max: 250 }, rules: ["H <= W"] },
    defaultDims: { L: 250, W: 180, H: 80 },
    presets: [
      p("accessories", "إكسسوارات", "Accessories", { L: 180, W: 120, H: 50 }, true),
      p("tshirt", "تيشيرت", "T-shirt", { L: 300, W: 220, H: 60 }, true),
      p("shoe", "حذاء", "Shoe box", { L: 330, W: 200, H: 120 }, true),
      p("pastry", "حلويات شرقية", "Oriental sweets", { L: 300, W: 300, H: 70 }),
    ],
    materials: ALL_CORRUGATED,
    features: { ...NONE, windowFaces: ["top"] },
    uses: ["ecommerce", "gift", "food", "apparel"],
  },
  display: {
    params: { L: { min: 150, max: 700 }, W: { min: 100, max: 500 }, H: { min: 40, max: 300 } },
    defaultDims: { L: 300, W: 200, H: 100 },
    presets: [
      p("shelf-display", "عرض على الرف", "Shelf display", { L: 300, W: 200, H: 100 }, true),
      p("counter-display", "عرض على الكاونتر", "Counter display", { L: 250, W: 180, H: 80 }, true),
      p("snacks", "سناكس", "Snack display", { L: 380, W: 250, H: 120 }),
    ],
    materials: ALL_CORRUGATED,
    features: NONE,
    uses: ["retail", "food"],
  },
  octagon: {
    params: { L: { min: 150, max: 600 }, W: { min: 150, max: 600 }, H: { min: 30, max: 300 } },
    defaultDims: { L: 300, W: 300, H: 80 },
    presets: [
      p("cake-26", "تورتة 26 سم", "Cake 26 cm", { L: 270, W: 270, H: 100 }, true),
      p("sweets-30", "حلويات 30 سم", "Sweets 30 cm", { L: 300, W: 300, H: 60 }, true),
      p("fruit-basket", "سلة فاكهة", "Fruit basket", { L: 400, W: 300, H: 150 }),
    ],
    materials: ALL_CORRUGATED,
    features: NONE,
    uses: ["food", "gift", "retail"],
  },
  container: {
    params: { L: { min: 150, max: 800 }, W: { min: 100, max: 600 }, H: { min: 60, max: 500 } },
    defaultDims: { L: 400, W: 300, H: 250 },
    presets: [
      p("archive", "ملفات أرشيف", "Archive box", { L: 380, W: 300, H: 260 }, true),
      p("household", "أدوات منزلية", "Household goods", { L: 500, W: 350, H: 300 }),
      p("produce", "خضر وفاكهة", "Produce", { L: 500, W: 300, H: 200 }),
    ],
    materials: HEAVY,
    features: NONE,
    uses: ["shipping", "retail"],
  },
};

/* ───────────────────────── entry helper ───────────────────────── */

interface Spec {
  fefco: string;
  sub: Fefco04SubFamily;
  kind: Kind;
  en: string;
  ar: string;
  descEn: string;
  descAr: string;
  gen: FamilyGenerator;
  glued?: boolean;
  fidelity?: Fefco04Definition["fidelity"];
  limits?: Partial<StructureParamLimits>;
}

type KitGenerator = FamilyGenerator & { kitOpts?: TrayKitOpts };
const kit = (o: TrayKitOpts): FamilyGenerator => Object.assign((d: Dims, t: number, f: StructureFeatures) => trayKit(d, t, o, f), { kitOpts: o });

/**
 * Offer only the options the style's geometry actually shows: a handle toggle is pointless when
 * hand holes are built in (0422.1, 0430…) and impossible under a lid; a thumb notch needs an
 * open, full-height front wall (no cover flaps, no display cut-down).
 */
function featuresFor(meta: FeatureSupport, gen: KitGenerator): FeatureSupport {
  const o = gen.kitOpts;
  if (!o) return meta;
  return {
    ...meta,
    handle: meta.handle && !o.handHoles && o.top.kind !== "lid",
    thumbNotch: meta.thumbNotch && o.top.kind === "none" && !o.displayFront,
  };
}
const wrap = (o: WrapOpts): FamilyGenerator => (d, t, f) => wrapFolder(d, t, o, f);

function entry(s: Spec): Fefco04Definition {
  const meta = KIND[s.kind];
  const params: StructureParamLimits = { ...meta.params, ...s.limits };
  const presets = meta.presets.filter((x) => (["L", "W", "H"] as const).every((k) => x.dims[k] >= params[k].min && x.dims[k] <= params[k].max));
  const code = `FEFCO_${s.fefco}` as Fefco04Code;
  return {
    code,
    fefco: s.fefco,
    slug: `fefco-${s.fefco.replace(/_/g, "-").toLowerCase()}`,
    family: "CORRUGATED",
    subFamily: s.sub,
    standard: `FEFCO ${s.fefco.replace("_", ".")}`,
    name: { ar: s.ar, en: s.en },
    description: { ar: s.descAr, en: s.descEn },
    params,
    defaultDims: meta.defaultDims,
    presets,
    materials: meta.materials,
    features: featuresFor(meta.features, s.gen),
    shape: "box",
    pieces: s.kind === "bliss" ? 3 : 1,
    glued: s.glued ?? false,
    uses: meta.uses,
    generate: s.gen,
    fidelity: s.fidelity ?? "interpreted",
  };
}

/* ───────────────────────── catalogue ───────────────────────── */

const SPECS: Spec[] = [
  // ── one-piece folders (taped / glued closed)
  { fefco: "0400", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder", ar: "غلاف مطوي من قطعة واحدة",
    descEn: "Base with end walls; cover flaps on the long walls meet in the middle and are taped.", descAr: "قاعدة بجدارين طرفيين وألسنة غطاء على الجدارين الطوليين تلتقي في المنتصف وتغلق بشريط لاصق.",
    gen: kit({ ears: "none", top: { kind: "flaps", on: "long", overlap: "meet" } }) },
  { fefco: "0401", fidelity: "described", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder (cover across W)", ar: "غلاف مطوي من قطعة واحدة بغطاء على العرض",
    descEn: "Cross-shaped blank: walls fold up from the base, full-width cover flaps overlap across W.", descAr: "لوح على شكل صليب تنثني جدرانه من القاعدة، وألسنة الغطاء متراكبة بعرض العلبة كاملا.",
    gen: kit({ ears: "none", top: { kind: "flaps", on: "long", overlap: "full" } }) },
  { fefco: "0402", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder (cover along L)", ar: "غلاف مطوي من قطعة واحدة بغطاء على الطول",
    descEn: "Like 0401 but the overlapping cover flaps are hinged on the end walls and run along L.", descAr: "مثل 0401 لكن ألسنة الغطاء المتراكبة متصلة بالجدارين الطرفيين وتمتد على الطول.",
    gen: kit({ ears: "none", top: { kind: "flaps", on: "ends", overlap: "full" } }) },
  { fefco: "0403", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder with end buffers", ar: "غلاف مطوي بمصدات طرفية",
    descEn: "0401 folder whose end walls roll in double to form shock-absorbing buffers.", descAr: "غلاف 0401 تنطوي جدرانه الطرفية للداخل مزدوجة لتكون مصدات تمتص الصدمات.",
    gen: kit({ ears: "none", double: { ends: true }, top: { kind: "flaps", on: "long", overlap: "full" } }) },
  { fefco: "0412", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder with dust flaps", ar: "غلاف مطوي بألسنة جانبية",
    descEn: "Long walls carry corner dust flaps that fold inside the end walls; cover flaps meet in the middle.", descAr: "ألسنة جانبية على الجدارين الطوليين تنثني داخل الجدارين الطرفيين، وألسنة الغطاء تلتقي في المنتصف.",
    gen: kit({ ears: "long", top: { kind: "flaps", on: "long", overlap: "meet" } }) },
  { fefco: "0413", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder with dust flaps, overlapping cover", ar: "غلاف مطوي بألسنة جانبية وغطاء متراكب",
    descEn: "As 0412 with full-width overlapping cover flaps for a double top.", descAr: "مثل 0412 بألسنة غطاء متراكبة بالعرض الكامل لسطح علوي مزدوج.",
    gen: kit({ ears: "long", top: { kind: "flaps", on: "long", overlap: "full" } }) },
  { fefco: "0415", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder with dust flaps and front flap", ar: "غلاف مطوي بألسنة جانبية ولسان أمامي",
    descEn: "Courier folder: dust flaps at the corners, cover hinged on the back with a front flap taped over the front wall.", descAr: "غلاف بريد سريع بألسنة جانبية في الأركان وغطاء متصل بالخلف ولسان أمامي يلصق فوق الجدار الأمامي.",
    gen: kit({ ears: "long", top: { kind: "lid", front: "flap", sides: "none" } }) },
  { fefco: "0415a", sub: "one-piece-folder", kind: "folder", glued: true, en: "One-piece folder with dust flaps, wrapped cover", ar: "غلاف مطوي بألسنة جانبية وغطاء ملتف",
    descEn: "0415 whose cover also carries side flaps folding down outside the end walls.", descAr: "غلاف 0415 بغطاء له ألسنة جانبية تنثني خارج الجدارين الطرفيين.",
    gen: kit({ ears: "long", top: { kind: "lid", front: "flap", sides: "outside" } }) },
  { fefco: "0416", sub: "one-piece-folder", kind: "folder", en: "One-piece folder with dust and tuck flaps", ar: "غلاف مطوي بألسنة جانبية ولسان إدخال",
    descEn: "Hinged cover with a tuck flap that slides inside the front wall; corner dust flaps.", descAr: "غطاء متصل بلسان إدخال ينزلق داخل الجدار الأمامي، مع ألسنة جانبية في الأركان.",
    gen: kit({ ears: "long", top: { kind: "lid", front: "tuck", sides: "none" } }) },
  { fefco: "0416a", sub: "one-piece-folder", kind: "folder", en: "One-piece folder with dust and tuck flaps, lid side flaps", ar: "غلاف مطوي بلسان إدخال وألسنة غطاء جانبية",
    descEn: "0416 with dust flaps on the cover sides that tuck inside the end walls.", descAr: "غلاف 0416 بألسنة جانبية على الغطاء تدخل داخل الجدارين الطرفيين.",
    gen: kit({ ears: "long", top: { kind: "lid", front: "tuck", sides: "dust" } }) },
  { fefco: "0420", sub: "one-piece-folder", kind: "folder", en: "One-piece folder with dust flaps and hinged lid", ar: "غلاف مطوي بألسنة جانبية وغطاء متصل",
    descEn: "Dust flaps on the end walls fold inside the long walls; hinged lid with tuck and side flaps.", descAr: "ألسنة جانبية على الجدارين الطرفيين تنثني داخل الجدارين الطوليين، وغطاء متصل بلسان إدخال وألسنة جانبية.",
    gen: kit({ ears: "ends", top: { kind: "lid", front: "tuck", sides: "dust" } }) },

  // ── tubes, wrap-around and five panel folders
  { fefco: "0404", sub: "wrap-around", kind: "wrap", glued: true, en: "Folder-type tube", ar: "أنبوب مطوي",
    descEn: "Four panels and a glue flap wrapped around the product into an open-ended tube.", descAr: "أربعة ألواح ولسان لصق تلتف حول المنتج لتكون أنبوبا مفتوح الطرفين.",
    gen: wrap({ joint: "glue", endFlaps: { wPanels: "none", hPanels: "none", outer: "w" } }) },
  { fefco: "0406", sub: "wrap-around", kind: "wrap", glued: true, en: "Wrap-around blank", ar: "لوح تغليف ملتف",
    descEn: "Blank wrapped around the product on a packing line and glued; end flaps close both ends.", descAr: "لوح يلتف حول المنتج على خط التعبئة ويلصق، وتغلق الألسنة الطرفية الجانبين.",
    gen: wrap({ joint: "glue", endFlaps: { wPanels: "meet", hPanels: "meet", outer: "w" } }) },
  { fefco: "0409", fidelity: "described", sub: "five-panel-folder", kind: "fpf", glued: true, en: "Five panel folder", ar: "غلاف خماسي الألواح",
    descEn: "Four panels plus a fifth overlap panel that doubles one face; end flaps close the ends. For long items.", descAr: "أربعة ألواح ولوح خامس متراكب يضاعف أحد الأوجه، وألسنة طرفية تغلق النهايات. للمنتجات الطويلة.",
    gen: wrap({ joint: "fifth-panel", fifthRatio: 1, endFlaps: { wPanels: "meet", hPanels: "full", outer: "h" } }) },
  { fefco: "0409a", sub: "five-panel-folder", kind: "fpf", glued: true, en: "Five panel folder, partial fifth panel", ar: "غلاف خماسي الألواح بلوح خامس جزئي",
    descEn: "0409 with a shorter fifth panel (different panel heights).", descAr: "غلاف 0409 بلوح خامس أقصر (ألواح بارتفاعات مختلفة).",
    gen: wrap({ joint: "fifth-panel", fifthRatio: 0.5, endFlaps: { wPanels: "meet", hPanels: "full", outer: "h" } }) },
  { fefco: "0410", sub: "five-panel-folder", kind: "fpf", glued: true, en: "Five panel folder, end flaps on W panels", ar: "غلاف خماسي الألواح بألسنة طرفية على العرض",
    descEn: "Five panel folder whose full-cover end flaps sit on the base and top panels.", descAr: "غلاف خماسي الألواح ألسنته الطرفية الكاملة على لوحي القاعدة والسطح.",
    gen: wrap({ joint: "fifth-panel", fifthRatio: 1, endFlaps: { wPanels: "full", hPanels: "meet", outer: "w" } }) },
  { fefco: "0410a", sub: "five-panel-folder", kind: "fpf", glued: true, en: "Five panel folder, end flaps on W panels, partial fifth panel", ar: "غلاف خماسي الألواح بألسنة على العرض ولوح خامس جزئي",
    descEn: "0410 with a shorter fifth panel (diverse panel heights).", descAr: "غلاف 0410 بلوح خامس أقصر (ألواح بارتفاعات متنوعة).",
    gen: wrap({ joint: "fifth-panel", fifthRatio: 0.5, endFlaps: { wPanels: "full", hPanels: "meet", outer: "w" } }) },
  { fefco: "0411", sub: "five-panel-folder", kind: "fpf", glued: true, en: "Centre seam five panel folder", ar: "غلاف خماسي الألواح بوصلة في المنتصف",
    descEn: "The top is split into two halves meeting on a centre seam; end flaps close the ends.", descAr: "ينقسم السطح العلوي إلى نصفين يلتقيان في وصلة بالمنتصف، وتغلق الألسنة الطرفية النهايات.",
    gen: wrap({ joint: "centre-seam", seamRatio: 0.5, endFlaps: { wPanels: "meet", hPanels: "full", outer: "h" } }) },
  { fefco: "0411a", sub: "five-panel-folder", kind: "fpf", glued: true, en: "Centre seam five panel folder, offset seam", ar: "غلاف خماسي الألواح بوصلة غير متماثلة",
    descEn: "0411 with unequal top halves (diverse panel heights), moving the seam off centre.", descAr: "غلاف 0411 بنصفين علويين غير متساويين، فتنتقل الوصلة بعيدا عن المنتصف.",
    gen: wrap({ joint: "centre-seam", seamRatio: 0.65, endFlaps: { wPanels: "meet", hPanels: "full", outer: "h" } }) },
  { fefco: "0405", sub: "multi-piece-folder", kind: "bliss", glued: true, en: "Bliss-style container", ar: "حاوية بليس من ثلاث قطع",
    descEn: "Three blanks: a body (base, long walls, cover flaps) and two end panels glued inside with flaps.", descAr: "ثلاث قطع: جسم من القاعدة والجدارين الطوليين وألسنة الغطاء، ولوحان طرفيان يلصقان من الداخل بألسنة.",
    gen: (d, t, f) => blissContainer(d, t, f) },

  // ── self-locking trays (rolled walls trap the corner ears, no glue)
  { fefco: "0421", sub: "lidded-tray", kind: "lidTray", en: "Tray with self-locking end walls and hinged lid", ar: "صينية ذاتية القفل بغطاء متصل",
    descEn: "Rolled double end walls lock the corner ears; hinged lid with a front tuck. No glue.", descAr: "جداران طرفيان مزدوجان يقفلان آذان الأركان، وغطاء متصل بلسان أمامي، بدون لصق.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "lid", front: "tuck", sides: "none" } }) },
  { fefco: "0421_1", sub: "lidded-tray", kind: "lidTray", en: "Tray with self-locking end walls and hinged lid, lid side flaps", ar: "صينية ذاتية القفل بغطاء متصل وألسنة جانبية",
    descEn: "0421 whose lid also carries side flaps tucking inside the end walls.", descAr: "صينية 0421 بغطاء له ألسنة جانبية تدخل داخل الجدارين الطرفيين.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "lid", front: "tuck", sides: "dust" } }) },
  { fefco: "0421a", sub: "lidded-tray", kind: "lidTray", en: "Tray with self-locking walls and hinged lid, double front", ar: "صينية ذاتية القفل بغطاء متصل وواجهة مزدوجة",
    descEn: "0421 with the front wall rolled double as well, for a stiffer opening edge.", descAr: "صينية 0421 بجدار أمامي مزدوج أيضا لحافة فتح أقوى.",
    gen: kit({ ears: "long", double: { ends: true, front: true }, top: { kind: "lid", front: "tuck", sides: "none" } }) },
  { fefco: "0422_1", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray with hand holes", ar: "صينية ذاتية القفل بفتحات يد",
    descEn: "0422 tray with hand holes through both layers of the rolled end walls.", descAr: "صينية 0422 بفتحات يد في طبقتي الجدارين الطرفيين المزدوجين.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "none" }, handHoles: true }) },
  { fefco: "0422_2", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray with locked inner end walls", ar: "صينية ذاتية القفل بجدران داخلية مقفلة",
    descEn: "0422 tray whose rolled end walls end in bottom flaps that lock on the base.", descAr: "صينية 0422 تنتهي جدرانها الطرفية المزدوجة بألسنة قاع تقفل على القاعدة.",
    gen: kit({ ears: "long", double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "none" } }) },
  { fefco: "0422a", sub: "display-tray", kind: "display", en: "Self-locking tray with display front", ar: "صينية ذاتية القفل بواجهة عرض",
    descEn: "0422 tray with a lowered front between corner posts for shelf display.", descAr: "صينية 0422 بواجهة أمامية منخفضة بين قائمي الأركان للعرض على الرف.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "none" }, displayFront: true }) },
  { fefco: "0423", sub: "self-locking-tray", kind: "tray", en: "Tray with self-locking long walls", ar: "صينية ذاتية القفل بجدران طولية مزدوجة",
    descEn: "Front and back walls roll double and trap ears on the end walls.", descAr: "الجداران الأمامي والخلفي مزدوجان ويقفلان الآذان المتصلة بالجدارين الطرفيين.",
    gen: kit({ ears: "ends", double: { front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0423_1", sub: "self-locking-tray", kind: "tray", en: "Tray with self-locking long walls and hand holes", ar: "صينية ذاتية القفل بجدران طولية مزدوجة وفتحات يد",
    descEn: "0423 with hand holes in the end walls.", descAr: "صينية 0423 بفتحات يد في الجدارين الطرفيين.",
    gen: kit({ ears: "ends", double: { front: true, back: true }, top: { kind: "none" }, handHoles: true }) },
  { fefco: "0423a", sub: "display-tray", kind: "display", en: "Tray with self-locking back wall and display front", ar: "صينية ذاتية القفل بجدار خلفي مزدوج وواجهة عرض",
    descEn: "0423 variant: double back wall, lowered display front.", descAr: "نوع من 0423 بجدار خلفي مزدوج وواجهة عرض منخفضة.",
    gen: kit({ ears: "ends", double: { back: true }, top: { kind: "none" }, displayFront: true }) },
  { fefco: "0423_1a", sub: "display-tray", kind: "display", en: "Tray with self-locking back wall, display front and hand holes", ar: "صينية عرض ذاتية القفل بفتحات يد",
    descEn: "0423a with hand holes in the end walls.", descAr: "صينية 0423a بفتحات يد في الجدارين الطرفيين.",
    gen: kit({ ears: "ends", double: { back: true }, top: { kind: "none" }, displayFront: true, handHoles: true }) },
  { fefco: "0424", sub: "self-locking-tray", kind: "tray", en: "Tray with self-locking end walls and lock flaps", ar: "صينية ذاتية القفل بألسنة قفل سفلية",
    descEn: "Rolled end walls end in bottom flaps that lock the tray without corner ears.", descAr: "تنتهي الجدران الطرفية المزدوجة بألسنة سفلية تقفل الصينية دون آذان في الأركان.",
    gen: kit({ ears: "none", double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "none" } }) },
  { fefco: "0424a", sub: "display-tray", kind: "display", en: "Tray with self-locking end walls, lock flaps and display front", ar: "صينية ذاتية القفل بألسنة قفل وواجهة عرض",
    descEn: "0424 with a lowered display front.", descAr: "صينية 0424 بواجهة عرض منخفضة.",
    gen: kit({ ears: "none", double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "none" }, displayFront: true }) },
  { fefco: "0425", sub: "self-locking-tray", kind: "tray", en: "Tray with four self-locking walls", ar: "صينية ذاتية القفل بأربعة جدران مزدوجة",
    descEn: "All four walls roll double; the long-wall ears are locked inside the ends. Presentation trays and lids.", descAr: "الجدران الأربعة مزدوجة وآذان الجدارين الطوليين مقفلة داخل الطرفين. لصواني وأغطية العرض الفاخرة.",
    gen: kit({ ears: "long", double: { ends: true, front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0425a", sub: "self-locking-tray", kind: "tray", en: "Tray with four self-locking walls and bottom flaps", ar: "صينية بأربعة جدران مزدوجة وألسنة قاع",
    descEn: "0425 whose rolled walls end in interior bottom flaps (hidden locks).", descAr: "صينية 0425 تنتهي جدرانها المزدوجة بألسنة قاع داخلية (أقفال مخفية).",
    gen: kit({ ears: "long", double: { ends: true, front: true, back: true }, bottomFlaps: { ends: true, front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0426a", sub: "lidded-tray", kind: "lidTray", en: "Tray with self-locking walls and hinged lid, plain lid", ar: "صينية ذاتية القفل بغطاء متصل بسيط",
    descEn: "0426 (pizza box) variant without lid side flaps: lid closes with the front tuck only.", descAr: "نوع من 0426 (علبة البيتزا) بدون ألسنة جانبية للغطاء، يقفل باللسان الأمامي فقط.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "lid", front: "tuck", sides: "none", tuckRatio: 0.6 } }), limits: { H: { min: 20, max: 80 } } },
  { fefco: "0427_1", sub: "lidded-tray", kind: "lidTray", en: "Mailer with locking ears, plain lid", ar: "علبة بريدية بآذان قفل وغطاء بسيط",
    descEn: "0427 variant: double front and end walls with locking ears, lid with tuck and no side flaps.", descAr: "نوع من 0427 بجدار أمامي وجدارين طرفيين مزدوجين بآذان قفل، وغطاء بلسان دون ألسنة جانبية.",
    gen: kit({ ears: "long", double: { ends: true, front: true }, top: { kind: "lid", front: "tuck", sides: "none", tuckRatio: 0.75 } }) },
  { fefco: "0428", sub: "lidded-tray", kind: "lidTray", en: "Tray with foot-lock and hinged lid", ar: "صينية بقفل سفلي وغطاء متصل",
    descEn: "Rolled end walls lock to the base with foot flaps; hinged lid with tuck and side flaps.", descAr: "جداران طرفيان مزدوجان يقفلان في القاعدة بألسنة سفلية، وغطاء متصل بلسان وألسنة جانبية.",
    gen: kit({ ears: "none", double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "lid", front: "tuck", sides: "dust" } }) },
  { fefco: "0428a", sub: "lidded-tray", kind: "lidTray", en: "Tray with foot-lock and hinged lid, plain lid", ar: "صينية بقفل سفلي وغطاء متصل بسيط",
    descEn: "0428 without lid side flaps.", descAr: "صينية 0428 بدون ألسنة جانبية للغطاء.",
    gen: kit({ ears: "none", double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "lid", front: "tuck", sides: "none" } }) },
  { fefco: "0429", sub: "lidded-tray", kind: "lidTray", en: "Tray with self-locking walls and wrap-over lid", ar: "صينية ذاتية القفل بغطاء ملتف",
    descEn: "Self-locking tray whose lid side flaps fold down outside the end walls.", descAr: "صينية ذاتية القفل تنثني ألسنة غطائها الجانبية خارج الجدارين الطرفيين.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "lid", front: "tuck", sides: "outside" } }) },
  { fefco: "0429a", sub: "lidded-tray", kind: "lidTray", en: "Tray with self-locking walls, double front and wrap-over lid", ar: "صينية ذاتية القفل بواجهة مزدوجة وغطاء ملتف",
    descEn: "0429 with the front wall rolled double.", descAr: "صينية 0429 بجدار أمامي مزدوج.",
    gen: kit({ ears: "long", double: { ends: true, front: true }, top: { kind: "lid", front: "tuck", sides: "outside" } }) },
  { fefco: "0430", sub: "self-locking-tray", kind: "tray", en: "Tray with carrying handles", ar: "صينية بمقبض حمل",
    descEn: "Self-locking tray with hand holes through the double end walls.", descAr: "صينية ذاتية القفل بفتحات يد في الجدارين الطرفيين المزدوجين.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "none" }, handHoles: true }), limits: { H: { min: 60, max: 300 } } },
  { fefco: "0431", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray, double back wall", ar: "صينية ذاتية القفل بجدار خلفي مزدوج",
    descEn: "Double end walls lock the ears; the back wall is rolled double for stacking strength.", descAr: "جداران طرفيان مزدوجان يقفلان الآذان، والجدار الخلفي مزدوج لقوة التستيف.",
    gen: kit({ ears: "long", double: { ends: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0432", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray, locked long walls", ar: "صينية ذاتية القفل بجدران طولية مقفلة",
    descEn: "Rolled front and back walls trap the end-wall ears and lock to the base with bottom flaps.", descAr: "الجداران الأمامي والخلفي مزدوجان يقفلان آذان الطرفين ويثبتان في القاعدة بألسنة سفلية.",
    gen: kit({ ears: "ends", double: { front: true, back: true }, bottomFlaps: { front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0432a", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray, locked long walls and hand holes", ar: "صينية ذاتية القفل بجدران طولية مقفلة وفتحات يد",
    descEn: "0432 with hand holes in the end walls.", descAr: "صينية 0432 بفتحات يد في الجدارين الطرفيين.",
    gen: kit({ ears: "ends", double: { front: true, back: true }, bottomFlaps: { front: true, back: true }, top: { kind: "none" }, handHoles: true }) },
  { fefco: "0433", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray, four double walls, ears on ends", ar: "صينية ذاتية القفل بأربعة جدران مزدوجة وآذان طرفية",
    descEn: "All walls roll double; the ears sit on the end walls and lock inside the long walls.", descAr: "الجدران كلها مزدوجة والآذان على الجدارين الطرفيين وتقفل داخل الجدارين الطوليين.",
    gen: kit({ ears: "ends", double: { ends: true, front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0434", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray with carrying handles, raised ends", ar: "صينية ذاتية القفل بمقبض حمل وطرفين مرتفعين",
    descEn: "End walls raised above the long walls carry hand holes; long walls lock the ends.", descAr: "جداران طرفيان أعلى من الجدارين الطوليين بفتحات يد، والجداران الطوليان يقفلان الطرفين.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "none" }, raisedEnds: 0.35, handHoles: true }), limits: { H: { min: 60, max: 300 } } },
  { fefco: "0435", sub: "display-tray", kind: "display", en: "Display tray with self-locking walls and header", ar: "صينية عرض ذاتية القفل بلوحة إعلانية",
    descEn: "Self-locking tray with a lowered front and a raised printed header on the back wall.", descAr: "صينية ذاتية القفل بواجهة منخفضة ولوحة إعلانية مطبوعة مرتفعة على الجدار الخلفي.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "none" }, displayFront: true, header: 0.3 }) },
  { fefco: "0435a", sub: "display-tray", kind: "display", en: "Display tray with self-locking walls, tall header", ar: "صينية عرض ذاتية القفل بلوحة إعلانية طويلة",
    descEn: "0435 with a taller header and locked inner end walls.", descAr: "صينية 0435 بلوحة إعلانية أطول وجدران طرفية داخلية مقفلة.",
    gen: kit({ ears: "long", double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "none" }, displayFront: true, header: 0.6 }) },
  { fefco: "0436", sub: "interior-flap-tray", kind: "tray", en: "Self-locking tray, four locked walls", ar: "صينية ذاتية القفل بأربعة جدران مقفلة",
    descEn: "All four walls roll double and lock into the base with interior bottom flaps; no ears.", descAr: "الجدران الأربعة مزدوجة وتقفل في القاعدة بألسنة قاع داخلية، بدون آذان.",
    gen: kit({ ears: "none", double: { ends: true, front: true, back: true }, bottomFlaps: { ends: true, front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0437", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray, double front", ar: "صينية ذاتية القفل بواجهة مزدوجة",
    descEn: "Double end walls lock the ears; the front wall is rolled double.", descAr: "جداران طرفيان مزدوجان يقفلان الآذان، والجدار الأمامي مزدوج.",
    gen: kit({ ears: "long", double: { ends: true, front: true }, top: { kind: "none" } }) },
  { fefco: "0437_1", sub: "self-locking-tray", kind: "tray", en: "Self-locking tray, double front and hand holes", ar: "صينية ذاتية القفل بواجهة مزدوجة وفتحات يد",
    descEn: "0437 with hand holes in the end walls.", descAr: "صينية 0437 بفتحات يد في الجدارين الطرفيين.",
    gen: kit({ ears: "long", double: { ends: true, front: true }, top: { kind: "none" }, handHoles: true }) },
  { fefco: "0439", sub: "interior-flap-tray", kind: "tray", en: "Self-locking tray with interior bottom flaps", ar: "صينية ذاتية القفل بألسنة قاع داخلية",
    descEn: "Rolled end and front walls finish in interior bottom flaps lying on the base.", descAr: "تنتهي الجدران الطرفية والأمامية المزدوجة بألسنة قاع داخلية مستقرة على القاعدة.",
    gen: kit({ ears: "none", double: { ends: true, front: true }, bottomFlaps: { ends: true, front: true }, top: { kind: "none" } }) },
  { fefco: "0439a", sub: "interior-flap-tray", kind: "tray", en: "Self-locking tray with interior bottom flaps and hand holes", ar: "صينية بألسنة قاع داخلية وفتحات يد",
    descEn: "0439 with hand holes in the end walls.", descAr: "صينية 0439 بفتحات يد في الجدارين الطرفيين.",
    gen: kit({ ears: "none", double: { ends: true, front: true }, bottomFlaps: { ends: true, front: true }, top: { kind: "none" }, handHoles: true }) },
  { fefco: "0447", sub: "lidded-tray", kind: "lidTray", en: "Tuck-lock tray with lid", ar: "صينية بقفل إدخال وغطاء",
    descEn: "Single-wall tray whose corner ears tuck inside the ends; lid with tuck and side flaps.", descAr: "صينية بجدران مفردة تدخل آذان أركانها داخل الطرفين، وغطاء بلسان وألسنة جانبية.",
    gen: kit({ ears: "long", top: { kind: "lid", front: "tuck", sides: "dust" } }) },
  { fefco: "0449", sub: "display-tray", kind: "display", en: "Display tray with self-locking walls", ar: "صينية عرض ذاتية القفل",
    descEn: "Self-locking display tray with a cut-down front and a tall back header for point of sale.", descAr: "صينية عرض ذاتية القفل بواجهة مقطوعة ولوحة خلفية طويلة لنقاط البيع.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "none" }, displayFront: true, header: 0.8 }) },
  { fefco: "0457", sub: "self-locking-tray", kind: "tray", en: "Tray with ear-hook lock corners", ar: "صينية بأركان مقفلة بخطاف",
    descEn: "Single walls; ears on the end walls hook behind the long walls at the corners.", descAr: "جدران مفردة وآذان على الجدارين الطرفيين تتعلق خلف الجدارين الطوليين في الأركان.",
    gen: kit({ ears: "ends", top: { kind: "none" } }) },

  // ── glued trays and lidded trays from a gluer / stitcher
  { fefco: "0440", sub: "lidded-tray", kind: "lidTray", glued: true, en: "Tray with stitched lid", ar: "صينية بغطاء مدبس",
    descEn: "Glued-corner tray with a lid hinged on the back; the front flap is stitched or taped down.", descAr: "صينية بأركان ملصوقة وغطاء متصل بالخلف، يدبس لسانه الأمامي أو يلصق.",
    gen: kit({ ears: "long", gluedEars: true, top: { kind: "lid", front: "flap", sides: "none" } }) },
  { fefco: "0441", sub: "lidded-tray", kind: "lidTray", glued: true, en: "Tray with hinged lid", ar: "صينية بغطاء متصل",
    descEn: "Glued-corner tray with a hinged lid closed by a front tuck.", descAr: "صينية بأركان ملصوقة وغطاء متصل يقفل بلسان أمامي.",
    gen: kit({ ears: "long", gluedEars: true, top: { kind: "lid", front: "tuck", sides: "none" } }) },
  { fefco: "0442", sub: "lidded-tray", kind: "lidTray", en: "Tray with notch-lock corners and hinged cover", ar: "صينية بأركان مقفلة بشقوق وغطاء متصل",
    descEn: "Corner ears on the end walls lock in notches; the cover wraps over the front and ends.", descAr: "آذان الأركان على الجدارين الطرفيين تقفل في شقوق، والغطاء يلتف فوق الواجهة والطرفين.",
    gen: kit({ ears: "ends", top: { kind: "lid", front: "flap", sides: "outside" } }) },
  { fefco: "0443", sub: "glued-tray", kind: "tray", glued: true, en: "Rigid tray, long-wall glue flaps", ar: "صينية متينة بألسنة لصق طولية",
    descEn: "Glue flaps on the long walls are glued to the end walls; inward rim flaps stiffen the long edges.", descAr: "ألسنة لصق على الجدارين الطوليين تلصق بالطرفين، وحواف علوية للداخل تقوي الحواف الطويلة.",
    gen: kit({ ears: "long", gluedEars: true, top: { kind: "flaps", on: "long", overlap: "rim" } }) },
  { fefco: "0444", sub: "glued-tray", kind: "tray", glued: true, en: "Rigid tray, end-wall glue flaps", ar: "صينية متينة بألسنة لصق طرفية",
    descEn: "Glue flaps on the end walls are glued to the long walls; inward rim flaps on the end walls.", descAr: "ألسنة لصق على الجدارين الطرفيين تلصق بالطوليين، مع حواف علوية للداخل على الطرفين.",
    gen: kit({ ears: "ends", gluedEars: true, top: { kind: "flaps", on: "ends", overlap: "rim" } }) },
  { fefco: "0445", sub: "glued-tray", kind: "tray", en: "Jointless tray", ar: "صينية بدون وصلة",
    descEn: "Tray formed without a glued joint: corner flaps fold inside and are held by the ends.", descAr: "صينية تتشكل دون وصلة لصق، تنثني ألسنة الأركان للداخل ويثبتها الطرفان.",
    gen: kit({ ears: "long", top: { kind: "none" } }) },
  { fefco: "0448", sub: "glued-tray", kind: "tray", glued: true, en: "Side-slotted tray with folding flaps", ar: "صينية بشقوق جانبية وألسنة منثنية",
    descEn: "Slotted-corner tray whose long walls carry inward folding rim flaps.", descAr: "صينية بأركان مشقوقة على جدرانها الطولية ألسنة علوية تنثني للداخل.",
    gen: kit({ ears: "none", top: { kind: "flaps", on: "long", overlap: "rim" } }) },
  { fefco: "0450", sub: "glued-tray", kind: "tray", glued: true, en: "End-slotted tray with folding wall", ar: "صينية بشقوق طرفية وجدار منثن",
    descEn: "Glue flaps on the end walls; the front wall folds over double.", descAr: "ألسنة لصق على الجدارين الطرفيين، والجدار الأمامي ينثني مزدوجا.",
    gen: kit({ ears: "ends", gluedEars: true, double: { front: true }, top: { kind: "none" } }) },
  { fefco: "0451", sub: "glued-tray", kind: "tray", glued: true, en: "Side-slotted tray with folding wall", ar: "صينية بشقوق جانبية وجدار منثن",
    descEn: "Glue flaps on the long walls; the back wall folds over double.", descAr: "ألسنة لصق على الجدارين الطوليين، والجدار الخلفي ينثني مزدوجا.",
    gen: kit({ ears: "long", gluedEars: true, double: { back: true }, top: { kind: "none" } }) },
  { fefco: "0451_1", sub: "glued-tray", kind: "tray", glued: true, en: "Side-slotted tray with folding front wall", ar: "صينية بشقوق جانبية وجدار أمامي منثن",
    descEn: "0451 with the folding wall at the front.", descAr: "صينية 0451 بالجدار المنثني في الأمام.",
    gen: kit({ ears: "long", gluedEars: true, double: { front: true }, top: { kind: "none" } }) },
  { fefco: "0451_2", sub: "glued-tray", kind: "tray", glued: true, en: "Side-slotted tray with two folding walls", ar: "صينية بشقوق جانبية وجدارين منثنيين",
    descEn: "0451 with both long walls folding over double.", descAr: "صينية 0451 بجدارين طوليين منثنيين مزدوجين.",
    gen: kit({ ears: "long", gluedEars: true, double: { front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0452", fidelity: "described", sub: "glued-tray", kind: "tray", glued: true, en: "Side-slotted tray", ar: "صينية بشقوق جانبية",
    descEn: "Basic glued tray: glue flaps on the long walls. Pallet bases and caps.", descAr: "صينية ملصوقة بسيطة بألسنة لصق على الجدارين الطوليين. لقواعد وأغطية البالتات.",
    gen: kit({ ears: "long", gluedEars: true, top: { kind: "none" } }) },
  { fefco: "0453", fidelity: "described", sub: "glued-tray", kind: "tray", glued: true, en: "End-slotted tray", ar: "صينية بشقوق طرفية",
    descEn: "As 0452 with the glue flaps on the adjacent (end) walls.", descAr: "مثل 0452 لكن ألسنة اللصق على الجدارين المجاورين (الطرفيين).",
    gen: kit({ ears: "ends", gluedEars: true, top: { kind: "none" } }) },
  { fefco: "0454", sub: "glued-tray", kind: "tray", glued: true, en: "End-slotted tray with double walls", ar: "صينية بشقوق طرفية وجدران مزدوجة",
    descEn: "End-wall glue flaps covered by double front and back walls.", descAr: "ألسنة لصق على الطرفين تغطيها جدران أمامية وخلفية مزدوجة.",
    gen: kit({ ears: "ends", gluedEars: true, double: { front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0454_1", sub: "glued-tray", kind: "tray", glued: true, en: "End-slotted tray with locked double walls", ar: "صينية بشقوق طرفية وجدران مزدوجة مقفلة",
    descEn: "0454 whose double long walls end in interior bottom flaps.", descAr: "صينية 0454 تنتهي جدرانها الطولية المزدوجة بألسنة قاع داخلية.",
    gen: kit({ ears: "ends", gluedEars: true, double: { front: true, back: true }, bottomFlaps: { front: true, back: true }, top: { kind: "none" } }) },
  { fefco: "0455", sub: "glued-tray", kind: "tray", glued: true, en: "Side-slotted tray with double end walls", ar: "صينية بشقوق جانبية وجدران طرفية مزدوجة",
    descEn: "Long-wall glue flaps covered by double end walls.", descAr: "ألسنة لصق على الجدارين الطوليين يغطيها جداران طرفيان مزدوجان.",
    gen: kit({ ears: "long", gluedEars: true, double: { ends: true }, top: { kind: "none" } }) },
  { fefco: "0455_1", sub: "glued-tray", kind: "tray", glued: true, en: "Side-slotted tray with locked double end walls", ar: "صينية بشقوق جانبية وجدران طرفية مزدوجة مقفلة",
    descEn: "0455 whose double end walls end in interior bottom flaps.", descAr: "صينية 0455 تنتهي جدرانها الطرفية المزدوجة بألسنة قاع داخلية.",
    gen: kit({ ears: "long", gluedEars: true, double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "none" } }) },
  { fefco: "0458", sub: "lidded-tray", kind: "container", glued: true, en: "Container with wrap-over lid", ar: "حاوية بغطاء ملتف",
    descEn: "Deep glued-corner container whose hinged lid wraps over the front and both ends.", descAr: "حاوية عميقة بأركان ملصوقة وغطاء متصل يلتف فوق الواجهة والطرفين.",
    gen: kit({ ears: "long", gluedEars: true, top: { kind: "lid", front: "flap", sides: "outside" } }) },
  { fefco: "0459", sub: "octagonal-tray", kind: "octagon", glued: true, en: "Octagonal tray", ar: "صينية ثمانية الأضلاع",
    descEn: "Base with chamfered corners and eight walls; glue ears join the corner walls.", descAr: "قاعدة بأركان مشطوفة وثمانية جدران، وآذان لصق تربط جدران الأركان.",
    gen: (d, t, f) => octagonalTray(d, t, f) },
  { fefco: "0460", sub: "display-tray", kind: "display", en: "Tray with raised end panels", ar: "صينية بألواح طرفية مرتفعة",
    descEn: "Self-locking tray whose double end walls stand above the long walls for stacking and display.", descAr: "صينية ذاتية القفل جدرانها الطرفية المزدوجة أعلى من الطولية للتستيف والعرض.",
    gen: kit({ ears: "long", double: { ends: true }, top: { kind: "none" }, raisedEnds: 0.5 }) },

  // ── self-locking trays with interior bottom flaps (0470 series)
  { fefco: "0470", sub: "interior-flap-tray", kind: "lidTray", en: "Self-locking tray with interior bottom flaps and lid", ar: "صينية ذاتية القفل بألسنة قاع داخلية وغطاء",
    descEn: "Rolled end walls lock with interior bottom flaps; hinged lid with front tuck. Ships, then displays.", descAr: "جداران طرفيان مزدوجان يقفلان بألسنة قاع داخلية، وغطاء متصل بلسان أمامي. للشحن ثم العرض.",
    gen: kit({ ears: "none", double: { ends: true }, bottomFlaps: { ends: true }, top: { kind: "lid", front: "tuck", sides: "none" } }) },
  { fefco: "0471", sub: "interior-flap-tray", kind: "lidTray", en: "Self-locking mailer with interior bottom flaps", ar: "علبة بريدية ذاتية القفل بألسنة قاع داخلية",
    descEn: "Double front and end walls with interior bottom flaps; lid with tuck and rounded side flaps.", descAr: "جدار أمامي وجداران طرفيان مزدوجة بألسنة قاع داخلية، وغطاء بلسان وألسنة جانبية مستديرة.",
    gen: kit({ ears: "none", double: { ends: true, front: true }, bottomFlaps: { ends: true, front: true }, top: { kind: "lid", front: "tuck", sides: "rounded" } }) },
  { fefco: "0471a", sub: "interior-flap-tray", kind: "tray", en: "Self-locking tray with interior bottom flaps, open", ar: "صينية مفتوحة ذاتية القفل بألسنة قاع داخلية",
    descEn: "0471 base without the lid: open tray for display or as a presentation-box base.", descAr: "قاعدة 0471 بدون غطاء: صينية مفتوحة للعرض أو قاعدة لعلبة هدايا.",
    gen: kit({ ears: "none", double: { ends: true, front: true }, bottomFlaps: { ends: true, front: true }, top: { kind: "none" } }) },
  { fefco: "0472", sub: "interior-flap-tray", kind: "display", en: "Self-locking display tray with interior bottom flaps", ar: "صينية عرض ذاتية القفل بألسنة قاع داخلية",
    descEn: "Rolled end walls with interior bottom flaps and a lowered display front.", descAr: "جداران طرفيان مزدوجان بألسنة قاع داخلية وواجهة عرض منخفضة.",
    gen: kit({ ears: "none", double: { ends: true, back: true }, bottomFlaps: { ends: true, back: true }, top: { kind: "none" }, displayFront: true }) },
];

/* ───────────────────────── RETF gift boxes (trade names, retf.ts) ───────────────────────── */

/**
 * Roll end tuck front gift boxes (suppliers sell the construction as RETF / FEFCO 0427 mailers), inner mm. Sizes follow the standard ranges
 * of mailer suppliers (Packlane, Arka, Vistaprint, Pacdora; see docs/audit/gift-box-tuck-front.md), rounded
 * to whole centimetres where Egyptian converters quote them.
 */
const MAILER_PRESETS: DimsPreset[] = [
  // First: the owner's sample proportions (kids apparel brand, L:W:H about 1 : 1 : 0.31).
  p("kids-apparel", "ملابس أطفال", "Kids apparel", { L: 240, W: 240, H: 75 }, true),
  p("tshirt", "تيشيرت", "T-shirt", { L: 300, W: 230, H: 50 }, true),
  p("cosmetics", "مستحضرات تجميل", "Cosmetics set", { L: 230, W: 150, H: 100 }, true),
  p("accessories", "مجوهرات وإكسسوارات", "Jewellery and accessories", { L: 150, W: 100, H: 50 }, true),
];

const MAILER_META = {
  params: { L: { min: 80, max: 600 }, W: { min: 60, max: 450 }, H: { min: 20, max: 250 }, rules: ["H <= W"] },
  // Owner's die proportions (L:W:H about 1 : 1 : 0.31).
  defaultDims: { L: 240, W: 240, H: 75 },
  presets: MAILER_PRESETS,
  materials: ALL_CORRUGATED,
  features: { ...NONE, windowFaces: ["top"], tearStrip: true, partitions: true } as FeatureSupport,
  uses: ["ecommerce", "apparel", "cosmetics", "gift"] as Fefco04Definition["uses"],
  // The owner calls this box a gift box; suppliers file the construction under RETF / FEFCO 0427 mailers.
  keywords: ["gift box", "mailer box", "mailer", "tuck front", "RETF", "roll end", "roll end tuck front", "e-commerce box", "هدايا", "علبة هدايا", "علبة بريدية", "علبة شحن"],
};

const MAILERS: Fefco04Definition[] = [
  {
    ...MAILER_META,
    code: "MAILER_RETF",
    fefco: "RETF",
    slug: "gift-box-tuck-front",
    family: "CORRUGATED",
    subFamily: "mailer",
    standard: "RETF (FEFCO 0427 family)",
    name: { ar: "علبة هدايا بلسان أمامي", en: "Gift box (tuck front)" },
    description: {
      ar: "علبة هدايا من الكرتون المضلع بجدارين جانبيين مزدوجين يقفلان في القاعدة، وجدار أمامي مفرد، وغطاء بلسان أمامي بجناحين. مناسبة للهدايا وطلبات المتاجر الإلكترونية.",
      en: "Corrugated gift box with rolled double side walls that lock into the base, a single front wall and a lid with a winged front tuck (roll end tuck front). For gifts and online orders.",
    },
    shape: "box",
    pieces: 1,
    glued: false,
    generate: (d, t, f) => retfMailer(d, t, { tuckWings: true, dust: "rounded", tuckRatio: 1 }, f),
    fidelity: "described",
  },
  {
    ...MAILER_META,
    code: "MAILER_RETF_PLAIN",
    fefco: "RETF_PLAIN",
    slug: "gift-box-tuck-front-plain",
    family: "CORRUGATED",
    subFamily: "mailer",
    standard: "RETF (FEFCO 0427 family)",
    name: { ar: "علبة هدايا بلسان أمامي بسيط", en: "Gift box (tuck front, plain tuck)" },
    description: {
      ar: "علبة هدايا بجدارين جانبيين مزدوجين وجدار أمامي مفرد، وغطاء بلسان مستدير الأركان وألسنة جانبية شبه منحرفة. قطع أبسط وأوفر في الكرتون.",
      en: "Gift box (roll end tuck front) with a plain round-cornered tuck and trapezoid lid side flaps: a simpler die that uses less board.",
    },
    shape: "box",
    pieces: 1,
    glued: false,
    generate: (d, t, f) => retfMailer(d, t, { tuckWings: false, dust: "trapezoid", tuckRatio: 0.75 }, f),
    fidelity: "interpreted",
  },
];

export const DEFINITIONS: Fefco04Definition[] = [...SPECS.map(entry), ...MAILERS];

/** Codes of group 04 already built in the core engine (src/lib/dieline/structures.ts). */
export const IMPLEMENTED_IN_CORE = { "0422": "FEFCO_0422", "0426": "PIZZA", "0427": "FEFCO_0427" } as const;

/** Published group 04 codes not generated here (see README). */
export const NOT_IMPLEMENTED: Record<string, string> = {
  "0446": "Tray with twenty holders: needs a separate holder insert grid (multi-piece insert), out of scope for the folder kit.",
  "0473": "Recessed end box: recessed end panels need non-90° compound folds the tree engine cannot close yet.",
};

export function definitionByCode(code: string): Fefco04Definition | null {
  return DEFINITIONS.find((d) => d.code === code || d.fefco === code || d.slug === code) ?? null;
}
