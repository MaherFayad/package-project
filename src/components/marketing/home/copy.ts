import type { Locale } from "@/types";

/**
 * Home page copy. Arabic first: MSA natural for Egypt, noun-form labels, no diacritics,
 * Western digits. Page-local on purpose; the English object fixes the shape and the Arabic one
 * must match it key for key (type `Widen<typeof en>`).
 *
 * Printing first (docs/audit/simplicity-2026-11/printing-first.md): the page sells printed
 * packaging (made by vetted Egyptian printers, sold and guaranteed by Elba, paid online,
 * delivered by Bosta). The free 3D designer is the easy way in, one supporting section.
 * Written for a small shop owner on a phone: no FEFCO, dieline, bleed or preflight. Every number
 * is passed in from real data ({models}, {groups}, {finishes}, {printers}, {days}, {price},
 * {min}, {max}). No customer names, quotes, logos or counters we cannot back.
 * Facts: quantities (QTY_TIERS, maxInstantQty), lead time + transit (src/lib/pricing), proof at
 * checkout and quality check (src/lib/orders/state.ts), reprint or refund within 30 days (returns
 * policy in src/i18n/en.ts), payment (PAYMENT_METHODS, Paymob), delivery (src/lib/shipping, Bosta),
 * printed products (printer capabilities in prisma/seed.ts; quote-only stock in
 * src/data/catalogue/order-mode.ts).
 */
const en = {
  hero: {
    titles: ["Printed boxes for your brand", "Delivered to your door"],
    lead: "Custom boxes with your logo, printed by vetted Egyptian printers, guaranteed by Elba and delivered across Egypt. See yours in 3D with the exact price before you pay.",
    primary: "Get your box price",
    secondary: "See what we print",
    trustLabel: "Why Elba",
    trust: ["Printed by vetted Egyptian printers", "Price known before you pay", "Delivery across Egypt"],
    pause: "Pause rotation",
    play: "Rotate the box",
    mediaAlt: "A mailer box printed with a brand's logo, turning",
  },
  products: {
    title: "What we print for you",
    sub: "Choose the packaging, add your logo, and a vetted printer makes it. Add a finish such as foil, spot UV or soft-touch if you like.",
    from: "{price} each for 500 pieces",
    items: [
      { key: "mailer", title: "Mailer and shipping boxes", body: "Strong boxes that protect your orders on the way and open like a gift." },
      { key: "carton", title: "Product boxes", body: "Printed card boxes for cosmetics, tea, medicine and shop shelves." },
      { key: "food", title: "Food boxes", body: "Pizza boxes and carry boxes with a handle, for restaurants, cafés and bakeries." },
      { key: "rigid", title: "Rigid gift boxes", body: "Sturdy lid-and-base boxes wrapped in printed paper, for perfume, gifts and launches." },
      { key: "labels", title: "Labels for bottles, jars and cans", body: "Roll labels on paper or on white or clear film, sized to your container." },
      { key: "pouches", title: "Pouches and squeeze tubes", body: "Stand-up pouches for coffee and snacks, and printed tubes for creams." },
    ],
    note: "Prices are per piece for 500 pieces in a standard size, with setup and delivery to Greater Cairo included, paid online, before VAT 14%. Cups, paper bags and moulded pulp are priced on request.",
    cta: "Get your box price",
  },
  trust: {
    title: "Elba stands behind every order",
    items: [
      { key: "reprint", title: "Reprint or refund", body: "If your boxes differ from the approved proof, arrive damaged or short, tell us within 30 days of delivery and we reprint or refund them, your choice." },
      { key: "proof", title: "A proof before printing", body: "Nothing prints until you approve the proof of your box. {printers} {printersWord} make every order." },
      { key: "pay", title: "Secure payment, one receipt", body: "Pay by card, mobile wallet, Fawry or InstaPay. You buy from Elba, with one receipt showing VAT 14%." },
      { key: "delivery", title: "Delivered and tracked", body: "Shipped with Bosta to every governorate. You see the delivery date before you pay and follow every step in your account." },
    ],
  },
  how: {
    title: "How ordering works",
    sub: "Three steps from your logo to boxes at your door.",
    step: "Step {n}",
    steps: [
      { title: "Choose your box", body: "Pick the box for what you sell, from mailer boxes to gift boxes." },
      { title: "Add your logo, see the price", body: "Place your logo on the box in the free 3D preview and see the exact price for your size and quantity." },
      { title: "Approve, pay, receive", body: "Approve the proof and pay online. A vetted printer makes your boxes and Bosta delivers them." },
    ],
    daysLine: "For example, 500 mailer boxes reach Greater Cairo in {days} {daysWord}.",
    cta: "Get your box price",
  },
  faq: {
    title: "Questions about ordering and printing",
    items: [
      { key: "min", q: "What is the smallest order?", a: "You get an instant price from {min} boxes up to {max} boxes. For more, ask for a quote." },
      { key: "days", q: "How long until my boxes arrive?", a: "It is the printer's production time plus delivery, and you see the date before you pay. For example, 500 mailer boxes reach Greater Cairo in {days} {daysWord}." },
      { key: "designer", q: "Do I need a designer?", a: "No. Upload your logo or a ready design in the free 3D preview, on your phone or computer, and see the result right away." },
      { key: "quote", q: "What if the box I need is not listed?", a: "Browse the catalogue and ask for a quote. Our team replies with a price." },
    ],
  },
  final: {
    title: "Your boxes, printed and delivered",
    body: "See your box and its exact price in seconds. You pay only when you order.",
    cta: "Get your box price",
  },
};

type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
export type HomeCopy = Widen<typeof en>;

const ar: HomeCopy = {
  hero: {
    titles: ["علب مطبوعة بشعار مشروعك", "تصلك حتى بابك"],
    lead: "تطبعها بشعارك مطابع مصرية معتمدة، وتضمنها علبة، وتصلك في أي محافظة. شاهد علبتك ثلاثية الأبعاد واعرف سعرها بالضبط قبل الدفع.",
    primary: "معرفة سعر علبتك",
    secondary: "عرض ما نطبعه",
    trustLabel: "لماذا علبة",
    trust: ["مطابع مصرية معتمدة", "السعر معروف قبل الدفع", "توصيل لكل محافظات مصر"],
    pause: "إيقاف الدوران",
    play: "تدوير العلبة",
    mediaAlt: "علبة بريدية مطبوعة بشعار علامة تجارية تدور",
  },
  products: {
    title: "ما نطبعه لك",
    sub: "اختر العبوة وأضف شعارك، وتنفذها مطبعة معتمدة. ويمكنك إضافة تشطيب مثل البصمة الذهبية أو الطلاء اللامع على الشعار أو السلوفان المخملي.",
    from: "{price} للقطعة عند طلب 500 قطعة",
    items: [
      { key: "mailer", title: "علب بريدية وكراتين شحن", body: "علب قوية تحمي طلباتك في الطريق وتفتح كأنها هدية." },
      { key: "carton", title: "علب كرتون للمنتجات", body: "علب كرتون مطبوعة لمستحضرات التجميل والشاي والأدوية ورفوف المتاجر." },
      { key: "food", title: "علب الطعام", body: "علب بيتزا وعلب بمقبض للمطاعم والمقاهي والمخابز." },
      { key: "rigid", title: "علب هدايا صلبة", body: "علب متينة بغطاء وقاعدة مغلفة بورق مطبوع، للعطور والهدايا والإصدارات الخاصة." },
      { key: "labels", title: "ملصقات للزجاجات والبرطمانات والعلب المعدنية", body: "ملصقات على ورق أو على بلاستيك أبيض أو شفاف، بمقاس عبوتك." },
      { key: "pouches", title: "أكياس وأنابيب مطبوعة", body: "أكياس قائمة للقهوة والوجبات الخفيفة، وأنابيب مطبوعة للكريمات." },
    ],
    note: "الأسعار للقطعة الواحدة عند طلب 500 قطعة بمقاس قياسي، شاملة التجهيز والتوصيل إلى القاهرة الكبرى بعد خصم الدفع مقدما، قبل ضريبة القيمة المضافة 14%. الأكواب والأكياس الورقية وعبوات اللب المضغوط بعرض سعر.",
    cta: "معرفة سعر علبتك",
  },
  trust: {
    title: "علبة مسؤولة عن طلبك من البداية إلى النهاية",
    items: [
      { key: "reprint", title: "إعادة الطباعة أو رد المبلغ", body: "إذا اختلفت علبك عن البروفة المعتمدة أو وصلت تالفة أو ناقصة، أبلغنا خلال 30 يوما من التسليم ونعيد طباعتها أو نرد المبلغ، حسب اختيارك." },
      { key: "proof", title: "بروفة قبل الطباعة", body: "لا تبدأ الطباعة إلا بعد أن تعتمد بروفة علبتك. وتنفذ الطلبات {printers} {printersWord}." },
      { key: "pay", title: "دفع آمن وإيصال واحد", body: "ادفع بالبطاقة أو المحفظة الإلكترونية أو فوري أو إنستاباي. تشتري من علبة مباشرة، وتحصل على إيصال واحد يوضح ضريبة القيمة المضافة 14%." },
      { key: "delivery", title: "توصيل ومتابعة", body: "نشحن مع بوسطة إلى كل محافظات مصر، وتعرف موعد التسليم قبل الدفع، وتتابع كل خطوة من حسابك." },
    ],
  },
  how: {
    title: "كيف تطلب علبك",
    sub: "ثلاث خطوات من شعارك حتى وصول العلب إلى بابك.",
    step: "الخطوة {n}",
    steps: [
      { title: "اختر علبتك", body: "اختر العلبة المناسبة لما تبيعه، من العلب البريدية حتى علب الهدايا." },
      { title: "أضف شعارك واعرف السعر", body: "ضع شعارك على العلبة في المعاينة ثلاثية الأبعاد المجانية، واعرف السعر بالضبط لمقاسك وكميتك." },
      { title: "اعتمد وادفع واستلم", body: "اعتمد البروفة وادفع إلكترونيا، ثم تطبع علبك مطبعة معتمدة وتوصلها بوسطة إليك." },
    ],
    daysLine: "فمثلا تصل 500 علبة بريدية إلى القاهرة الكبرى خلال {days} {daysWord}.",
    cta: "معرفة سعر علبتك",
  },
  faq: {
    title: "أسئلة عن الطلب والطباعة",
    items: [
      { key: "min", q: "ما أقل كمية يمكنني طلبها؟", a: "تحصل على سعر فوري من {min} علبة حتى {max} علبة، وللكميات الأكبر اطلب عرض سعر." },
      { key: "days", q: "متى تصل علبي؟", a: "المدة هي وقت الإنتاج في المطبعة مع التوصيل، وتعرف الموعد قبل الدفع. فمثلا تصل 500 علبة بريدية إلى القاهرة الكبرى خلال {days} {daysWord}." },
      { key: "designer", q: "هل أحتاج إلى مصمم؟", a: "لا. ارفع شعارك أو تصميمك الجاهز في المعاينة ثلاثية الأبعاد المجانية، من هاتفك أو الكمبيوتر، وشاهد النتيجة في الحال." },
      { key: "quote", q: "ماذا لو لم أجد العلبة التي أحتاجها؟", a: "تصفح الكتالوج واطلب عرض سعر، وسيرد فريقنا بالسعر." },
    ],
  },
  final: {
    title: "علبك مطبوعة وتصل إلى بابك",
    body: "شاهد علبتك واعرف سعرها بالضبط في ثوان، ولا تدفع إلا عند الطلب.",
    cta: "معرفة سعر علبتك",
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

export function groupsWord(locale: Locale, n: number): string {
  return counted(locale, n, { one: "مجموعة", few: "مجموعات", many: "مجموعة" }, { one: "group", other: "groups" });
}

export function finishesWord(locale: Locale, n: number): string {
  return counted(locale, n, { one: "تشطيب", few: "تشطيبات", many: "تشطيبا" }, { one: "finish", other: "finishes" });
}

export function modelsWord(locale: Locale, n: number): string {
  return counted(locale, n, { one: "نموذج", few: "نماذج", many: "نموذجا" }, { one: "model", other: "models" });
}

export function printersWord(locale: Locale, n: number): string {
  return counted(locale, n, { one: "مطبعة معتمدة", few: "مطابع معتمدة", many: "مطبعة معتمدة" }, { one: "vetted printer", other: "vetted printers" });
}
