# Shopify marketing site reference (Mobbin sections)

Source: shopify.com sections on Mobbin, saved in `docs/design-refs/shopify-web/` (local only, kept out of git). Use them for the public landing, catalog and vendor index pages. The admin reference (`shopify-mobbin-reference.md`) still governs the vendor portal, admin and in-app screens. Copy layout, rhythm, type scale and section anatomy. Never copy the Shopify logo, name, photos, illustrations or copy.

## Section index

| File | Mobbin | Pattern | Our use |
|---|---|---|---|
| w01-hero-split-email-cta | [link](https://mobbin.com/sites/sections/a86e388a-0aaa-4fdc-85eb-8785b5628a41) | Huge 72 to 96px tight headline left, one-line subhead, inline input + black pill CTA, fine print; right: tall masonry of photos + floating UI chips (sales card, notification); soft mint-to-white gradient; announcement bar on top | Home hero: headline left, live 3D box + floating chips (price, "approved", vendor rating) right; phone-number field + "ابدأ التصميم مجانا" |
| w02-hero-centered-photo | [link](https://mobbin.com/sites/sections/a37436a4-e6ec-45c8-b2df-4289bf73edef) | Eyebrow in green caps, centred 64px headline, subhead, black pill + outline pill, "Already have…" line, full-bleed lifestyle photo with product device | Category landing (/boxes, /bottles) |
| w03-hero-dark-collage | [link](https://mobbin.com/sites/sections/277ef2f2-b31c-434f-8a39-e14ede8db6a0) | Dark navy hero, centred headline 2 lines, lime pill CTA, bottom row of staggered tiles mixing photos and UI cards | Vendor recruitment page / "For printers" |
| w04-about-split-hero | [link](https://mobbin.com/sites/sections/392cfc85-f159-4d9b-a162-d46d6a0e6102) | Eyebrow caps, 40px headline, layered photo + UI screenshot | How it works / About |
| w05-stats-globe | [link](https://mobbin.com/sites/sections/64f1ef93-17c1-4246-b8e1-1224ba62da1b) | Big statement headline with highlighted phrase, 2x2 stats with left accent rule | Trust stats (vendors, governorates, on-time %, min order 100) |
| w06-feature-grid-6-icons | [link](https://mobbin.com/sites/sections/f6c1cb21-298a-4ab1-b2df-a5d165fdbca6) | Centred H2, 3x2 grid of line icon + bold 14px title + 14px grey body, no cards, generous whitespace, faint radial tint | Value props |
| w07-feature-row-4-icon-tiles | [link](https://mobbin.com/sites/sections/5bc49425-caf0-4870-8e4d-b34aa35cfd2d) | Left-aligned 48px H2, 4 columns: mint rounded-square icon tile, 20px title, body, outline pill "+ Compare" | Finishes / materials overview |
| w08-audience-cards-5 | [link](https://mobbin.com/sites/sections/97d6ee75-56ec-49cf-a96e-25d2c4310a6b) | Small caps eyebrow, 5 white cards with tinted circle icon, light shadow; next band light grey with "Your store, your way" + product screenshot | Use cases (e-commerce, food, cosmetics, apparel, gifts) then designer screenshot band |
| w09-blog-hero-cta-band | [link](https://mobbin.com/sites/sections/11c092be-1fe5-4324-92c6-552368fcc6a8) | Half grey band with headline + full-width CTA, photo right | Closing CTA band |
| w10-footer-white / w11-footer-black | [link](https://mobbin.com/sites/sections/428f0e97-50a4-4651-a022-ae2ea974098d) / [link](https://mobbin.com/sites/sections/1bafefb8-58e5-4dfe-acae-11210eb607fe) | Logo mark left, 4 link columns with 13px bold heads, second row of columns, divider, region selector + legal links + social icons | Footer (black variant) |

## Marketing design language (differs from admin)

- **Header:** white or black 64px bar, wordmark left, 3 to 4 nav items with chevron menus, "Log in" text link + black pill "Start" button (white pill on black). Optional thin announcement bar above (lime or mint).
- **Type:** much bigger than admin. Hero 64 to 96px, weight 600 to 700, tracking -2%, line height 1.0 to 1.05. H2 40 to 56px. Body 18 to 20px grey (#4a4a4a) in heroes, 16px elsewhere. Eyebrows 12 to 14px caps, green or dark, letter spacing 0.04em. Arabic: IBM Plex Sans Arabic, drop negative tracking, line height 1.25 for headlines.
- **Buttons:** fully rounded pills, 48 to 52px tall, black fill / white text primary, 1.5px black outline secondary. Lime (#d4f36b-ish) only on dark sections. Admin bevel buttons are NOT used on marketing pages.
- **Colour:** mostly white, black and greys; soft mint/green gradients (#e8f8ee to white) as section washes; dark navy/black sections for contrast; one accent at a time. Stay with our own accent if brand differs, but keep this restraint.
- **Layout:** 1200 to 1280px container, 96 to 128px vertical section padding desktop, 64px mobile. Alternating white / light grey (#f5f5f3) / dark bands. Lots of empty space; no boxed card-everything layout on marketing pages; cards only for audience/tiles.
- **Imagery:** real product photography and floating UI fragments (price chip, order card, notification) layered over photos. For us: real 3D renders of our boxes, bottles and labels, printed-sample photos (placeholders generated locally), Egyptian brand contexts.
- **Motion:** subtle; marquee of logos/photos, hover lift on cards; respect prefers-reduced-motion.
- **Mobile:** headline 40 to 44px, stacked, CTA full width, collage becomes a horizontal scroll strip.

## What is wrong with the current home page (Nov 2026 screenshot)
- Looks like an admin dashboard: everything boxed in cards on grey canvas, small 13px type, hero headline only ~32px, tiny buttons.
- Value props, how-it-works and catalog are equal-weight card grids: no hierarchy, no rhythm, no dark/light bands.
- Hero visual is a small static box in a card; no floating proof chips, no sense of "free 3D".
- Catalog thumbnails are blank grey placeholder boxes.
- Cookie banner floats mid-page over content.
- Footer is plain; no strong closing CTA band.
