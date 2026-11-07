import type { Locale } from "@/types";

/**
 * Strings for /[locale]/designer only. Kept out of the shared dictionary on purpose: the
 * dictionary is serialised into every public page's client payload, and these strings are
 * rendered on the server (client islands get the few they need as props).
 * The page sells printed boxes; the free 3D preview is how the buyer sees them first (R2-04).
 * No print jargon (board grades, file formats, model counts).
 * Arabic: MSA natural for Egypt, noun-form labels, no diacritics.
 * Placeholders: {price}, {rate}.
 */
const en = {
  meta: {
    title: "See your printed box before you order",
    description:
      "Add your logo to a real box in 3D, free, and see every side. Then Elba prints it at a vetted Egyptian printer and delivers it to your door.",
  },
  families: { CORRUGATED: "Shipping box", FOLDING_CARTON: "Shop carton", RIGID: "Gift box", TUBE: "Paper tube" },
  hero: {
    eyebrow: "Preview your box before printing",
    title: "See your printed box before you order",
    body: "Pick a box, add your logo and turn it to see every side. When it looks right, we print it at a vetted Egyptian printer and deliver it to your door.",
    cta: "Get your box price",
    secondary: "See box types",
    small: "The preview is free and needs no account. We ask for your mobile number only when you order.",
    frameTag: "Your logo",
    layers: "Sides",
    layerItems: ["Front", "Lid", "Left side", "Inside"],
    addLayer: "Add text",
    swatches: "Your colours",
    finish: "Matte finish",
    priceTitle: "Price at 500 boxes",
    priceValue: "{price} / box",
    priceNote: "Delivery included, before {rate}% VAT",
    turn: "Turn in 3D",
    turnHint: "Loads the live 3D box",
    viewer: "Mailer box in 3D with a sample logo",
    pause: "Pause the moving preview pieces",
    play: "Play the moving preview pieces",
  },
  wall: {
    title: "Pick the box you need",
    body: "Shipping boxes, shop cartons, gift boxes and tubes. Each one shows its price at 500 boxes.",
    using: "See the price",
    all: "All box types",
    pause: "Pause the box types strip",
    play: "Play the box types strip",
    label: "Box types",
  },
  make: {
    title: "Your box with your logo, no design software",
    body: "It all happens in your browser, on your phone too. You do not need a designer.",
    cta: "Pick your box",
    cards: [
      { key: "artwork", title: "Add your logo", body: "Upload your logo from your phone. It lands on the lid, and you can move it, resize it or put it on any side." },
      { key: "colours", title: "Your colours", body: "Pick the colour of the box and of your text from your brand colours." },
      { key: "text", title: "Arabic and English text", body: "Write your shop name, phone number or Instagram in Arabic or English. Arabic letters join and read right to left as they should." },
      { key: "dieline", title: "We check it before we print", body: "We tell you when your logo is too small to print sharp or sits too close to a fold, and you approve the final look before printing starts." },
    ],
  },
  share: {
    title: "From your preview to boxes at your door",
    body: "The box you see is the box we print.",
    cta: "Get your box price",
    cards: [
      { key: "link", title: "Show it to your partner", body: "Send a link to a partner or a client. They turn the box on their phone without signing in." },
      { key: "approve", title: "Approve before we print", body: "Before printing, you see your box once more and approve it. Nothing is printed without your OK." },
      { key: "views", title: "Photos for your shop", body: "Download a photo of your box for your online shop, your menu or your social posts." },
      { key: "order", title: "Order in a few taps", body: "Choose how many boxes and pay online. Elba handles the printer and the delivery, and you get one receipt." },
    ],
  },
  trust: {
    title: "Ready to order from day one",
    cards: [
      { key: "printers", title: "Vetted Egyptian printers", body: "We pick a printer we have checked for machines, quality and delivery times. Elba is responsible for your whole order, from printing to delivery." },
      { key: "vat", title: "Receipts with {rate}% VAT", body: "Every price shows Egyptian VAT on its own line, and you can add your company name and tax registration number at checkout for the receipt." },
      { key: "pay", title: "Pay your way", body: "Pay by card, mobile wallet, Fawry or InstaPay. Every order is paid in full when you place it." },
    ],
    payLabels: { CARD: "Card", WALLET: "Wallet", FAWRY: "Fawry", INSTAPAY: "InstaPay" },
    vatLines: { subtotal: "Subtotal", vat: "VAT {rate}%", total: "Total" },
    printerTags: ["Printing", "Cutting", "Delivery"],
    printersStat: "Active printers today",
  },
  start: {
    title: "Three steps to your printed boxes",
    body: "From picking a box to boxes delivered to your door.",
    cta: "Get started",
    prev: "Previous step",
    next: "Next step",
    label: "Steps to get started",
    steps: [
      "Pick your box type and size.",
      "Add your logo and see your box from every side.",
      "Choose the quantity and pay. We print your boxes and deliver them to your door.",
    ],
  },
  ui: {
    upload: "Logo added",
    crop: "Move",
    rotate: "Rotate",
    fit: "Fit to side",
    colours: [
      { name: "Nile green", hex: "#2F5D50" },
      { name: "Sand", hex: "#F6EFE2" },
      { name: "Terracotta", hex: "#C8553D" },
      { name: "Ink", hex: "#1F2124" },
    ],
    textAr: "قهوة الصباح",
    textEn: "Morning coffee",
    textTool: ["Aa", "Arabic", "Bold", "Centre"],
    legend: { cut: "Cut", crease: "Fold", safe: "Safe for text", bleed: "Print edge" },
    shareButton: "Copy link",
    proofRows: [["Box", "Mailer box"], ["Logo", "On the lid"], ["Size", "25 × 18 × 8 cm"]] as [string, string][],
    proofOk: "You approved this box",
    download: "Download photo",
    orderTitle: "Quantity",
    qty: ["250", "500", "1,000", "2,000"],
    dielineTitle: "The box laid flat",
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { q: "Is the preview free?", a: "Yes. Seeing your box with your logo is free. You pay only when you order printed boxes." },
      { q: "Do I need an account?", a: "No. Add your logo and see your box straight away. We ask for your mobile number when you save, share or order." },
      { q: "Which boxes can you print?", a: "Mailer and shipping boxes, cartons for shops, pizza and food boxes, boxes with a handle, gift boxes and paper tubes." },
      { q: "Can I write in Arabic on my box?", a: "Yes. Arabic text joins and reads right to left on every side, and you can mix Arabic and English on the same box." },
      { q: "What logo should I upload?", a: "A picture of your logo from your phone or computer. For a sharp print, use a picture at least 1000 pixels wide. We tell you right away when it is smaller." },
      { q: "Will my box print the way I see it?", a: "Yes. The preview is the real shape of your box. We warn you about a logo that is too small or too close to a fold, and you approve the final look before printing starts." },
      { q: "How much does it cost?", a: "You see the price of your box before you pay. It includes printing, setup and delivery to Greater Cairo, with 14% VAT on its own line." },
      { q: "How do I pay?", a: "By card, mobile wallet, Fawry reference number or InstaPay. Every order is paid in full when you place it." },
      { q: "Who prints my boxes?", a: "A vetted Egyptian printer that Elba picks for your box. Elba is the seller on every order, pays the printer and is responsible for your boxes until they reach you." },
    ],
  },
};

type Copy = typeof en;

const ar: Copy = {
  meta: {
    title: "شاهد علبتك المطبوعة قبل أن تطلبها",
    description:
      "أضف شعارك إلى علبة حقيقية ثلاثية الأبعاد مجانا وشاهدها من كل الجهات. ثم تطبعها علبة لدى مطبعة مصرية معتمدة وتوصلها إلى بابك.",
  },
  families: { CORRUGATED: "كرتونة شحن", FOLDING_CARTON: "علبة للمحلات", RIGID: "علبة هدايا", TUBE: "علبة أسطوانية" },
  hero: {
    eyebrow: "معاينة علبتك قبل الطباعة",
    title: "شاهد علبتك المطبوعة قبل أن تطلبها",
    body: "اختر العلبة، وأضف شعارك، وأدرها لترى كل جهة. وعندما تعجبك، نطبعها لدى مطبعة مصرية معتمدة ونوصلها إلى بابك.",
    cta: "معرفة سعر علبتك",
    secondary: "عرض أنواع العلب",
    small: "المعاينة مجانية ولا تحتاج إلى حساب. نطلب رقم محمولك عند الطلب فقط.",
    frameTag: "شعارك",
    layers: "الجهات",
    layerItems: ["الأمام", "الغطاء", "الجانب الأيسر", "الداخل"],
    addLayer: "إضافة نص",
    swatches: "ألوانك",
    finish: "تشطيب مطفي",
    priceTitle: "السعر عند 500 علبة",
    priceValue: "{price} للعلبة",
    priceNote: "شامل التوصيل، قبل ضريبة {rate}%",
    turn: "تدوير ثلاثي الأبعاد",
    turnHint: "لتحميل العلبة ثلاثية الأبعاد",
    viewer: "علبة بريدية ثلاثية الأبعاد بشعار تجريبي",
    pause: "إيقاف حركة عناصر المعاينة",
    play: "تشغيل حركة عناصر المعاينة",
  },
  wall: {
    title: "اختر العلبة التي تحتاجها",
    body: "كراتين شحن وعلب للمحلات وعلب هدايا وعلب أسطوانية. يظهر سعر كل علبة عند طلب 500 علبة.",
    using: "معرفة السعر",
    all: "كل أنواع العلب",
    pause: "إيقاف شريط أنواع العلب",
    play: "تشغيل شريط أنواع العلب",
    label: "أنواع العلب",
  },
  make: {
    title: "علبتك بشعارك، دون برامج تصميم",
    body: "كل شيء من المتصفح، وعلى هاتفك أيضا. لا تحتاج إلى مصمم.",
    cta: "اختيار علبتك",
    cards: [
      { key: "artwork", title: "شعارك على العلبة", body: "ارفع شعارك من هاتفك، فيظهر على الغطاء، ويمكنك تحريكه أو تكبيره أو وضعه على أي جهة." },
      { key: "colours", title: "ألوانك", body: "اختر لون العلبة ولون النص من ألوان علامتك." },
      { key: "text", title: "نص عربي وإنجليزي", body: "اكتب اسم محلك أو رقم هاتفك أو حسابك على إنستجرام بالعربية أو الإنجليزية. تتصل الحروف العربية وتقرأ من اليمين إلى اليسار كما ينبغي." },
      { key: "dieline", title: "مراجعة قبل الطباعة", body: "ننبهك إذا كان شعارك أصغر من أن يطبع بوضوح أو قريبا جدا من خط الطي، وتوافق على الشكل النهائي قبل بدء الطباعة." },
    ],
  },
  share: {
    title: "من المعاينة إلى علب على بابك",
    body: "العلبة التي تراها هي العلبة التي نطبعها.",
    cta: "معرفة سعر علبتك",
    cards: [
      { key: "link", title: "رابط لشريكك", body: "أرسل رابطا لشريك أو عميل، ليدير العلبة من هاتفه دون تسجيل الدخول." },
      { key: "approve", title: "موافقتك قبل الطباعة", body: "قبل الطباعة ترى علبتك مرة أخيرة وتوافق عليها. لا نطبع شيئا دون موافقتك." },
      { key: "views", title: "صور لمتجرك", body: "نزل صورة لعلبتك لمتجرك الإلكتروني أو قائمتك أو منشوراتك." },
      { key: "order", title: "الطلب في خطوات قليلة", body: "اختر عدد العلب وادفع إلكترونيا. تتولى علبة المطبعة والتوصيل، ويصلك إيصال واحد." },
    ],
  },
  trust: {
    title: "جاهز للطلب من اليوم الأول",
    cards: [
      { key: "printers", title: "مطابع مصرية معتمدة", body: "نختار لك مطبعة راجعنا ماكيناتها وجودتها والتزامها بالمواعيد. وعلبة مسؤولة عن طلبك كاملا، من الطباعة حتى التوصيل." },
      { key: "vat", title: "إيصالات توضح ضريبة {rate}%", body: "تظهر ضريبة القيمة المضافة المصرية في سطر مستقل مع كل سعر، ويمكنك إضافة اسم شركتك ورقم التسجيل الضريبي عند الدفع ليظهرا في الإيصال." },
      { key: "pay", title: "الدفع بطريقتك", body: "ادفع بالبطاقة أو المحفظة الإلكترونية أو فوري أو إنستاباي. يدفع كل طلب كاملا عند إتمامه." },
    ],
    payLabels: { CARD: "بطاقة", WALLET: "محفظة", FAWRY: "فوري", INSTAPAY: "إنستاباي" },
    vatLines: { subtotal: "المجموع الفرعي", vat: "الضريبة {rate}%", total: "الإجمالي" },
    printerTags: ["الطباعة", "القص", "التوصيل"],
    printersStat: "المطابع النشطة اليوم",
  },
  start: {
    title: "ثلاث خطوات إلى علبك المطبوعة",
    body: "من اختيار العلبة إلى علب تصل إلى بابك.",
    cta: "البدء",
    prev: "الخطوة السابقة",
    next: "الخطوة التالية",
    label: "خطوات البدء",
    steps: [
      "اختر نوع علبتك ومقاسها.",
      "أضف شعارك وشاهد علبتك من كل الجهات.",
      "اختر الكمية وادفع، ونطبع علبك ونوصلها إلى بابك.",
    ],
  },
  ui: {
    upload: "تمت إضافة الشعار",
    crop: "تحريك",
    rotate: "تدوير",
    fit: "ملء الجهة",
    colours: [
      { name: "أخضر النيل", hex: "#2F5D50" },
      { name: "رملي", hex: "#F6EFE2" },
      { name: "طوبي", hex: "#C8553D" },
      { name: "حبر", hex: "#1F2124" },
    ],
    textAr: "قهوة الصباح",
    textEn: "Morning coffee",
    textTool: ["أب", "عربي", "عريض", "وسط"],
    legend: { cut: "قص", crease: "طي", safe: "مساحة النص", bleed: "حافة الطباعة" },
    shareButton: "نسخ الرابط",
    proofRows: [["العلبة", "علبة بريدية"], ["الشعار", "على الغطاء"], ["المقاس", "25 × 18 × 8 سم"]] as [string, string][],
    proofOk: "تمت الموافقة على شكل العلبة",
    download: "تنزيل الصورة",
    orderTitle: "الكمية",
    qty: ["250", "500", "1,000", "2,000"],
    dielineTitle: "العلبة مفرودة",
  },
  faq: {
    title: "الأسئلة الشائعة",
    items: [
      { q: "هل المعاينة مجانية؟", a: "نعم. مشاهدة علبتك بشعارك مجانية، ولا تدفع إلا عند طلب العلب المطبوعة." },
      { q: "هل أحتاج إلى حساب؟", a: "لا. أضف شعارك وشاهد علبتك فورا. نطلب رقم محمولك عند الحفظ أو المشاركة أو الطلب." },
      { q: "ما العلب التي تطبعونها؟", a: "العلب البريدية وكراتين الشحن، وعلب المحلات، وعلب البيتزا والطعام، والعلب بمقبض، وعلب الهدايا، والعلب الأسطوانية الورقية." },
      { q: "هل يمكنني الكتابة بالعربية على علبتي؟", a: "نعم. يتصل النص العربي ويقرأ من اليمين إلى اليسار على كل جهة، ويمكنك الجمع بين العربية والإنجليزية على العلبة نفسها." },
      { q: "ما الشعار الذي أرفعه؟", a: "صورة شعارك من هاتفك أو الكمبيوتر. للحصول على طباعة واضحة، استخدم صورة عرضها 1000 بكسل على الأقل، وننبهك فورا إذا كانت أصغر." },
      { q: "هل تطبع علبتي كما أراها؟", a: "نعم. المعاينة هي الشكل الحقيقي لعلبتك. ننبهك إذا كان الشعار صغيرا أو قريبا جدا من خط الطي، وتوافق على الشكل النهائي قبل بدء الطباعة." },
      { q: "كم التكلفة؟", a: "ترى سعر علبتك قبل الدفع، وهو يشمل الطباعة والتجهيز والتوصيل إلى القاهرة الكبرى، مع ضريبة 14% في سطر مستقل." },
      { q: "كيف أدفع؟", a: "بالبطاقة أو المحفظة الإلكترونية أو الرقم المرجعي لفوري أو إنستاباي. يدفع كل طلب كاملا عند إتمامه." },
      { q: "من يطبع علبي؟", a: "مطبعة مصرية معتمدة تختارها علبة لعلبتك. علبة هي البائع في كل طلب، وتدفع للمطبعة، ومسؤولة عن علبك حتى تصل إليك." },
    ],
  },
};

export function designerPageCopy(locale: Locale): Copy {
  return locale === "ar" ? ar : en;
}

/** "{price} / box" → "EGP 4.20 / box". */
export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
