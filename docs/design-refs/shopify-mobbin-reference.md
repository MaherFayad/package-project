# Shopify reference (Mobbin, Spring 2026 admin)

Source: 22 Shopify web screens from Mobbin, saved as high-res images in `docs/design-refs/shopify/` (local reference only; not for redistribution, keep out of git). Use these as the visual ground truth for "Polaris look". Copy patterns, spacing, hierarchy and component anatomy. Never copy the Shopify logo, name, illustrations, mascot or icon set.

## Screen index

| File | Mobbin | Pattern to copy | Where we use it |
|---|---|---|---|
| 01-home-dashboard | [link](https://mobbin.com/screens/a14400bb-6617-4890-af09-01c012c69998) | Metrics strip at top, greeting, task cards grid | Vendor dashboard, admin overview |
| 02-home-setup-cards | [link](https://mobbin.com/screens/01119441-a83f-4141-bc57-26eb0174ff5e) | Setup/onboarding cards with illustration + 1 primary + 1 plain action; small 3-up cards | Vendor onboarding, buyer account "next steps" |
| 03-date-range-popover | [link](https://mobbin.com/screens/dcba8f32-4ca1-4d22-b246-4c1628026bff) | Date range popover with presets list + dual calendar, Cancel/Apply | Admin analytics filters |
| 04-search-overlay | [link](https://mobbin.com/screens/ff3011d8-d1eb-4891-b255-b12a07922d19) | Global search with scope chips + recent searches, dimmed backdrop | Admin/vendor search |
| 05-metric-popover | [link](https://mobbin.com/screens/843c9e38-0cb0-41cc-9449-3b6d6b0a80cf) | Metric picker list with icons, chart card | Admin funnel metrics |
| 06-analytics-dashboard | [link](https://mobbin.com/screens/7483aa3e-31eb-470c-bbe2-477a81106422) | KPI cards with sparkline, line chart card, breakdown table card, donut | Admin overview (funnel, GMV, margin) |
| 07-orders-index | [link](https://mobbin.com/screens/78c265c7-af85-446c-9edb-ec3f7423bf89) | Orders index: page header actions, metrics strip, view selector + "Search and filter", index table, status badges, toast | Admin orders, vendor jobs, buyer orders |
| 08-orders-index-batches | [link](https://mobbin.com/screens/79e56fe6-07e5-47d6-b24d-a57cd92d5fc1) | Grouped rows with progress steps "Pick > Print > Pack > Done" | Vendor production batches |
| 09-orders-bulk-actions | [link](https://mobbin.com/screens/2f59c8fc-2374-4fc4-9157-0767616b7f74) | Bulk action bar replacing header row when rows selected | Admin bulk routing, vendor bulk status |
| 10-orders-filter-menu | [link](https://mobbin.com/screens/4df3cf78-bc17-4632-8ad8-fb9d69bd90b2) | Filter field focused with filter-key menu | All index tables |
| 11-drafts-index | [link](https://mobbin.com/screens/8fdff2db-2f47-435d-bc69-47fd82759791) | Simple index table, status badges (Completed grey, Open yellow, Invoice sent blue), right-aligned totals | Quotes list, manual quotes |
| 12-order-timeline | [link](https://mobbin.com/screens/a55fe048-1d64-46c8-9a5a-26fbcafe2111) | Timeline: comment composer card + dotted vertical event list with timestamps | Order detail (buyer, vendor, admin) |
| 13-order-detail-unfulfilled | [link](https://mobbin.com/screens/08acdf60-2382-48ed-b328-269b035fa838) | Order detail 2/3 + 1/3 layout, title with status badges, header actions + pager, fulfilment card with split primary button, payment summary inset box | Order detail pages |
| 14-order-detail-fulfilled | [link](https://mobbin.com/screens/9565322e-d10e-45ce-b417-28da8ff6dc6f) | Fulfilled state, tracking link, toast | Shipped state |
| 15-order-fulfill-form | [link](https://mobbin.com/screens/922543bc-0a8b-4529-a06d-72ec5a201f3a) | Inline fulfil form: tracking number + carrier select + notify checkbox, Cancel / primary | Vendor "mark shipped" |
| 16-product-edit-savebar | [link](https://mobbin.com/screens/053b40d2-a1f5-4c60-b06c-c8f1cc3c4683) | Contextual save bar in top bar ("Unsaved changes", Discard, Save), 2/3 form + 1/3 side cards, media grid with add tile | Vendor profile, rate cards, admin pricing config |
| 17-product-edit-inventory | [link](https://mobbin.com/screens/d4e16c22-ff8c-496c-99b7-ab2b15761232) | Nested table inside card, toggle in card header, inline pills for secondary fields | Rate card tiers editor |
| 18-create-order | [link](https://mobbin.com/screens/d48d1394-dde0-4829-ac49-a977bb938bad) | Line items with qty input, payment card with Subtotal/Shipping/Tax/Total, Send invoice / Mark as paid | Checkout summary, admin manual quote |
| 19-checkout-summary-form | [link](https://mobbin.com/screens/08fc94cd-e351-4de2-96e4-7ffd8d68f3eb) | Long form left, sticky summary card right with timeline bullets, Amount due, full-width primary, info banner | Buyer checkout |
| 20-modal-choice-list | [link](https://mobbin.com/screens/c018c96d-32c2-4dda-92aa-83a785c8c4e9) | Modal: title + info icon + close, radio/checkbox list with help text and "Recommended" badge, Cancel + disabled primary | Soft-gate modal, settings modals |
| 21-settings-general | [link](https://mobbin.com/screens/62c220f0-a020-4124-8a5c-7382503e3661) | Settings overlay: left nav card with search, content cards with list rows + chevrons, selects with help text | Account settings, vendor settings, admin config |
| 22-settings-banner-collapsible | [link](https://mobbin.com/screens/3934c706-bf90-4abe-95fc-34e24e36d73e) | Info banner, collapsible sections inside card, radio + checkbox groups | Consent management (PDPL), admin config |

## Observed design language (apply exactly)

**Frame**
- Top bar: full-width near-black (~#1a1a1a), 56px tall. Centered search pill, dark grey fill, magnifier icon, "⌘ K" hint at the end. Right: icon buttons + avatar with initials on a coloured square. When a form is dirty the search is replaced by the contextual save bar (dark pill: "Unsaved changes" + Discard (dark) + Save (white)).
- Side navigation: light grey surface (~#ebebeb), no visible border, ~240px. Items: 16px icon + 13px semibold label, 28 to 32px rows, active item is a white pill with a subtle shadow. Count badges right-aligned in grey pills. Sub-items indented under the active parent. Section labels like "Sales channels ›" in 12px secondary text. Settings pinned to the bottom.
- Canvas: ~#f1f1f1 background. Content max width ~1000px centred for detail pages; index pages go full width with 16 to 20px gutters.

**Page header**
- Optional leading icon or "icon ›" breadcrumb, title 20px bold, then status badges inline. Subtitle line in 12 to 13px secondary text ("July 6, 2026 at 5:05 am from Draft Orders").
- Actions right: small secondary buttons (white, 1px border + bottom bevel shadow, 13px semibold, radius 8, ~28px tall), "More actions ⌄" menu button, primary button dark (#303030 to #1a1a1a gradient, white text), and ‹ › pager buttons.

**Cards**
- White, radius 12px, shadow: 0 1px 0 rgba(0,0,0,.07) plus a very light outline. Padding 16px (12px on mobile). Card title 13px semibold. Cards stack with 16px gaps.
- Insets: summary boxes inside cards use a 1px border, radius 8, 12px padding (payment summary, totals).
- Two-column detail layout: main 2/3, sidebar 1/3 of stacked small cards (Notes, Customer, Contact, Address, Tags) each with a title row and an icon action (pencil or ⋯) top right.

**Metrics strip**
- One card divided into equal columns; each: 12px label with dotted underline, 14 to 16px value, small sparkline; first cell can be a period selector ("Today").

**Index table**
- Toolbar row: view selector ("All ⇕"), "Search and filter" field with magnifier, right icon buttons (columns, sort).
- Header row: 12px semibold secondary text, light grey background, checkbox column. Rows ~36px, 13px text, hover background, dividers 1px #ebebeb. Order IDs semibold. Money right-aligned.
- Bulk selection: header becomes "2 selected" + action chips (Print, Create shipping labels, Mark as ⌄, …).
- Cancelled/refunded rows: strikethrough secondary text.
- Footer: centred "Learn more about orders" link.

**Badges**
- Pill, 12px, 20px tall, 8px horizontal padding. Neutral grey with filled dot (Paid, Completed). Attention yellow with a ring icon (Unfulfilled, Open). Warning orange (Payment pending). Info blue (Invoice sent). Success green (Active, On). Status badge can carry an icon prefix.

**Buttons**
- Primary: dark/black, white text. Not green. Destructive: red. Secondary: white with border + bevel. Plain/link: blue text (#005bd3). Split button: primary + chevron menu. Full-width primary in summary cards.

**Forms**
- Labels 13px above inputs. Inputs ~32px tall, radius 8, 1px #8a8a8a border, 12px horizontal padding, focus ring 2px blue (#005bd3) with offset. Selects show ⇕ double chevron. Help text 12px secondary below. Inline secondary fields as grey pills ("Compare-at", "Charge tax Yes"). Toggles in card headers.

**Feedback**
- Toast: black pill bottom-centre, white 13px text, × close.
- Banner info: light blue background, blue info icon in a rounded square, dismiss ×. Banner inside cards also used.
- Modal: white, radius 12, header (title 14px semibold + info icon + ×), divider, body, divider, footer right-aligned Cancel (secondary) + primary (disabled = grey).
- Popovers/menus: white, radius 12, shadow-lg, 13px items 28px tall, hover grey, icons optional.

**Timeline**
- Comment composer card with avatar square, emoji/mention/attach icons, "Post" button disabled until text. Vertical rail with dots; event text 13px, timestamp right-aligned secondary; expandable events with ⌄; embedded "View email" small secondary button. Date group headers ("Today").

**Typography**
- Inter. Body 13px/20px, small 12px/16px, card titles 13px semibold, page title 20px/24px bold, big greeting 24 to 28px. Numbers use tabular figures.

**Colour (approximate, verify against tokens)**
- Text #303030, secondary #616161, disabled #b5b5b5, link #005bd3.
- Surfaces: canvas #f1f1f1, card #ffffff, nav #ebebeb, hover #f7f7f7, selected #ffffff on grey.
- Badge fills: neutral #e3e3e3, attention #ffeb78, warning #ffd6a4, info #e0f0ff, success #cdfed4, critical #fed1d7.

## How to apply to our product
- **Vendor portal and admin:** replicate the admin frame 1:1 (top bar, side nav, index tables, detail layout, save bar, timeline).
- **Buyer storefront and designer:** use the same tokens, cards, buttons, badges and forms, with a lighter marketing layout. Checkout follows screen 19 (form left, sticky summary right, full-width dark primary). The soft-gate sign-in modal follows screen 20.
- **RTL:** mirror the frame (side nav on the right, actions on the left, chevrons flipped); keep numbers, money and the 3D canvas unmirrored.
- **Branding:** our own wordmark and avatar colours; no Shopify logo, name, mascot, illustrations or icons.
