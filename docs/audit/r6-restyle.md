# R6 restyle: every other public page in the shopify.com (2026) language

Scope: `/boxes`, `/boxes/[structure]`, `/boxes/[structure]/[size]`, `/catalog`, `/catalog/[slug]`, `/bottles`, `/vendors`, `/vendors/[slug]`, `/legal/*`, the not-found and error pages, `/login` and the share page `/s/[id]`. Home, `/start`, `/why-elba`, `/pricing` and `/designer` belong to other sessions. Tokens, fonts, header, footer and the motion kit come from the foundation branch (`r6-foundation`), and renders come from the assets branch (`r6-assets`).

## 1. Reference capture (shopify.com/sa, 6 Nov 2026, Playwright, 1440x900 and 390x844, ar-SA)

Captured pages: `/sa/online`, `/sa/pos`, `/sa/checkout`, `/sa/payments`, `/sa/shipping`, `/sa/pricing`, `/sa/legal/terms`, `/sa/legal/privacy`, and an unknown `/sa/...` URL for the 404. The screens are not in git (they are Shopify's material). The measured values below are the ones this restyle copies.

| Element | 1440 | 390 | Notes |
|---|---|---|---|
| Product hero (checkout, payments, pricing) | dark `rgb(2,9,10)` or black; eyebrow 16px/550, uppercase Latin; h1 64px/330, -0.02em (payments, pricing, legal); headline 96px/300 on online and shipping | h1 36 to 56px | Copy at the start, media at the end; violet or navy radial glow behind the media |
| Section sheet | white or `#f2f2f0` sheet, **48px** top radius, overlaps the dark band | **20px** radius | Sheets alternate dark, white, black, navy `rgb(1,7,44)` and violet `rgb(77,33,255)` |
| Section padding | 128px top (80px on sheets that open a page) | 64 to 80px | |
| h2 | 56 to 64px / 330, line-height 1.08, tracking -0.01 to -0.02em | 36 to 44px | |
| h3 / card title | 28px / 360 (statement), 18 to 20px / 450 to 550 (card) | 18 to 22px | |
| Body | 18px / 400, lh 1.4; muted `rgba(0,0,0,.6)` on light, `rgb(187,199,216)` / `rgb(212,212,216)` on dark; fine print 14px / 420 | 16px | |
| Primary pill | 56px tall, radius 9999, padding 12px 24px, 18px / 550; white on dark, black on light | 44px, 16px, 8px 20px | |
| Secondary pill | same size, transparent, 2px solid currentColour | same | |
| Feature cards (shipping) | `#f2f2f0` card on white, radius about 24px, UI mockup above a 20px centred caption | stacked | 2-up bento |
| Stats row (checkout) | 3 cells in a hairline box, 28px / 360 number above 14px muted label | 3 across, 18px | |
| Legal | dark hero band 325 to 482px (eyebrow "Updated …", 64px h1, muted subline), then a white body: sticky table of contents at the start column (16px / 550 heading, 14px links, a 1px rule with a 2px active indicator), article column about 720px, h2 34px / 330, body 18px / 1.4 | TOC collapses above the article | |
| 404 | full-viewport dark page with a teal-to-navy radial gradient; start column: "404" 44px / 330 above a 64px h2 and a 20px lead with an underlined help link; end column: 3 big links (32px) separated by 1px rules, each with a 44px round outline arrow button | stacked | |
| Motion | reveal 0.3s `cubic-bezier(0.4,0,0.2,1)` opacity plus translateY; hovers 0.2s; media 0.45s `cubic-bezier(0.5,0,0.5,1)` | same | |

## 2. Page table

Status key: planned, in progress, done (restyled, checked), blocked.

| Route | Shopify model | New structure (Elba content, our renders, no fabricated proof) | Behaviour to keep | Status | Phone LCP / CLS (ar) |
|---|---|---|---|---|---|
| `/boxes` | `/sa/online` hero + `/sa/shipping` bento | dark hero (eyebrow, 64px h1, lead, two pills, render row on a glow); white 48px sheet with each family as a section head plus a card rail; light grey band linking to the full library; dark closing CTA | preloaded AVIF LCP render, rails, family anchors, ISR prices | planned | |
| `/boxes/[structure]` | `/sa/checkout` hero | dark product hero (breadcrumb, eyebrow, h1, lead, fact chips, pills; render on a glow card); white sheet holding the price table, specs, sizes and materials cards, sticky aside | Product + Breadcrumb JSON-LD, `#prices` anchor, notFound in the segment layout above Suspense | planned | |
| `/boxes/[structure]/[size]` | same as structure | same component (`StructureDetail`), with the current size chip and an extra breadcrumb level | SEO title/h1 forms, canonical, size chips | planned | |
| `/catalog` | `/sa/pricing` hero + app grid | dark hero with the four real counts as a stats row (hairline cells); white sheet with the sticky filter bar and the model grid on `#f2f2f0` tiles | filters, sticky filters, 370+ cards, fast render, Breadcrumb JSON-LD, inline CSS bytes not up | planned | |
| `/catalog/[slug]` | `/sa/checkout` hero split | white page with a sticky 3D stage card and a facts column; price-path card in the dark tone; related models on a grey sheet | quote form, order-mode copy, permanent redirect of old slugs, notFound | planned | |
| `/bottles` | `/sa/online` | same as `/boxes` | showcase CLS fix | planned | |
| `/vendors` | `/sa/shipping` | dark hero; white sheet with the filter form and vendor cards | filters (GET form), counts | planned | |
| `/vendors/[slug]` | `/sa/checkout` | dark profile hero (name, city, real capabilities, real lead time); white sheet with portfolio, structures and contact | Organization JSON-LD, notFound above Suspense | planned | |
| `/legal/*` | `/sa/legal/privacy` | dark hero band (eyebrow with the update date, 64px h1, draft-for-review note); white body with sticky TOC and active-section rule, 720px article | draft banner (role note), TOC anchors, other-docs nav | planned | |
| 404 (store, detail, catch-all, locale) | `/sa/404` | dark full-height page, glow gradient, "404" plus h2 and lead at the start, three large links with round arrow buttons at the end (home, catalogue, design) | real 404 status, document title effect, small not-found sheet for non-store areas (R4-09) | planned | |
| error boundaries | same as 404 | same layout, retry pill | `role="alert"`, reset() | planned | |
| `/login` | `/sa/pricing` hero, centred | dark sheet, centred card on white | OTP flow, consent, redirects | planned | |
| `/s/[id]` | `/sa/checkout` | dark hero with the 3D preview card; specs and order CTA on a white sheet; not-found state in the 404 language | lazy viewer, noindex, price quote, rate limit | planned | |

## 3. Baseline measurements (before, `next start`, base f5e1c33)

Inline CSS per page, from `node docs/audit/tools/inline-css-bytes.mjs http://localhost:3100 <paths>`:

| Page | HTML KB (gz) | inline CSS KB (gz) | CSS also in RSC payload |
|---|---|---|---|
| `/ar/catalog` | 777.8 (131.7) | 136.5 (26.3) | 100% |
| `/ar/boxes` | 453.5 (92.7) | 110.7 (21.7) | 100% |
| `/ar/boxes/mailer-box` | 452.2 | 127.9 | 100% |
| `/ar/bottles`, `/ar/vendors`, `/ar/legal/privacy` | 387 to 451 | 110.7 | 100% |
| `/ar/login` | 424.0 | 136.5 | 100% |

Before screenshots: `docs/screenshots/audit/r6-restyle/before/`.
