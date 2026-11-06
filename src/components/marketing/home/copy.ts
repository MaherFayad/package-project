import type { Locale } from "@/types";

/**
 * Home page copy (R6). Arabic first: MSA natural for Egypt, noun-form labels, no diacritics,
 * Western digits. Page-local on purpose so the shared dictionaries stay conflict-free while the
 * foundation branch rebuilds the chrome; the English object fixes the shape and the Arabic one
 * must match it key for key (type `Widen<typeof en>`).
 *
 * Every number is passed in from real data ({models}, {groups}, {finishes}, {printers}, {days},
 * {price}, {min}, {max}). No customer names, quotes, logos or counters we cannot back.
 */
const en = {
  hero: {
    titles: ["Packaging worthy of your brand", "Design it in 3D. Print it in Egypt."],
    lead: "Design your printed box free on a live 3D model, see the price instantly and order from vetted Egyptian printers.",
    primary: "Start designing free",
    secondary: "Browse box styles",
    pause: "Pause rotation",
    play: "Rotate the box",
    mediaAlt: "A printed mailer box turning on our 3D model",
  },
  statement: {
    lead: "A box for everything you sell.",
    rest: " For online stores, cafés, cosmetics and gifts, in your size, your print and your finish.",
  },
  rail: {
    label: "From the model library",
    pause: "Pause the strip",
    play: "Play the strip",
  },
  feature: {
    title: "Design your box right in the browser",
    body: "Upload your logo, pick colours and Arabic or Latin type, and see it on a 3D model before you print. No software, no designer, no fees.",
    link: "Open the designer",
    prompt: "Your brand name",
    chipTitle: "500 mailer boxes",
    chipValue: "{price} per box",
    chipNote: "Setup and delivery included, ex-VAT",
  },
  everywhere: {
    title: "Every step in one place.",
    titleRest: "From the idea to your door.",
    cards: [
      { title: "Design on a live model", body: "Real cuts, glue flaps and folds for every model, sized to the millimetre.", link: "Open the designer" },
      { title: "Run the whole order", body: "Design, price, payment and delivery in one account.", link: "Your orders" },
      { title: "Print at a vetted printer", body: "{printers} {printersWord} in Egypt check every file and send a proof before printing.", link: "Meet the printers" },
    ],
    nodes: ["Design", "Price", "Payment", "Printer", "Delivery"],
    hub: "Elba",
  },
  delivery: {
    title: "Delivered across Egypt",
    cardTitle: "Delivery to 27 governorates",
    cardBody: "Boxes ship flat to cut shipping cost, and you see the delivery time before you pay: {days} {daysWord} to Greater Cairo for 500 mailer boxes.",
    orderTitle: "Mailer box",
    orderQty: "500 boxes",
    orderPrice: "{price} per box",
    orderDays: "Delivery in {days} {daysWord}",
    orderCta: "Order",
    zones: ["Greater Cairo", "Alexandria", "Delta", "Canal", "Upper Egypt"],
  },
  anyone: {
    title: "For every business, from the first order to thousands of boxes",
    cards: [
      { title: "Online stores", body: "Mailer boxes that protect the product and open like a gift." },
      { title: "Restaurants and cafés", body: "Pizza and takeaway boxes printed with your name." },
      { title: "Cosmetics and care", body: "Folding cartons with gloss or soft-touch finishes." },
    ],
    cta: "Browse box styles",
  },
  designer: {
    title: "Meet your 3D designer",
    narrowTitle: "Watch it turn",
    narrowBody: "Rotate, zoom and open the box to check every side before you print.",
    wideTitle: "Design with no experience",
    wideBody: "Arabic and Latin fonts, artwork that snaps to the fold lines and autosave on every change.",
    prompt: "Add my logo to the lid",
    link: "Open the designer",
  },
  wall: {
    title: "{models} models in one library",
    body: "Shipping boxes, cartons, rigid boxes, trays, tubes, bottles, pouches and cans, in {groups} groups, each with its real dieline.",
    link: "Browse the catalogue",
    pause: "Pause the wall",
    play: "Play the wall",
  },
  finishes: {
    title: "Finishes you see before you print",
    body: "{finishes} finishes previewed on the model the way they will print: lamination, spot UV, varnish, hot foil, emboss and deboss.",
    link: "See the finishes",
    names: ["Matte lamination", "Gloss lamination", "Spot UV", "Soft-touch lamination", "Varnish", "Hot foil", "Emboss", "Deboss"],
  },
  stats: {
    title: "Everything you need to print your box",
    checkoutTitle: "A clear price before you order",
    rule: "{price} per box for 500 mailer boxes, setup and delivery to Greater Cairo included. VAT 14% is shown separately.",
    items: [
      { label: "Models in the library" },
      { label: "{printersWord}" },
      { label: "{daysWord} to Greater Cairo" },
      { label: "Boxes minimum order" },
    ],
    note: "Numbers come from our model library, our printers and the pricing engine, and refresh every hour.",
    secureTitle: "Secure payment, clear invoice",
    payChips: ["Meeza or Visa card", "Mobile wallet", "Fawry", "InstaPay"],
    secureBody: "Pay by card, mobile wallet, Fawry or InstaPay. Every order comes with an invoice showing VAT 14%.",
    receipt: {
      title: "Order summary",
      line: "Mailer box × 500",
      setup: "Setup and die",
      delivery: "Delivery, Greater Cairo",
      included: "Included",
      subtotal: "Subtotal",
      vat: "VAT 14%",
      total: "Total",
      pay: "Pay",
    },
  },
  steps: {
    title: "Start your box today",
    items: ["Pick a model and size", "Design and preview", "Order and delivery"],
    cta: "Start designing free",
    pause: "Pause the steps",
    play: "Play the steps",
  },
};

type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
export type HomeCopy = Widen<typeof en>;

const ar: HomeCopy = {
  hero: {
    titles: ["علبة تليق بعلامتك", "صمم في ثلاثة أبعاد، واطبع في مصر"],
    lead: "صمم علبتك المطبوعة مجانا على نموذج حي ثلاثي الأبعاد، واعرف السعر فورا، واطلب من مطابع مصرية معتمدة.",
    primary: "ابدأ التصميم مجانا",
    secondary: "تصفح النماذج",
    pause: "إيقاف الدوران",
    play: "تدوير العلبة",
    mediaAlt: "علبة شحن مطبوعة تدور على نموذجنا ثلاثي الأبعاد",
  },
  statement: {
    lead: "علبة لكل ما تبيعه.",
    rest: " للمتجر الإلكتروني والمقهى ومستحضرات التجميل والهدايا، بمقاسك وطباعتك وتشطيبك.",
  },
  rail: {
    label: "من مكتبة النماذج",
    pause: "إيقاف الشريط",
    play: "تشغيل الشريط",
  },
  feature: {
    title: "صمم علبتك داخل المتصفح",
    body: "ارفع شعارك واختر الألوان والخطوط العربية أو اللاتينية، وشاهد التصميم على نموذج ثلاثي الأبعاد قبل الطباعة. دون برامج ودون مصمم ودون رسوم.",
    link: "فتح المصمم",
    prompt: "اسم علامتك",
    chipTitle: "500 علبة شحن",
    chipValue: "{price} للعلبة",
    chipNote: "شامل الإعداد والتوصيل، قبل الضريبة",
  },
  everywhere: {
    title: "كل خطوة في مكان واحد.",
    titleRest: "من الفكرة إلى باب بيتك.",
    cards: [
      { title: "تصميم على نموذج حي", body: "قص وطي ولسان لصق حقيقي لكل نموذج، بمقاسك بالمليمتر.", link: "فتح المصمم" },
      { title: "إدارة الطلب كله", body: "التصميم والسعر والدفع والتوصيل في حساب واحد.", link: "طلباتي" },
      { title: "طباعة عند مطبعة معتمدة", body: "{printers} {printersWord} في مصر تراجع كل ملف وترسل بروفة قبل الطباعة.", link: "تعرف على المطابع" },
    ],
    nodes: ["التصميم", "السعر", "الدفع", "المطبعة", "التوصيل"],
    hub: "علبة",
  },
  delivery: {
    title: "توصيل إلى كل محافظات مصر",
    cardTitle: "التوصيل إلى 27 محافظة",
    cardBody: "تشحن العلب مسطحة لتقل تكلفة الشحن، وتعرف مدة التسليم قبل الدفع: {days} {daysWord} إلى القاهرة الكبرى لطلب 500 علبة شحن.",
    orderTitle: "علبة شحن",
    orderQty: "500 علبة",
    orderPrice: "{price} للعلبة",
    orderDays: "التسليم خلال {days} {daysWord}",
    orderCta: "طلب",
    zones: ["القاهرة الكبرى", "الإسكندرية", "الدلتا", "القناة", "الصعيد"],
  },
  anyone: {
    title: "لكل نشاط، من أول طلب إلى آلاف العلب",
    cards: [
      { title: "المتاجر الإلكترونية", body: "علب شحن تحمي المنتج وتفتح كأنها هدية." },
      { title: "المطاعم والمقاهي", body: "علب بيتزا وعلب تيك أواي مطبوعة باسمك." },
      { title: "مستحضرات التجميل والعناية", body: "علب كرتون رقيقة بتشطيب لامع أو مخملي." },
    ],
    cta: "تصفح النماذج",
  },
  designer: {
    title: "تعرف على مصممك ثلاثي الأبعاد",
    narrowTitle: "معاينة من كل الجهات",
    narrowBody: "حرك العلبة وكبرها وافتحها لترى كل وجه قبل الطباعة.",
    wideTitle: "تصميم دون خبرة سابقة",
    wideBody: "خطوط عربية ولاتينية، وتصميم يلتزم بخطوط الطي، وحفظ تلقائي مع كل تعديل.",
    prompt: "إضافة الشعار على الغطاء",
    link: "فتح المصمم",
  },
  wall: {
    title: "{models} نموذجا في مكتبة واحدة",
    body: "علب شحن وكرتون وعلب فاخرة وصوان وأنابيب وزجاجات وأكياس وعلب معدنية، في {groups} مجموعات، ولكل نموذج فرد حقيقي.",
    link: "تصفح الكتالوج",
    pause: "إيقاف الحركة",
    play: "تشغيل الحركة",
  },
  finishes: {
    title: "تشطيبات تراها قبل أن تطبعها",
    body: "{finishes} تشطيبات تظهر على النموذج كما ستطبع: سلوفان وطلاء UV موضعي وورنيش وبصمة حرارية وطباعة بارزة وغائرة.",
    link: "عرض التشطيبات",
    names: ["سلوفان مطفي", "سلوفان لامع", "طلاء UV موضعي", "سلوفان مخملي", "ورنيش", "بصمة حرارية", "طباعة بارزة", "طباعة غائرة"],
  },
  stats: {
    title: "كل ما تحتاجه لتطبع علبتك",
    checkoutTitle: "سعر واضح قبل أن تطلب",
    rule: "{price} للعلبة لطلب 500 علبة شحن، شامل الإعداد والتوصيل إلى القاهرة الكبرى، وتظهر ضريبة القيمة المضافة 14% بشكل منفصل.",
    items: [{ label: "نموذج في المكتبة" }, { label: "{printersWord}" }, { label: "{daysWord} للتسليم في القاهرة الكبرى" }, { label: "علبة حد أدنى للطلب" }],
    note: "الأرقام من مكتبة النماذج والمطابع ومحرك الأسعار، وتتحدث كل ساعة.",
    secureTitle: "دفع آمن وفاتورة واضحة",
    payChips: ["بطاقة ميزة أو فيزا", "محفظة إلكترونية", "فوري", "إنستاباي"],
    secureBody: "ادفع بالبطاقة أو المحفظة الإلكترونية أو فوري أو إنستاباي، ومع كل طلب فاتورة توضح ضريبة القيمة المضافة 14%.",
    receipt: {
      title: "ملخص الطلب",
      line: "علبة شحن × 500",
      setup: "الإعداد والفورمة",
      delivery: "التوصيل، القاهرة الكبرى",
      included: "مشمول",
      subtotal: "الإجمالي الفرعي",
      vat: "ضريبة القيمة المضافة 14%",
      total: "الإجمالي",
      pay: "الدفع",
    },
  },
  steps: {
    title: "ابدأ علبتك اليوم",
    items: ["اختيار النموذج والمقاس", "التصميم والمعاينة", "الطلب والتوصيل"],
    cta: "ابدأ التصميم مجانا",
    pause: "إيقاف الخطوات",
    play: "تشغيل الخطوات",
  },
};

export function homeCopy(locale: Locale): HomeCopy {
  return locale === "ar" ? ar : (en as HomeCopy);
}

/** {name} interpolation. */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * Counted noun after a Western-digit number. Arabic: 3 to 10 take the plural ("few"), 11 to 99
 * (and hundreds ending in 11 to 99) the accusative singular ("many"), round hundreds and 1 to 2
 * the singular ("one").
 */
export function counted(locale: Locale, n: number, ar: { one: string; few: string; many: string }, en: { one: string; other: string }): string {
  if (locale === "en") return n === 1 ? en.one : en.other;
  const r = n % 100;
  if (r >= 3 && r <= 10) return ar.few;
  if (r >= 11) return ar.many;
  return ar.one;
}

export function daysWord(locale: Locale, n: number): string {
  return counted(locale, n, { one: "يوم", few: "أيام", many: "يوما" }, { one: "day", other: "days" });
}

export function printersWord(locale: Locale, n: number): string {
  return counted(locale, n, { one: "مطبعة معتمدة", few: "مطابع معتمدة", many: "مطبعة معتمدة" }, { one: "vetted printer", other: "vetted printers" });
}
