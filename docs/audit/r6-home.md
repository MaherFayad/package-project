# R6 home page: shopify.com/sa → Elba `/[locale]`

Scope: `src/app/[locale]/(store)/page.tsx` and `src/components/marketing/home/*`.
Reference: `docs/design-refs/shopify-2026-reference.md`. Captured 6 Nov 2026 with Playwright
(`https://www.shopify.com/sa` in Arabic and `https://www.shopify.com/` in English, 1440x900 and
390x844: full-page shots, a frame every half viewport, a scroll video and computed styles).
The captures stay local (not committed). Only our screenshots are committed, under
`docs/screenshots/r6/home/`.

Hard rules applied: no Shopify logo, name, icons, photos, videos or copy. No fabricated social
proof: Shopify's merchant stories, "every 26 seconds" counter, "250M+ shoppers", "15% higher
conversion" study and the Capital testimonial (English page only) map to **real Elba numbers**
(model count from the library, finishes, active printers from the DB, delivery days and prices
from the pricing engine) or to plain product facts.

## 1. Measured reference (shopify.com/sa, 1440 wide)

| Item | Measured |
|---|---|
| Page bg | `rgb(2,9,10)`; sections `margin-top:-1px`, padding 64px 0 (128px before a sheet) |
| Container | 1260px content (90px gutters at 1440); phone 16px |
| h1 | 96px / 1.08, weight 300, tracking -0.02em (phone 56px / 1.08, weight 330) |
| Section h2/h3 | 56px / 1.08, weight 330, -0.03em (phone 36px / 1.12, -0.02em) |
| Big h2 (green band, steps) | 64px / 1.08, weight 330, -0.02em (phone 44px) |
| Sub h3 (checkout, globe, steps) | 44px / 1.1, weight 330, -0.01em (phone 30px) |
| Card title | 20px / 1.3, weight 450 (phone 16px) |
| Body / caption | 18px / 1.4 muted `rgb(157,171,173)` on green-dark, `rgb(151,151,162)` on black; captions 14px / 1.37 weight 420 |
| Hero lead | 24px / 1.3 weight 400 |
| Pills | 56px tall, radius 9999, 18px/28px weight 550, padding 12px 24px, `transition: 0.15s cubic-bezier(0.4,0,0.2,1)`; primary white/black; secondary 2px white outline |
| Cards | radius 12px (media cards), 16px (wide feature cards); feature card bg `rgb(6,26,28)` with `linear-gradient(290.7deg, …)` |
| Sheet | violet band `linear-gradient(in oklab, rgb(44,0,127) 42%, rgb(0,10,30))`, radius 48px 48px 0 0; navy band `rgb(0,10,30)`; green band `rgb(4,30,24)` with radius 48px top; closing sheet `linear-gradient(rgba(2,8,8,.5), #000)` radius 48px top |
| Stats | value 96px weight 300, label 12px `rgb(54,244,164)` (avocado), top rule 0.5px `#11352D`; quote rule 2px avocado |
| Motion | `cc-float 6s ease-in-out infinite`, `cc-orbit 36s linear`, `mc-spin-rev 80s linear`, `mc-glow-fade 8s`, `scroll-x 240s linear` (storefront rail), `factoid-fade-in 0.5s ease-in-out`, step underline 0.3s, media 0.5s `cubic-bezier(0.22,1,0.36,1)`; scroll-filled headline (muted spans light up) |
| Hero | full-bleed video, rotating headlines (2 variants with their own video), copy bottom-start, 900px tall at 1440, then a 48px-radius dark sheet overlaps |
| Floating PiP | "why we built" mini video pinned bottom-end on desktop; dismissed by scroll (`pip-scroll-dismiss`) |

## 2. Section table (their section → our section)

| # | Shopify /sa section | Elba section (component) | Content (real data) | Motion | Status |
|---|---|---|---|---|---|
| 1 | Full-bleed hero video, rotating h1 ("كن أنت الاسم الأشهر" / "كن أنت نجم …"), lead, white pill + outline "why we built" pill with play icon | `HomeHero` | Rotating h1 over our box turntable loop (poster first, video when visible): "علبتك، باسم علامتك" / "صمم علبتك في ثلاثة أبعاد"; lead; white pill "ابدأ التصميم مجانا" → designer (mailer); outline pill with play icon "شاهد العلبة تدور" (plays/pauses the hero loop = SC 2.2.2 control) | per-word `HeroTitle` slide-in 0.4s, cross-fade between headlines every 7s, pause control; Ken-Burns drift on the poster | planned |
| 2 | Dark sheet: scroll-filled 56px statement "بع منتجاتك في كل مكان…" with muted continuation; storefront screenshot rail (`scroll-x 240s`) with domains under it | `HomeStatement` + `HomeRail` | "علبة واحدة لكل ما تبيعه. للمتجر الإلكتروني والمقهى ومستحضرات التجميل، بمقاسك وبطباعتك." Rail = our renders (370 models from the library), caption = model name + group | words light up with scroll (CSS `animation-timeline: view()`, static white fallback); rail 120s linear, hover and button pause | planned |
| 3 | Wide green-dark feature card "دخلت علامتك التجارية إلى ساحة المحادثات" with floating prompt bar and AI logos | `HomeFeatureCard` (designer) | "التصميم الآن داخل المتصفح": floating price chip from the pricing engine, a prompt-style "اكتب اسم علامتك" bar, and the box render | `cc-float` 6s chip float, reveal | planned |
| 4 | "تواجد في كل مكان. دون أن تبرح مكانك." + 3 cards (narrow / wide orbit / narrow) with captions and links | `HomeEverywhere` with page-local `Orbit` | "كل خطوة في مكان واحد." Cards: "صمم على نموذج حي" (designer shot), orbit with hub علبة and nodes التصميم، المطبعة، الدفع، التوصيل، الكتالوج, "اطبع عند مطبعة معتمدة" (printer count from DB) | orbit rings 80s reverse spin, nodes 36s orbit, glow fade 8s | planned |
| 5 | "حقق النمو في جميع أنحاء العالم": wide card with dotted map, product card mockup, order chip | `HomeDelivery` | "التوصيل إلى 27 محافظة": dotted Egypt map, order card mockup (mailer, price per box at 500 from the engine, delivery days from the engine) | chip float, reveal | planned |
| 6 | "للجميع، من رواد الأعمال إلى الشركات الكبرى": 3 photo cards with merchant stories + "اختر خطة تناسبك" outline pill | `HomeForAnyone` | 3 render cards: المتاجر الإلكترونية (mailer), المطاعم والمقاهي (pizza), مستحضرات التجميل (tuck carton): no merchant names; outline pill "عرض الأسعار" → catalogue | media hover scale 0.5s `cubic-bezier(0.22,1,0.36,1)` | planned |
| 7 | Violet sheet "تعرف على سلاحك السري، Sidekick": narrow video card + wide card with prompt bar | `HomeDesignerBand` (violet `Sheet`) | "تعرف على مصممك ثلاثي الأبعاد": narrow card = turntable loop, wide card = designer UI screenshot with prompt-style bar; captions | glow fade, sparkle on the bar icon, reveal | planned |
| 8 | App icon wall with centred heading "خصص كل شيء باستخدام التطبيقات" fading in | `HomeCatalogueWall` | "370 نموذجا في مكتبة واحدة": icon wall of our model thumbnails (box, carton, bottle, can, pouch, tube renders), count from `MODELS.length`, groups count | rows drift in opposite directions (marquee), heading fade-in; pause button | planned |
| 9 | Navy: "مدعوم بقوة الذكاء الاصطناعي…" dev terminal mockup with floating labels | `HomeFinishes` | "تشطيبات تراها قبل الطباعة": 8 finishes from `FINISH_CODES` as glass chips around the rigid box render (instead of terminal), each a real finish name | chips float, glow | planned |
| 10 | Green sheet "ليس هناك مكان أفضل لتبني فيه نشاطك" + checkout mockup + 15% / 250M+ stats + footnote; globe "استقرار تام. وسرعة فائقة." | `HomeStats` (green `Sheet`) | "أفضل مكان لتطبع فيه علبتك": checkout summary mockup (real line items: 500 mailer boxes, VAT 14%); stats via `CountUp`: model count, active printers, delivery days from engine, minimum order 100; quote-rule note "الأسعار شاملة الإعداد والتوصيل إلى القاهرة الكبرى، قبل الضريبة" | count-up on enter, factoid fade 0.5s, floating thumbnails | planned |
| 11 | Dark gradient sheet "ابن نشاطك بسرعة على Shopify": steps 01/02/03 with underline progress, two photos swap, "اغتنم الفرصة" pill | `HomeSteps` | "ابدأ علبتك اليوم": 01 اختيار النموذج، 02 التصميم والمعاينة، 03 الطلب والتوصيل; images swap per step; white pill "ابدأ التصميم مجانا" | auto-advance 5s with underline fill, pause button, click to choose | planned |
| 12 | Footer | Foundation `MarketingFooter` | n/a (foundation scope) | n/a | foundation |
| — | Floating PiP "why we built" video | not mirrored | It is a promo for a brand film we do not have; a floating box over content risks SC 2.4.11 | n/a | skipped (reason) |
| — | "Every 26 seconds" counter (globe), merchant stories, 250M+, Capital testimonial (EN) | replaced | fabricated social proof for us; mapped to real numbers in #10 | n/a | replaced |

## 3. Kit usage

The FOUNDATION branch owns the motion kit. Until it lands, the page uses page-local pieces under
`src/components/marketing/home/` and the existing `[data-reveal]` + `RevealScope` system. After
each merge of `-r6-foundation`, page-local pieces that duplicate a kit component are removed
(see the report at the end).
