# Craft review, round 2: cross-app polish and motion

Owner key: `craft`. This is a report-and-record pass: no source files were changed. Every row below names the owning area, so area sessions can pick up their own rows.

The bar is "looks and feels amazing in every way" (Shopify-grade). Today the product clears it on the marketing home and the payment flow. It drops below the bar wherever two areas meet: headers, footers, cookie banners, status badges and the motion vocabulary each come in two or three flavours. It also misses at a handful of specificity bugs that make text vanish on hover.

## 1. Scope and method

| | |
|---|---|
| Build | `next build` + `next start` (production), SQLite seed, `ALLOW_MOCK_PAYMENTS=1` for the payment run |
| Pages | 51 routes: marketing 9, platform 2, catalogue 3, designer 5, checkout and orders 9, vendor 8, admin 15 |
| Matrix | ar and en × 390×844 (touch, mobile) and 1440×900 = **204 full-page captures** at 1x DPR |
| States | loading (throttled designer route), empty (applicant `/orders`, admin search `zzzzqqq`, catalogue search), error (unknown route, bad share link, bad checkout design), success (paid order, toast, saved profile) |
| Per page, measured | CLS (layout-shift observer), console errors, horizontal overflow, targets under 24px, H1 scale, button and badge style signatures (height, radius, size, weight, colours), icon sizes and strokes, spinners vs skeletons |
| Hover sweep | Every filled `a` and `button` on 20 key pages hovered; text-on-fill contrast computed after hover |
| Motion | 10 Playwright `recordVideo` clips plus frame strips; motion tokens and keyframes read from source |

**Artefacts**
- Full-page screenshots: `docs/screenshots/final/<area>/<page>-<locale>-<width>.jpg` (204 files, 28.2 MB, JPEG; tall pages recompressed to stay under 30 MB).
- Motion clips: `docs/screenshots/motion/*.webm` (10 clips, 6 MB):

| Clip | What it shows |
|---|---|
| `01-home-hover-press-en-1440` | pill hover and press, card lift, nav menu open and close |
| `02-home-scroll-reveal-en-1440` | reveal on scroll (39 `[data-reveal]` nodes, all revealed once) |
| `03-home-reduced-motion-en-1440` | `prefers-reduced-motion: reduce`: marquee, chips and reveals are static |
| `04-checkout-price-tick-proof-pay-success-en-1440` | quantity change, proof fold (Half, Flat, Closed), cancel dialog open and Escape, card payment, payment success |
| `05-designer-3d-fit-fold-autorotate-en-1440` | skeleton to canvas, dimension change ghost, camera fit, fold, idle autorotate |
| `06-designer-mobile-ar-390` | Arabic mobile designer, tabs, bottom sheet |
| `07-designer-loading-skeleton-ar-390` | designer route on a 200 KB/s, 400 ms link: skeleton for 7 s, then canvas, no spinner |
| `08-admin-table-tabs-en-1440` | IndexTable row hover, tab switch, navigation |
| `09-vendor-job-toast-en-390` | contextual save bar, toast enter, toast removal |
| `10-share-viewer-autorotate-en-390` | share viewer idle |

- Hover-contrast evidence: `docs/screenshots/motion/cta-hover-contrast-bug.png` (header CTA at rest, hover and press).

## 2. Counts

| Area | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| platform (UI kit, chrome, globals) | 0 | 4 | 8 | 3 | 15 |
| marketing | 0 | 2 | 3 | 6 | 11 |
| catalogue | 0 | 1 | 2 | 2 | 5 |
| designer | 0 | 1 | 4 | 2 | 7 |
| 3d-engine | 0 | 2 | 2 | 0 | 4 |
| checkout (incl. orders) | 0 | 2 | 6 | 2 | 10 |
| vendor | 0 | 0 | 4 | 2 | 6 |
| admin | 0 | 1 | 4 | 3 | 8 |
| **Total** | **0** | **13** | **33** | **20** | **66** |

Rows that name several areas are counted under the first one.

No critical (broken-flow) issues: every flow completed end to end, including card payment through to the success page.

## 3. Motion system verdict

| Check | Result | Evidence |
|---|---|---|
| Token-based durations 100 to 300 ms, ease-out enter | **Partial.** Three separate sources: `--p-motion-*` (tokens.css), `--m-*` (motion.css) and `finishes/motion.ts` (JS). There are three different "ease-out" curves, and two hard-coded 480 ms transitions in `PackagingScene.module.css:57,65`. | CR-18 |
| Hover and press states | Present on pills, cards, buttons and chips. Press scale 0.97 at 80 ms. **Broken colour on hover for every link styled as a pill** (CR-01 to CR-03). | clip 01, hover sweep |
| Reveal on scroll, once | Pass: 39 nodes, 480 ms, 70 ms stagger, no re-trigger, no hidden-without-JS state. | clip 02 |
| Skeletons, not spinners | Route loading uses skeletons (designer, checkout, admin, vendor, account). There are three spinner holdouts: designer view switch, price chip, and the Pay button in its busy state. | clip 07, CR-22, CR-24 |
| Toast enter and exit | Enter: 200 ms rise. **No exit**: the node is removed instantly and causes a 0.0067 layout shift. | clip 09, CR-16 |
| Modal enter and exit | Enter: 150 ms fade plus 200 ms rise. **No exit** (`Modal.tsx:120` returns null). | clip 04, CR-17 |
| Price tick | Designer badge ticks (300 ms) but re-keys the whole sentence. **Checkout total has no tick**: the value swaps within 120 ms. | clip 04, CR-19, CR-20 |
| 3D camera fit, fold and autorotate | Fold tween 1.2 to 2.2 s ease-in-out, a dimension "ghost" preview, autorotate after 4 s idle at 6°/s with a 1.2 s ramp: all good. **Camera fit ignores the overlay toolbar at 390 px**, so the model is clipped (CR-13). | clips 05, 06, 10 |
| Payment success moment | Functional but flat: a static saturated banner, no focus move and no transition (CR-23). | clip 04 last frames |
| prefers-reduced-motion (WCAG 2.3.3) | Pass. The global kill switch, marquee, chips, reveals, hero spin, autorotate and fold tweens are all off or instant. The spinner keeps turning at 1.5 s (acceptable as an essential indicator). | clip 03, `globals.css:106` |
| Pause, stop, hide (WCAG 2.2.2) | Pass. Marquee and hero chips have a pause button. Hero 3D spins for 8 s then stops. Autorotate starts only when idle and stops on interaction. | clip 01 |
| CLS < 0.1 | Pass on all 204 loads; worst is `/s/<bad>` at **0.0896** (late footer) and the vendor job page at 0.0546 (CR-44). | inventory |

## 4. Findings

Severity: critical = broken flow, data or security; high = clearly wrong, ugly or inaccessible; medium = noticeable polish; low = nitpick. Status for every row: **open** (report-only session).

| ID | Sev | Area | Page / file | Finding | Standard | Fix |
|---|---|---|---|---|---|---|
| CR-01 | high | platform | `src/styles/globals.css:52`, `marketing.module.css:194-221`, `designer.module.css:58,279` | `a:hover { color: link-hover }` has specificity (0,1,1) and beats `.pill { color: var(--pill-fg) }` at (0,1,0). Every link styled as a pill turns `#004299` on hover: the header CTA becomes **1.51:1** on `#2b2b2b`; designer `topBarLink` 1.21:1; `startCtaLink` 1.86:1. Seen on ar and en, on every marketing page and the design picker. | WCAG 1.4.3 | Lower the global rule: `a:where(:hover) { color: var(--p-color-text-link-hover); }` (0,0,1). Belt and braces: `.pill:hover { color: var(--pill-fg); }`. Re-run the hover sweep. |
| CR-02 | high | marketing | `marketing.module.css:1058-1068` (footer `.social a`) | Footer social icons turn white on their white disc on hover, so the icon disappears. | WCAG 1.4.11 | `.social a, .social a:hover { color: #000; }`. Keep the `translateY(-2px)` lift. |
| CR-03 | high | catalogue | `designer/library.module.css:61-68` | The selected filter chip (`aria-pressed=true`) loses its dark fill on hover: `.chip:hover:not(:disabled)` (0,3,0) beats `.chip[aria-pressed="true"]` (0,2,0), leaving white text on `#f7f7f7` (1.07:1). | WCAG 1.4.3 | `.chip:hover:not(:disabled):not([aria-pressed="true"])`, and add `.chip[aria-pressed="true"]:hover { background: var(--p-color-bg-fill-brand-hover); }`. |
| CR-04 | high | platform | `src/app/not-found.tsx`; any `/ar/<unknown>` or `/en/<unknown>` | Unknown routes under a locale fall through to the global 404. It loads no tokens and no fonts, so it renders Times New Roman with "الصفحة غير موجودة · Page not found" wrapping into itself, no header and no footer. | Brand, WCAG 3.2.3 | Add `src/app/[locale]/[...missing]/page.tsx` that calls `notFound()`, so the styled `[locale]/not-found.tsx` with chrome renders in the right language. In the global file, import `@/styles/tokens.css` and the font variables and render one language chosen from `Accept-Language`. |
| CR-05 | high | platform | MarketingHeader vs `ui/Frame` TopBar vs designer top bar | Buyer-facing pages use three chromes. Marketing has a white 64 px header with pill CTA. `/login`, `/orders`, `/account`, `/vendor/apply` and `/s/*` use the dark admin TopBar with tab nav. `/design` uses the dark designer bar. A buyer crosses from white to black chrome on the first click. | Consistency (ISO 9241-110 conformity with expectations) | Buyer-facing pages (login, account, orders, share, vendor apply, design picker) use MarketingHeader (logged-in variant: avatar menu in place of "Log in"). Keep the dark TopBar only for the vendor and admin apps and the full-screen editor. Checkout keeps a minimal header but in white (logo, "Secure checkout", language), like Shopify checkout. |
| CR-06 | high | platform | `marketing/CookieBar.tsx` vs `store/CookieNotice.tsx` | Two cookie notices. Marketing uses a white full-width bar with a black "OK" pill. Store and app pages use a dark floating card with a cookie icon and a white button. The same user sees both in one session. | Consistency; PDPL 151/2020 notice should read the same everywhere | Keep one component in `src/components/ui` (white surface card, `--p-shadow-400`, max 440 px, bottom start, full width under 490 px, primary dark button). Delete the other. Enter 200 ms rise, exit 150 ms fade. |
| CR-07 | medium | platform | `MarketingFooter` vs `store/SiteFooter` vs checkout footer | Three footers. Marketing is dark with 5 columns and social links. Store is light, and on mobile it stacks into a single long list. Checkout is one row of links (that one is fine). | Consistency | SiteFooter becomes a compact light variant of MarketingFooter (same columns, same type ramp, 2 columns on mobile). |
| CR-08 | high | checkout, vendor, admin | `orders/_components`, `vendor/JobsIndex`, `admin/OrdersIndex`, order detail | The same status gets a different badge tone in each area. **Paid** is yellow (attention) in the buyer list, grey in buyer detail and grey in admin. **Delivered** is green (success) in admin and grey in vendor jobs. | Consistency; WCAG 1.4.1 meaning not by colour alone (labels exist, but colour contradicts) | One `statusTone()` map in `src/lib/order-status.ts`, used everywhere. Polaris convention: payment Paid = neutral with a complete dot; Awaiting payment = attention with an incomplete dot. Fulfilment: Awaiting printer = attention; In production, QC and Shipped = info with a partial dot; Delivered = success with a complete dot; Disputed = critical. |
| CR-09 | high | checkout | `/orders/ELB-26001` Boxes card (ar and en) | The order line thumbnail shows the broken-image glyph for seeded orders. New orders show the render, so the fallback path is the bug. | Polish, trust | When `thumbnailUrl` is missing, use the structure thumbnail (`/models/...`) or the `Thumbnail` placeholder with a `Package` icon on `--p-color-bg-surface-secondary`. Never the broken-image icon. |
| CR-10 | high | marketing | `/boxes/[structure]/[size]` price table at 390 | The last column ("Delivered in") is clipped by the card. Arabic shows "0." instead of "10 أيام". | WCAG 1.4.10 reflow | Wrap the table in `overflow-x:auto` with a start and end fade, or switch to a stacked definition list under 490 px. Make quantity the row header. |
| CR-11 | high | designer | Designer size helper (box and vessel) in ar | Size ranges render reversed: "330–130" for bottle height, and the box "80–600" span is `direction:rtl; unicode-bidi:isolate`, which flips the order. A user reads the max as the min. | WCAG 1.3.2 meaningful sequence | Render ranges as `<bdi dir="ltr">{min}–{max}</bdi>`, or set the range span to `direction: ltr; unicode-bidi: isolate`. The same applies to dimension strings in catalogue cards. |
| CR-12 | high | admin | `/admin/vendors/applications/[id]` "Applicant message"; also vendor bios and dispute notes | Text the user typed in English inside an RTL page shows its punctuation at the wrong end (".We print shipping boxes…"). | WCAG 1.3.2; Unicode bidi | Add `dir="auto"` to every container showing user-generated text (application message, vendor bio, dispute messages, notes, addresses). |
| CR-13 | high | 3d-engine | Designer stage at 390 (mailer ar, pouch en), proof viewer | Camera fit frames the model to the full canvas, but the floating view controls (about 64 px) cover the bottom, so the model is clipped at the base. | Craft, 3D render quality | Pass a `fitInsets={{ bottom: controlsHeight + 16 }}` to the fit routine, or move the controls below the canvas under 490 px. Target: model bounding box inside 80% of the visible area, centred. |
| CR-14 | medium | 3d-engine | `/s/<token>` at 390 and 1440 | The share viewer sits the box low, with about 35% empty headroom. The composition reads unfinished on the first screen a buyer sees. | Craft | Use the same fit routine as the designer, with a vertical target offset of 0 and a 12% margin. |
| CR-15 | high | 3d-engine | Designer first render (mailer `/design/mailer-box`) | A new design opens as a flat, unprinted orange cuboid. Lighting is flat, and there is no flute edge, no lid seam (FEFCO 0427 reads as a solid block) and no contact shadow detail. The marketing tiles (NOUR, Lamsa) promise printed, lit packaging, so this is an expectation gap at the most important moment. | Craft | Start from a sample artwork ("Your logo" placeholder on the lid in `--p-color-text-secondary`). Add a 0.6 mm edge bevel and visible lid seam, a kraft fibre normal map at low strength, contact shadow opacity 0.35, and the same studio HDRI as the marketing renders. |
| CR-16 | medium | platform | `ui/Toast.tsx:87-124`, `Toast.module.css:30` | The toast has no exit: it is removed at 5 s and the region shifts (CLS 0.0067). Also uses `--p-color-bg-inverse` while the token comment says toasts use `--p-color-bg-surface-inverse`. | Motion consistency | Add `data-state="closing"` with `animation: out var(--p-motion-duration-150) var(--p-motion-ease-in) forwards` (`opacity:0; translateY(8px)`), and unmount on `animationend`. Reduced motion: opacity only. |
| CR-17 | medium | platform | `ui/Modal.tsx:120`, `Modal.module.css:58,81` | The modal and backdrop vanish on close (no exit), while enter animates. | Motion consistency | Keep the modal mounted for 150 ms after `open=false`: backdrop fade to 0, dialog `opacity 0; scale(.99)` with `--p-motion-ease-in`. Restore focus after the exit. |
| CR-18 | medium | platform | `tokens.css` motion, `motion.css`, `three/finishes/motion.ts`, `PackagingScene.module.css:57,65` | Three motion token sets, with different curves for "ease-out": `(0.19,0.91,0.38,1)`, `(0.16,1,0.3,1)` and hard-coded `(0.22,1,0.36,1)` at 480 ms. Durations 80, 100, 150, 160, 200, 240, 250, 300, 480 and 1200 ms coexist. | Design-system hygiene | One scale: `--motion-instant 80`, `--motion-fast 150`, `--motion-base 200`, `--motion-slow 300`, `--motion-reveal 480`; `--ease-enter (0.16,1,0.3,1)`, `--ease-exit (0.4,0,1,1)`, `--ease-standard (0.2,0,0,1)`, `--ease-spring` (transform only). Alias `--p-motion-*` and `--m-*` to these, and mirror the values as constants in `motion.ts`. |
| CR-19 | medium | checkout | `checkout/_components/CheckoutClient.tsx` (`data-testid="checkout-total"`, summary total) | Changing quantity swaps the totals instantly (the new value shows within 120 ms with no transition), while the designer badge ticks. It is the same "price changed" moment with two behaviours. | Motion consistency | Reuse `lib.priceTick` (`library.module.css:325`), keyed on the money value, on the summary total and the per-box figure. 300 ms, off under reduced motion. |
| CR-20 | medium | designer | `designer/Modals.tsx:77-79` | The price tick re-keys the whole badge sentence, so the entire label flickers, not just the number. | Motion craft | Key only the `formatMoney` span; keep the label static. |
| CR-21 | medium | designer | `DesignerApp.tsx:889`; `Modals.tsx:75` | A large spinner shows on the stage during view switches, while the route loader uses a skeleton. The price chip uses a spinner, and its accessible name reads "Loading Getting the price". | Skeletons over spinners; WCAG 4.1.2 | Use `.stageSkeleton` for the view switch. On the price chip, replace the spinner with a 64×12 px shimmer bar, set `aria-busy="true"`, and keep only the "Getting the price" text. |
| CR-22 | medium | checkout | `/checkout/pay/[orderId]` Pay button (`PaymentClient.tsx`) | While paying, the primary button turns flat grey and shows only a spinner: the label disappears and the button looks disabled rather than working. | WCAG 4.1.3 status; craft | Keep the brand fill, show a leading 16 px spinner plus "Paying…" / "جار الدفع", and set `aria-busy`. Same pattern as `Button loading` in Polaris. |
| CR-23 | medium | checkout | `/orders/[id]?paid=1` | The payment success moment is a large saturated green banner. Focus stays at the top of the document and nothing marks the transition. The stepper already shows "In production" one second after payment. | Craft; WCAG 2.4.3 focus order | Use a success header card: a 32 px check icon drawn with `stroke-dashoffset` over 300 ms `--ease-enter`, title "Payment received", the three next steps as a list. Move focus to its heading. Use the `--p-color-bg-surface-success` tint, not the fill. Reduced motion: static check. |
| CR-24 | medium | designer | Designer stage view switch | Duplicate of the CR-21 pattern for the 3D, Face and Dieline toggle: spinner flash on each switch. | Skeletons | Keep the previous view rendered until the next one is ready (cross-fade 150 ms). |
| CR-25 | medium | admin, vendor | `/admin/orders` and `/vendor` KPI strip at 390 | The KPI cards are clipped mid-word ("مراجعة الج", "تسليم خلا") with no scroll affordance. | WCAG 1.4.10 | Two-column grid under 490 px, or `scroll-snap-type: x mandatory` with an end fade and peeking card. |
| CR-26 | medium | admin | `ui/Frame` side nav (admin home 1440) | The nav background stops at the first viewport height (about 900 px), while content runs to 1110 px. A grey column ends mid-page. | Craft | Nav `position: sticky; inset-block-start: var(--p-top-bar-height); block-size: calc(100dvh - var(--p-top-bar-height))`. Paint the background on the column, not the list. |
| CR-27 | medium | 3d-engine | Vendor job dieline (`/ar/vendor/jobs/ELB-26001`) | Panel labels inside the dieline are English ("Inner front wall", "Lid", "Ear") on the Arabic page, and too small to read (about 7 px). | Localization; WCAG 1.4.4 | Pass localized `panelLabels` as the designer does, set a minimum label size of 10 px at fit, and hide labels on panels under 40 px. |
| CR-28 | medium | vendor | Vendor top bar user menu (ar) | The org name is truncated at the start ("...inting & Packaging staff") because the Latin name is laid out RTL. | Unicode bidi | `dir="auto"` on the name, truncate with `text-overflow: ellipsis` at the end, and show a short org name ("Nile Pack"). |
| CR-29 | medium | marketing | Home "Everything you need" section | en centres the heading; ar start-aligns it. The same section has two layouts. | Consistency | Pick one alignment (centred) and apply it to both locales; drop the `:lang(ar)` override. |
| CR-30 | medium | catalogue | `/design` model library | All 370 models render in one list: 13,063 px at 1440 and about 18,000 px on `/catalog`. The filter chips scroll away. | Craft, performance | Show 12 per family with "Show all 128", or virtualize. Make search and chips sticky under the top bar. |
| CR-31 | medium | catalogue | `/catalog`, `/boxes` product cards | Card action rows don't line up across a row when description lengths differ (buttons at 1479 px vs 1497 px). | Rhythm | Card as `display:flex; flex-direction:column`, actions `margin-block-start:auto`; clamp the description to 2 lines. |
| CR-32 | low | catalogue | `/ar/catalog` pizza card | The eyebrow reads "PIZZA" in Latin caps on Arabic, where siblings show FEFCO codes. | Localization | Use the FEFCO code (0426) or `-` for non-FEFCO. |
| CR-33 | low | catalogue | `/design` model card "مبسط" / "Simplified" tag | 11 px grey text in the corner, not a Badge. | Component consistency | `<Badge size="small">`. |
| CR-34 | medium | checkout | `/orders/[id]` Timeline | The timeline sits outside the card system, and its times use 24 h "04:37" while the header uses "4:37 AM". | Consistency | Wrap it in a Card titled "Activity". Use one time format from `formatDateTime` (en `4:37 AM`, ar `4:37 ص`). |
| CR-35 | medium | checkout, admin | Order lists and tables | Money precision is inconsistent within one column ("14,913" vs "6,976.80"), so the digits don't line up. | Polaris DataTable numeric | In tables, always two decimals or always none (recommend none above EGP 1,000 in lists, two in invoices). `font-variant-numeric: tabular-nums`. |
| CR-36 | medium | admin | `ui/IndexTable` numeric columns | Money and count columns are start-aligned. | Polaris numeric columns align to end | `columnContentTypes="numeric"` gives `text-align:end` plus tabular numbers. |
| CR-37 | medium | platform | `ui/Button.module.css` | Button heights sprawl across the apps: 24, 28, 32, 36, 40 and 44 px (36 px appears in vendor and admin only). | Design-system hygiene | Three sizes: slim 28, medium 32 (40 on `pointer:coarse`), large 44. Map 36 to medium. |
| CR-38 | medium | platform | 67 direct `lucide-react` imports (`admin/*Index.tsx`, `HeaderNav.tsx`, `AuthGateDialog.tsx`…) | Icons drawn directly with lucide use stroke 2, while `<Icon>` uses 1.75. Sizes 14, 15, 16, 18, 20, 24 and 28 are all used. | Icon consistency | Route every icon through `<Icon>`, or wrap lucide with the 1.75 stroke default. Allowed sizes: 16 and 20 in the apps, 24 in marketing features. |
| CR-39 | low | marketing | `.site:lang(ar)` display type | The Arabic H1 is 64/80 (1.25), tight for the Plex Arabic ascenders on two-line heads. | Arabic typography | Use `--mk-lh-display: 1.3` under `:lang(ar)`, and 1.35 for H2. |
| CR-40 | medium | vendor | `/vendor/profile` bio textareas (`ui/Form.module.css` counter) | The character counter "141/1200" overlaps the last line of text. | WCAG 1.4.8 / legibility | Move the counter below the field (end-aligned help row), or add `padding-block-end: 24px` to counted textareas. |
| CR-41 | low | vendor | Vendor home onboarding checklist | Completed items use `line-through`. Arabic strikethrough cuts through the letter joins and is hard to read. | Legibility | Check icon plus `--p-color-text-secondary`; no strikethrough. |
| CR-42 | medium | vendor | Public vendor profile portfolio (`/vendors/nile-pack`) | Portfolio tiles are abstract geometric placeholder SVGs (cube, dot), not product images. It reads unfinished next to the rendered home tiles. | Craft | Render seed portfolio items from the 3D pipeline (same as the home "Sample designs" strip), or show a styled empty state. |
| CR-43 | medium | marketing | `/legal/privacy` | A visible placeholder "[اسم الكيان القانوني، سجل تجاري رقم ___]" with a "draft for legal review" banner. | PDPL 151/2020: controller identity must be stated | Fill in the legal entity, CR number and DPO contact before launch; keep the banner until then. |
| CR-44 | medium | platform, vendor | `/s/<bad-token>` (CLS 0.0896), `/vendor/jobs/[n]` (0.0546) | The footer streams in late and pushes the page; on the job page a QC card inserts above existing cards. | CLS budget 0.1 (close to the limit) | Give `main` `min-block-size: calc(100dvh - header)` so the footer starts below the fold; reserve the QC card slot with a skeleton. |
| CR-45 | low | marketing | Home on load | CLS 0.0063: the marquee (0.0055) and header actions (0.0008, auth state) shift. | CLS | Set `block-size` on the marquee row, and `min-inline-size` on header actions. |
| CR-46 | low | platform | `ui/Spinner.module.css:10` | The spinner overrides the reduced-motion kill switch with `!important` (continues at 1.5 s). | WCAG 2.3.3 | Acceptable as an essential indicator; document the exception in `motion.css`. |
| CR-47 | low | designer | ar designer panel select | "الوجه الأمام" should read "الوجه الأمامي". The bottle select shows "الوجه ملصق دائري كامل" because label and value are concatenated. | Arabic MSA grammar | Visible label "الوجه" outside the select, value only inside. Fix the adjective agreement. |
| CR-48 | low | checkout | Checkout step header back button | Accessible name "Back: Back" (label concatenated twice). | WCAG 2.5.3, 4.1.2 | Single `accessibilityLabel`. |
| CR-49 | low | platform | Detail pages: rate card, admin user, vendor, dispute | Detail pages reuse the list `<title>` ("Rate cards · Vendor portal · Elba"). | WCAG 2.4.2 | Prefix the entity name: "E-flute mailer · Rate cards · …". |
| CR-50 | low | admin | IndexTable at 390 | Row links are 20 px tall; the clear-search button is 20×24. | WCAG 2.5.8 (24 px) | Row link `padding-block: 2px` (or a whole-row hit area); clear button 24×24 minimum. |
| CR-51 | low | checkout | Vendor offer card price | "EGP 42.46 per box (excl. / VAT)" breaks inside the parenthesis. | Typography | `white-space: nowrap` on "(excl. VAT)", or put it on its own line by design. |
| CR-52 | medium | vendor | `/vendor/jobs/[n]` | "Send for QC" appears twice (header and footer), both disabled with no reason given. | Clarity | One primary, at the bottom of the QC card. When disabled, show help text: "Add at least one photo of the first sheet". |
| CR-53 | low | marketing | `/catalog` hero (1440) | About 150 px of dead space between the CTA row and the shelf illustration. | Rhythm | Gap 48 px (`--p-space-1200`). |
| CR-54 | low | marketing | `/catalog` family header | The "عدد الأنواع: 5" count sits detached at the far end of the header row. | Hierarchy | Put it under the family title as a caption, or drop it. |
| CR-55 | low | marketing | Top nav | "Pricing / الأسعار" shows as active on `/catalog` (the box catalogue). The label doesn't match the page. | IA | Rename the item "Box styles", or point Pricing at a pricing section. |
| CR-56 | low | admin | `/admin/pricing` | A clear (×) button inside every numeric factor input: 20+ icons of noise. | Clarity | Remove `clearButton` from numeric fields. |
| CR-57 | low | admin | Admin top bar (ar) | The seeded admin name "Elba Ops Admin" is English on the Arabic shell. | Localization (seed) | Seed `name: "فريق تشغيل علبة"` for the ar admin, or show the role label. |
| CR-58 | low | designer | Pouch, en 390 | The panel select mixes sizes: "Panel" small grey prefix inline with a 16 px value. | Type scale | Label above the select, consistent with the other fields. |
| CR-59 | medium | checkout | Seeded order `ELB-26001` | The line shows "500 × EGP 24.70 = 12,350", while Payment says "Printed boxes EGP 12,950". New orders reconcile, so the seed is wrong. | Trust (ETA e-invoice lines must reconcile) | Fix the seed's per-box price, or add the setup line, so the line items add up. |
| CR-60 | medium | platform | `src/app/[locale]/orders`, `(store)/catalog`, `boxes`, `vendors` | No `loading.tsx` on orders, catalogue, boxes or vendors, so navigation shows nothing until the server responds. | Skeletons | Add list skeletons (`ui/Skeleton`) for these segments, matching the card grid and the table. |
| CR-61 | medium | marketing | `/vendor/apply`, `/login` (logged out) | Public acquisition pages sit in the dark app chrome with a light stacked footer. They look like the back office, not the brand. | Consistency | Covered by CR-05; listed so marketing owns the page shells. |
| CR-62 | low | marketing | Box size H1 (ar) | "25×18×8 سم" (cm, no spaces) in the title, while the body uses "250 × 180 × 80 مم". | Consistency | Use one unit (mm) and thin spaces around ×. |
| CR-63 | medium | designer | Designer and share at 1440 vs marketing | Designer chrome buttons (secondary, 32 px, radius 8) sit beside a pill price chip (radius full, 40 px) in the same toolbar row. | Component consistency | Price chip uses the Button `pill` variant at 32 px, or the toolbar buttons move to the same size scale. |
| CR-64 | low | vendor | Vendor portal sidebar footer links | "View public page" and "Back to store" use the same icon weight and size as primary nav, with no separator. | Hierarchy | Add a divider and use `--p-color-text-secondary`. |
| CR-65 | medium | admin | Admin application decision bar | Approve (disabled primary), Reject (critical plain) and Start review have unclear order and no disabled reason. | Clarity | Primary on the end, "Start review" first; help text "Complete the 7 checklist items to approve". |
| CR-66 | low | platform | Global focus ring | Pills use the browser outline offset 1 px on a dark fill, which is barely visible on `#0b0b0b`. | WCAG 2.4.7, 2.4.11 | Pills: `outline: 2px solid var(--p-color-border-focus); outline-offset: 2px`. |

### What already clears the bar (keep)
- Marketing home: type ramp (88/52 px display, pill CTAs, banded white / `#f5f5f3` / dark), product renders, reveal choreography, and correct reduced-motion and pause handling.
- Checkout: 4-step stepper, sticky mobile summary bar, VAT 14% shown separately, offer comparison with "Best match / Fastest / Lowest price" badges, and test-mode banner copy.
- Designer: route skeleton, fold tween, dimension ghost, idle autorotate with a ramp, and keyboard-operable view controls.
- Arabic: noun-form labels across admin and vendor ("نظرة عامة", "طلبات البيانات"), no diacritics, and correct RTL mirroring of steppers, funnels and arrows.

## 5. Top 25 fixes (do these first)

| # | ID | Area | Fix |
|---|---|---|---|
| 1 | CR-01 | platform | `a:where(:hover)` in `globals.css:52`, so link pills keep their colour on hover (1.51:1 today) |
| 2 | CR-04 | platform | `[locale]/[...missing]/page.tsx` calls `notFound()`; tokens and fonts in the global 404 |
| 3 | CR-05 | platform | One buyer-facing chrome (MarketingHeader) for login, account, orders, share, apply and the design picker |
| 4 | CR-08 | checkout, vendor, admin | One `statusTone()` map; Paid and Delivered get the same badge everywhere |
| 5 | CR-06 | platform | One cookie notice component |
| 6 | CR-11 | designer | `<bdi dir="ltr">` around size ranges (Arabic shows max–min) |
| 7 | CR-13 | 3d-engine | Camera fit insets for the overlay toolbar at 390 px |
| 8 | CR-15 | 3d-engine | First render: sample artwork, lid seam, bevel, studio lighting |
| 9 | CR-02 | marketing | Footer social icon colour on hover |
| 10 | CR-03 | catalogue | Selected chip hover keeps its fill |
| 11 | CR-10 | marketing | Price table reflow at 390 |
| 12 | CR-12 | admin | `dir="auto"` on all user-generated text |
| 13 | CR-09 | checkout | Thumbnail fallback instead of the broken-image glyph |
| 14 | CR-18 | platform | One motion token scale (alias `--p-motion-*`, `--m-*`, `motion.ts`) |
| 15 | CR-16 | platform | Toast exit animation (150 ms) and no shift on removal |
| 16 | CR-17 | platform | Modal exit animation (150 ms) |
| 17 | CR-19 | checkout | Price tick on checkout totals (reuse `priceTick`) |
| 18 | CR-23 | checkout | Payment success header: check-draw, focus on heading, tint not fill |
| 19 | CR-22 | checkout | Pay button busy state keeps its label and brand fill |
| 20 | CR-21 | designer | Skeleton, not spinner, for the view switch and price chip |
| 21 | CR-07 | platform | One footer family (compact light variant) |
| 22 | CR-44 | platform, vendor | `main` min-height; reserve the QC card slot (CLS 0.09 and 0.05) |
| 23 | CR-25 | admin, vendor | KPI strip as a 2-column grid on phones |
| 24 | CR-38 | platform | Icons through `<Icon>`: stroke 1.75, sizes 16 and 20 |
| 25 | CR-37 | platform | Three button sizes (28, 32/40, 44) |

## 6. Notes for the integrator
- No source files were changed. The only writes are `docs/audit/craft.md`, `docs/screenshots/final/**` and `docs/screenshots/motion/**`.
- The payment run needs `ALLOW_MOCK_PAYMENTS=1` under `next start` (see `src/lib/payments/config.ts:41`). Without it, the pay page shows "This payment method is not available right now". That is correct behaviour in production, so it is not a finding.
- The capture scripts live outside the repo, in this session's scratchpad. To re-run: full-page capture through `page.screenshot({ fullPage: true })` **without** the SwiftShader GL flags for non-3D pages. With `--use-angle=swiftshader`, Chromium repeats the top of the page beyond about 8,000 px in stitched captures, so 3D pages are captured separately with GL on.
