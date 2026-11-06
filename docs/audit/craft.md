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

---

# Round 4: fresh cross-app craft review

Owner key: `craft`. This pass only reports and records: no source files changed. The writes are this section, `docs/screenshots/final/**` (replaced) and `docs/screenshots/motion/**` (replaced). The base is `781d663` (rounds 1 to 3 merged). The bar is still "looks and feels amazing in every way" (Shopify-grade).

**Verdict.** Round 3 closed almost every round 2 gap. There is now one buyer chrome, one cookie notice and one status-tone map. Hover contrast holds, the 404 is styled, and the success moment, modal and toast exits, and price ticks all work. The design system now reads as one product. What still keeps the product below the bar:
- **3D first impression and lighting:** the poster and canvas show a double image on load, dark prints go black on the side faces, and the model is small on phones.
- **Arabic and mobile edges of the back office:** the audit table is unreadable at 390, and the invoice address is reversed.
- **A few truth-in-UI mismatches:** the stepper after payment, the model counts and the minimum quantity.

## R4.1 Scope and method

| | |
|---|---|
| Build | `next build` + `next start -p 3100`, SQLite seed, `OTP_DEV_ECHO=1`, `ALLOW_MOCK_PAYMENTS=1` |
| Pages | 57 page states: marketing 10, catalogue 4, designer 5, platform 2, checkout and orders 10, vendor 9, admin 17 |
| Matrix | ar and en × 390×844 (mobile, touch) and 1440×900 = **228 full-page captures**, 1x DPR, JPEG |
| States | empty (applicant orders, catalogue search `zzzzqqq`, quotes, moderation after review), error (unknown route, bad share link, bad checkout design, another vendor's job), success (paid order, toasts), live data (a real order ELB-26302 placed through the UI) |
| Per page, measured | CLS with shift sources, console errors, horizontal overflow, targets under 24 px, H1 count and scale, broken images, spinners, `<title>` |
| Targeted probes | hover colours, cookie notice per surface, badge tones per area, `dir=auto`, bidi of ranges, button heights, rendered lucide stroke widths, focus ring, the 3D stage poster to canvas sequence frame by frame |
| Capture rule | non-3D pages without SwiftShader GL flags (tall stitched captures repeat with GL on); designer and share with GL. Lazy images are forced eager and decoded before capture. |

Automated sweep result: **0** horizontal overflow, **0** broken images, exactly **1** H1 on every page, no console errors except the expected 404 response. All small-target hits are visually hidden inputs behind full-size labels or full-width 20 px block links, so none is an issue. CLS is ≤ 0.002 everywhere except `/ar/catalog` (R4-CR-05).

## R4.2 Media

- `docs/screenshots/final/<area>/<page>-<locale>-<width>.jpg`: 228 files, **25 MB**.
- `docs/screenshots/motion/` (11 clips, **11 MB**, VP9):

| Clip | Shows | Result |
|---|---|---|
| `01-home-hover-press-en-1440` | pill hover and press, Products menu, card lift, printer card hover, FAQ open | Pass. Header CTA keeps white on `#2b2b2b` on hover. |
| `02-home-scroll-reveal-en-1440` | reveal on scroll | Pass. 39 `[data-reveal]` nodes; 0 left hidden after a full scroll; reveals once. |
| `03-home-scroll-reveal-ar-390` | Arabic mobile menu and reveal | Pass. |
| `04-home-reduced-motion-en-1440` | `prefers-reduced-motion: reduce` | Pass. 0 running animations after load. |
| `05-designer-model-fold-finish-export-en-1440` | first load, finishes (gold foil, matte varnish, window), fold Half / Flat / Closed, model switch to Pizza box via picker search, PNG export (downloads `elba-pizza-box-1080.png`) | Works end to end. The price moves 40.06 → 48.36 per box with a tick. **First load ghosts** (R4-CR-01). |
| `06-checkout-price-tick-to-payment-success-en-1440` | quantity 250 / 1,000 / 500 with total tick, printer switch, address, company invoice, 3D and flat proof, approve, card pay, success | Works. Focus lands on the "Payment received" heading. **The stepper is ahead of the status** (R4-CR-04). |
| `07-vendor-job-accept-toast-en-390` | accept a job (bottom-sheet dialog), "Job accepted" toast, start production, "Production started" toast | Pass. The toast enters and exits. |
| `08-vendor-profile-savebar-toast-en-1440` | contextual save bar, save, "Changes saved" toast | Pass. |
| `09-admin-moderation-en-1440` | approve a photo, reject one with a reason, toast, empty state | Pass. "Photo rejected. The vendor sees your note." |
| `10-designer-reduced-motion-ar-390` | fold under reduced motion, 7 s idle | Pass. The fold snaps, no autorotate, 0 running animations. |
| `11-designer-mobile-tabs-sheet-ar-390` | Arabic mobile designer, panel tabs, sheet | Works. **The model is small** (R4-CR-11). |

- Evidence stills: `evidence-designer-first-load-ghosting.jpg` (10 frames at 4 fps, 2.8 to 5.2 s after navigation), `evidence-share-dark-side-faces.jpg`, `evidence-admin-audit-ar-390.jpg`.
- Test data I created and then removed: three portfolio items for the moderation clip (deleted), and one Nile Pack English and Arabic bio edit (reverted). Kept: order ELB-26302 (paid through the UI) and the accepted / in-production state of ELB-26202.

## R4.3 Re-verification of round 2 rows (CR-*)

| ID | Status | Evidence (round 4) |
|---|---|---|
| CR-01 | fixed | `a:where(:hover)` (`globals.css:54`). Header CTA hover: `#fff` on `#2b2b2b`. Picker CTA: `#fff` on `#1a1a1a`. |
| CR-02 | fixed | Footer social on hover: `#000` icon on a `#fff` disc. |
| CR-03 | fixed | Selected chip on hover: `#fff` on `#0b0b0b`. |
| CR-04 | fixed | `/ar|en/<unknown>` renders the styled 404 with header and footer in the right language. |
| CR-05 | fixed | Login, account, orders, order, invoice, share, vendor apply and the design picker use MarketingHeader with an avatar menu. Checkout uses the white minimal header. Dark chrome is kept only for vendor, admin and the editor. |
| CR-06 | fixed | One `CookieNotice` (white card, dark button) on `/`, `/catalog`, `/login`, `/design` and `/vendors/*`. |
| CR-07 | fixed | One dark footer family on buyer pages; checkout keeps its one-row footer. |
| CR-08 | fixed | Paid is neutral (`#e3e3e3`) in buyer detail and admin. Awaiting printer / vendor is attention. In production is info. Delivered is success. Same map everywhere. |
| CR-09 | fixed | ELB-26001 line shows `/models/mailer-box.svg`, never the broken glyph. |
| CR-10 | fixed | The size price table stacks into a definition list at 390 (ar and en). |
| CR-11 | fixed | Ranges render as `<bdi dir=ltr>` "80–600" in Arabic. |
| CR-12 | fixed (on the reported surfaces) | Three `dir=auto` nodes on the application page; the message reads correctly. **Invoice address missed** (R4-CR-02). |
| CR-13 | fixed | View controls sit below the canvas at 390; nothing covers the model. Framing is still small (R4-CR-11). |
| CR-14 | fixed | Share viewer is centred at 1440 and 390. |
| CR-15 | fixed | Kraft fibre, "Your logo" / "شعارك هنا" hint on the lid, contact shadow. Lid seam visible but faint. |
| CR-16 | fixed | Toast `closing` state with a 150 ms exit plus a fallback; clips 07 to 09. |
| CR-17 | fixed | Modal exit seen in clips 05 and 07 (accept dialog, picker). |
| CR-18 | fixed (remnant, low) | Curves live only in `tokens.css` and `motion.ts`. Two hard-coded `150ms ease-out` remain at `designer/library.module.css:425,436`. Swap to `var(--motion-fast) var(--ease-enter)`. |
| CR-19 | fixed | `CheckoutClient.tsx:961-968` keyed tick on totals (clip 06). |
| CR-20 | fixed | `Modals.tsx:102` keys only the amount span. |
| CR-21 / CR-24 | fixed | A MutationObserver saw no spinner during 3D → Face → Dieline switches or a price refresh. |
| CR-22 | fixed | The Pay button keeps its fill and label while busy (clip 06). |
| CR-23 | fixed | Success card on a tint, check icon, "What happens next" list, focus on the heading. |
| CR-25 | fixed | Admin and vendor KPIs at 390 are a 2-column grid; no clipped labels. |
| CR-26 | fixed | The nav column holds its background to the page end. |
| CR-27 | partly fixed (low) | Dieline labels are now Arabic ("الأمام", "جدار داخلي"). They are still about 8 px at fit on the job page. Set a 10 px minimum and hide labels on panels under 40 px. |
| CR-28 | fixed | Org name truncates at the end. |
| CR-29 | fixed | "Everything you need" is centred in both locales at 1440. |
| CR-30 | **reopened (medium), round 4** | `/design` is fixed (5,583 px at 1440). **`/catalog` grew to 46,528 px at 1440 and 64,334 px at 390** (all 394 models in one list). Apply the same "12 per family + Show all N" pattern there, keep search and chips sticky, and add `content-visibility: auto` on family sections. |
| CR-31 | fixed | `/boxes` and `/catalog` card actions align on a row. |
| CR-32 | fixed | Pizza shows "FEFCO 0426". |
| CR-33 | not reproduced | No "Simplified" tag on the seeded models. |
| CR-34 | fixed | "Activity" card; times "9:35 AM" / "9:35 ص". |
| CR-35 | **reopened (medium), round 4** | Buyer and admin lists are consistent (always two decimals). It is still mixed in: the checkout summary ("EGP 16,520" above "EGP 1,062.50"), the vendor jobs list ("EGP 15,500" vs "EGP 16,572.02") and the public size price list ("9,733" vs "15,007.50"). One `formatMoney(…, { fraction: "always" })` for every column of amounts, with `tabular-nums`. |
| CR-36 | fixed | Money cells `text-align:end` plus `tabular-nums`. |
| CR-37 | fixed in apps | App buttons are 28 / 32 / 40 / 44 only. Marketing pills: see R4-CR-20. |
| CR-38 | **partly reopened (low), round 4** | App body icons are 1.75. The marketing chrome now also wraps buyer pages, and its icons still render `stroke-width=2`: nav chevrons, globe, menu, close, footer globe, the checkout lock and globe, the picker product icons and the vendor checklist circles. So orders, account and checkout mix 2 and 1.75 on one screen. Pass `strokeWidth={1.75}` in `MarketingHeader`, `MarketingFooter`, `CheckoutShell` and the designer `productIcon`. |
| CR-39 | fixed | ar H1 76/98.8 px (1.3). |
| CR-40 | fixed | The counter sits below the field (2 px clear). |
| CR-41 | fixed | The checklist uses check icons, no strikethrough. |
| CR-42 | fixed | Portfolio shows `/marketing/samples/sample-0N.webp` renders. |
| CR-43 | **open** (business facts) | Privacy placeholder and draft banner unchanged. See also R4-CR-12 (invoice). |
| CR-44 | fixed | `/s/<bad>` CLS 0.0000; vendor job CLS 0.0000. |
| CR-45 | fixed | Home CLS 0 to 0.0001. |
| CR-46 | accepted | Spinner kept as an essential indicator (500 ms). |
| CR-47 / CR-58 | fixed | "الوجه" label outside the select; values only inside. Alignment nit: R4-CR-19. |
| CR-48 | fixed | One name: "Back: Bloom mailer". |
| CR-49 | fixed | e.g. "Mailer box, E-flute kraft · Rate cards · Vendor portal · Elba", "ELB-26001 · Orders · Admin · Elba". |
| CR-50 | fixed | No admin table targets under 24 px at 390. |
| CR-51 | fixed | "(excl. VAT)" / "(دون الضريبة)" on its own line by design. |
| CR-52 | fixed | One "Submit for quality check" with help text. |
| CR-53 / CR-54 | partly fixed (low) | `/catalog` is fixed. `/boxes` family header still puts "Styles: 5" / "عدد الأنواع: 5" at the far end of the row at 1440. Move it under the family title as a caption. |
| CR-55 | fixed | Nav item renamed "Box styles"; active on `/catalog`. |
| CR-56 | fixed | 0 clear buttons on `/admin/pricing`. |
| CR-57 | partly fixed (low) | The seed admin is now "فريق تشغيل علبة" in **both** locales, so the English shell shows Arabic. Show the localized role label ("Elba operations" / "فريق تشغيل علبة"), or seed `nameEn`. |
| CR-59 | fixed | ELB-26001: 500 × 24.70 = 12,350 = "Printed boxes EGP 12,350". |
| CR-60 | fixed | `loading.tsx` on orders, catalogue, boxes, vendors, account, checkout, share, editor, vendor and admin. |
| CR-61 | fixed | Covered by CR-05. |
| CR-62 | fixed | "علبة بريدية مطبوعة 250 × 180 × 80 مم" (isolated). |
| CR-63 | fixed | The price chip has its own row above the stage. |
| CR-64 | fixed | Portal sidebar footer links are separated and secondary. |
| CR-65 | fixed | "Start review" first, Approve last, with the disabled reason shown. |
| CR-66 | fixed | Pill focus: 2 px solid `#005bd3`, offset 2 px. |

Tally: 55 fixed, 1 accepted, 1 not reproduced, 1 open (CR-43). **2 reopened** (CR-30, CR-35) and **5 partly fixed with a low remnant** (CR-18, CR-27, CR-38, CR-53/54, CR-57).

## R4.4 New findings (R4-CR-*)

Severity: critical = broken flow, data or security; high = clearly wrong, ugly or inaccessible; medium = noticeable polish; low = nitpick. Status for every row: **open** (report-only session).

| ID | Sev | Area | Page / file | Finding | Standard | Fix |
|---|---|---|---|---|---|---|
| R4-CR-01 | high | 3d-engine, designer | `/design/<model>` first load. `DesignerApp.tsx:904-907` (`stagePoster` img), `PackagingScene.module.css:48-77` (`.poster` / `.canvas[data-fade]` 480 ms cross-fade), `DesignScene.tsx:54` | On every editor open, the SVG poster (a different projection, scale and position from the 3D camera) stays up while the first frame renders. For about 1 s the real model shows *through* a larger flat poster box (two boxes, two shadows), then both fade at once for 480 ms as a double image. This is the first 3D moment a buyer sees. Evidence: clip 05 at 2.8 to 5.2 s, `evidence-designer-first-load-ghosting.jpg`. | Craft (3D render quality); ISO 9241-110 (conformity with expectations) | Pick one: **(a, recommended)** render the posters from the engine with the same camera fit, so poster and frame 1 match pixel for pixel (generate them in `scripts/` with the `fit.ts` framing at 1440 and 390 aspect ratios). Or **(b)** cut instead of cross-fade: keep the canvas at opacity 1 underneath, fade only the poster out over 150 ms (`--motion-fast`) after `onReady`, and never animate the canvas opacity. Remove the second poster layer: `DesignerApp` `stagePoster` and the `PackagingScene` `poster` both show today. |
| R4-CR-02 | high | checkout | `/ar/orders/[id]/invoice`: customer block (also seller and customer address lines on the ar order page) | The Latin address typed by the buyer renders reversed in RTL on the **tax invoice**: "Abbas El Akkad St, Nasr City, Cairo 14" instead of "14 Abbas El Akkad St, Nasr City, Cairo". CR-12 added `dir=auto` to the application and dispute text but not to invoice or order addresses. | WCAG 1.3.2; Unicode bidi; ETA invoices must carry the buyer address as given | `<span dir="auto">` (or `<bdi>`) on every address line, name, company name and tax number in `invoice/page.tsx`, the order "Delivery address" card, the vendor job "Delivery" card and the admin order page. Add a vitest check that renders an Arabic invoice with a Latin address and asserts `dir="auto"`. |
| R4-CR-03 | high | admin | `/ar/admin/audit` at 390 (also `/admin/users/[id]` and `/admin/vendors/[slug]` tables at 390) | The IndexTable keeps all 5 columns at 390. "Details" is squeezed to about 45 px, so text breaks every few characters across about 20 lines and is clipped at the inline-start edge. Status badges wrap to 3 lines, and money cells are clipped ("3.81" for 23,490.81). Evidence: `evidence-admin-audit-ar-390.jpg`. | WCAG 1.4.10 reflow | Under 490 px, render IndexTable rows as stacked cards. Polaris IndexTable does this with `condensed`: the first column is the title, the others become label/value lines. Otherwise put the table in an `overflow-x:auto` scroller with a fixed 160 px minimum per column and an edge fade. Badges get `white-space:nowrap`. |
| R4-CR-04 | medium | checkout | `/orders/[id]?paid=1` stepper (`PaidHeader.tsx` plus progress component) | Straight after payment the stepper marks **"In production"** as current. Meanwhile the order list says "Awaiting printer" (status `PAID`), the copy says "The printer checks your file and starts production", and the vendor has not accepted yet. The UI tells two different truths one second apart. | Trust; ISO 9241-110 (self-descriptiveness) | Insert a step "Printer accepted" ("قبول المطبعة") between Paid and In production, or keep "Paid" as current until the vendor accepts (`ACCEPTED`). Drive the stepper from the same `statusTone()` map as the badges. |
| R4-CR-05 | medium | catalogue, platform | `/ar/catalog` at 1440: filter chips (`catalogue_chip`). `src/app/fonts.ts:21-29` | CLS **0.069 to 0.075** (budget 0.1). At about 450 ms IBM Plex Sans Arabic 600 swaps in (`preload:false`, "600 loads on demand"), the chips get wider, and one chip wraps from y 720 to the next line. | CLS (Core Web Vitals); WCAG 2.2.2-adjacent motion | Preload Plex Arabic 600 on Arabic pages (it is the chip and heading weight), or set the chips to 500. Make the chip row `flex-wrap:nowrap; overflow-x:auto` with an end fade, so a width change can never re-wrap the row. Target CLS < 0.01. |
| R4-CR-06 | medium | catalogue, designer | `/catalog` hero vs `/design` and the "Change model" dialog | The same "Available in Egypt" filter reports different totals: catalogue "410 models · 394 available in Egypt", designer picker "370 models · All 355". A buyer who filters in one place and then the other sees 39 models missing. | Trust; consistency (B-20/B-21 signal) | One source (`library index`), with both totals stated: "394 to order in Egypt · 355 in the 3D designer". Or show the designable subset everywhere, with a "Quote only" chip for the other 39. |
| R4-CR-07 | medium | checkout | Checkout "Other quantity" (`checkout.en.ts:33,35`, `checkout.ar.ts`) | The help text says "Between 1 and 2,000 boxes" ("من 1 إلى 2,000"). Marketing says "From 100 boxes" (`home`, `/boxes`), the printer cards say "From 50 / 100 / 500 boxes", and the sample is 5. The minimum quantity is stated 4 ways. | Consistency; consumer protection (clear terms) | State the real per-printer minimum: "From {min} to {max} boxes with this printer" ("من {min} إلى {max} علبة مع هذه المطبعة"). Validate against the selected offer's MOQ, and reword the hero "From 100 boxes" to "From 50 boxes" if that is the true floor. |
| R4-CR-08 | medium | marketing | Home hero at 390 (ar and en) | The floating price card ("500 علبة بريدية 40.06 ج.م للعلبة") covers the top corner of the NOUR box, and the "Delivered to Alexandria" chip covers its front corner, so the product shot reads cluttered. At 1440 the chips float clear. | Craft, hierarchy | Under 490 px, move the price card and chips below the render as a 2-up row, or shrink the render to 86% and anchor the chips outside its bounding box (`inset-inline-end:-8px; top:-12px`, max 50% overlap with empty background only). |
| R4-CR-09 | medium | platform, marketing | Announcement bar plus header CTA on signed-in buyer pages (`/orders/[id]?paid=1`, `/account`, `/orders`, invoice) | After CR-05 the marketing promo bar ("New: preview foil… See finishes") and "Start designing free" sit above the payment-success card and the tax invoice. At 390 ar the bar wraps to 3 lines and splits the link "عرض التشطيبات" across lines. | Hierarchy; Polaris (no promo in transactional views) | Hide the announcement bar on account, orders, invoice and checkout routes, and for 30 days after it is dismissed (cookie). Signed-in CTA: "New design" ("تصميم جديد"). At 390, shorten to "جديد: معاينة البصمة والسلوفان في 3D · عرض" with `white-space:nowrap` on the link. |
| R4-CR-10 | medium | 3d-engine | Share viewer, checkout 3D proof, designer: dark printed colours (`#1f3d2b` Bloom mailer). `lighting.tsx`, `finishes/finishMaterial.ts` | Vertical faces of dark prints crush to near-black (side faces about `#16220f` against a `#263c22` lid). The brand colour the buyer approved is not readable on 2 of 3 visible faces. Gold foil text reads as flat orange print, with no specular sweep. The marketing renders (NOUR) keep side faces readable, so this is an expectation gap at proof approval. Evidence: `evidence-share-dark-side-faces.jpg`. | Craft (3D render quality); proof accuracy | Add a soft front fill (or raise the environment intensity on vertical normals) so side-face luminance is ≥ 55 to 60% of the lid for any albedo. Clamp shadow darkness for printed albedo. Give foil `metalness 1, roughness 0.25` with the studio HDRI reflection and a 1.5 s light sweep on idle (off under reduced motion). Add a visual check in `docs/audit/tools/3d-ecma` for side/top luminance ratio. |
| R4-CR-11 | medium | designer, 3d-engine | Designer at 390 (ar and en), all models; worst on bottles | With the stage header (view tabs plus a duplicated "Face" select), the 7-button control row and the fold row stacked, the canvas is about 170 px tall. The model fills about 30% of it (the bottle about 12%, roughly 40 px wide). The "Face" select also appears twice on screen (stage header and the Artwork panel). | Craft; WCAG 1.4.4-adjacent legibility; ISO 9241-110 | Stage `min-block-size: 46dvh` on phones. Collapse the arrow and zoom buttons into one "View" menu button (keep them for keyboard: WCAG 2.5.7 is met by drag plus the menu), put fold as a segmented control inside the canvas bottom inset, and drop the stage-header Face select under 490 px (the panel has it). Fit target: model bounding box at 70 to 80% of the visible canvas. |
| R4-CR-12 | medium | checkout, business | `/orders/[id]/invoice` seller block (ar and en) | The tax invoice reads "Tax registration number: To be assigned", "Commercial register: To be assigned", and ETA "Activity code / Item code (EGS): To be assigned". A B2B buyer cannot reclaim input VAT on an invoice without the seller TRN. | Egyptian VAT Law 67/2016 and ETA e-invoicing (seller TRN and EGS codes are mandatory); same business-facts gap as CR-43 | Until the legal entity exists, title the document "Order receipt (not a tax invoice)" ("إيصال طلب (ليس فاتورة ضريبية)") and hide the ETA block. Switch to "Tax invoice" only when `ELBA_SELLER_TRN` is configured. Show the EGS item code per line once it is registered. |
| R4-CR-13 | low | admin | `/admin/audit`, `/admin/vendors/[slug]` history | Summaries embed raw record ids: "Nile Pack Printing & Packaging photo cmw4ogi8700037drbi0sbz1ku". The Admin column shows a phone number, not a name. | Clarity | Store and show the caption ("photo "Printed pizza boxes…"") and link it to the record. Keep the id in the expandable "Changes". Admin column: name, with the phone in a tooltip. |
| R4-CR-14 | low | marketing | Home dark CTA band tile (`marketing.*.ts:162-166` `tileOrder`) | Mock order "EL-1042"; real orders are "ELB-26001". | Consistency | "Order ELB-26014" / "طلب ELB-26014". |
| R4-CR-15 | low | checkout | Checkout summary "Prepayment discount" | "EGP -621.53"; in ar the minus floats to the wrong side of the number. | Typography; bidi | Use `formatMoney(-x)` → "−EGP 621.53" with U+2212, wrapped in `<bdi dir="ltr">` in ar ("‎−621.53 ج.م"), coloured `--p-color-text-success`. |
| R4-CR-16 | low | checkout | ar invoice and order spec lines | Latin commas inside Arabic: "علبة بريدية, 250 × 180 × 80 مم, كرتون مضلع E كرافت". | Arabic typography (MSA) | Join list parts with "، " in ar (use `Intl.ListFormat("ar", { type: "unit" })` or a locale separator). |
| R4-CR-17 | low | catalogue, designer | "Change model" dialog cards | On the current model, "Current" replaces the "Made in Egypt" badge and sits inline with the code. Across the grid, badges sit at different heights because the titles wrap. | Component consistency; rhythm | Show both badges in a footer row pinned with `margin-block-start:auto`, "Current" first. Clamp titles to 2 lines. |
| R4-CR-18 | low | designer | ar fold and view controls | Box: "مسطحة / نصف طي / مغلقة" (adjective, noun, adjective). Vessel: "إغلاق / فتح / دوران تلقائي" (verbal nouns). Two grammars for one control. | Arabic UX (noun-form labels) | Box: "فرد · نصف طي · طي كامل". Vessel: "غلق · فتح · دوران تلقائي". Same pattern in en: "Flat · Half · Closed" stays. |
| R4-CR-19 | low | designer | ar designer at 390, stage header | The "الوجه" label is centred above its select instead of start-aligned. | Alignment | `text-align:start` on the field label (it inherits a centred cell). |
| R4-CR-20 | low | marketing | Home | Marketing pills come in 52 px ("Start designing free", "Open the designer", "Browse box styles") and 48 px ("See all printers") on one page. | Design-system hygiene | One marketing large pill (52 px) for section CTAs; 40 px for header and inline links. |
| R4-CR-21 | low | admin | Badges in admin tables at 1440 ("Photo approved") and 390 | Badges wrap onto two or three lines. | Polaris Badge (single line) | `.Badge { white-space:nowrap }`; let the cell widen. |
| R4-CR-22 | low | vendor | Vendor top bar search at 390 | Placeholder cut: "Search jobs by nu…" / "البحث في الطلبات بال…". | Micro-copy | Short placeholder under 490 px: "Search jobs" / "بحث في الطلبات". |
| R4-CR-23 | low | checkout | `/en/orders` tabs at 390 | The last tab is cut ("Deliver…") with no scroll affordance. | Affordance | End fade mask on the tab scroller, plus `scroll-padding-inline` so the selected tab is never clipped. |
| R4-CR-24 | low | marketing | Printer cards on home and `/vendors` (Cairo Label & Flex) | Small tiles crop the bottle renders (the pump and water bottle tops are cut off). | Craft | `object-fit:contain` with 8% padding for vessel renders, or pick a box render for small tiles. |

## R4.5 Counts

**New findings this round, before any fixing** (R4-CR-*):

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 3 |
| Medium | 9 |
| Low | 12 |
| **Total new** | **24** |

Reopened round 2 rows: 2 medium (CR-30 `/catalog` length, CR-35 money precision). Partly fixed with a low remnant: 5 (CR-18, CR-27, CR-38, CR-53/54, CR-57). Still open on business facts: CR-43.

By owner (new plus reopened): 3d-engine 3 (R4-CR-01, 10, 11, shared with designer); checkout 7 (02, 04, 07, 12, 15, 16, 23, plus CR-35); admin 3 (03, 13, 21); catalogue 3 (05, 06, 17, plus CR-30); marketing 4 (08, 14, 20, 24); platform 1 (09, plus CR-38); designer 2 (18, 19); vendor 1 (22).

The stop rule is "a round with no medium-or-worse issue". It is **not met**: 3 high, 9 medium, plus 2 reopened medium.

## R4.6 Top 20 (do these first)

| # | ID | Sev | Area | Fix in one line |
|---|---|---|---|---|
| 1 | R4-CR-01 | high | 3d-engine | Engine-rendered posters with the same fit, or a 150 ms poster-only fade over an opaque canvas; one poster layer |
| 2 | R4-CR-02 | high | checkout | `dir="auto"` / `<bdi>` on every address, name and tax id on the invoice, order, job and admin pages |
| 3 | R4-CR-03 | high | admin | IndexTable condensed (stacked) rows under 490 px; badges `nowrap` |
| 4 | R4-CR-10 | medium | 3d-engine | Front fill, side/top luminance ≥ 0.55; metallic foil with an HDRI reflection |
| 5 | R4-CR-11 | medium | designer | Phone stage ≥ 46dvh, controls into one menu, no duplicate Face select, fit at 70 to 80% |
| 6 | R4-CR-04 | medium | checkout | "Printer accepted" step; stepper follows the status map |
| 7 | R4-CR-12 | medium | checkout | "Order receipt (not a tax invoice)" until the seller TRN exists |
| 8 | CR-30 | medium (reopened) | catalogue | `/catalog`: 12 per family + "Show all", sticky filters (46 to 64k px today) |
| 9 | CR-35 | medium (reopened) | checkout, vendor, marketing | One money precision per column, `tabular-nums` |
| 10 | R4-CR-06 | medium | catalogue | One model count source; state both totals |
| 11 | R4-CR-07 | medium | checkout | Real per-printer minimum in the quantity help and validation |
| 12 | R4-CR-05 | medium | catalogue | Preload Plex Arabic 600; chip row `nowrap` scroller (CLS 0.075 → < 0.01) |
| 13 | R4-CR-09 | medium | platform | No promo bar or "Start designing free" on signed-in transactional pages |
| 14 | R4-CR-08 | medium | marketing | Hero chips off the render at 390 |
| 15 | CR-38 | low (partly reopened) | platform | Stroke 1.75 in the marketing header and footer and the checkout shell |
| 16 | R4-CR-13 | low | admin | Captions, not cuids, in audit summaries |
| 17 | R4-CR-15 | low | checkout | "−EGP 621.53" with a U+2212 minus and bidi isolation |
| 18 | R4-CR-16 | low | checkout | Arabic list separator "،" |
| 19 | R4-CR-18 | low | designer | One noun-form grammar for the fold and view controls in ar |
| 20 | R4-CR-21 | low | admin | Single-line badges |

## R4.7 Notes for the integrator

- Only `docs/audit/craft.md`, `docs/screenshots/final/**` and `docs/screenshots/motion/**` changed. The round 2 clips and `cta-hover-contrast-bug.png` were replaced by the round 4 set.
- The capture, probe and motion scripts are in this session's scratchpad, not in the repo (same as round 2). To reproduce: create session rows directly (sha256 of a random token into `Session.tokenHash`, cookie `elba_session`) and set cookie `elba_cookie_ack=1` to suppress the notice. Order pages poll, so wait for `load` plus up to 8 s of `networkidle`, never `networkidle` alone. Force lazy images to eager and `decode()` them before full-page capture.
