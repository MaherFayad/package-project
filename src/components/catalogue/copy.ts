import type { LocalizedText } from "@/types";
import { EGYPT_BADGE } from "@/data/catalogue/order-mode";

/**
 * Catalogue copy (MSA for Egypt, noun-form labels, no diacritics). Kept next to the
 * components so the catalogue merges without touching the shared dictionaries.
 */
const t = (en: string, ar: string): LocalizedText => ({ ar, en });

export const COPY = {
  metaTitle: t("Packaging catalogue: every type in 3D", "كتالوج العبوات: كل الأنواع بتقنية ثلاثية الأبعاد"),
  metaDescription: t(
    "Browse 400+ packaging models in 3D by family and FEFCO / ECMA code. Filter what Egyptian printers make, design free, and get an instant price or a quote.",
    "تصفح أكثر من 400 نموذج عبوة ثلاثي الأبعاد حسب العائلة وكود FEFCO أو ECMA. اعرض ما تصنعه المطابع المصرية، وصمم مجانا، واحصل على سعر فوري أو عرض سعر.",
  ),
  eyebrow: t("Packaging catalogue", "كتالوج العبوات"),
  title: t("Every packaging type, in 3D", "كل أنواع العبوات بتقنية ثلاثية الأبعاد"),
  lead: t(
    "{count} models from FEFCO and ECMA styles to cups, pouches, bottles and cans. Start with what Egyptian printers make, or browse the world.",
    "{count} نموذج، من طرازات FEFCO وECMA إلى الأكواب والأكياس والزجاجات والعلب المعدنية. ابدأ بما تصنعه المطابع المصرية، أو تصفح العالم.",
  ),
  statModels: t("models", "نموذج"),
  statEgypt: t("available in Egypt", "متاح في مصر"),
  statInstant: t("with an instant price", "بسعر فوري"),
  statFamilies: t("families", "عائلة"),
  search: t("Search the catalogue", "البحث في الكتالوج"),
  searchPlaceholder: t("Name or code, e.g. mailer, FEFCO 0427", "ابحث بالاسم أو الكود"),
  scopeLabel: t("Where it is available", "مكان التوفر"),
  scopeEgypt: t("Available in Egypt", "متاح في مصر"),
  scopeWorld: t("Worldwide", "عالميا"),
  familiesLabel: t("Families", "العائلات"),
  subFamiliesLabel: t("Sub-families", "الفئات الفرعية"),
  all: t("All", "الكل"),
  results: t("{count} models", "{count} نموذج"),
  resultsFor: t("{count} models for “{q}”", "{count} نموذج لـ «{q}»"),
  emptyTitle: t("No models match", "لا توجد نماذج مطابقة"),
  emptyBody: t("Try another word or code, or switch to Worldwide.", "جرب كلمة أو كودا آخر، أو اختر عالميا."),
  emptyReset: t("Clear filters", "مسح عوامل التصفية"),
  /** Same wording on every surface (B-20): src/data/catalogue/order-mode.ts EGYPT_BADGE. */
  egypt: EGYPT_BADGE,
  egyptLong: {
    local: t("Egyptian converters make this at volume.", "تصنعه مصانع مصرية بكميات تجارية."),
    imported: t("Mostly imported; local stock or custom runs through importers.", "مستورد في الغالب، ويتوفر من خلال المستوردين بمخزون أو تصنيع خاص."),
    rare: t("Hard to source in Egypt; we route the request to importers and regional converters.", "صعب التوفير في مصر، لذا نوجه الطلب إلى المستوردين والمصانع الإقليمية."),
  },
  instant: t("Instant price", "سعر فوري"),
  quote: t("By quote", "بعرض سعر"),
  noStandard: t("No FEFCO / ECMA code", "دون كود FEFCO أو ECMA"),
  regions: t("Common in", "شائع في"),
  regionNames: { MENA: t("MENA", "الشرق الأوسط وشمال أفريقيا"), GCC: t("GCC", "الخليج"), EU: t("EU", "أوروبا"), US: t("US", "أمريكا"), ASIA: t("Asia", "آسيا") },
  // detail page
  back: t("Catalogue", "الكتالوج"),
  standard: t("Standard", "المعيار"),
  family: t("Family", "العائلة"),
  availability: t("Availability in Egypt", "التوفر في مصر"),
  sizes: t("Common sizes", "المقاسات الشائعة"),
  defaultSize: t("Default size", "المقاس الافتراضي"),
  axes: { L: t("Length", "الطول"), W: t("Width", "العرض"), H: t("Height", "الارتفاع"), D: t("Diameter", "القطر"), G: t("Gusset", "القاعدة"), topD: t("Top diameter", "قطر الفوهة"), bottomD: t("Base diameter", "قطر القاعدة"), rimD: t("Rim diameter", "قطر الحافة") },
  mm: t("mm", "مم"),
  ml: t("ml", "مل"),
  designCta: t("Design it free", "صممها مجانا"),
  sizesPrices: t("Sizes and prices: {name}", "المقاسات والأسعار: {name}"),
  quoteCta: t("Request a quote", "اطلب عرض سعر"),
  instantTitle: t("Instant price from Egyptian printers", "سعر فوري من مطابع مصرية"),
  instantLabelsTitle: t("Instant price for the labels", "سعر فوري للملصقات"),
  instantBody: t(
    "Design it free in 3D, then compare instant prices from {count} vetted printers. Prices include 14% VAT at checkout.",
    "صممها مجانا بتقنية ثلاثية الأبعاد، ثم قارن الأسعار الفورية من {count} مطبعة معتمدة. تضاف ضريبة القيمة المضافة 14% عند الدفع.",
  ),
  quoteTitle: t("Designed free, priced by quote", "تصميم مجاني وتسعير بعرض سعر"),
  quoteBody: t(
    "No printer on Elba prices this format automatically yet. Send a request: a suitable converter replies with a price within 2 working days.",
    "لا توجد مطبعة على علبة تسعر هذا النوع تلقائيا بعد. أرسل طلبا وسيرد مصنع مناسب بالسعر خلال يومي عمل.",
  ),
  viewerHint: t("Drag to turn. Use the arrow keys when the viewer is focused.", "اسحب للتدوير، أو استخدم مفاتيح الأسهم عند تحديد العارض."),
  viewerLoading: t("Loading the 3D model", "جار تحميل النموذج ثلاثي الأبعاد"),
  related: t("More in {name}", "المزيد من {name}"),
  hostNote: t("Shown inside a FEFCO 0200 box of its host size.", "معروضة داخل علبة FEFCO 0200 بمقاس العلبة المضيفة."),
  // quote form
  formTitle: t("Quote request", "طلب عرض سعر"),
  formQty: t("Quantity", "الكمية"),
  formSize: t("Size", "المقاس"),
  formNotes: t("Notes for the converter (optional)", "ملاحظات للمصنع (اختياري)"),
  formNotesHint: t("Material, print colours, finishes, delivery city. No personal data needed.", "الخامة وعدد الألوان والتشطيبات ومدينة التسليم، دون بيانات شخصية."),
  formSubmit: t("Send request", "إرسال الطلب"),
  formSending: t("Sending", "جار الإرسال"),
  formSent: t("Request sent. We reply on your account phone within 2 working days.", "تم إرسال الطلب، وسنرد على رقم هاتف حسابك خلال يومي عمل."),
  formSignIn: t("Sign in to request a quote", "سجل الدخول لطلب عرض سعر"),
  formPrivacy: t(
    "We share the request with matching converters only, under Egypt's Personal Data Protection Law 151/2020.",
    "نشارك الطلب مع المصانع المناسبة فقط، وفقا لقانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020.",
  ),
  formErrorQty: t("Enter a quantity from 100 to 1,000,000.", "أدخل كمية من 100 إلى 1,000,000."),
  formError: t("Could not send the request. Try again.", "تعذر إرسال الطلب، حاول مرة أخرى."),
  formRateLimited: t("Too many requests. Try again in a minute.", "طلبات كثيرة، حاول بعد دقيقة."),
} as const;

/** Fill "{name}" placeholders. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
