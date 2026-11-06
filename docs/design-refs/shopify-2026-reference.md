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
| `Sheet` spacing (section 7) | `y = "md" \| "lg" \| "xl"` (64/56/40, 100/80/64, 128/96/80); overlap = `--mk-radius-sheet` 48/40/32 with the first heading `--mk-section-y-lg` below the top edge; same-tone neighbours collapse to one `--mk-section-y`; `hero` top = header height | Never add page padding to a Sheet (rule 1); `pad="none"` only for full-bleed media that lays itself out. |
| `SectionHead` | `title`, `sub?`, `eyebrow?`, `as = "h2"`, `size = "56"`, `align`, `lg`, `id`, `children` (the content) | title → sub 16; head → content 40/32/32 (`lg`: 80/64/48); centred heads max 760px. Use it for every section heading block. |
| `Stack` | `gap = "head-content" \| "title-sub" \| "head-content-lg" \| "grid"`, `as` | Vertical rhythm from the tokens; replaces page-local margins. |
| `Grid` | `cols = 3`, `colsMd = 2`, `colsSm = 1`, `gap = "default" \| "tight" \| "bento"`, `as` | Gaps 24/24/16, 16/16/12, 32/24/16. `Bento` uses the bento gap. |
| `SheetCard` | `tone = "green"`, `as`, `className` | Rounded 32px band inside the container (the reference's green feature card). |
| `Container` | `size = "default"` (1260 content box), `"narrow"` (880), `"wide"` (1440), `"full"`; `as` | Gutter 16 phone, 32 tablet, `max(24px, (100vw - 1260px) / 2)` desktop (90 at 1440). |
| `Display` (alias `Heading`) | `as = "h2"`, `size: "hero" \| "96" \| "64" \| "56" \| "44" \| "20"` (default 64), `align: "start" \| "center"`, `id` | Weights 300 (hero, 96), 330 (64/56/44), 450 (20). Arabic: no tracking, line height 1.25. |
| `Eyebrow`, `Lead`, `Body` | `children`, `align` (Lead) | Eyebrow is green on dark, deep green on light, lilac on violet. |
| `Pill` | `href?` (Link) or button props; `variant = "light" \| "outline" \| "tint" \| "dark" \| "outline-dark" \| "ghost"`; `size = "md"` (44px) `\| "sm"` (40) `\| "lg"` (56) | light/outline on dark, tint on violet, dark/outline-dark on light sheets. |
| `PillRow` | `align = "start" \| "center"` | 40px top margin, 12px gap. |
| `IconPill` | button props + required `aria-label` | 44px round (pause/play, arrows). |
| `Reveal` | `as = "div"`, `variant = "rise" \| "fade" \| "scale"`, `index` (stagger, 60ms each) | Once on enter, 600ms `cubic-bezier(0.215,0.61,0.355,1)`. Visible without JS, instant under reduced motion. Never on the LCP headline. |
| `Stagger` | `as = "div"`, `variant`, `start = 0`, `className` | Adds reveal + index to each direct child element. |
| `HeroTitle` | `lines?: string[]` or `text`, `as = "h1"`, `size: "96" \| "hero" \| "64"`, `align`, `id` | Word slide-in 400ms, 45ms apart, reading order in both directions; rises without fading so it stays the LCP paint. Splits on spaces only (Arabic joins intact). |
| `PinnedScale` (client) | `media`, `behind?`, `from = 0.45`, `length = "220vh"`, `aria-label` | Pins and scales the card to full bleed (radius 32 → 0). CSS `animation-timeline` with rAF fallback. No JS / reduced motion: full size, not pinned. |
| `StickyStory` (client) | `steps: { id, title, body?, media, extra? }[]`, `mediaSide = "end" \| "start"`, `headingLevel = "h3"` | Sticky media column cross-fades to the step nearest the viewport centre. Phones and no-JS: media inline per step. |
| `Collage` (client) | `items: { media, x, y, w = "18%", depth = 0 (-1..1), rotate?, front?, hideOnPhone? }[]`, `children` (centre), `height = "90svh"`, `travel = 160` | Logical `x` (mirrors in Arabic). Parallax off under reduced motion. |
| `Marquee` (client) | `items: ReactNode[]`, `label` (required, names the region), `duration = 40`, `reverse`, `gap = "24px"`, `controls = true`, `paused?` (controlled), `pauseLabel`, `playLabel` | Runs the reading direction; pauses on hover, focus and its button; reduced motion: plain scroller, single copy. Two-row logo marquee: two Marquees, one `reverse`, share one `paused` state and one button. |
| `Ticker` (client) | `words: string[]`, `label`, `duration = 30`, `reverse` | Big 64px words with green dot separators, on Marquee (pause button included). |
| `CardFan` | `cards: { media, label? }[]`, `width = 240`, `tilt = 6`, `height = 520`, `aria-label` | Arc that rises into place once; straightens on hover/focus; phones: snap row. Label sample brands as samples. |
| `Glow` | `color = "violet" \| "green" \| "navy" \| "white"`, `x`, `y`, `size = "60vmax"`, `blur = 40`, `breathe = false` | CSS only, aria-hidden, inside any Sheet. `breathe` (8s loop) needs a `MotionScope` around the section. |
| `MotionScope` (client) | `children`, `pauseLabel?`, `playLabel?`, `buttonClassName?` | Pause/play button for every CSS animation inside (WCAG 2.2.2); hidden under reduced motion. |
| `Orbit` | `hub`, `nodes: { label, icon? }[]`, `label`, `duration = 80`, `size = 560` | Ring turns, nodes stay upright; list semantics; pause button built in. |
| `CountUp` / `Stat` (client) | `value`, `prefix`, `suffix`, `decimals = 0`, `duration = 1400`; `Stat` adds `label` | Server HTML holds the final value; counts once on enter; screen readers get the final value; Western digits. Real Elba numbers only. |
| `Steps` (client) | `items: { title, body?, media }[]`, `interval = 6000` (0 = manual), `label` | 01/02/03 ARIA tabs with progress underline and media swap; auto-advance with pause button; holds on hover/focus; manual under reduced motion. |
| `Bento` / `BentoCard` | `Bento`: `cols = 3 \| 2 \| 4`, `row = 280`; `BentoCard`: `span 1-4`, `rowSpan 1-2`, `tone = "white" \| "grey" \| "dark" \| "green" \| "violet"`, `eyebrow`, `title`, `titleAs = "h3"`, `body`, `media` | 32px radius cards; media pinned to the card foot. |
| `MediaCard` (client) | `poster: { src, alt, width, height, srcSet?, sizes? }`, `video?: { webm?, mp4? }`, `title`, `body`, `href`, `ratio = "4 / 5"` | Poster first, `preload="none"`; muted loop plays on hover / focus only, never under reduced motion. |
| `Faq` | `items: { q, a }[]`, `name?` (exclusive accordion) | Native details/summary, big plus → minus, height animation where supported. |
| `PhoneSignup` (client) | `designPath`, `labels?` (overrides `mk.phone.*`), `align` | Same logic as `HeroPhoneForm` (empty → designer; valid number → `/login?next=`; the number never goes in the URL, PDPL 151/2020). |
| `MockupFrame` | `frame = "none" \| "browser" \| "phone"`, `tilt`, `chips?: { content, x, y }[]`, `caption`, `children` | Floating UI with the float shadow; wrap in `Reveal` for entrance. |

Helpers: `useReducedMotion()`, `prefersReducedMotion()` and `useScrollProgress(ref, fn)` in `kit/motion.ts` (they also honour the gallery's `html[data-mk-reduced]` preview).

Tokens (`kit/tokens.css`, read them in page CSS, never literals): `--mk-bg`, `--mk-bg-2`, `--mk-bg-3`, `--mk-band-green`, `--mk-band-navy`, `--mk-band-violet` (gradient), `--mk-violet`, `--mk-violet-tint`, `--mk-sheet`, `--mk-sheet-2`, `--mk-on-dark`, `--mk-on-dark-muted`, `--mk-on-dark-subtle`, `--mk-on-light`, `--mk-on-light-muted`, `--mk-line-dark(-strong)`, `--mk-line-light`, `--mk-green` (accent on dark), `--mk-accent-ink` (accent on light), `--mk-focus`; inside a Sheet also `--mk-muted`, `--mk-line`, `--mk-ring`. Radii `--mk-radius-sheet` 48, `--mk-radius-card` 32, `--mk-radius-media` 20, `--mk-radius-tile` 16, `--mk-radius-pill`. Motion `--mk-ease-standard` (0.4,0,0.2,1), `--mk-ease-out` (0.215,0.61,0.355,1), `--mk-ease-media` (0.5,0,0.5,1), `--mk-dur-1/2/3/4` 150/200/300/450ms, `--mk-dur-title` 400ms, `--mk-stagger` 60ms. Type `--mk-fs-hero/96/64/56/44/20/18/16/14`, `--mk-fw-display` 300, `--mk-fw-heading` 330, `--mk-fw-title` 450, `--mk-fw-button` 550, `--mk-font`. Layout `--mk-container` 1280, `--mk-gutter`, `--mk-header-h` 64/72, `--mk-section-y`, `--mk-sheet-overlap` 48.

Rules for page sessions:
- The first section of a rebuilt page is `<Sheet hero>`; the header is transparent until scroll only on such pages. Pages without one get the solid header (no change needed for legacy pages).
- A page built from Sheets gets the dark canvas behind them automatically (`.mk-site:has(main [data-tone])`).
- Strings for header, footer and kit controls live in `src/i18n/kit.{en,ar}.ts` (`mk.*`). Put page copy in your own namespace.
- Never wrap the LCP headline in `Reveal`; use `HeroTitle` (or a plain `Display`).
- Header and footer link to `/start`, `/why-elba`, `/designer`, `/pricing` (the pages being built). `startHref(locale)` still points at the designer until `/start` ships; switch it in `MarketingHeader.tsx`.

Foundation notes (measured on the reference, 6 Nov 2026, 1440x900 and 390x844):
- Header: 72px, `position: sticky`, transparent over the hero and `rgb(2,9,10)` once scrolled or while a menu is open; menu panel full width `rgb(2,9,10)`, 40px top padding, slides in 300ms `cubic-bezier(0.215,0.61,0.355,1)` after a 200ms delay, link list fades in 250ms later; other top-level items dim while one is open. Phone: logo, underlined "Start free" text link, menu button.
- Pills: 44px (16px/550, 8px 20px) in the header and 56px (18px/550, 12px 24px) in heroes, 2px border, 150ms `cubic-bezier(0.4,0,0.2,1)`.
- Headings: h1 96/300 line 1.08 tracking -0.02em; h2 64/330 or 56/330 (tracking -0.03em); h3 44/330; card titles 20/450; footer headings 20/450, links 16px zinc-400 (`#a1a1aa`), 200ms colour transition, footer background `#000`.
- Keyframes on the home page: `mc-glow-fade` / `mc-glow-fade-bloom` (8s), `mc-spin`, `mc-spin-rev`, `logo-group-marquee(-reverse)`, `scroll-x`, `shimmer`, `fade-in`, `pulse`.
- Fonts in this build: Inter first in both locales, then Noto Sans Arabic (one 166 KB variable file, Arabic block, preloaded on Arabic marketing pages only). English pages render the one Arabic word (language switch) in the system face. Plex stays for the designer, checkout, vendor and admin frames (`preloadPlexArabic`).
- Mega-menu panels mount after hydration (their links are also in the phone menu and footer), which keeps about 10 KB out of every marketing page's HTML.

## 7. Spacing system (measured 6 Nov 2026, binding for every marketing page)

Measured with Playwright on shopify.com/sa, /sa/start, /sa/sell, /sa/website/builder and /sa/pricing at 1440x900 and 390x844 (section bands, paddings, heading offsets, grid gaps, container boxes), against our /ar, /ar/start, /ar/why-elba, /ar/designer and /ar/pricing on main c828b8a. Every marketing page uses these tokens and nothing else. No page-local padding, margin or gap values in px.

| Token | Desktop (≥1024) | Tablet (768 to 1023) | Phone (<768) | Shopify evidence |
|---|---|---|---|---|
| `--mk-container` | 1260px max, centred | 100% minus 2 × gutter | 100% minus 2 × gutter | content box 1260 at x=90 on every page |
| `--mk-gutter` | 90px at 1440 (`max(24px, (100vw - 1260px)/2)`) | 32px | 16px | x=90 / x=16 |
| `--mk-section-y` (standard band) | 64px top and bottom | 56px | 40px | 64/64 on most home bands; phone 40/40 |
| `--mk-section-y-lg` (feature, sheet, violet/green bands) | 100px | 80px | 64px | violet sheet 100/100, phone 64/64 |
| `--mk-section-y-xl` (closing CTA, after-hero statement) | 128px | 96px | 80px | 128 on CTA and closing bands |
| `--mk-hero-top` | header height (72px), content then vertically placed | 72px | 72px | hero padding-top 72 |
| `--mk-stack-title-sub` (heading → its one-line subtitle) | 16px | 16px | 16px | gapAfterH 16 |
| `--mk-stack-head-content` (heading block → cards/media) | 40px | 32px | 32px | 32 to 40 |
| `--mk-stack-head-content-lg` (big feature) | 80px | 64px | 48px | 80 |
| `--mk-grid-gap` | 24px | 24px | 16px | 24 |
| `--mk-grid-gap-tight` (dense rows, logo/icon walls) | 16px | 16px | 12px | 16 |
| `--mk-grid-gap-bento` | 32px | 24px | 16px | 32 |
| `--mk-radius-sheet` | 48px | 40px | 32px | 48 desktop, 32 phone |
| Type: h1 hero | 96px (start hero 180px) | 72px | 56px | 96 / 180; phone 56 |
| Type: h2 section | 56px (64 for page-closing) | 48px | 36px | 56/64; phone 36 |
| Type: h3 | 44px | 36px | 28px | 44 |

Rules:
1. Bands never add their own padding on top of a Sheet's padding; a Sheet is the band.
2. Adjacent bands of the same tone collapse to one `--mk-section-y` between them (no doubled 64 + 64 = 128 gaps).
3. Overlapping sheets: the next sheet's top edge sits `--mk-radius-sheet` into the previous band; the first heading inside sits `--mk-section-y-lg` below the sheet top.
4. No negative gaps: a heading must never overlap the block after it (designer page had -44px).
5. Line length: body text max 60ch in a 630px column (half container) as on Shopify; centred section intros max 760px.
6. Every page is checked by e2e/marketing-spacing.spec.ts (owned by the foundation): container width and gutter, section paddings by band type, heading-to-content gap and grid gaps within ±2px of the tokens, at 1440, 1024, 768 and 390 in ar and en.

Section 7 in code (foundation): every value above is a token in `kit/tokens.css` (`--mk-container`, `--mk-gutter`, `--mk-section-y(-lg|-xl)`, `--mk-hero-top`, `--mk-stack-title-sub`, `--mk-stack-head-content(-lg)`, `--mk-grid-gap(-tight|-bento)`, `--mk-radius-sheet`, `--mk-sheet-overlap`, `--mk-measure` 60ch, `--mk-intro-max` 760px; type `--mk-fs-96` 96/72/56, `--mk-fs-64` 64/48/36, `--mk-fs-56` 56/48/36, `--mk-fs-44` 44/36/28). `Lead` sits 16px under its heading and caps at 60ch (760px centred); `PillRow` sits `--mk-stack-head-content` under the head. `e2e/marketing-spacing.spec.ts` measures the kit's `data-mk-*` hooks; pages listed in its `NOT_YET` set run as `test.fixme` until their owner conforms them and deletes the entry (at the foundation push: /why-elba, /designer, /boxes, /catalog, /vendors; /, /start and /pricing pass).
