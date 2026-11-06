# R6 restyle: every other public page in the shopify.com (2026) language

Scope: `/boxes`, `/boxes/[structure]`, `/boxes/[structure]/[size]`, `/catalog`, `/catalog/[slug]`, `/bottles`, `/vendors`, `/vendors/[slug]`, `/legal/*`, the not-found and error pages, `/login` and the share page `/s/[id]`. Home, `/start`, `/why-elba`, `/pricing` and `/designer` belong to other sessions. Tokens, fonts, header, footer and the kit come from `r6-foundation` (merged twice, the second time with main f8db398), and renders from `r6-assets` (merged).

## 1. Reference capture (shopify.com/sa, 6 Nov 2026, Playwright, 1440x900 and 390x844, ar-SA)

Captured pages: `/sa/online`, `/sa/pos`, `/sa/checkout`, `/sa/payments`, `/sa/shipping`, `/sa/pricing`, `/sa/legal/terms`, `/sa/legal/privacy`, and an unknown `/sa/...` URL for the 404. The screens are Shopify's material, so they are not in git. The measured values below are what this restyle copies.

| Element | 1440 | 390 | Notes |
|---|---|---|---|
| Product hero (checkout, payments, pricing) | dark `rgb(2,9,10)` or black; eyebrow 16px/550; h1 64px/330, -0.02em (payments, pricing, legal); headline 96px/300 on online and shipping | h1 36 to 56px | Copy at the start, media at the end; violet or navy radial glow behind the media |
| Section sheet | white or `#f2f2f0` sheet, **48px** top radius, overlapping the dark band | **20px** radius | Sheets alternate dark, white, black, navy `rgb(1,7,44)` and violet `rgb(77,33,255)` |
| Section padding | 128px top (80px on sheets that open a page) | 64 to 80px | |
| h2 | 56 to 64px / 330, line-height 1.08 | 36 to 44px | |
| h3 / card title | 28px / 360 (statement), 18 to 20px / 450 to 550 (card) | 18 to 22px | |
| Body | 18px / 400, line-height 1.4; muted `rgba(0,0,0,.6)` on light, `rgb(187,199,216)` on dark; fine print 14px / 420 | 16px | |
| Primary pill | 56px tall, radius 9999, 12px 24px padding, 18px / 550; white on dark, black on light | 44px, 16px | |
| Secondary pill | same size, transparent, 2px solid current colour | same | |
| Feature cards (shipping) | `#f2f2f0` card on white, radius about 24px, UI above a centred caption | stacked | 2-up bento |
| Stats row (checkout) | 3 cells in a hairline box, 28px / 360 number above a 14px muted label | 3 across, 18px | |
| Legal | dark hero band (eyebrow "Updated …", 64px h1, 20px muted subline), then a white body: sticky TOC at the start (16px / 550 heading, 14px links, 1px rule with a 2px active marker), article about 720px, h2 34px / 330, body 18px / 1.4 | TOC above the article | |
| 404 | full-viewport dark page with a teal-to-navy radial gradient; start column: "404" 44px / 330, 64px h2, 20px lead; end column: three 32px links separated by 1px rules, each with a 44px round outline arrow | stacked | |
| Motion | reveal 0.3s `cubic-bezier(0.4,0,0.2,1)` opacity + rise; hovers 0.2s; media 0.45s `cubic-bezier(0.5,0,0.5,1)`; hero words slide in | same | |

## 2. How the pages are built

- Sections, type and pills are kit components only: `Sheet` (hero / white / light / green tones), `Display`, `HeroTitle`, `Eyebrow`, `Lead`, `Pill`, `PillRow`, `Reveal`, `Stagger`, `Glow`. Nothing in `kit/` was forked.
- Page-local pieces live in `src/components/marketing/restyle/`. Each sheet is split by page group so that every page carries only what it uses:
  - `restyle.module.css`: core pieces (5.6 KB). Product split hero, media card, chips, stats box, section heads, crumbs.
  - `detail.module.css`: tiles, product cards, category showcase, printer profile and the `mkui` stand-ins.
  - `legal.module.css`: TOC with the active-section rule, plus the article.
  - `lost.module.css`: 404 and error states (1.8 KB). It is deliberately separate because the (store) and detail not-found and error elements are embedded in every page under those layouts (R4-09).
  - `auth.module.css`: sign-in.
- The catalogue pages keep their hero pieces in `catalogue.module.css` and the share page in `share.module.css`. Before the platform's chunking fix, importing the restyle sheet pulled a merged chunk (restyle + detail + store + account, about 30 KB) onto the 370-model page.
- `LostState` (client) is the shared 404/error layout. `TocSpy` (client, about 30 lines) marks the TOC link of the section in view.
- `mkui.tsx` and `ProductCard.tsx` now read the restyle sheets instead of `marketing.module.css`.
- Sample brands: every render that shows our made-up brands has the assets kit's `SAMPLE_LABEL` under it: the /boxes and /bottles showcases and the box style/size hero.
- No new copy keys. Every string is an existing key; the legal subline reuses `legal.<doc>.metaDescription` and the 404 links reuse `common.goHome`, `nav.catalog` and `nav.design`.

## 3. Page table

Status: done = restyled, axe 0, budgets met; noted = restyled, with a measured issue explained below. Phone = 390x844, DPR 2, 4x CPU, Slow 4G, cold cache, median of 3 loads (`docs/audit/tools/r6-restyle-check.mjs`). axe uses the WCAG 2.0/2.1/2.2 A+AA tags at 1440 and 390.

| Route | Shopify model | New structure | Kept behaviour | Status | Phone LCP ar / en (s) | CLS ar / en | axe |
|---|---|---|---|---|---|---|---|
| `/boxes` | `/sa/online` hero + `/sa/shipping` cards | dark hero sheet: eyebrow, 96px `HeroTitle`, lead, two pills, render row on a violet glow with the sample label; white sheet with each family as a 56px head and a grey-tile card rail (swipe rail on phones); light sheet linking to the library; dark CTA with glow | preloaded AVIF LCP render, rails + RailFocus, family anchors, ISR prices | done | §4 | §4 | 0 |
| `/boxes/[structure]` | `/sa/checkout` hero | compact dark hero: crumbs, eyebrow, 64px `HeroTitle`, lead, fact chips, pills, render in a glass media card on a glow; white sheet: price, specs, sizes and materials tiles; sticky dark CTA tile + printers tile | Product + Breadcrumb JSON-LD, `#prices`, notFound in the segment layout above Suspense | done | §4 | §4 | 0 |
| `/boxes/[structure]/[size]` | same | same component, size chip current, extra crumb | SEO title/h1 forms; h1 stays a plain `Display`, because HeroTitle's word spans would break the bidi-isolated dims (CR-62) | done | §4 | §4 | 0 |
| `/catalog` | `/sa/pricing` hero + app grid | compact dark hero: eyebrow, 64px `HeroTitle`, lead, the four real counts in a hairline stats box; white sheet: sticky search/filters and the model grid on flat `#f5f5f3` tiles; section titles at heading weight | filters, sticky filters, windowed grid, Breadcrumb JSON-LD, inline CSS bytes (§5) | done | §4 | §4 | 0 |
| `/catalog/[slug]` | `/sa/checkout` | compact dark hero: crumbs, standard as eyebrow, h1, description; white sheet: sticky 3D stage tile and facts column with the price-path card (kit pills); light sheet with related models | quote form, order-mode copy, permanent redirect of old slugs, notFound | done | §4 | §4 | 0 |
| `/bottles` | `/sa/online` | as `/boxes`; the title is 64 because at 96 the Arabic title wrapped 4 lines in the fallback face and 3 in Noto, and the swap shifted the page (CLS 0.15) | showcase CLS fix (MK-20), "Coming soon" tags | done | §4 | §4 | 0 |
| `/vendors` | `/sa/shipping` | compact centred dark hero with the managed-marketplace note; white sheet: filter tile, results, printer cards; green CTA sheet "become a printer" | GET filter form, counts, noindex on filtered views | done | §4 | §4 | 0 |
| `/vendors/[slug]` | `/sa/checkout` | compact dark hero: crumbs, logo + city eyebrow, h1, bio, badges, pills; 2x2 hairline stats box (rating or "New", on-time or "New", lead time, minimum); white sheet with the portfolio, capabilities, machines, certifications and reviews tiles | Organization JSON-LD, notFound above Suspense, R5-JR-05 rules from main | done | §4 | §4 | 0 |
| `/legal/*` | `/sa/legal/privacy` | compact centred dark hero: "Last updated" eyebrow, 64px h1, 20px subline, draft-for-review pill (`role=note`); white sheet: sticky TOC with a 2px active-section marker, 720px article, 34px section heads | draft banner, anchors, other-docs nav, `data-testid=legal-body` | done | §4 | §4 | 0 |
| 404: store, detail, catch-all, share, locale | `/sa/404` | full-height dark hero sheet, teal/navy glow, "404", 64px title, 20px lead; three large links with 44px round arrows (home, catalogue, designer; the share 404 leads with "copy design") | real 404 status, document title effect, `#not-found-title`, the locale 404 keeps its own small sheet (R4-09) | noted (LCP, §4) | §4 | §4 | 0 |
| error boundaries | `/sa/404` | same layout; retry is the first big link | `role=alert`, `reset()` | done | – | – | – |
| `/login` | `/sa/pricing` hero | full-height dark hero sheet: lock badge, 64px h1, lead; OTP form in a white floating card | OTP flow, consent, `?next=` and role landing | done | §4 | §4 | 0 |
| `/s/[id]` | `/sa/checkout` | dark sheet (not a hero: the page streams in after the header) with the style as eyebrow, h1, subtitle; white sheet: viewer on a grey tile, sticky dark order tile (price, prepay note, order pill, copy pill) and a specs tile | lazy viewer + poster LCP, noindex, share price, rate-limited visit tracking, token guard above Suspense | done | §4 | §4 | 0 |

## 4. Phone performance and axe (final run on the merged branch)

Raw data: `docs/audit/perf-data/r6-restyle/check-final.jsonl` (base: `check-base-f5e1c33.jsonl`, subset). Budgets: LCP < 2.5 s, CLS < 0.1. The share token `r6restyleShareToken01` was set on a seeded design for the run.

| Page | LCP ar (s) | LCP en (s) | CLS ar | CLS en | axe ar/en, 1440 + 390 | Base f5e1c33 LCP ar / en |
|---|---|---|---|---|---|---|
| `/boxes` | 1.35 | 1.31 | 0.010 | 0.000 | 0 | 8.16 / 7.92 |
| `/boxes/mailer-box` | 1.43 | 1.35 | 0.007 | 0.005 | 0 | – |
| `/boxes/mailer-box/250x180x80` | 1.31 | 1.15 | 0.019 | 0.002 | 0 | – |
| `/catalog` | 1.27 | 1.13 | 0.011 | 0.000 | 0 | 2.09 / 1.88 |
| `/catalog/bakery-box` | 1.65 | 1.32 | 0.008 | 0.000 | 0 | – |
| `/bottles` | 1.44 | 1.36 | 0.010 | 0.000 | 0 | 1.52 / 1.37 |
| `/vendors` | 1.33 | 1.10 | 0.010 | 0.000 | 0 | – |
| `/vendors/nile-pack` | 1.31 | 1.14 | 0.010 | 0.000 | 0 | – |
| `/legal/privacy` | 1.25 | 1.06 | 0.016 | 0.000 | 0 | 1.22 / 1.02 |
| `/legal/terms` | 2.21 | 1.05 | 0.008 | 0.000 | 0 | – |
| `/login` | 1.15 | 1.71 | 0.009 | 0.000 | 0 | – |
| `/s/r6restyleShareToken01` | 1.93 | 1.64 | 0.005 | 0.000 | 0 | 2.35 / 1.96 |
| `/s/no-such-token-123` | 4.87 | 4.45 | 0.000 | 0.000 | 0 | 4.48 / 3.96 | ← R6-RS-11
| `/no-such-page` | 4.69 | 4.37 | 0.000 | 0.000 | 0 | 4.50 / 3.84 | ← R6-RS-11

Every page meets both budgets except the 404 renders (R6-RS-11). Those were already 3.8 to 4.5 s on base: no `<style>` in the 404 head, so the CSS applies at hydration.

## 5. Inline CSS bytes (before / after)

Measured with `node docs/audit/tools/inline-css-bytes.mjs http://localhost:3100 <paths>` against `next start`. "Before" is base f5e1c33. "Foundation only" is `r6-foundation` at 9c075e3, before its main merge, built separately.

| Page | Before: inline CSS KB (gz) | Foundation only | After (this branch, merged) | HTML KB gz before → after |
|---|---|---|---|---|
| `/ar/catalog` | 136.5 (26.3) | 158.1 (30.7) | **153.2 (30.8)** | 131.7 → 137.4 |
| `/ar/boxes` | 110.7 (21.7) | 132.3 (26.2) | 147.4 (29.8) | 92.7 → 105.0 |
| `/ar/boxes/mailer-box` | 127.9 | 149.5 (28.7) | 164.1 (32.3) | – → 102.4 |
| `/ar/legal/privacy` | 110.7 | 132.3 (26.2) | 149.5 (30.2) | – → 89.7 |
| `/ar/vendors` | 110.7 | 132.3 (26.2) | 147.4 (29.6) | – → 104.4 |
| `/ar/login` | 136.5 | 158.1 (30.7) | 154.4 (31.1) | – → 85.7 |

Reading the numbers:

- **No duplication inside a page.** Across the 1,619 inline rules on `/ar/catalog`, 16 rules repeat, for 747 bytes in total. The copy of the CSS inside the RSC payload ("CSS also in flight", 89 to 100%) is Next's `inlineCss` behaviour (R4-08) and was already 100% before.
- **`/catalog`:** 153.2 KB, which is under the foundation-only build. Everything above base is the kit's own sheet, which `Sheet` needs; the catalogue page imports no restyle CSS at all.
- **Other pages:** +15 to +17 KB over foundation-only. That is the kit sheet (about 26 KB, shared by every rebuilt page) plus the restyle sheets (5.6 + 6 + 2 KB). It is partly offset because these pages stopped using about 20 of `marketing.module.css`'s classes, but that sheet still loads through the shell (foundation scope).

## 6. Findings fixed during the restyle

| id | severity | page | finding | standard | fix | status |
|---|---|---|---|---|---|---|
| R6-RS-01 | high | every dark hero | `--rs-muted` / `--rs-line` resolved on `.page`, above the Sheet, so dark sheets got the light-tone grey (axe color-contrast on crumbs, notes, figcaption) | WCAG 1.4.3 | rules read the Sheet's own `--mk-muted` / `--mk-line`; the dark tile sets them | fixed |
| R6-RS-02 | high | `/vendors/[slug]` | default printer tag dark-on-dark in the hero | WCAG 1.4.3 | translucent white tag on dark sheets | fixed |
| R6-RS-03 | high | `/ar/bottles` | CLS 0.152: the 96px Arabic title wrapped 4 lines in the fallback face and 3 in Noto | CWV CLS < 0.1 | 64px title (same wrap in both faces at 360/390/412/768) | fixed (0.01) |
| R6-RS-04 | high | `/ar/bottles` | LCP 4.9 s: a lazy side render painted larger than the preloaded centre render | CWV LCP < 2.5 s | side renders capped smaller than the centre one (boxes too) | fixed (1.5 s) |
| R6-RS-05 | high | `/s/[id]` | CLS 0.076: the streamed hero sheet switched the header to its overlay offset late and moved `<main>` | CLS | plain dark sheet (solid header) on this streamed page | fixed |
| R6-RS-06 | high | `/s/[id]` | CLS 0.138 when the 3D chunk replaced the placeholder (70dvh/36rem against the viewer's 60dvh/32rem plus its fold row); predates R6 | CLS | placeholder matches the viewer box and reserves the 49px fold row | fixed (0.005) |
| R6-RS-07 | medium | `/ar/legal/*`, `/ar/login`, `/ar/s/…` | LCP 2.3 to 2.7 s: HeroTitle's per-word spans never count as one LCP block, so the cookie notice (painted after hydration) became the LCP | LCP | plain `Display` h1 with `m-enter-lcp` on these short heroes; 20px legal subline (as on the reference) | fixed (1.2 / 1.2 / 2.4 s) |
| R6-RS-08 | medium | `/s/[id]` | the share page pulled the merged restyle chunk; poster later than base (2.7 s against 2.35 s) | LCP | self-contained `share.module.css` | fixed (2.43 s) |
| R6-RS-09 | medium | `/catalog` | importing the restyle core pulled a merged 30 KB chunk onto the 370-model page | perf budget | hero pieces kept in `catalogue.module.css` | fixed |
| R6-RS-10 | medium | `/s/no-such-token`, 404s | 404 lead was smaller than the cookie text, so LCP moved to the cookie notice (7.3 s en share 404) | LCP | 20px 404 lead (measured on the reference) | fixed for the candidate; see R6-RS-11 |
| R6-RS-11 | medium | every 404 (pre-existing) | 404 renders ship no `<style>` in the head: the CSS is only in the RSC payload and applies at hydration, so the styled lead paints at about 3.9 to 5.5 s on Slow 4G. Base f5e1c33 measured 3.8 to 4.5 s with the same cause; this branch is 0.2 to 0.5 s slower there (4.4 to 4.9 s), because the restyled 404 is a kit client island that hydrates with the shell. | LCP | needs a shell- or Next-level fix (not-found with `inlineCss`); not forked here. Listed for the performance / foundation owner. | open (pre-existing) |
| R6-RS-12 | low | e2e | the R6 footer lists "Returns for custom goods" twice (link column + legal row); the strict locator failed | – | assert `.first()` is visible (the same requirement) | fixed |

## 7. Checks (final, merged branch)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors. The 2 warnings are in `scripts/marketing/render-ui.mjs`, from the assets branch. |
| `npm run typecheck` | clean |
| `npm test` (vitest) | 112 files, 8,771 tests passed |
| `npm run build` | ok |
| e2e storefront + catalogue + catalogue-models + designer + smoke, `--workers=2` | 68 passed, 0 failed, 26 skipped (the specs' own once-per-project skips). The "quote request: signed-in buyer" catalogue test failed once in an earlier run under load (it types before hydration) and passed 3 of 3 alone and in this run. |
| axe (WCAG 2.2 AA tags), 14 routes x ar/en x 1440/390 | 0 violations |
| Phone LCP < 2.5 s and CLS < 0.1 | met on every page except the 404 renders (R6-RS-11, pre-existing) |

Screenshots: before in `docs/screenshots/audit/r6-restyle/before/`, after in `docs/screenshots/audit/r6-restyle/after/` (JPEG, top 2,400 px of each page).

Files outside the listed page scope, touched minimally:
- `e2e/storefront.spec.ts`: footer locator `.first()`.
- `src/components/catalogue/catalogue.module.css`: catalogue page styles.
- `src/components/marketing/mkui.tsx` and `ProductCard.tsx`: used only by in-scope pages.
- `src/app/[locale]/not-found.module.css`, `NotFoundBody.tsx`, `error.tsx` and new `LostLinks.tsx`: the locale 404 and error.
- `src/i18n/scopes.generated.ts`: regenerated by `scripts/generate-i18n-scopes.ts`.
