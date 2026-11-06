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
| 1 | Full-bleed hero video, rotating h1 ("كن أنت الاسم الأشهر" / "كن أنت نجم …"), lead, white pill + outline "why we built" pill with play icon | `HomeHero` | Rotating h1 over our box turntable loop (poster first, video when visible): "علبتك، باسم علامتك" / "صمم علبتك في ثلاثة أبعاد"; lead; white pill "ابدأ التصميم مجانا" → designer (mailer); outline pill with play icon "شاهد العلبة تدور" (plays/pauses the hero loop = SC 2.2.2 control) | per-word `HeroTitle` slide-in 0.4s, cross-fade between headlines every 7s, pause control; Ken-Burns drift on the poster | built |
| 2 | Dark sheet: scroll-filled 56px statement "بع منتجاتك في كل مكان…" with muted continuation; storefront screenshot rail (`scroll-x 240s`) with domains under it | `HomeStatement` + `HomeRail` | "علبة واحدة لكل ما تبيعه. للمتجر الإلكتروني والمقهى ومستحضرات التجميل، بمقاسك وبطباعتك." Rail = our renders (370 models from the library), caption = model name + group | words light up with scroll (CSS `animation-timeline: view()`, static white fallback); rail 120s linear, hover and button pause | built |
| 3 | Wide green-dark feature card "دخلت علامتك التجارية إلى ساحة المحادثات" with floating prompt bar and AI logos | `HomeFeatureCard` (designer) | "التصميم الآن داخل المتصفح": floating price chip from the pricing engine, a prompt-style "اكتب اسم علامتك" bar, and the box render | `cc-float` 6s chip float, reveal | built |
| 4 | "تواجد في كل مكان. دون أن تبرح مكانك." + 3 cards (narrow / wide orbit / narrow) with captions and links | `HomeEverywhere` with page-local `Orbit` | "كل خطوة في مكان واحد." Cards: "صمم على نموذج حي" (designer shot), orbit with hub علبة and nodes التصميم، المطبعة، الدفع، التوصيل، الكتالوج, "اطبع عند مطبعة معتمدة" (printer count from DB) | orbit rings 80s reverse spin, nodes 36s orbit, glow fade 8s | built |
| 5 | "حقق النمو في جميع أنحاء العالم": wide card with dotted map, product card mockup, order chip | `HomeDelivery` | "التوصيل إلى 27 محافظة": dotted Egypt map, order card mockup (mailer, price per box at 500 from the engine, delivery days from the engine) | chip float, reveal | built |
| 6 | "للجميع، من رواد الأعمال إلى الشركات الكبرى": 3 photo cards with merchant stories + "اختر خطة تناسبك" outline pill | `HomeForAnyone` | 3 render cards: المتاجر الإلكترونية (mailer), المطاعم والمقاهي (pizza), مستحضرات التجميل (tuck carton): no merchant names; outline pill "عرض الأسعار" → catalogue | media hover scale 0.5s `cubic-bezier(0.22,1,0.36,1)` | built |
| 7 | Violet sheet "تعرف على سلاحك السري، Sidekick": narrow video card + wide card with prompt bar | `HomeDesignerBand` (violet `Sheet`) | "تعرف على مصممك ثلاثي الأبعاد": narrow card = turntable loop, wide card = designer UI screenshot with prompt-style bar; captions | glow fade, sparkle on the bar icon, reveal | built |
| 8 | App icon wall with centred heading "خصص كل شيء باستخدام التطبيقات" fading in | `HomeCatalogueWall` | "370 نموذجا في مكتبة واحدة": icon wall of our model thumbnails (box, carton, bottle, can, pouch, tube renders), count from `MODELS.length`, groups count | rows drift in opposite directions (marquee), heading fade-in; pause button | built |
| 9 | Navy: "مدعوم بقوة الذكاء الاصطناعي…" dev terminal mockup with floating labels | `HomeFinishes` | "تشطيبات تراها قبل الطباعة": 8 finishes from `FINISH_CODES` as glass chips around the rigid box render (instead of terminal), each a real finish name | chips float, glow | built |
| 10 | Green sheet "ليس هناك مكان أفضل لتبني فيه نشاطك" + checkout mockup + 15% / 250M+ stats + footnote; globe "استقرار تام. وسرعة فائقة." | `HomeStats` (green `Sheet`) | "أفضل مكان لتطبع فيه علبتك": checkout summary mockup (real line items: 500 mailer boxes, VAT 14%); stats via `CountUp`: model count, active printers, delivery days from engine, minimum order 100; quote-rule note "الأسعار شاملة الإعداد والتوصيل إلى القاهرة الكبرى، قبل الضريبة" | count-up on enter, factoid fade 0.5s, floating thumbnails | built |
| 11 | Dark gradient sheet "ابن نشاطك بسرعة على Shopify": steps 01/02/03 with underline progress, two photos swap, "اغتنم الفرصة" pill | `HomeSteps` | "ابدأ علبتك اليوم": 01 اختيار النموذج، 02 التصميم والمعاينة، 03 الطلب والتوصيل; images swap per step; white pill "ابدأ التصميم مجانا" | auto-advance 5s with underline fill, pause button, click to choose | built |
| 12 | Footer | Foundation `MarketingFooter` | n/a (foundation scope) | n/a | foundation |
| — | Floating PiP "why we built" video | not mirrored | It is a promo for a brand film we do not have; a floating box over content risks SC 2.4.11 | n/a | skipped (reason) |
| — | "Every 26 seconds" counter (globe), merchant stories, 250M+, Capital testimonial (EN) | replaced | fabricated social proof for us; mapped to real numbers in #10 | n/a | replaced |

## 3. As built (deltas from the plan)

- Assets: hero, rail, cards, steps and floating pieces use the R6 renders and real UI captures from the assets branch (`kit/assets.ts`). Every one showing a fictional brand (NOUR, ATTAR, Halawa, NADA, SAHWA, Waraqa) carries `SAMPLE_LABEL` next to it: the rail note, a tag on each "for every business" card. UI mockups (designer, vendor job, price badge, order timeline) are real screens.
- Hero video: `heroVideo()` switches the hero to the `R6.loops.mailer` turntable (720p first, poster first, plays only while visible, never under reduced motion) as soon as the loop files exist in `public/marketing/r6/loops/`. Until then the dark studio render drifts. No code change is needed when the loops land.
- Live numbers on the page (seed DB, pricing engine, 6 Nov): 370 models, 8 groups, 8 finishes, 6 active printers, EGP 39.69 per box for 500 mailers (250 × 180 × 80), 10 days to Greater Cairo, minimum order from the printers table. Every figure is computed at render time and the page revalidates hourly; nothing is hard-coded.
- Statement fill (#2) uses CSS `animation-timeline: view()`. Browsers without scroll timelines and reduced motion get the static two-tone text (lead white, rest muted 4.1:1, large text, SC 1.4.3).
- Every auto-moving part has a pause control (SC 2.2.2): hero (rotation, video and drift), rail (kit Marquee), orbit (kit Orbit), steps (kit Steps), icon wall and each floating mockup (kit MotionScope, each with its own section name). Under reduced motion nothing moves and the controls are hidden (SC 2.3.3).
- FAQ dropped: the reference home has none, and FAQ JSON-LD without a visible FAQ breaks Google's structured-data rules. The FAQ belongs on /pricing.

## 4. Kit usage

Kit components used: `Sheet` (hero, statement, violet, green and steps sheets), `Container`, `Display`, `HeroTitle`, `Pill`/`PillRow`/`IconPill`, `Reveal`, `Marquee`, `Orbit`, `Stat` (CountUp), `Steps`, `MotionScope`, `startHref()`.

Page-local, by design, under `src/components/marketing/home/`:
- `HomeHero`: the rotating two-headline hero with video/drift and one pause control. The kit has no rotating hero; it renders kit `Sheet hero` + `HeroTitle` inside.
- `EgyptDots`: CSS-masked dot map (one element plus 7 city dots).
- `R6Pic`: `<picture>` for an R6 asset with an optional high-priority preload (the kit exports the srcset helpers but no component).
- `copy.ts`: page copy, ar/en with enforced parity, with Arabic counted-noun helpers (`daysWord`, `printersWord`).
- Icon wall rows: decorative and aria-hidden, so they cannot use kit `Marquee` (its viewport is a focusable region, which would be a focusable element inside aria-hidden). It is paused by kit `MotionScope` instead.

Removed in favour of the kit after the foundation merge: the page-local `Loop`, `CountUp` and `HomeSteps`.

## 5. Verification (commit at the end of this branch)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (1 warning in `scripts/marketing/render-ui.mjs`, assets branch) |
| `npm run typecheck` | pass |
| `npm test` | 107 files, 8,753 tests passed |
| `npm run build` | pass; `/[locale]` 3.5 kB route JS, 173 kB first load (shared chunk grew with the foundation header) |
| e2e `smoke`, `storefront`, `a11y`, `a11y-routes`, `marketing-kit`, `journey` (desktop + mobile, `--workers=2`) | 123 passed, 3 skipped by design (journey is desktop-only) |
| axe-core, home, ar/en × 1440/390 × motion/reduced, full scroll | 0 violations in all 8 |
| Keyboard walk (ar, 1440) | 26 focus stops in `main`, all visible with a 2px ring, none under the sticky header (SC 2.4.7, 2.4.11) |
| Reduced-motion walk | all content visible and static; rail becomes a scroller, wall a static grid, no pause buttons |
| perf-pages.mjs `ISOLATE=1`, phone (slow 4G, 4× CPU) | ar: LCP 2.04 s, CLS 0.006, INP 88 ms; en: LCP 1.92 s, CLS 0.000, INP 168 ms |
| perf-pages.mjs, desktop | ar: LCP 0.34 s, CLS 0; en: LCP 0.38 s, CLS 0 |

Notes:
- TBT on phone is 600 to 780 ms, about the same as `/boxes` (767 ms) under the same tool, so it is shell-level hydration cost, not this page. TBT is not one of the brief's budgets (LCP, CLS, INP), but the acceptance in the reference doc lists it.
- Pre-existing, shell scope: `MarketingShell` wraps every page in `<Suspense>` inside `<main>` (R4-MK-09), so async pages stream their body as a hidden segment that an inline `$RC` script reveals. With JavaScript disabled, `main` is empty on every marketing page, not only home. That conflicts with "content visible without JS" in the reference doc. Not changed here.
- e2e failures seen before merging foundation `bdef78f` (kit gallery contrast at `/dev/kit`, footer "Returns for custom goods" listed twice) were in foundation files and are fixed on that branch.

Screenshots (ours only): `docs/screenshots/r6/home/` (ar 1440 per section, ar 390 frames, en 1440 hero and stats, a reduced-motion frame). Side-by-side sheets with the reference were made locally and are not committed.

### Re-verified after merging foundation `cdf37a4` (main `f8db398`, i18n scopes)

Lint 0 errors · typecheck pass · unit 112 files / 8,771 tests · build pass · `generate-i18n-scopes --check` up to date · e2e (smoke, storefront, a11y, a11y-routes, marketing-kit, journey) 123 passed, 3 skipped · axe 0 in all 8 · phone LCP 1.96 s ar / 1.82 s en, CLS 0.006 / 0, INP 128 / 88 ms. Home conflict: kept the R6 page (main only touched the old page's on-time average, which the R6 page does not show).

### Pass 2: integrator side-by-side (5 gaps), merged assets `7cf260a`

| Gap | Fix | Status |
|---|---|---|
| 1. Hero was a small box in a dark void | Full-bleed studio scene. The backdrop matches the loops' studio (rgb 26,24,22) with a lit floor; the `R6.loops` turntable plays large (scale 1.2) at the end side, with cutouts (perfume, rigid box, can) as set pieces and drop shadows. One scene per headline (mailer, then rigid box) cross-fades with the headline; only the active loop is fetched and played (720p under 1024px, 1080p above, poster = LCP). Headline at the bottom start, kit 96px. Alternate headline shortened to two lines («صممها وشاهدها تدور» / "Design it. Watch it turn."), so the hero fits the viewport | fixed |
| 2. Sparse cards | Trio frames 470px tall with studio photos and floating real UI (price badge, vendor job); feature cutout up to 460px; finishes box up to 520px; rail switched to landscape 4:3, 360px wide; violet narrow card is the kit `MediaCard` with the perfume loop (plays on hover/focus) | fixed |
| 3. First sheet must overlap the hero with 48px corners | The scene now runs to the hero's bottom edge, over a lit floor, so the statement sheet's 48px corners read against it as on the reference | fixed |
| 4. Cookie notice covered the hero CTA (SC 2.4.11) | While the notice is in the page (first visit), the hero reserves space above it via `html:has([data-cookie-notice])`: 200px desktop, 156px phone. The notice is server-rendered, so this applies from first paint (first-visit CLS 0.0012). Phone scrim strengthened: the lead text's brightest background pixel gives 9.98:1 on white | fixed |
| 5. Older posters | Hero, rail, cards, steps, the wall (R6 cutouts) and the violet card all use assets-branch renders and loops; no `/marketing/renders` or `/marketing/samples` left on the page | fixed |

Change outside scope (smallest additive): `src/components/ui/CookieNotice.tsx` gets a `data-cookie-notice=""` attribute, a stable hook for layouts that keep their CTA clear of it.

Re-verified: lint 0 errors · tsc pass · unit 8,771 · build pass (`/[locale]` 3.64 kB) · i18n scopes `--check` clean · e2e 123 passed, 3 skipped · axe 0 in all 8 · phone LCP 1.96 s ar / 1.87 s en, CLS 0.006 / 0 (first visit with notice 0.0012), INP 88 / 72 ms · desktop LCP 0.40 / 0.36 s, CLS 0. Screenshots refreshed, plus first-visit frames with the notice.
