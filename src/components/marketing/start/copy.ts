import type { Locale } from "@/types";

/**
 * Copy for /[locale]/start (R6). Page-local so this landing can ship without touching the shared
 * marketing dictionaries other sessions edit. Arabic first: MSA natural for Egypt, noun-form
 * labels, no diacritics. Placeholders: {price}, {count}, {days}.
 */
const ar = {
  metaTitle: "علبك المطبوعة: معاينة ثلاثية الأبعاد مجانية وسعر فوري",
  metaDescription: "علبك مطبوعة بشعارك لدى مطبعة مصرية معتمدة وتصل إلى بابك. شاهد علبتك ثلاثية الأبعاد واعرف سعرها بالضبط قبل الدفع.",
  hero: {
    word1: "ابدأ",
    word2: "اليوم",
    title: "ابدأ اليوم",
    sub: "علبك مطبوعة بشعارك وتصل إلى بابك. شاهدها ثلاثية الأبعاد واعرف سعرها بالضبط قبل الدفع",
    cta: "معرفة سعر علبتك",
    heroAlt: "علبة بريدية مطبوعة بتصميم نموذجي، معروضة في مصمم علبة ثلاثي الأبعاد",
    chipPrice: "{price} للعلبة",
    chipPriceNote: "عند طلب 500 علبة، قبل الضريبة",
    chipProof: "بروفة ثلاثية الأبعاد",
    chipProofNote: "قبل الطباعة",
    pieceAlt: "نموذج تصميم: {name}",
  },
  choose: {
    title: "اختر علبتك",
    sub: "ابدأ من نوع جاهز بمقاسك، ثم غير الألوان والشعار والنصوص على النموذج مباشرة.",
    previewAlt: "مصمم علبة: نموذج علبة بريدية ثلاثي الأبعاد مع لوحة الألوان والعناصر",
    cta: "معاينة علبتك بشعارك",
    live: "معاينة حية",
    styleAlt: "نوع {name}",
    stylesLabel: "أنواع جاهزة للبدء",
  },
  shine: {
    title: "اجعل علبتك تلمع",
    sub: "جرب البصمة الحرارية والطلاء اللامع الموضعي والسلوفان المخملي، وشاهد أثرها على علبتك قبل الطباعة.",
    alt: "علبة صلبة ببصمة ذهبية، معروضة في المصمم",
    chip: "معاينة ثلاثية الأبعاد",
    finishes: { foil: "بصمة ذهبية", spotUv: "طلاء لامع موضعي", emboss: "طباعة بارزة", softTouch: "سلوفان مخملي", window: "نافذة شفافة" },
    count: "التشطيبات المتاحة: {count}",
  },
  paid: {
    title: "اعرف السعر، وادفع بطريقتك",
    sub: "أسعار فورية من المطابع حتى 2,000 علبة، مع ضريبة القيمة المضافة 14% موضحة في كل طلب.",
    cardTitle: "ملخص الطلب",
    item: "علبة بريدية \u206625 × 18 × 8\u2069 سم",
    qty: "الكمية",
    unit: "سعر العلبة",
    subtotal: "المجموع الفرعي",
    vat: "ضريبة القيمة المضافة 14%",
    total: "الإجمالي",
    delivery: "تصل إلى القاهرة الكبرى خلال {days} {daysWord}",
    pay: "الدفع",
    methods: "بطاقة · محفظة · فوري · إنستاباي",
    status: "تأكيد المطبعة",
    statusNote: "خلال 24 ساعة من الدفع",
    noPrice: "تظهر الأسعار في المصمم حسب المقاس",
    pieces: "{count} علبة",
  },
  fan: {
    title: "علامات تجارية بانتظار علبتها",
    sub: "تصميمات نموذجية لعلامات تجارية غير حقيقية، صنعناها بالمصمم لتعرض ما يمكن فعله.",
    badge: "نموذج",
    yours: "علامتك هنا",
    yoursBody: "أضف شعارك إلى علبتك واعرف سعرها قبل الدفع.",
    yoursCta: "طلب علبتك",
    listLabel: "تصميمات نموذجية",
  },
  bento: {
    title: "ابدأ، ثم توسع",
    share: { title: "رابط للمراجعة", body: "شارك التصميم مع فريقك أو عميلك ليراجعه على النموذج، دون حساب." },
    export: { title: "بروفة قبل الطباعة", body: "تراجع علبتك بشعارك وتعتمدها قبل أن تبدأ الطباعة." },
    sample: { title: "عينة أولا", body: "اطلب عينة مطبوعة قبل الكمية الكاملة." },
    reorder: { title: "إعادة الطلب بنقرة", body: "التصميم والمقاس والمطبعة محفوظة لطلبك التالي." },
    linkLabel: "رابط التصميم",
    pdfName: "بروفة علبتك",
    sampleQty: "عينة مطبوعة",
    reorderCta: "إعادة الطلب",
  },
  closing: {
    title: "هل تريد طباعة علبك؟",
    steps: ["اختيار العلبة وإضافة الشعار", "الموافقة على البروفة", "الطباعة والتسليم"],
    cta: "معرفة سعر علبتك",
    fine: "دون حساب ودون رقم محمول حتى تطلب.",
  },
};

type Copy = typeof ar;

const en: Copy = {
  metaTitle: "Get your printed boxes: free 3D preview and instant price",
  metaDescription: "Your boxes printed with your logo by a vetted Egyptian printer and delivered to your door. See your box in 3D and its exact price before you pay.",
  hero: {
    word1: "start",
    word2: "today",
    title: "Start today",
    sub: "Your boxes, printed with your logo and delivered to your door. See yours in 3D and its exact price before you pay",
    cta: "Get your box price",
    heroAlt: "A printed mailer box with sample artwork, shown from the Elba 3D designer",
    chipPrice: "{price} a box",
    chipPriceNote: "for 500 boxes, before VAT",
    chipProof: "3D proof",
    chipProofNote: "before printing",
    pieceAlt: "Sample design: {name}",
  },
  choose: {
    title: "Choose your box",
    sub: "Start from a ready style in your size, then change colours, logo and text right on the 3D model.",
    previewAlt: "The Elba designer: a 3D mailer box with the colour panel and layers",
    cta: "See your box with your logo",
    live: "Live preview",
    styleAlt: "{name} style",
    stylesLabel: "Ready styles to start from",
  },
  shine: {
    title: "Make your packaging shine",
    sub: "Try foil, spot gloss and soft-touch, and see what each does on your box before you print.",
    alt: "A rigid box with a gold foil finish, shown in the designer",
    chip: "3D preview",
    finishes: { foil: "Gold foil", spotUv: "Spot gloss", emboss: "Emboss", softTouch: "Soft touch", window: "Clear window" },
    count: "{count} finishes available",
  },
  paid: {
    title: "See the price, pay your way",
    sub: "Instant prices from printers up to 2,000 boxes, with 14% VAT shown on every order.",
    cardTitle: "Order summary",
    item: "Mailer box 25 × 18 × 8 cm",
    qty: "Quantity",
    unit: "Per box",
    subtotal: "Subtotal",
    vat: "VAT 14%",
    total: "Total",
    delivery: "Delivered to Greater Cairo in {days} {daysWord}",
    pay: "Payment",
    methods: "Card · Wallet · Fawry · InstaPay",
    status: "Printer confirms",
    statusNote: "within 24 hours of payment",
    noPrice: "Prices show in the designer for your size",
    pieces: "{count} boxes",
  },
  fan: {
    title: "Brands waiting for their box",
    sub: "Sample designs for made-up brands, built in the designer to show what you can do.",
    badge: "Sample",
    yours: "Your brand here",
    yoursBody: "Add your logo to your box and see its price before you pay.",
    yoursCta: "Order your box",
    listLabel: "Sample designs",
  },
  bento: {
    title: "Start, then grow",
    share: { title: "A link for review", body: "Share the design with your team or client to review on the model, no account needed." },
    export: { title: "A proof before printing", body: "Check your box with your logo and approve it before printing starts." },
    sample: { title: "Sample first", body: "Order a printed sample before the full run." },
    reorder: { title: "Reorder in one tap", body: "Design, size and printer are saved for your next order." },
    linkLabel: "Design link",
    pdfName: "Your proof",
    sampleQty: "Printed sample",
    reorderCta: "Reorder",
  },
  closing: {
    title: "Ready to get your boxes printed?",
    steps: ["Pick your box, add your logo", "Approve the proof", "Printed and delivered"],
    cta: "Get your box price",
    fine: "No account and no mobile number until you order.",
  },
};

export function startCopy(locale: Locale): Copy {
  return locale === "ar" ? ar : en;
}

export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
