# Elba design system

Elba's UI kit copies the **Polaris design language** of the Shopify admin (2025–2026), using the 22 Mobbin reference screens in `docs/design-refs/`. We wrote it ourselves:

- Tokens: `src/styles/tokens.css`
- Base styles: `src/styles/globals.css`
- Components: `src/components/ui/*`
- Showcase: `/ar/dev/ui` and `/en/dev/ui` (marked noindex)

## Licence notes (read before changing anything)

- `@shopify/polaris` and `@shopify/polaris-tokens` (checked version 9.4.2, on 2026-11-05) say `SEE LICENSE IN LICENSE.md`. That licence is MIT-style with one added restriction:
  > "…may only be exercised to develop and distribute applications that integrate or interoperate with Shopify software or services, and in the case of external, stand-alone applications … that are dissimilar and visually distinct from Shopify products and services (including the internal administration page of a Shopify merchant store)…"
- Elba is a stand-alone app, so it **must not** install, import, bundle or copy code from those packages. It must also not use Polaris icons or any Shopify logo, name, illustration or mascot.
- What we did:
  - We read the published token values as reference only.
  - We re-entered colours, spacing, radii and shadows by hand as ordinary CSS values. Hex colours and a 4 px scale cannot be owned, but treat the list as reference.
  - We wrote every component from scratch.
  - Icons are `lucide-react` (ISC licence).
  - The illustrations, wordmark and avatar palette are our own.
- **Open risk:** being "faithful to Polaris" pulls against the licence's "visually distinct" clause, even though no code is reused. To keep Elba recognisably Elba:
  - Our wordmark (kraft-board box glyph, "Elba" / "علبة") stays in the top bar.
  - The kraft accent `--e-color-brand-kraft` is reserved for brand moments.
  - The storefront uses a lighter marketing layout.
  - Legal should review this before launch. The brand team may later swap the accent or primary colour, which is one token edit.

## Tokens

All tokens are CSS custom properties on `:root`.

- Polaris roles use the prefix `--p-*`, so polaris.shopify.com docs map onto our names one to one.
- Additions that are only ours use `--e-*`.
- Light mode is the primary theme. A dark structure exists for `data-theme="dark"`; it covers the semantic roles only and is not turned on automatically.

### Colour (main roles)

| Token | Value | Use |
|---|---|---|
| `--p-color-bg` | #f1f1f1 | App canvas |
| `--p-color-bg-inverse` | #1a1a1a | Top bar |
| `--p-color-bg-surface` | #ffffff | Cards, popovers, modals |
| `--p-color-bg-surface-secondary` | #f7f7f7 | Table header, subdued card section |
| `--p-color-bg-surface-tertiary` | #f3f3f3 | Modal header |
| `--p-color-bg-surface-hover` / `-active` / `-selected` | #f7f7f7 / #f3f3f3 / #f1f1f1 | Row and item states |
| `--p-color-nav-bg` | #ebebeb | Side navigation |
| `--p-color-nav-bg-surface-selected` | #fafafa | Active nav pill |
| `--p-color-bg-fill-brand` | #303030 | **Primary button (dark, not green)** |
| `--p-color-bg-fill` | #ffffff | Secondary (bevel) button |
| `--p-color-bg-fill-transparent-secondary` | rgba(0,0,0,.06) | Grey page-header actions ("tertiary") |
| `--p-color-bg-fill-critical` | #c70a24 | Destructive primary |
| `--p-color-bg-fill-success` | #047b5d | Success fill |
| `--p-color-bg-fill-tertiary` | #e3e3e3 | Neutral badge |
| `--p-color-bg-fill-caution-secondary` | #ffeb78 | Attention badge |
| `--p-color-bg-fill-warning-secondary` | #ffd6a4 | Warning badge |
| `--p-color-bg-fill-info-secondary` | #d5ebff | Info badge |
| `--p-color-bg-fill-success-secondary` | #affebf | Success badge |
| `--p-color-bg-fill-critical-secondary` | #fed1d7 | Critical badge |
| `--p-color-bg-surface-{info,success,warning,critical,caution}` | tints | Banners |
| `--p-color-text` | #303030 | Body text |
| `--p-color-text-secondary` | #616161 | Secondary text (5.3:1 on #f1f1f1) |
| `--p-color-text-disabled` | #b5b5b5 | Disabled only (exempt from contrast rules) |
| `--p-color-text-link` | #005bd3 | Links, plain buttons |
| `--p-color-text-{critical,success,warning,caution,info}` | dark tones | Text on tinted surfaces |
| `--p-color-border` / `-secondary` / `-tertiary` | #e3e3e3 / #ebebeb / #cccccc | Dividers |
| `--p-color-input-border` | #8a8a8a | Inputs (3.4:1, meets 1.4.11) |
| `--p-color-border-focus` | #005bd3 | Focus ring |
| `--p-color-border-critical-secondary` | #8e0b21 | Input in error |
| `--e-color-topbar-search-bg` | #303030 | Search pill and save bar |
| `--e-color-avatar-{1..6}-{bg,text}` | our palette | Avatar initials, all pairs at least 4.5:1 |
| `--e-color-brand-kraft` / `-strong` | #c8964f / #8a5a1c | Wordmark and illustrations only |

`tokens.css` also has the full Polaris role set: the hover, active and selected steps, and the icon colours.

### Typography

- Fonts: Inter for Latin text and IBM Plex Sans Arabic for Arabic, both loaded through `next/font`.
- Under `:lang(ar)`, Plex comes first in the font stack.
- Weights: Latin uses 450, 550, 650 and 700. Under `:lang(ar)` they snap to Plex's 400, 500, 600 and 700.
- Digits are always Western. Use `numeric` or `.tabular-nums` for tabular figures.

| Variant | Size / line height | Weight | Arabic |
|---|---|---|---|
| heading3xl | 36 / 48 | bold | same |
| heading2xl | 30 / 40 | bold | same |
| headingXl | 24 / 32 | bold | same |
| headingLg | 20 / 24 (18 on phones) | semibold | same |
| headingMd | 14 / 20 | semibold | same |
| headingSm (card title) | 13 / 20 | semibold | 14 |
| headingXs | 12 / 16 | semibold | 13 / 20 |
| bodyLg | 14 / 20 | regular | same |
| **bodyMd (default)** | **13 / 20** | regular | **14 / 24** |
| bodySm | 12 / 16 | regular | 13 / 20 |
| bodyXs | 11 / 12 | regular | same |

- The page title is 20 px bold (18 px on phones).
- Inputs use 16 px text on phones so iOS does not zoom.

### Space, radius, shadow, motion

- **Space** uses a 4 px base. The name is the pixel value × 4 / 100: `--p-space-0, 025 (1px), 050 (2), 100 (4), 150 (6), 200 (8), 300 (12), 400 (16), 500 (20), 600 (24), 800 (32), 1000 (40), 1200 (48), 1600 (64), 2000 (80), 2400 (96), 2800 (112), 3200 (128)`.
- **Radius:**
  - 100 (4 px): checkbox
  - 150 (6 px): micro button
  - 200 (8 px): buttons, inputs, insets, nav items, badges
  - 300 (12 px): cards, popovers, top-bar search
  - 400 (16 px): modal
  - full: pills
- **Shadow:**
  - `100` is the card drop shadow; `--e-shadow-card` adds a 1 px hairline outline to it.
  - `300` is used for popovers, `400` for toasts and menus, `600` for modals.
  - `bevel-100` and `button*` are the inset bevels: the white secondary button has a darker bottom edge, and the dark primary has a light top edge plus a subtle gradient.
- **Focus:**
  - The ring is a 2 px `--p-color-border-focus` outline with a 1 px offset.
  - It turns white on the dark top bar.
- **Motion:**
  - Durations run 0–500 ms, plus 5000 ms for toasts.
  - Easings: `ease`, `ease-in`, `ease-out` (0.19, 0.91, 0.38, 1), `ease-in-out`, `linear`.
  - `globals.css` stops animations under `prefers-reduced-motion`. Spinners keep turning slowly so "busy" still reads.
- **Layout:**
  - Breakpoints: 490, 768, 1040 and 1440 px.
  - Page max width: 998 px (narrow 662 px).
  - Gutter: 16 px on phones, 24 px from 768 px.
  - Top bar: 56 px. Nav: 240 px.
  - Control heights: 24 (micro), 28 (slim and default buttons), 32 (inputs) and 40 px on coarse pointers.

## Component API (summary)

Import everything from `@/components/ui`.

- **Server-safe** components (no hooks) can be used directly in Server Components: Text, Box, BlockStack, InlineStack, InlineGrid, Divider, Bleed, Card, CardSection, Inset, Layout/LayoutSection/LayoutAnnotatedSection, Badge, CountBadge, Icon, Avatar, Thumbnail, ProgressBar, EmptyState, Timeline and MetricsStrip.
- **All other components are Client Components.** Two rules follow from that:
  1. From a Server Component, use the named exports (`LayoutSection`, `IndexTableRow`) and not `Layout.Section`, because compound properties do not cross the server/client boundary.
  2. To pass an icon from a Server Component into a client component, pass an element (`icon={<Icon source={Truck} />}`), not the lucide function.

| Component | Key props | Notes |
|---|---|---|
| `AppProvider` | `locale` | Supplies the kit's strings (ar/en) and the toast queue. Mount once per area layout. Without it, the kit uses the `I18nProvider` locale and toasts do nothing (with a warning). |
| `Frame` | `topBar`, `navigation`, `navigationLabel`, `contentElement` | Black frame and rounded `#f1f1f1` sheet. Renders the single `<main id="main">`; use `contentElement="div"` when a parent layout already does. On phones the nav becomes a drawer (dialog, focus trapped, Escape closes, closes on route change). |
| `TopBar` | `logo`, `logoUrl`, `searchField`, `secondaryMenu`, `userMenu {name, detail, actions}`, `contextualSaveBar` | Centred search pill. The save bar replaces the search while a form is dirty. |
| `TopBarSearchField` | `value`, `onChange`, `onSubmit`, `placeholder`, `shortcut`, `results` | Ctrl/⌘+K focuses it. |
| `TopBarIconButton` | `icon`, `label`, `url`/`onClick`, `badge` | |
| `ContextualSaveBar` | `message`, `saveAction`, `discardAction` | |
| `Navigation` | `sections [{title?, items, pinned?}]`, `location?` | Items take `{url, label, icon, badge, exactMatch, matchPaths, subNavigationItems, selected}`. The longest matching path is selected; `aria-current="page"`. |
| `Page` | `title`, `titleMetadata`, `subtitle`, `titleIcon`, `backAction`, `primaryAction`, `secondaryActions`, `actionGroups`, `pagination`, `fullWidth`, `narrowWidth` | Secondary actions are grey "tertiary" buttons; on phones they fold into a ⋯ menu. |
| `Layout` / `LayoutSection` | `variant: oneThird / oneHalf / fullWidth`, `as="aside"` | 2/3 + 1/3 that stacks on phones. |
| `Card` | `title`, `headerActions`, `footer`, `padding`, `background`, `roundedAbove` | Plus `CardSection` (full-bleed divider section) and `Inset` (bordered summary box). |
| `Box`, `BlockStack`, `InlineStack`, `InlineGrid` | `gap`, `padding*`, `align`, `blockAlign`, `columns` | Accept responsive values `{xs, sm, md, lg, xl}`. |
| `Text` | `as` (required), `variant`, `tone`, `fontWeight`, `alignment`, `numeric`, `truncate`, `visuallyHidden` | |
| `Button` | `variant: primary / secondary / tertiary / plain / monochromePlain`, `tone: critical / success`, `size: micro / slim / medium / large`, `icon`, `disclosure`, `loading`, `disabled`, `pressed`, `url`, `external`, `submit`, `fullWidth`, `accessibilityLabel` | forwardRef. Loading sets `aria-busy` and disables the button. |
| `ButtonGroup` | `variant="segmented"`, `gap`, `fullWidth` | |
| `TextField` | `label`, `autoComplete` (required), `helpText`, `error`, `prefix`, `suffix`, `multiline`, `maxLength` + `showCharacterCount`, `clearButton`, `connectedLeft/Right`, `dir`, `optional`, `requiredIndicator` | forwardRef. Controlled or uncontrolled. |
| `Select` | `label`, `options` (strings, options or groups), `labelInline`, `placeholder`, `error` | Native `<select>` with the ⇕ icon. |
| `Checkbox` | `checked: boolean or "indeterminate"`, `helpText`, `error` | 16 px box with a 24 px hit area. |
| `RadioButton` | `name`, `checked`, `helpText` | |
| `ChoiceList` | `title`, `choices [{label, value, helpText, renderChildren}]`, `selected`, `allowMultiple` | Fieldset with legend. |
| `RangeSlider` | `value`, `min`, `max`, `step`, `output`, `formatValue` | Native range. Always pair it with a number field. |
| `Badge` | `tone: neutral / info / success / attention / warning / critical / new / readOnly / enabled / magic`, `progress: incomplete / partiallyComplete / complete`, `icon`, `size` | Plus `CountBadge`. |
| `Banner` | `tone`, `title`, `action`, `secondaryAction`, `onDismiss`, `inCard`, `announce` | |
| `useToast()` | `show(content, {tone, duration, action})` | Black pill at the bottom centre. Pauses on hover or focus. Critical toasts use `role=alert`. |
| `Modal` | `open`, `onClose`, `title`, `titleMetadata`, `primaryAction`, `secondaryActions`, `footer`, `size`, `flush`, `initialFocusRef`, `preventClose` | Portal, focus trap, inert background, restores focus, Escape closes. Bottom sheet on phones. |
| `Popover` + `ActionList` | `active`, `activator`, `onClose`, `preferredAlignment`, `ariaHaspopup` / `items`, `sections`, `actionRole="menuitem"`, `onActionAnyItem` | Fixed position (escapes overflow), flips above when needed, follows RTL. Arrow keys move through the list. |
| `Tabs` | `tabs [{id, content, badge, url, disabled}]`, `selected`, `onSelect`, `activation`, `fitted` | ARIA tabs with roving tabindex and RTL-aware arrows. Link tabs render as `<nav>`. |
| `IndexTable` | `resourceName`, `headings`, `rowIds`, `selectable`, `selectedIds`, `onSelectionChange`, `promotedBulkActions`, `bulkActions`, `toolbar`, `title`, `titleAction`, `emptyState`, `footer` | Rows are `IndexTableRow {id, tone, strikethrough}`, cells `IndexTableCell {alignment, numeric}`, and the row link is `IndexTableRowLink`. |
| `IndexFilters` | `views`, `queryValue`, `filters`, `appliedFilters`, `sortOptions` | The "Search and filter" toolbar. |
| `DataTable` | `columnContentTypes`, `headings`, `rows`, `totals`, `caption` | |
| `MetricsStrip` | `metrics [{label, value, trend}]`, `leading` | |
| `Timeline` | `groups [{title, events [{content, time, details, action, tone}]}]`, `composer` | |
| `Stepper` | `steps`, `current`, `currentTone`, `orientation`, `accessibilityLabel` | Order status. Vertical on phones. |
| `PriceTag` | `amount` (piasters), `compareAt`, `vat`, `perUnit`, `size`, `locale` | Uses `formatMoney`, wrapped in `<bdi>` inside `<data>`. |
| `EmptyState` | `heading`, `image`, `action`, `secondaryAction`, `compact` | Plus `EmptyBoxIllustration`. |
| `Spinner`, `ProgressBar`, `SkeletonPage`, `SkeletonBodyText`, `SkeletonDisplayText`, `SkeletonThumbnail`, `SkeletonTabs` | | |
| `Thumbnail`, `Avatar` | `alt` (required) / `name`, `shape`, `size` | |
| `Tooltip` | `content`, `dotted`, `asLabel`, `preferredPosition` | |
| `DropZone` | `label`, `accept`, `maxSize`, `allowMultiple`, `onDrop(all, accepted, rejected)`, `error` | |
| `Link`, `Breadcrumbs`, `Pagination`, `Icon` | | `Icon` sizes: small 16, medium 20 (16 px glyph), large 24; `flipInRtl` for arrows. |

## Usage rules (from the reference screens)

- **One dark primary per view.** Primary buttons are dark (#303030), never green. Use critical for destructive actions. Secondary buttons are white with a bevel; page-header actions are grey (tertiary); links are blue plain buttons.
- **Admin areas** (vendor and admin) use `Frame` + `TopBar` + `Navigation` + `Page`:
  - Index pages: `Page fullWidth`, then `MetricsStrip`, then `IndexTable` with `IndexFilters`.
  - Detail pages: `Layout` with a 2/3 section and a 1/3 `aside` of small cards (title row plus a pencil or ⋯ icon action), then the timeline at the bottom.
  - Edit forms set `contextualSaveBar` on the TopBar while the form is dirty.
- **Buyer storefront, checkout and designer** use the same tokens, cards, buttons and forms, without the admin frame.
  - Checkout follows screen 19: the form on the start side and a sticky summary card on the end side, with a full-width dark primary button.
  - The sign-in gate modal follows screen 20: a ChoiceList with a "Recommended" badge, Cancel, and a primary button that stays disabled until a choice is made.
- **Statuses are pill badges.** Use the `progress` pip (ring, half or dot) as well as colour, and keep the label text explicit.
- **Money** always goes through `PriceTag` or `formatMoney`. Put "ج.م" after the amount in Arabic and "EGP" before it in English. Show VAT 14% as a separate line.
- **Never hard-code colours or spacing** in other areas; use the tokens.

## RTL rules

- Every component uses logical properties (`inline-start/end`, `block-start/end`, `border-start-start-radius`), so the frame mirrors automatically:
  - the nav is on the right,
  - actions are on the left,
  - the mobile drawer slides in from the right,
  - popovers align to the logical start or end.
- **Directional icons** (back arrows, chevrons, pager) use `<Icon flipInRtl />`. Logos, clocks, checkmarks and media icons are never flipped.
- **Tabs:** ArrowLeft moves to the next tab in RTL.
- **Range slider:** the fill runs from the right in RTL, matching the native input.
- **Never mirrored:**
  - the 3D scene and dielines (not part of this kit),
  - numbers, money and dimensions (`numeric` / `<bdi>`),
  - phone numbers, codes, emails and URLs: use `TextField dir="ltr"` while the label keeps the page direction.
- **Arabic copy:** MSA, noun-form labels, no diacritics, Western digits. The kit's own strings are in `src/components/ui/strings.ts`, separate from the app dictionaries.

## Accessibility notes (WCAG 2.2 AA)

- **Contrast:**
  - All text pairs are at least 4.5:1.
  - Input borders (#8a8a8a) and focus rings are at least 3:1.
  - Badge text uses the dark `text-*` tone on its tint.
  - Disabled text is exempt.
- **Focus:**
  - A visible 2 px ring on every control (`:focus-visible`).
  - `scroll-padding-top` keeps focused elements clear of the sticky top bar (2.4.11).
  - Modal and drawer focus is trapped and then restored.
- **Target size:**
  - At least 24 px everywhere; checkboxes and radios use an invisible 24 px hit area.
  - On coarse pointers, buttons, inputs, tabs and nav rows grow to 40–44 px.
- **Keyboard:**
  - Tabs, ActionList and Popover all work from the keyboard (Escape closes and returns focus).
  - Tooltips show on focus, can be dismissed with Escape, and can be hovered (1.4.13).
  - Ctrl/⌘+K focuses search.
- **Single pointer (2.5.7):**
  - DropZone has an "Add files" button and the zone itself is clickable; drag-and-drop is only a shortcut.
  - RangeSlider must be paired with a number field.
  - IndexTable row clicks are a shortcut for a real link.
- **Semantics:**
  - Dialogs: `role=dialog` with `aria-modal` and a labelled title.
  - Tabs follow the ARIA tabs pattern.
  - IndexTable: a table with a caption, `scope` on headers, `aria-selected` rows and labelled row checkboxes.
  - Stepper: an ordered list with `aria-current="step"` and the status in text.
  - Toasts use live regions.
  - Field errors and help text are linked with `aria-describedby`, and `aria-invalid` is set.
- **Motion:** `prefers-reduced-motion` turns off transitions and shimmer.
- **Reflow:** usable at 360 px with no page-level horizontal scroll; wide tables and the metrics strip scroll inside their cards.

## Tests

`src/components/ui/__tests__/` runs with Vitest, jsdom and Testing Library. It covers:

- Modal: focus moves in, the Tab/Shift+Tab trap, the inert background, Escape closing and focus restore, and Arabic labels.
- Tabs: roles, the roving tabindex, arrows that skip disabled tabs and wrap, Home/End, RTL arrows, and manual activation.
- Button: click, submit, disabled, loading/busy, icon-only name, pressed/expanded, links.
- Helpers: `cx` and `fileAccepted`.
