# R6 · `/[locale]/designer` — product page for the free 3D packaging designer

Owner: DESIGNER-PAGE session (branch `claude/exciting-albattani-8kzgsu-r6-designer-page`).
Reference: `https://www.shopify.com/sa/website/builder` (Arabic) and `https://www.shopify.com/website/builder` (English),
captured with Playwright on 6 Nov 2026 at 1440x900 and 390x844: 14 desktop and 18 or 19 phone scroll frames per locale, a scroll video per locale at 1440, and computed styles.
The captures stay out of git (Shopify assets). Only the measurements below are kept.

## 1. Reference measurements (computed styles, 1440 wide, en)

| Element | Measured |
|---|---|
| Page background | `rgb(5,9,23)` navy black (`bg-bgblack`); FAQ band `rgb(0,0,0)` |
| Hero eyebrow (the real `<h1>`) | 16px / 550, `-0.01em`, lilac `rgb(196,191,252)` |
| Hero display line (`<p>`) | 96px / 300, line-height 1.08, tracking `-2.4px` (-0.025em), white |
| Section h2 (dark) | 64px / 330, line-height 1.08, `-1.28px` (-0.02em) |
| Section h2 (light bento) | 56px / 330, `-0.56px` (-0.01em) |
| Card h3 | 28px / 360, line-height 1.2, `-0.28px` |
| Body | 16px / 400 / 24px; lead 18 to 20px, muted 70% white |
| Primary pill | white bg, black text, radius 9999px, 44px high, 16px / 550, padding 8px 20px |
| Bento sheet | white sheet with ~48px top radius sliding over the dark hero (`margin-top` negative) |
| Bento card | radius 24px, `linear-gradient(rgba(173,149,219,.2) 50%, rgba(229,177,175,.2) 50%)` (lilac to blush), media on top, 28px title + 14px body at the bottom, 2-column 1:1 then 1:1 grid, `gap: 16px` |
| Trust card | dark, 1px border `rgba(255,255,255,.12)`, radius 12px, media tile 16px radius on top |
| App names | 18px / 550, underlined links, 3 columns, 14px muted description |
| Step card | 2px border `rgba(255,255,255,.2)`, radius 12px, number in muted 16px, 20px text; arrow buttons are 32px outline circles |
| FAQ | 64px h2; rows 20px / 400 with a 32px white circle "+" at the end, 1px `rgba(255,255,255,.2)` dividers, 8 to 12 questions in a 1080px column |
| Motion | transitions `0.3s cubic-bezier(0.4,0,0.2,1)` (opacity, translate), `0.3s cubic-bezier(0.215,0.61,0.355,1)`, colour `0.15s`, media `0.5s`; prompt bar types itself; template wall drifts sideways; app icons marquee |

## 2. Section table

| # | Shopify section (reference) | Elba section | Data source (real, no fabricated proof) | Component (page-local unless noted) | Status |
|---|---|---|---|---|---|
| 1 | Hero: navy-black canvas with a faint grid, floating editor UI pieces (layers panel, colour swatches, product tiles), a selected "Heading" frame around the headline, white pill + small print, glow | Hero: "Your brand on every face" inside a selected text frame; floating pieces are our own editor UI (faces list, colour swatches, R6 cutout tiles, finish chip, price chip); the live 3D box; sample-brand note | Unit price at 500 from the pricing engine (`getPriceFrom`, ex-VAT, labelled so) | `DesignerPage.tsx` + `LiveBox.tsx` (poster = LCP; R6 mailer loop in view once deployed; three.js only on "Turn in 3D", a press on the box, or mouse hover when there is no loop; kit `HeroScene3D`) | done |
| 2 | "Create a custom website with AI" + violet glow band with a typing prompt bar | "Describe your box" + violet glow band with a typing prompt bar. Submitting goes to the model picker with the words as a search (`/design?q=`, GET form, works without JS); example chips; no AI claim | Picker search (`matchesQuery`) | `PromptBar.tsx` | done |
| 3 | "Or start with a customizable template": wall of theme cards, drifting, "Using X theme" pills | "Or start from one of our box styles": wall of our renders, each card a link to `/[locale]/design?structure=CODE`, pill with the style name | `listStructures()` + renders in `public/marketing/renders` | kit `Marquee` (drift, pause button, hover/focus pause, WCAG 2.2.2) | done |
| 4 | Light sheet "Make your mark, no code needed": bento, 4 cards with product UI | Light sheet "Make it yours, no design software needed": artwork upload and crop, brand colours, text on every face with Arabic shaping, flat dieline with bleed and safe zone | Designer features in `src/components/designer` | `DesignerPage.tsx` + CSS mockups in `mockups.tsx` (the dieline is the real `dielineToSvg` output) | done |
| 5 | Light sheet "Get noticed with marketing and SEO tools": bento, 4 cards | "Share it, then print it": share links, a 3D + PDF proof before printing (the print PDF is prepared by our team, the designer has no self-serve PDF), mockup download, order from the same design | Share route `/s/[id]`, mockup export, real bleed and safe-zone values | `mockups.tsx` | done |
| 6 | "Every site is business-ready from day one": 3 dark cards | "Ready to order from day one": vetted Egyptian printers, 14% VAT receipts, pay by card, wallet, Fawry or InstaPay | `listVendors()` count, `VAT_RATE`, `paymentConfig().methods` | `DesignerPage.tsx` | done |
| 7 | "There's 13,000+ apps for that": app icon marquee + 9 linked categories | "N materials and finishes": a tile wall of boards and finishes (marquee with pause) + 9 linked groups into the catalogue | `MATERIAL_CODES`, `FINISH_CODES` (minus NONE) names from the dictionary; real count | kit `Marquee` + swatch tiles | done |
| 8 | "Start building for free": 3-step carousel, arrows | "Start designing free": 3-step carousel (pick a style, add your artwork, order from a printer), arrow buttons, scroll-snap | — | `StartCarousel.tsx` (scroll-snap, RTL-aware arrows, no auto-advance) | done |
| 9 | "Frequently asked questions": 10+ rows | FAQ in MSA (10 questions) + FAQPage JSON-LD | — | kit `Faq` | done |

## 3. Components

Page-local, under `src/components/marketing/designer-page/`: `copy.ts` (ar + en strings, kept out of the client dictionary), `designer-page.module.css`, `DesignerPage.tsx` (server, all nine sections), `LiveBox.tsx` (client: poster, loop, on-demand 3D, pause), `PromptBar.tsx` (client: GET search form with a typing placeholder), `StartCarousel.tsx` (client), `mockups.tsx` (server: CSS product-UI drawings), `__tests__/copy.test.ts`.
FOUNDATION kit used as-is (cdf37a4): `Sheet`, `Display`, `Pill`, `IconPill`, `Marquee` (style and materials walls), `Faq`, `Glow`, tokens (`--mk-*`). Kept page-local on purpose: the bento cards (the reference's measured lilac-to-blush card tone is not a `BentoCard` tone) and `StartCarousel` (the reference uses a snap carousel; kit `Steps` is a tabbed media swap). ASSETS kit used as-is: `R6.cutouts`, `R6.loops.mailer` (when deployed), `SAMPLE_LABEL`. Older kit pieces used as-is: `HeroImage`, `HeroScene3D` (lazy), `JsonLd`, `faqJsonLd`, the shell's reveal observer.

## 4. Files outside scope (smallest additive change)

| File | Change | Why |
|---|---|---|
| `src/app/sitemap.ts` | `/designer` entry | sitemap entry (asked) |
| `src/components/designer/ModelPicker.tsx`, `ModelLinks.tsx`, `src/app/[locale]/design/(picker)/page.tsx` | optional `initialQuery` prop, fed from `?q=` (trimmed, max 80 chars) | the prompt bar routes to the picker with a search |
| `docs/audit/tools/perf-pages.mjs` | `designer-page` entry | measure the page |

## 5. Copy decisions (fact-checked against the product)

- No AI claim anywhere: the prompt bar is a keyword search over the model library, and the copy says "Searches all N models by name and use".
- No self-serve print PDF: the designer says "The print-ready dieline PDF is prepared by our team when you order", so the card is "A proof before printing", and the FAQ says the same.
- Prices are ex-VAT in the pricing engine, so the hero price chip says "Before 14% VAT"; the trust card says VAT shows on its own line, and company name + tax registration number can be added at checkout (`CompanyInvoice`).
- Share links and mockup downloads need a free account (designer gate copy); the copy says so.
- Uploads: PNG, JPG, WebP, SVG (`IMAGE_ACCEPT`).
- Every render shows a fictional brand: `SAMPLE_LABEL` sits under the hero box and the style wall.
- Arabic: MSA, noun-form labels, no diacritics or tatweel (unit test), number-agreement-safe phrasing ("المطابع النشطة اليوم" under the count rather than "N مطابع").

## 6. Checks (final)

| Check | Result |
|---|---|
| `npm run lint` (incl. direct UI-kit imports rule) | 0 errors; 0 warnings in this page's files (2 unused-variable warnings come from the merged ASSETS script `scripts/marketing/render-ui.mjs`) |
| `npm run typecheck` | clean |
| `npm test` | 108 files, 8,757 tests passed (5 new in `designer-page/__tests__/copy.test.ts`) |
| `npm run build` | passes; `/[locale]/designer` SSG, revalidate 1h, 9.25 kB route JS, 117 kB first load (gz) |
| `e2e/designer-page.spec.ts` (ar + en, desktop 1280 + phone 360) | 23 passed, 1 skipped by design (Turn in 3D on the emulated phone: software WebGL) |
| e2e coverage | hydration with no console errors; no `window.__THREE__` and no canvas on first paint; CTA `href` and a style card click land in the editor; prompt bar → `/design?q=` with the search prefilled and results listed; reduced motion (loops and floats `animation: none`, every reveal visible, strip pause buttons gone, strips still keyboard-scrollable); pause button pauses the strip; Turn in 3D loads three.js; sitemap has both locales |
| Existing specs touched by the picker change | `e2e/designer.spec.ts` + `e2e/smoke.spec.ts`: 20 passed, 4 skipped (pre-existing skips) |
| axe (WCAG 2.0/2.1/2.2 A + AA tags), ar + en, desktop + phone, whole page scrolled | 0 violations |
| Phone perf (`perf-pages.mjs`, 390x844 DPR 2, 4x CPU, Slow 4G) | ar: LCP 1.58 s, CLS 0.011, INP 104 ms · en: LCP 1.46 s, CLS 0.000, INP 168 ms. LCP element: the hero poster (AVIF 720w, preloaded) |
| Desktop perf (1440x900) | ar: LCP 0.49 s, CLS 0.006 · en: LCP 0.39 s, CLS 0.000. The harness clicks "Turn in 3D", so its JS and TBT include the on-demand three.js boot; one desktop-ar INP sample (288 ms) is a click on the prompt field landing while that boot runs. First load ships no three.js |
| Sitemap | `/ar/designer`, `/en/designer` (priority 0.9, hreflang alternates) |

Kit bug found (reported to FOUNDATION): under reduced motion the kit `Marquee` keeps looping in Arabic, because `.marqueeTrack:dir(rtl)` re-sets `animation-name` over the reduced-motion `animation: none` (also visible on `/ar/dev/kit`). Fixed in the kit (r6-foundation 6208abd); the page-scoped override is removed.

Open: the R6 turntable loops are declared in the ASSETS kit but their files were not pushed yet; the page plays the mailer loop automatically once `public/marketing/r6/loops/mailer-*.{webm,mp4}` exist (server-side check), with no code change.

## 7. Spacing pass (spec section 7, r6-foundation a7b9fc2)

Every section is a kit `Sheet` with a `y` size; heads are `SectionHead`, card grids `Grid`, vertical rhythm `Stack`, columns kit `Container`. The page CSS has no section padding, margin or gap values left; the remaining px are inside the editor-UI drawings and cards.

| Band | Kit | Measured 1440 (ar) | Spec |
|---|---|---|---|
| Hero | `Sheet hero` | 72 / 100 | header height / section-y-lg |
| Prompt head | `Sheet` md, same tone as hero | 0 / 64 (collapsed, rule 2) | 0 / 64 |
| Violet prompt band | `Sheet violet y="lg"` inside `MotionScope` | 100 / 100 | 100 / 100 |
| Style wall | `Sheet` md | 64 / 64 | 64 / 64 |
| Bento (white sheet) | `Sheet white y="lg"`, overlap 48 | 100 / 100 | 100 / 100 |
| Trust trio | `Sheet y="lg"`, overlap 48 | 100 / 100 | 100 / 100 |
| Materials, start | `Sheet` md, same tone | 0 / 64 each (collapsed) | 0 / 64 |
| FAQ (closing) | `Sheet y="xl"` | 128 / 128 | 128 / 128 |

Container 1260 at x=90 (phone 358 at x=16); title→sub 16; head→content 40 (phone 32); bento gap 32, card grids 24, h2 56 (FAQ 64), phone h2 36, sheet radius 32 on phone. The -44px heading overlap is gone: each head CTA pill now follows the head in the DOM (laid out at the head's top end from 768px, in flow under the head on phones). `e2e/marketing-spacing.spec.ts` runs `/designer` (entry removed from `NOT_YET`): ar + en pass at 1440, 1024, 768 and 390.

Side-by-side with shopify.com/sa/website/builder re-captured at 1440 and 390 (ar); the reference frames stay out of git, our frames are in `docs/screenshots/audit/r6-designer-page/` (webp).

R6-AX-15 (WCAG 2.2.2): the violet band's rotating backdrop and the prompt's typing examples now pause from one kit `MotionScope` button; e2e covers it.
