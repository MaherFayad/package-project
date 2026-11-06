/**
 * R6 marketing asset kit: every image and video under /public/marketing/r6/, rendered from OUR 3D
 * engine, model library and UI by scripts/marketing/render-assets.mjs (no stock photos, no generated
 * people, nothing from third-party sites). Regenerate with:
 *
 *   ELBA_DATABASE_URL=file:./as.db node scripts/marketing/render-assets.mjs
 *
 * Files per still: <base>.avif / <base>.webp (1x) and <base>@2x.avif / <base>@2x.webp (2x).
 * `width`/`height` are the 1x CSS size of the slot the file was cut for.
 *
 * Every brand on these assets (NOUR, ATTAR, Halawa, Waraqa, SAHWA, NADA) is fictional. Assets with
 * `sample: true` must be shown with SAMPLE_LABEL (or equivalent copy) wherever a visitor could read
 * them as a real customer's work.
 *
 * Usage:
 *   const a = R6.hero["mailer-iso-dark"];
 *   <picture>
 *     <source type="image/avif" srcSet={srcSet(a, "avif")} />
 *     <img src={src(a)} srcSet={srcSet(a, "webp")} width={a.width} height={a.height} alt={a.alt[locale]} />
 *   </picture>
 */
import type { Locale } from "@/types";
import { R6_SIZES } from "./assets.generated";

export type Localized = Record<Locale, string>;

export interface R6Image {
  /** Path without extension or density suffix, e.g. "/marketing/r6/hero/mailer-iso-dark". */
  base: string;
  width: number;
  height: number;
  alt: Localized;
  /** Transparent background (cutouts, collage pieces, framed UI). */
  alpha: boolean;
  /** Shows a fictional brand or sample data: label it as a sample on the page. */
  sample: boolean;
}

export interface R6Video {
  /** 1080p and 720p sources, webm (VP9) first then mp4 (H.264). Muted, 5 s, seamless loop. */
  sources: { src: string; type: "video/webm" | "video/mp4"; height: 1080 | 720 }[];
  poster: R6Image;
  width: 1920;
  height: 1080;
  alt: Localized;
  sample: true;
}

export const SAMPLE_LABEL: Localized = { en: "Sample design · fictional brand", ar: "تصميم توضيحي · علامة غير حقيقية" };

const ROOT = "/marketing/r6";

export function src(a: R6Image, fmt: "avif" | "webp" = "webp", density: 1 | 2 = 1): string {
  return `${a.base}${density === 2 ? "@2x" : ""}.${fmt}`;
}
export function srcSet(a: R6Image, fmt: "avif" | "webp"): string {
  return `${a.base}.${fmt} 1x, ${a.base}@2x.${fmt} 2x`;
}
/** Width descriptors (for `sizes`): 1x file = width w, 2x file = 2w. */
export function srcSetW(a: R6Image, fmt: "avif" | "webp"): string {
  return `${a.base}.${fmt} ${a.width}w, ${a.base}@2x.${fmt} ${a.width * 2}w`;
}

function img(key: string, alt: Localized, alpha: boolean, sample: boolean): R6Image {
  const size = R6_SIZES[key] ?? ([0, 0] as const);
  return { base: `${ROOT}/${key}`, width: size[0], height: size[1], alt, alpha, sample };
}

// ---------------------------------------------------------------------------------------------
// Models (the library code each render uses is in scripts/marketing/r6/CapturePage.tsx SHOTS)

export const R6_MODELS = {
  mailer: { code: "FEFCO_0427", brand: "NOUR", en: "NOUR mailer box in terracotta with a striped pattern", ar: "علبة شحن من نور بلون الطوب ونقشة خطوط" },
  "rigid-box": { code: "RIGID_BOX", brand: "ATTAR", en: "ATTAR rigid lid-and-base gift box in black and gold", ar: "علبة هدايا صلبة بغطاء وقاعدة من عطار بالأسود والذهبي" },
  "drawer-box": { code: "RIGID_DRAWER", brand: "Halawa", en: "Halawa sweets drawer box in rose with an arch pattern", ar: "علبة درج حلويات من حلاوة باللون الوردي ونقشة أقواس" },
  "tuck-carton": { code: "ECMA_RTE", brand: "Waraqa", en: "Waraqa tuck end tea carton in deep green", ar: "كرتونة شاي بغلق لسان من ورقة باللون الأخضر الداكن" },
  perfume: { code: "PERFUME_SQUARE", brand: "ATTAR", en: "ATTAR square perfume bottle with a black and gold label", ar: "زجاجة عطر مربعة من عطار بملصق أسود وذهبي" },
  bottle: { code: "BOSTON_ROUND", brand: "NADA", en: "NADA round bottle with a sage label", ar: "زجاجة دائرية من ندى بملصق أخضر فاتح" },
  jar: { code: "WIDE_JAR", brand: "NADA", en: "NADA skin care jar with a sage label", ar: "برطمان عناية بالبشرة من ندى بملصق أخضر فاتح" },
  can: { code: "CAN", brand: "SAHWA", en: "SAHWA cold brew coffee can", ar: "علبة قهوة باردة من صحوة" },
  tube: { code: "SQUEEZE_TUBE", brand: "NADA", en: "NADA squeeze tube in sage", ar: "أنبوب كريم من ندى باللون الأخضر الفاتح" },
  pouch: { code: "STAND_UP_POUCH", brand: "SAHWA", en: "SAHWA stand-up coffee pouch", ar: "كيس قهوة قائم من صحوة" },
  "coffee-bag": { code: "FLEX_SIDE_GUSSET_BAG", brand: "SAHWA", en: "SAHWA side gusset coffee bag", ar: "كيس قهوة بطيات جانبية من صحوة" },
  cup: { code: "CUP-ICE-PINT", brand: "Halawa", en: "Halawa ice cream cup in rose", ar: "كوب آيس كريم من حلاوة باللون الوردي" },
  dropper: { code: "DROPPER_BOTTLE", brand: "NADA", en: "NADA serum dropper bottle", ar: "زجاجة سيروم بقطارة من ندى" },
  "tea-tin": { code: "ROUND_TIN", brand: "Waraqa", en: "Waraqa round tea tin in deep green", ar: "علبة شاي معدنية دائرية من ورقة باللون الأخضر الداكن" },
} as const;
export type R6ModelId = keyof typeof R6_MODELS;
const MODEL_IDS = Object.keys(R6_MODELS) as R6ModelId[];

const VIEW: Record<"iso" | "front", Localized> = { iso: { en: "three-quarter view", ar: "منظر جانبي" }, front: { en: "front view", ar: "منظر أمامي" } };
const TONE: Record<"dark" | "light", Localized> = { dark: { en: "dark studio background", ar: "خلفية داكنة" }, light: { en: "light grey studio background", ar: "خلفية رمادية فاتحة" } };
const describe = (id: R6ModelId, ...parts: Localized[]): Localized => ({
  en: [R6_MODELS[id].en, ...parts.map((p) => p.en)].join(", "),
  ar: [R6_MODELS[id].ar, ...parts.map((p) => p.ar)].join("، "),
});

/** 1. Hero stills, 640x800 (4:5) studio shots. Keys: `<model>-iso-dark`, `<model>-iso-light`, `<model>-front-dark`. */
const hero: Record<string, R6Image> = {};
/** 1b. Transparent cutouts, 480x480 (product centred, transparent padding). Keys: `<model>-iso`, `<model>-front`. */
const cutouts: Record<string, R6Image> = {};
for (const id of MODEL_IDS) {
  for (const [v, tones] of [["iso", ["dark", "light"]], ["front", ["dark"]]] as const) {
    for (const t of tones) hero[`${id}-${v}-${t}`] = img(`hero/${id}-${v}-${t}`, describe(id, VIEW[v], TONE[t]), false, true);
    cutouts[`${id}-${v}`] = img(`cutouts/${id}-${v}`, describe(id, VIEW[v]), true, true);
  }
}

/** 2. /start hero collage: cutouts at varied angles + "process" pieces from our own outputs. */
const COLLAGE_ANGLES: [string, R6ModelId][] = [
  ["mailer-tilt", "mailer"], ["rigid-box-high", "rigid-box"], ["drawer-box-side", "drawer-box"], ["tuck-carton-turn", "tuck-carton"], ["perfume-turn", "perfume"],
  ["can-turn", "can"], ["pouch-turn", "pouch"], ["jar-high", "jar"], ["cup-turn", "cup"], ["tube-turn", "tube"],
];
const collage: Record<string, R6Image> = Object.fromEntries(COLLAGE_ANGLES.map(([k, id]) => [k, img(`collage/${k}`, describe(id), true, true)]));
collage["process-dieline"] = img("collage/process-dieline", { en: "The NOUR mailer laid flat as its printed dieline", ar: "علبة شحن نور مفرودة كقالب قص مطبوع" }, true, true);
collage["swatch-card"] = img("ui/swatch-card", { en: "Brand colour card with four saved colours and their hex codes", ar: "بطاقة ألوان العلامة بأربعة ألوان محفوظة وأكوادها" }, true, true);
for (const l of ["en", "ar"] as const) {
  collage[`price-badge-${l}`] = img(`ui/price-badge-${l}`, { en: "Live price badge from the designer: quantity, unit price and delivery days", ar: "شارة السعر المباشر من أداة التصميم: الكمية وسعر القطعة ومدة التسليم" }, true, false);
  collage[`phone-designer-${l}`] = img(`ui/phone-designer-${l}`, { en: "Phone showing the Elba designer with a mailer box in 3D", ar: "هاتف يعرض أداة التصميم في علبة مع علبة شحن ثلاثية الأبعاد" }, true, false);
}

/** 4. UI mockups: real screens, cropped and framed (rounded corners, soft shadow, transparent margin). */
const UI_ITEMS: [string, Localized, boolean][] = [
  ["designer", { en: "The Elba designer with a mailer box in 3D, the artwork panel and the live price", ar: "أداة التصميم في علبة مع علبة شحن ثلاثية الأبعاد ولوحة التصميم والسعر المباشر" }, false],
  ["price-badge", { en: "Live price badge: quantity, unit price and delivery days", ar: "شارة السعر المباشر: الكمية وسعر القطعة ومدة التسليم" }, false],
  ["checkout-summary", { en: "Checkout summary with printer, quantity, VAT 14% and total", ar: "ملخص الدفع مع المطبعة والكمية وضريبة القيمة المضافة 14٪ والإجمالي" }, true],
  ["order-timeline", { en: "Order tracking timeline from payment to delivery", ar: "خط متابعة الطلب من الدفع حتى التسليم" }, true],
  ["vendor-job", { en: "Print job card in the vendor portal", ar: "بطاقة مهمة طباعة في بوابة المطابع" }, true],
  ["admin-kpi", { en: "Admin overview KPI tile", ar: "مؤشر أداء في لوحة الإدارة" }, true],
  ["phone-designer", { en: "Phone showing the Elba designer", ar: "هاتف يعرض أداة التصميم في علبة" }, false],
];
/** Keys: `<item>-en`, `<item>-ar`, plus `swatch-card`. `sample: true` = seeded demo data on screen. */
const ui: Record<string, R6Image> = {};
for (const [k, alt, sample] of UI_ITEMS) for (const l of ["en", "ar"] as const) ui[`${k}-${l}`] = img(`ui/${k}-${l}`, alt, true, sample);
ui["swatch-card"] = collage["swatch-card"];

/** 5. Card fan: 8 tall 600x900 brand sample cards. Always label with SAMPLE_LABEL. */
export const R6_CARDS = [
  { id: "nour", model: "mailer", name: "NOUR", nameAr: "نور", en: "Atelier mailer", ar: "علبة شحن أتيليه" },
  { id: "attar", model: "rigid-box", name: "ATTAR", nameAr: "عطار", en: "Perfume gift box", ar: "علبة هدايا عطور" },
  { id: "halawa", model: "drawer-box", name: "Halawa", nameAr: "حلاوة", en: "Sweets drawer box", ar: "علبة درج حلويات" },
  { id: "waraqa", model: "tuck-carton", name: "Waraqa", nameAr: "ورقة", en: "Tea carton", ar: "كرتونة شاي" },
  { id: "sahwa", model: "pouch", name: "SAHWA", nameAr: "صحوة", en: "Coffee pouch", ar: "كيس قهوة" },
  { id: "nada", model: "jar", name: "NADA", nameAr: "ندى", en: "Skin care jar", ar: "برطمان عناية بالبشرة" },
  { id: "sahwa-can", model: "can", name: "SAHWA", nameAr: "صحوة", en: "Cold brew can", ar: "علبة قهوة باردة" },
  { id: "attar-perfume", model: "perfume", name: "ATTAR", nameAr: "عطار", en: "Perfume bottle label", ar: "ملصق زجاجة عطر" },
] as const satisfies readonly { id: string; model: R6ModelId; name: string; nameAr: string; en: string; ar: string }[];
const cards: Record<string, R6Image> = Object.fromEntries(
  R6_CARDS.map((c) => [c.id, img(`cards/${c.id}`, { en: `${c.name}: ${c.en} (sample design, fictional brand)`, ar: `${c.nameAr}: ${c.ar} (تصميم توضيحي لعلامة غير حقيقية)` }, false, true)]),
);

/** 3. Turntable loops (5 s, muted, seamless). Play only when visible and not under prefers-reduced-motion (WCAG 2.2.2 / 2.3.3). */
const LOOP_IDS = ["mailer", "perfume", "can", "pouch", "rigid-box"] as const satisfies readonly R6ModelId[];
const loops: Record<(typeof LOOP_IDS)[number], R6Video> = Object.fromEntries(
  LOOP_IDS.map((id) => {
    const b = `${ROOT}/loops/${id}`;
    const alt = describe(id, { en: "turning on a dark studio background", ar: "تدور على خلفية داكنة" });
    return [id, {
      sources: [
        { src: `${b}-1080p.webm`, type: "video/webm", height: 1080 },
        { src: `${b}-1080p.mp4`, type: "video/mp4", height: 1080 },
        { src: `${b}-720p.webm`, type: "video/webm", height: 720 },
        { src: `${b}-720p.mp4`, type: "video/mp4", height: 720 },
      ],
      poster: img(`loops/${id}-poster`, alt, false, true),
      width: 1920,
      height: 1080,
      alt,
      sample: true,
    } satisfies R6Video];
  }),
) as Record<(typeof LOOP_IDS)[number], R6Video>;

export const R6 = { hero, cutouts, collage, ui, cards, loops } as const;

/** Localised alt text for a still. */
export const altOf = (a: R6Image, locale: Locale) => a.alt[locale];
