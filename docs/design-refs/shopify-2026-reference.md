# Public site rebuild: shopify.com (2026) reference

Owner request (6 Nov 2026): the public site must look, feel and animate like shopify.com today (`/sa`, `/sa/start`, `/sa/sell`, `/sa/website/builder` and the product pages), as close as possible. The current light, banded site is retired.

**Hard rules**
- Copy the design language: layout, rhythm, type scale, colour system, motion and interaction patterns. Never copy Shopify's logo, name, wordmark, icons, illustrations, photos, videos, brand logos or copy. Every image is ours, rendered from our own 3D engine and model library. Every word is written for Elba, in Arabic first.
- No fabricated social proof. That means no fake customer logos, testimonials, "every 26 seconds" style counters or review counts. Use real numbers from our own data: model count, finishes, printers in the seed, delivery days, prices from the pricing engine.
- Arabic is the primary locale. Use MSA natural for Egypt, noun-form labels, no diacritics, full RTL, with a mirrored layout that mirrors well.
- Accessibility: WCAG 2.2 AA throughout. Content is visible by default and animation is an enhancement. `prefers-reduced-motion` gives a calm static page with the same content. Every auto-moving thing (marquee, ticker, rotating hero) has a pause control under SC 2.2.2. Each focus target is visible and not obscured, under SC 2.4.7 and 2.4.11.
- Performance budget stays: phone LCP under 2.5 s, CLS under 0.1, INP under 200 ms, and no three.js on first load of marketing pages. Use posters for 3D, loaded on interaction or idle.
- Imports: use direct UI-kit imports only. An ESLint rule enforces this; run `node scripts/codemods/debarrel-ui.mjs` on new files.

Reference captures (screens, scroll frames, scroll videos, computed styles) were taken at 1440x900 and 390x844 in Arabic. They are not in git. Every build session should re-capture the page it rebuilds with Playwright and compare frame by frame: `https://www.shopify.com/sa/<page>`, plus `/sa/<page>` in English via `https://www.shopify.com/<page>`.

## 1. Foundations

| Token | Shopify value (measured) | Elba |
|---|---|---|
| Page background | near-black `rgb(2,9,10)`; builder page `rgb(5,9,23)` | `--mk-bg: #02090a` |
| Deep green band | `rgb(4,30,24)` / `rgb(0,8,5)` | `--mk-band-green` |
| Deep navy band | `rgb(0,10,30)` | `--mk-band-navy` |
| Violet band | saturated violet gradient (approx. `#3b1fd9` to `#6a4cff`), with glow | `--mk-band-violet` |
| Light sheet | `rgb(245,245,243)` and `#fff` | `--mk-sheet` |
| Text | white on dark; muted text about 60 to 70% white | tokens for `--mk-text`, `--mk-text-muted` on dark and light |
| Section sheet radius | 48px top corners (the sheet slides over the previous section); inner cards 32px; media 16 to 24px | `--mk-radius-sheet: 48px`, `--mk-radius-card: 32px` |
| Container | about 1200 to 1280px, 24 to 40px gutters; phone 16px | keep |
| Display type | 96px weight 300, tracking -0.02em (h1); start hero 180px weight 300, -4px; h2 64px/56px weight 330, -0.02em; h3 44px weight 330; card title 20px weight 450; body 16 to 18px | same scale, fluid with `clamp()`; phone h1 about 48 to 56px |
| Typeface | `Shopify-Inter` (Latin) + `Noto Sans Arabic` (Arabic), light weights for display | Inter + **Noto Sans Arabic** (variable, open licence) with weights 300 to 600, via next/font, Arabic subset, display swap, size-adjusted fallback. This replaces Plex for marketing pages; keep the LCP budget. |
| Buttons | white pill (black text) as primary on dark; outline pill (1px white) as secondary; on violet, a lilac pill. Height 40 to 48px | `mkui` Button variants: `pill-light`, `pill-outline`, `pill-tint` |
| Header | 72px, sticky, transparent on the hero then solid dark; logo at start; nav links with chevrons and mega-menus; an outlined "edition" pill; at end "Log in" and a white "Start free" pill | rebuild MarketingHeader: mega-menu panels (products, solutions), our wordmark |
| Footer | dark; logo mark; 4 link columns; locale switcher; legal row; social icons row | rebuild MarketingFooter |

## 2. Motion system (measured)

| Pattern | Measured on Shopify | Build as |
|---|---|---|
| Reveal on enter | opacity plus translate, 0.3s `cubic-bezier(0.4,0,0.2,1)` (most common) and 0.3s `cubic-bezier(0.215,0.61,0.355,1)`; staggered children | `<Reveal>` / `useReveal`. Content is visible without JS; a class enables the animation only when JS and motion are allowed. |
| Hero title slide-in | keyframe `hero-title-slide-in` 0.4s, per word or line | `<HeroTitle>` splits by word (RTL aware) |
| Scroll-scrubbed scale | start page: a template card grows from a centred card to full width while pinned; the headline sits behind | `<PinnedScale>` with CSS `animation-timeline: view()` where supported, and a rAF scroll fallback |
| Pinned story / sticky stack | "Choose your design" and "Make your products shine": sticky media, text steps scroll past | `<StickyStory>` |
| Collage fly-in | start hero: product pieces scattered around giant words, parallax at different speeds on scroll | `<Collage>` with per-item `data-depth` parallax |
| Logo or ticker marquee | `logo-group-marquee` (two rows, opposite directions), `ticker` (-66%), `marquee-rtl` / `marquee-ltr` | existing `Marquee`, RTL-correct, with pause button and hover pause |
| Card fan / lineup | start "Join an all-star lineup": tall tilted cards in an arc, drifting | `<CardFan>` |
| Glow orbs | `mc-glow-fade` / `mc-glow-fade-bloom` 8s loops; violet and green radial glows behind media | `<Glow>` (CSS only) |
| Slow spin rings | `mc-spin-rev` 80s, orbit diagram ("Show up everywhere") | `<Orbit>`: our hub in the centre, nodes for designer, printers, delivery, payment, catalogue |
| Counters | stats count up on enter (36%, 23%, 150+; 15%, 250M+) | `<CountUp>` with real Elba numbers |
| Steps with image swap | "Build fast": 01/02/03 list with an underline progress bar; the active step swaps the photo; auto-advance with pause | `<Steps>` |
| Bento grid | "Get going, then growing": light cards with product UI mockups | `<Bento>` |
| UI mockups | floating product UI (checkout, cart, chart, phone with a notification) layered over photos, with soft shadows | our real UI rendered as images (checkout summary, price badge, order tracking, vendor job) |
| Video cards | hover plays a muted loop; play button opens a modal | our 3D turntable loops rendered to webm/mp4 (short, muted, poster first) |
| Hover/press | 0.2s colour transitions; 0.15s scale on press; 0.45s `cubic-bezier(0.5,0,0.5,1)` on media | tokens `--mk-ease-standard`, `--mk-ease-out`, `--mk-dur-1/2/3` |
| FAQ | big plus icons, smooth height animation | `<Faq>` restyled |
| Section transitions | each dark/coloured section is a rounded sheet that overlaps the previous one (negative margin-top, 48px radius) | `<Sheet tone="dark|green|navy|violet|light">` |

## 3. Pages to build (Shopify page → Elba page)

| Shopify | Elba route | Sections to mirror (with Elba content) |
|---|---|---|
| `/sa` (home) | `/[locale]` | full-bleed dark hero (our 3D box turntable as the "video"), headline, two pills; "design everywhere" media rail; "show up everywhere" orbit; "grow" mockup band; "for anyone" 3 photo cards (cafés, cosmetics, e-commerce); violet band with the designer (Sidekick equivalent); catalogue icon grid (370 models, like the app grid); green stats band (real numbers); 3-step "start fast" with image swap; CTA; footer |
| `/sa/start` | new `/[locale]/start` (main CTA target) | giant split headline with box collage and parallax; "choose your box": pinned card that scales up into the designer; "make your packaging shine": finishes and 3D; "get paid / order": price and checkout mockup; card fan of sample brand boxes (labelled as samples); bento "start, then grow"; CTA with phone sign-up |
| `/sa/sell` | new `/[locale]/why-elba` | "More boxes. Less spend." hero with ticker of box styles; light sheet "better packaging" with sticky phone or mockup and 3 points; violet "more orders" 3 mockup cards; green "less spend" stats from the pricing engine; "switch from your print shop" with a quote-style card (our promise, no fake testimonial); CTA |
| `/sa/website/builder` | new `/[locale]/designer` (the 3D designer product page) | hero with floating UI and glow; violet glow prompt bar; template wall (our styles); "no code needed" bento with real editor screenshots; "get found" (share links, export); trust trio (secure payments, 14% VAT receipts, vetted printers); materials and finishes grid (like the app grid); 3-step start carousel; FAQ |
| `/sa/pricing` | `/[locale]/pricing` (new or restyled) | plan-card language applied to our price tiers (instant to 2,000, quote above), prepay discount, sample order, FAQ |
| `/sa/online`, `/checkout`, `/payments`, `/shipping` | product subpages as needed: `/[locale]/printing`, `/[locale]/delivery` | same section kit |
| global | header, footer, announcement bar (remove), 404, legal, boxes, catalogue, bottles, vendors, vendor profile, size pages | restyle with the new tokens and sheets |

## 4. Assets plan (ours only)
- Hero and collage imagery: render our models with sample artwork through the engine at 2x (webp/avif): mailer, rigid box, bottle, can, tube, pouch. Add studio scenes with soft shadows on dark, plus a few lifestyle-style compositions (hands, tissue, tape) made from our renders.
- Turntable loops: 4 to 6 s muted webm and mp4 per hero model, poster first, played only when visible and not under reduced motion.
- UI mockups: real screenshots of our designer, price badge, checkout summary, order tracking and vendor job, cropped and framed.

## 5. Acceptance
- Side by side with the Shopify page at 1440 and 390 in Arabic and English, scored per section on layout, type, colour, motion and interaction. Target: a reviewer cannot tell which design system each comes from, except for brand and content.
- Lighthouse phone: LCP under 2.5 s, CLS under 0.1, TBT under 200 ms on every rebuilt page.
- axe: 0 violations; keyboard walk; reduced-motion walk; RTL mirror check.
- e2e: update the storefront and marketing specs to the new structure without weakening them.

## 6. Kit API (foundation session; code against this)

All files live in `src/components/marketing/kit/`. Import each from its own file (no barrel), e.g. `import { Sheet } from "@/components/marketing/kit/Sheet"`. Every page under `MarketingShell` already has the tokens (`[data-mk]`), the dark header and footer, and the reveal observer. Live gallery: `/ar/dev/kit`, `/en/dev/kit` (dev and e2e only).

Page skeleton:

```tsx
<Sheet tone="dark" hero aria-labelledby="h">      {/* first section: sits under the transparent header */}
  <Eyebrow>…</Eyebrow>
  <HeroTitle id="h" lines={["…", "…"]} />          {/* the LCP h1: word slide-in, no fade */}
  <Lead>…</Lead>
  <PillRow><Pill href={startHref(locale)} size="lg">…</Pill><Pill href="…" variant="outline" size="lg">…</Pill></PillRow>
</Sheet>
<Sheet tone="light">…</Sheet>                      {/* overlaps the previous one: -48px, 48px top radius */}
<Sheet tone="green">…</Sheet>
```

`startHref(locale)` (exported from `MarketingHeader.tsx`) is the one place every "Start free" CTA points; it switches to `/start` when that page ships.

| Component | Props (defaults first) | Notes |
|---|---|---|
| `Sheet` | `tone: "dark" \| "green" \| "navy" \| "violet" \| "light" \| "white"`, `overlap = true`, `hero = false`, `pad: "default" \| "sm" \| "none"`, `container: "default" \| "narrow" \| "wide" \| "full" \| false`, `as = "section"`, `id`, `aria-label(ledby)` | Sets text, muted (`--mk-muted`), line (`--mk-line`) and focus ring for its tone. `hero` adds header-height top padding and marks the page so the header starts transparent. |
| `SheetCard` | `tone = "green"`, `as`, `className` | Rounded 32px band inside the container (the reference's green feature card). |
| `Container` | `size = "default"` (1280), `"narrow"` (880), `"wide"` (1440), `"full"`; `as` | Fluid gutter 16 / 32 / 40px. |
| `Display` (alias `Heading`) | `as = "h2"`, `size: "hero" \| "96" \| "64" \| "56" \| "44" \| "20"` (default 64), `align: "start" \| "center"`, `id` | Weights 300 (hero, 96), 330 (64/56/44), 450 (20). Arabic: no tracking, line height 1.25. |
| `Eyebrow`, `Lead`, `Body` | `children`, `align` (Lead) | Eyebrow is green on dark, deep green on light, lilac on violet. |
| `Pill` | `href?` (Link) or button props; `variant = "light" \| "outline" \| "tint" \| "dark" \| "outline-dark" \| "ghost"`; `size = "md"` (44px) `\| "sm"` (40) `\| "lg"` (56) | light/outline on dark, tint on violet, dark/outline-dark on light sheets. |
| `PillRow` | `align = "start" \| "center"` | 40px top margin, 12px gap. |
| `IconPill` | button props + required `aria-label` | 44px round (pause/play, arrows). |
| `Reveal` | `as = "div"`, `variant = "rise" \| "fade" \| "scale"`, `index` (stagger, 60ms each) | Once on enter, 600ms `cubic-bezier(0.215,0.61,0.355,1)`. Visible without JS, instant under reduced motion. Never on the LCP headline. |
| `Stagger` | `as = "div"`, `variant`, `start = 0`, `className` | Adds reveal + index to each direct child element. |
