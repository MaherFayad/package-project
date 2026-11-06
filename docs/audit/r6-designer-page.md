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
| 1 | Hero: navy-black canvas with a faint grid, floating editor UI pieces (layers panel, colour swatches, product tiles), a selected "Heading" frame around the headline, white pill + small print, glow | Hero: "Design your box in 3D, free" inside a selected text frame; floating pieces are our own editor UI (faces list, colour swatches, structure tiles, finish chip, price chip); the live 3D box | Prices from the pricing engine (`getPriceFrom`), model count from `MODELS` | `Hero.tsx` + `LiveBox.tsx` (poster first; three.js only after hover, tap or the "Turn in 3D" button; the kit's `HeroScene3D`) | built |
| 2 | "Create a custom website with AI" + violet glow band with a typing prompt bar | "Describe your box" + violet glow band with a typing prompt bar. Submitting goes to the model picker with the words as a search (`/design?q=`); no AI claim | Picker search (`ModelBrowser` match) | `PromptBar.tsx` | built |
| 3 | "Or start with a customizable template": wall of theme cards, drifting, "Using X theme" pills | "Or start from one of our box styles": wall of our renders, each card a link to `/[locale]/design?structure=CODE`, pill with the style name | `listStructures()` + renders in `public/marketing/renders` | `StyleWall.tsx` (pause button, WCAG 2.2.2) | built |
| 4 | Light sheet "Make your mark, no code needed": bento, 4 cards with product UI | Light sheet "Make it yours, no design software needed": artwork upload and crop, brand colours, text on every face with Arabic shaping, flat dieline with bleed and safe zone | Designer features in `src/components/designer` | `Bento.tsx` + CSS mockups in `mockups.tsx` | built |
| 5 | Light sheet "Get noticed with marketing and SEO tools": bento, 4 cards | "Share it, then print it": share links, print-ready PDF export, 3D views for your shop, order from the same design | Share route `/s/[id]`, export | `Bento.tsx` (second group) | built |
| 6 | "Every site is business-ready from day one": 3 dark cards | "Ready to order from day one": vetted Egyptian printers, 14% VAT receipts, pay by card, wallet, Fawry or InstaPay | `listVendors()` count, `VAT_RATE`, `paymentConfig().methods` | `TrustTrio.tsx` | built |
| 7 | "There's 13,000+ apps for that": app icon marquee + 9 linked categories | "N materials and finishes": a tile wall of boards and finishes (marquee with pause) + 9 linked groups into the catalogue | `MATERIAL_CODES`, `FINISH_CODES` names from the dictionary; real counts | `MaterialsWall.tsx` | built |
| 8 | "Start building for free": 3-step carousel, arrows | "Start designing free": 3-step carousel (pick a style, add your artwork, order from a printer), arrow buttons, scroll-snap | — | `StartCarousel.tsx` | built |
| 9 | "Frequently asked questions": 10+ rows | FAQ in MSA (10 questions) + FAQPage JSON-LD | — | kit `MarketingFaq` restyled page-locally | built |

## 3. Page-local components (no kit forks)

All under `src/components/marketing/designer-page/`: `copy.ts` (ar + en strings, kept out of the client dictionary), `designer-page.module.css`, `Hero.tsx`, `LiveBox.tsx` (client), `PromptBar.tsx` (client), `StyleWall.tsx` (client, pause), `Bento.tsx`, `mockups.tsx`, `TrustTrio.tsx`, `MaterialsWall.tsx` (client, pause), `StartCarousel.tsx` (client), `Faq` from the kit.
Kit components used as-is: `HeroImage`, `HeroScene3D` (lazy), `MarketingFaq`, `JsonLd`, `faqJsonLd`, `RevealScope` (already in the shell).

## 4. Files outside scope (smallest additive change)

| File | Change | Why |
|---|---|---|
| `src/app/sitemap.ts` | `/designer` entry | sitemap entry (asked) |
| `src/components/designer/ModelPicker.tsx`, `ModelLinks.tsx`, `src/app/[locale]/design/(picker)/page.tsx` | optional `initialQuery` prop, fed from `?q=` | the prompt bar routes to the picker with a search |

## 5. Checks

Filled in at the end of the session (section 6).
