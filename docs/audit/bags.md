# Store bags (أكياس): paper, plastic and reusable bags

Owner ask (2026-11-10): "start working on bags like store bags with all its sizes and prints". This report covers what Egyptian retail and e-commerce brands order, what Elba now builds (7 designer models with live 3D, sizes, handles, prints and instant prices), how the prices are set, and what is still open.

Branch: `claude/exciting-albattani-8kzgsu-bags`. Code: `src/lib/dieline/families/bags` (README there), `src/lib/library/packs/bags.ts`, `src/lib/pricing/bags.ts`, `src/components/designer/BagHandleGroup.tsx`, `src/app/[locale]/(store)/bags/page.tsx`.

## 1. Research (searched 2026-11-10)

Most Egyptian sources are supplier pages or directory listings; figures are what the sellers publish and are often undated. Anything not found is marked so; nothing below is an invented figure.

### Bag types and Egyptian makers

| Maker | What they list | Source |
|---|---|---|
| Packtec Egypt, 6th of October | Kraft, gift, garment, liquor-bottle, medical, shopping and SOS bags; twisted, flat and die-cut handles; three Italian flexo presses up to 8 colours; 15 converting machines; claims 45 million bags a month | https://www.paperindex.com/profile/packtec-egypt/27042313/51376 |
| Eco Pack Solutions, Amreya, Alexandria (2023) | Kraft, twisted-handle, flat-handle, die-cut, SOS, bakery and printed bags | https://www.paperindex.com/profile/eco-pack-solutions-for-trading-manufacturing-and-distribution-of-paper-products-s-a-e/16102515/67577 |
| Etqan Print | Brown or white kraft with twisted (مجدول) or flat (فلات) handles, coated (كوشيه) luxury bags, SOS bags; offset or flexo; gloss or matt lamination; proof before the run | https://etqanprint.com/packaging/paper-bags/ |
| Bag 'n Pack (online) | Plain and logo-printed brown kraft, white and luxury bags, with or without handles | https://bagnpackwebsite.com/collections/bags |
| AMPRO, Dotline (advertising printers) | Full-colour paper bags, front lamination (سلفنة) optional | https://amproadvertising.net/paper-bags/ ; https://dotlineadvertising.com/products/paper-bags |
| Upack | Plain kraft bags with thread handles | https://upack-eg.com/product-category/paper-bags/ |
| Al-Hadaf Egypt | Coated bags with rope handles, printed bags up to 4 colours (search snippets only; pages returned 404) | https://alhadafegypt.net/ |
| El-Sewedy Print, Al-Garhy | Offset and digital printing on paper bags | https://elsewedyprint.com/ ; https://al-garhy.com/ |
| Krafto, Nile Printing & Packaging, IPS Suez, Bedaya Packing | Listed in a June 2025 directory by a vendor that promotes itself; Bedaya quotes 112 to 150 gsm retail bags, flexo and offset | https://www.leelinebags.com/paper-bags-manufacturers-in-egypt/ |

Not found: dedicated Egyptian sites for "elshorbagy" or "nile paper bags"; any Egyptian page for bottle or wine bags other than Packtec's liquor-bottle bags.

### Size convention

- ISO 6591-1 is for paper SACKS, not carrier bags (2026 edition replaces 1984): width x gusset x length, external mm. https://www.iso.org/standard/90432.html
- EN 13590 covers volume and carrying capacity of carrier bags with handles; prEN 13590 enquiry ran Nov 2025 to Jan 2026. https://standards.iteh.ai/catalog/standards/cen/2fcec683-8388-410c-9eba-2951f90ce64c/pren-13590
- The trade writes W x G x H, but Egyptian sellers mix the order (AMPRO "side x width x height", Dotline L x W x H). Elba shows width x gusset x height everywhere (the designer labels the fields Width, Gusset, Height).

### Sizes found (cm, W x G x H)

| Use | Size | Source (market) |
|---|---|---|
| Jewellery / XS | 18 x 8 x 23 | Upack (Egypt) |
| Small | 15 x 8 x 25; 22 x 10 x 32; 22 x 11 x 30 | Bag 'n Pack, Upack (Egypt) |
| Small / medium | 24 x 9 x 32; 24 x 11 x 31 | onlineprinters.ie, ukpackaging.com (EU / UK) |
| Medium | 28 x 16 x 29; 30 x 14 x 30 | Upack, Bag 'n Pack (Egypt) |
| Large | 32 x 12 x 41 | Upack (Egypt), onlineprinters 31 x 12 x 41 (EU) |
| Large landscape | 42 x 12 x 35; 35 x 14 x 40 | onlineprinters (EU); Bag 'n Pack (Egypt) |
| XL | 46 x 16 x 49; 40 x 14 x 54; 39 x 10 x 60 | Upack, Bag 'n Pack, AMPRO (Egypt) |
| Wine, one bottle | 14 x 8 x 39; 14 x 8 x 40 | zbozi.cz (CZ), csj-emballages.com (FR) |

Not found: a published shoe or garment bag size. Elba's "Shoe box" preset (38 x 21 x 30 cm) is derived from our own FEFCO 0427 shoe mailer (330 x 200 x 120 mm) and is not marked standard.

### Construction

- Top turnover 30 to 50 mm; pasted square (block) bottom, base width = W, depth = G. https://creativeretailpackaging.com/packaging-insights/paper-shopping-bags-design-guide/
- Twisted handle: cord 2 to 4 mm (same guide), 4 to 6 mm (Huamei, https://huamei.io/blogs/luxury-paper-bag); bag machines take 4 to 5 mm cords and 50 x 200 mm patches (Curioni listing, snippet only). Elba uses 4.5 mm and a 50 mm patch.
- Flat handle: kraft tape 10 to 20 mm, usually no patch. Elba uses 15 mm.
- Rope: 3 to 6 mm threaded and knotted (guide); cotton 5 to 8 mm knotted inside against a board (Huamei). Elba: cotton 6 mm, PP 5 mm.
- Ribbon: satin or grosgrain 15 to 25 mm (Huamei).
- Not found: glue seam width (Elba uses 12 to 22 mm, scaled with the gusset), handle loop height (Elba scales it with the face width), grey-board base thickness in mm.

### Papers

- Egyptian sellers name the paper (brown or white kraft, couché) but rarely the weight; Bedaya quotes 112 to 150 gsm.
- Elsewhere: white kraft 100 to 180 gsm, MG kraft 80 to 120, SOS 90 to 110, laminated paper 120 to 250 (guide); kraft commonly 90 to 120 and coated about 120 (onlineprinters); luxury bags 120 to 200 (Huamei); textured luxury stock 210 to 250 (snippets).
- Inserts: bottom board 400 to 800 gsm, top board 300 to 600 gsm, patch 120 to 200 gsm (guide).
- Elba offers: brown kraft 80 and 120 gsm, white kraft 120 gsm, laminated art paper 170, 210 and 250 gsm.

### Handles and colours

- Egypt: twisted, flat and die-cut (Packtec, Eco Pack, Etqan), thread handles (Upack), rope on coated bags (Al-Hadaf), no handle (Etqan, Bag 'n Pack). No Egyptian source lists handle colours.
- Abroad: twisted paper handles in white, black, brown, red, yellow, dark green or navy (onlineprinters); cotton, PP, paper or jute rope; satin, grosgrain or twill ribbon (guide).
- Elba: paper handles in kraft, white, black, navy, red, green; ropes and ribbons in 11 colours (adds burgundy, beige, pink, gold, silver). The printer matches the named colour.

### Print and finishes

- Egypt: flexo up to 8 colours (Packtec); offset for full colour, flexo by bag type, gloss or matt lamination (Etqan); 1 colour 1 side (Bag 'n Pack); full colour, double-sided on request (AMPRO); up to 4 colours (Al-Hadaf); offset and digital (El-Sewedy, Al-Garhy). No Egyptian page mentioned foil, spot UV, emboss or inside print.
- Abroad: matt, gloss or soft-touch lamination, hot foil, spot UV, emboss, deboss (Huamei); flexo on kraft often about 2 colours with loose registration (instantprint.co.uk, search).
- Elba rules (configurator): kraft takes flexo colours, matte varnish and hot foil; lamination, spot UV and emboss are refused on kraft with the reason and the fix (choose laminated art paper). Art paper takes every finish; lamination is included in its price. Inside print is offered as "Outside and inside" (priced by the rate card's both-sides surcharge); flagged as not seen on Egyptian pages.

### MOQ, lead times, prices (EGP)

- MOQ: Bag 'n Pack 200 printed (1 week to 10 days, 50 % deposit); AMPRO and Dotline 500; Al-Hadaf coated rope bags 1,000 (snippet). No Egyptian source states 5,000 to 10,000 for machine bags; abroad 10,000 for flexo kraft (Polish catalogue 2022) and 200 to 300 for luxury bags (Huamei, samples 7 to 10 days, production 15 to 20 days).
- Prices seen 2026-11 (pages undated): AMPRO 7.96 to 42.94 per printed bag at MOQ 500; Dotline 7.55 (15 x 10 x 5) to 35.80 (60 x 39 x 10) at 500; Bag 'n Pack 3,290 for 300 one-colour kraft bags 15 x 25 x 8 (about 11 per bag); Upack plain kraft with thread handle 5 to 17 per bag; Al-Hadaf coated rope bag about 50 at 1,000 (snippet); Amazon.eg 50 large kraft bags at 430 (snippet, not verified).
- Paper: Edfu and Qous state mills cut prices by about EGP 4,000/t from 1 July 2026; private mills sell at 38,000 to 41,000/t (Al-Mal News, 2026-08-23, https://almalnews.com/2131258/).

These sources are in `src/data/packaging-availability/sources.ts`. The `bags` availability family in `data.ts` carries them, sub-grouped paper (kraft-carrier, sos, boutique, die-cut, bottle), plastic (tshirt, die-cut, loop-clip, merchandise) and reusable (non-woven).

## 2. Models

| Code | Slug | Default size (mm) | Presets (W x G x H mm) | Papers | Handles | Order |
|---|---|---|---|---|---|---|
| BAG_TWISTED_KRAFT | kraft-bag-twisted-handle | 260 x 120 x 350 | XS 180x80x230, S 220x100x320, M 260x120x350, L 320x120x410, XL 460x160x490 | kraft 120, white kraft 120, kraft 80 | twisted, flat | instant |
| BAG_FLAT_KRAFT | kraft-bag-flat-handle | 280 x 160 x 290 | S 220x110x300, takeaway 280x160x290, M 300x140x300, L 350x140x400 | same | flat, twisted | instant |
| BAG_SOS | sos-paper-bag | 159 x 97 x 318 | #4 127x79x244, #6 152x92x281, #8 159x97x318, takeaway 260x150x300 | kraft 80, kraft 120, white kraft 120 | none (thumb notch option) | instant |
| BAG_ROPE_ART | art-paper-bag-rope-handle | 240 x 90 x 320 | S 150x80x250, M 240x90x320, L 320x120x410, landscape 420x120x350, shoe 380x210x300, garment 460x160x490 | art 210, 170, 250 | cotton rope, PP rope, satin, grosgrain, twisted | instant |
| BAG_GIFT_ART | gift-bag-ribbon-handle | 180 x 80 x 230 | jewellery 180x80x230, M 240x110x310, L 320x120x410 | art 210, 170, 250 | satin, grosgrain, cotton, PP | instant |
| BAG_DIECUT_PATCH | die-cut-handle-bag | 300 x 120 x 400 | S 220x100x320, M 300x120x400, L 400x120x450 | kraft 120, white kraft 120, art 210 | die-cut | quote |
| BAG_BOTTLE | bottle-bag-rope-handle | 140 x 80 x 390 | 140x80x390, 140x80x400, oil 120x90x370 | art 210, kraft 120, white kraft 120, art 250 | cotton, PP, satin, twisted | quote |

Each model is a real die (glue seam, two gusset halves per side with the centre fold, block bottom with gusset triangles and two extensions, turnover, eyelets or hand hole through wall and turnover) with a fold animation; the closed pose is the open standing bag with the gussets creased 8° inward. Board base insert, handle patches and board strips are separate pieces. Handles are real 3D geometry in the chosen colour. Print areas: front, back, both gussets (two halves each), bottom; inside print through "Outside and inside". Finishes and their masks work as on boxes. Details: `src/lib/dieline/families/bags/README.md`.

Designer: picker group «أكياس» / "Bags" (the pouches group is now «أكياس مرنة», "Pouches"), size presets as cards, Width / Gusset / Height fields, paper cards, a handle card per type with a drawing, a colour swatch row. The handle is stored in `DesignDoc.features.bagHandle` (zod-validated), so the die, the 3D view and the price agree.

Earlier quote-only rows: `FS_BAG_TWISTED_HANDLE`, `FS_BAG_FLAT_HANDLE`, `FS_BAG_SOS` and `FS_BAG_BOTTLE` were promoted (removed from `foodservice` and pointed at the new codes through `BAG_CODE_ALIASES`; the SOS slug `sos-paper-bag` is kept). `FS_BAG_MERCHANDISE` (flat, no gusset) and `FS_BAG_BREAD_WINDOW` (window film, food paper) stay quote-only food bags. Catalogue: 421 rows (385 designer models, plastic bags included, section 8).

## 3. Pricing basis

All money is integer piasters; the engine adds the 25 % platform margin and 14 % VAT (`vatOf`).

- Core structure `PAPER_BAG`, rate card reference = a medium bag (26 x 12 x 35 cm, printed paper blank 0.36 m²), brown kraft 120 gsm, 4 colours, handle and board excluded. Seed tiers (buy, EGP per bag): 16 / 11 / 8.5 / 7 / 6 at 100 / 250 / 500 / 1,000 / 2,000. Paper multipliers: kraft 80 x0.85, white kraft x1.15, art 170 x3.9, 210 x4.3, 250 x4.8 (handmade: print, laminate, die-cut, punch, form and thread by hand; lamination included).
- Size bands by paper blank: S up to 0.22 m², M up to 0.42, L up to 0.66, XL above (`BAG_SIZE_BANDS`). Every size in a band costs the same, as on printers' lists; XL keeps growing with the area.
- Colours: the engine's colour factor (1 colour x0.85 of the 4-colour price, plates x0.4).
- Handle per bag (buy, medium band; S x0.8, L x1.2, XL x1.45): twisted 0.60, flat 0.45, cotton rope 3.20, PP rope 2.20, satin 3.80, grosgrain 4.20, die-cut patch 0.30, none 0. Board base and strips on laminated bags 1.50 (S x0.6 to XL x2.2). These are estimates from converter practice: no Egyptian list prices handles separately.
- Finishes: kraft cards have no lamination or spot UV (refused by the configurator too), matte varnish and hot foil are priced; art cards price lamination at 0 (included) and the rest like boxes. Setup EGP 900 (plates); die EGP 900 for laminated bags at non-standard sizes only (kraft bags are formed on the tube machine).
- MOQ: kraft 200 (first instant tier 250), laminated 300 (first tier 500). Above 2,000 bags: a quote, as for boxes.
- Printers (seed): Alex Print House makes kraft bags (bag machine, inline 2-colour flexo), Delta Cartons makes laminated bags (handmade line), Obour Box Works does short runs of kraft 120, white kraft and art 210.

Resulting sell prices, ex-VAT, ex-delivery, per bag (cheapest offer, seeded data):

| Model | Size (mm) | Paper | Colours | Handle | 250 | 500 | 1,000 | 2,000 |
|---|---|---|---|---|---|---|---|---|
| BAG_TWISTED_KRAFT | 220 x 100 x 320 | kraft 120 | 1 | twisted | 13.67 | 10.24 | 8.28 | 7.04 |
| BAG_TWISTED_KRAFT | 260 x 120 x 350 | kraft 120 | 1 | twisted | 13.67 | 10.24 | 8.28 | 7.04 |
| BAG_TWISTED_KRAFT | 320 x 120 x 410 | white kraft 120 | 2 | twisted | 21.46 | 16.05 | 12.95 | 10.99 |
| BAG_FLAT_KRAFT | 280 x 160 x 290 | kraft 120 | 1 | flat | 13.48 | 10.05 | 8.09 | 6.84 |
| BAG_SOS | 159 x 97 x 318 | kraft 80 | 1 | none | 8.39 | 5.99 | 4.64 | 3.81 |
| BAG_ROPE_ART | 240 x 90 x 320 | art 210 | 4 | cotton rope | MOQ | 57.77 | 47.69 | 41.20 |
| BAG_ROPE_ART | 460 x 160 x 490 | art 250 | 4 | cotton rope | MOQ | 112.56 | 93.52 | 81.06 |
| BAG_GIFT_ART | 180 x 80 x 230 | art 170 | 4 | satin ribbon | MOQ | 38.81 | 31.91 | 27.54 |

Checks against the public figures: a small 1-colour kraft bag is EGP 10 to 14 at 250 to 500 (Bag 'n Pack about 11 at 300; Dotline 7.55 to 11.50 at 500 for similar sizes); a medium laminated rope bag is EGP 48 at 1,000 (Al-Hadaf about 50 at 1,000). `src/lib/pricing/__tests__/bags.test.ts` keeps the kraft medium bag between EGP 7 and 20 and the rope bag between EGP 20 and 60.

## 4. Public site

- `/ar/bags`, `/en/bags`: every bag with its 3D render, sizes in cm (width x gusset x height), handles, and the price per bag the designer would show at the default size (1 colour on kraft, full colour on laminated paper, handle included, before VAT and delivery) or "Price by quote". No reviews, counts or logos: Elba has none for bags.
- Header (Products menu) and footer link "Bags" / «أكياس»; the catalogue (`/catalog`) has one "Bags" family with paper, plastic and reusable kinds.
- Arabic copy: MSA, noun-form labels («اختيار الكيس», «تصميم كيس كرافت»), no diacritics, «كيس» plural forms in `formatCount`.

## 5. Screenshots (`docs/screenshots/audit/bags/`)

- `closed-<CODE>.png`: every model in the designer, closed (the open standing bag).
- `size-twisted-xs.png`, `size-twisted-medium.png`, `size-twisted-xl.png`: three sizes of the twisted kraft bag.
- `handle-*.png`: twisted paper, flat paper, cotton rope, PP rope, satin ribbon, grosgrain ribbon (die-cut: `closed-BAG_DIECUT_PATCH.png`).
- `designer-rope-art-large-satin-logo.png`: the e2e journey (bag picked, Large, satin ribbon in navy, logo, instant price).
- `die-<CODE>.svg`: the die of each model at its default size (cut, crease, bleed, safe zones, separate board pieces).
- `bags-page-en.png`, `bags-page-ar.png`.
- `public/models/BAG_*.webp`: catalogue thumbnails rendered from the 3D models.

## 6. Tests run

- Unit: `src/lib/dieline/families/bags/__tests__/bags.test.ts` (89 tests), `src/lib/pricing/__tests__/bags.test.ts`, the whole `npm test` suite.
- e2e: `npx playwright test e2e/models.spec.ts --project=desktop --trace off --grep "model BAG_"` (7 models) and `e2e/bags.spec.ts` (designer journey, screenshots, bags page).
- Geometry snapshot: 8 new keys (7 bags + the PAPER_BAG core structure), no existing key changed.

## 7. Open items (paper)

1. **Copy says "box" around bags.** The designer's price badge and sheet say "500 boxes ... per box", and invoices print "Printed boxes" for the product line (quotes now carry "Printed bags", `pricing.line.productBag`). The badge lives in `src/components/designer/**`, which another session is changing; switch its noun on `model.family === "PAPER_BAG"` after that merge.
2. **Handle and board costs are estimates.** No Egyptian source prices handles separately. Ask Alex Print House and Delta Cartons for a handle line on their rate cards; the vendor portal rate-card form does not edit `BAG_HANDLE_COST` yet (it is code config).
3. **Machine-line MOQs are not public.** Factory flexo bags (Packtec class) are likely 5,000+; our instant price is for short-run makers (200 to 2,000). Large volumes go to a quote, as for every model above 2,000.
4. **Die-cut and bottle bags are quote-only** (reason copy is the generic "no printer prices this stock automatically yet"). Add a printer that lists them, then move them to "listed".
5. **Inside print and spot UV on bags** were not seen on Egyptian pages; they stay offered on art paper as on boxes. Confirm with a printer.
6. **Gusset crease** is uniform over the height (rigid panels); a real bag's crease fades toward the base. Within 1 % of the gusset depth.
7. **Marketing render**: `RENDER_ID.PAPER_BAG` points at the gable box render until a bag render is made with `scripts/marketing` (the /bags page uses the 3D catalogue thumbnails instead).
8. **Store SEO pages** (`/boxes/paper-bags/...`) are not generated for bags (`SEO_SIZES.PAPER_BAG` is empty); the /bags page and the catalogue rows carry the bag pages.
9. **Postgres**: no schema change (new values are String enums and seed rows), so no migration.

## 8. Plastic and reusable bags (scope added 2026-11-10: "don't forget also the normal plastic bags")

### Research (searched 2026-11-10)

Types advertised by Egyptian makers:
- T-shirt (vest) bags, printed and plain bags, gift bags, supermarket and clothing bags, window bags, "biodegradable" bags: Oliatra, 6th of October (https://oliatra.com/مصنع-اكياس-بلاستيك-مطبوعة/, 28 Mar 2026; https://oliatra.com/اسعار-شنط-بلاستيك-مطبوعة/, 21 May 2026).
- HDPE, LDPE and PP bags and rolls, plain or printed, handled bags: Helwan Plast, 6th of October (https://helwanplast.com/plastic-bags-manufacturers).
- Pharmacy, supermarket, restaurant and clothing-store bags, up to 6 colours: Brotherplast, Mansoura (https://www.brotherplast.com/).
- Printed, plain, basket, shipping and OPP bags: Karamaplast, Cairo (https://karamaplast.com/); El Gawhara, Giza (https://elgawharaeg.com/).
- Printed cloth bags with handles: AMPRO (https://amproadvertising.net/hand-textile-bag/). A non-woven maker with 10,000 pcs MOQ on the government export directory (expoegypt, snippet only).
- NOT FOUND on any Egyptian supplier page with specs: die-cut patch handle (with or without patch), kidney, soft loop, rigid clip, drawstring, and explicit side or bottom gusset lines. The trade terms (يد مفرغة, فانلة) are used in the market. Elba offers die-cut, patch, kidney, T-shirt, flat and non-woven bags instantly, and soft loop, clip and drawstring bags by quote only.

Materials and thickness:
- Thickness bands: thin 15 to 30 µm, medium 40 to 70 µm, thick 80 to 120+ µm (Oliatra). Per-type micron norms from an Egyptian source: NOT FOUND (abroad: T-shirt 20 to 50 µm, LDPE die-cut 30 to 50+ µm).
- Recycled content: suppliers say only that recycled grades are cheaper; no percentages.
- Biodegradable claims: Helwan Plast says cornstarch or PLA "without toxic residues" (no certificate or timeframe); Oliatra mentions PLA. Egypt's position on oxo-degradable bags is unsettled (EIPR appeal, 9 May 2022, https://eipr.org/en/node/4141; reported EOS and ministry moves against d2w and oxo, undated). An enacted oxo ban is NOT VERIFIED. Elba makes no compostable or biodegradable claim and offers none.
- Non-woven PP: 60 to 120 gsm, 80 typical (non-Egyptian sources); Egyptian standard ES 8919/2024 (https://www.eos.org.eg/ar/slider/130). Egyptian gsm data: NOT FOUND.

Print: flexo up to 6 colours (Brotherplast); price depends on colours and one or two sides (Helwan Plast). Screen printing on non-woven in Egypt: NOT FOUND (AMPRO says "one colour or more").

Sizes (W x H cm, no gusset published by any Egyptian source): 20 x 25, 30 x 40, 40 x 60+ (Oliatra); plain bags 15 x 30, 20 x 35, 25 x 40 (ikhlaspack); cloth bags 30 x 25 to 55 x 60 (AMPRO). Gusset widths, loop and clip sizes: NOT FOUND, ours are estimates.

Prices and MOQ:

| Item | Figure | Date | Source |
|---|---|---|---|
| Printed light / medium bags | EGP 22 to 30/kg ("approximate", below resin cost: stale or recycled) | Mar 2026 | Oliatra |
| Printed bags | EGP 65 to 90/kg | 2026 (snippet) | palastic.com |
| Printed bags, no MOQ | EGP 58/kg | undated | tigersstores.cloud |
| Plain PE, 1 kg retail | about EGP 88 to 90/kg | undated | ikhlaspack.com |
| Cloth bags with handles, MOQ 100 | EGP 6.24 to 17.26 per bag | undated | AMPRO |
| Non-woven, export, MOQ 10,000 | USD 135 to 210 per 1,000 | undated | expoegypt (snippet) |
| PE resin | HDPE about 60,000 (Mar 2026), about 74,000 (Jul 2026); LDPE about 62,000 to 72,000 EGP/t | 2026 | elmakhzn.com |

MOQ in kg and cylinder or plate costs per colour: NOT FOUND.

### Regulation (flagged in the designer and on /bags)

- **EPR fee:** Prime Minister's Decree No. 662 of 2025, Official Gazette issue 9 bis (B), 2 March 2025, under Article 17 of the Waste Management Law No. 202 of 2020. Plastic shopping bags produced or imported under ES 3040 are priority products under extended producer responsibility; producers and importers pay **EGP 37.5 per kg** of bags sold locally, declared quarterly, collected by the Waste Management Regulatory Authority, in force about **3 June 2025** (https://www.almasdar.com/152992; https://amwalalghad.com/2025/03/04/...; https://www.egypt-business.com/...). No thickness threshold in the decree. Not verified: the Gazette text itself; no amendment found.
- **Executive regulations:** PM Decree 722 of 2022 (22 Feb 2022): single-use bags must meet EOS specifications; free distribution needs written permission; large and medium retailers must offer multi-use bags (https://leap.unep.org/...; https://www.youm7.com/6377981).
- **ES 3040/2022 "Plastic shopping bags":** mandatory by decree 559/2022 (approved 27 Sep 2022, corrigendum 2024), all single-layer thermoplastic shopping bags (https://www.eos.org.eg/ar/standard/3210). The press reports a **50 µm minimum** and a ban on producing bags under 20 µm (Youm7, 1 Mar 2026); in Feb 2026 the minister directed enforcement of the 50 µm minimum. The standard's text and an enforcement date were NOT seen.
- **Governorate bans:** Red Sea single-use plastic ban (2019), South Sinai (Sharm, Dahab 2021), Alexandria (April 2022, scope NOT VERIFIED). No thickness thresholds found in them.

How Elba applies it:
- Configurator limit: every film offered is at least 50 µm (`MIN_FILM_MICRONS`, tested). There is no thinner film to pick.
- The EPR fee is a separate quote line at cost (no margin): bag weight (film blank area x gsm) x EGP 37.5/kg, rounded up to the piaster (`pricing.line.eprFee`). Non-woven bags (ES 8919, not single-use film) carry no EPR line; verify with WMRA.
- The designer shows the rule next to the film options; `/bags` shows it above the plastic section.

### Models, 3D and options

Eight models (table in `src/lib/dieline/families/bags/README.md`): T-shirt, die-cut (with or without patch), kidney, soft loop, rigid clip, flat merchandise, drawstring and non-woven. Films: HDPE 50, LDPE 50 / 70 / 100 µm; non-woven 80 / 100 gsm. Options: film tone (white, clear, coloured in 10 named colours), gusset (side, bottom, none, per model), handle type and colour where it is a separate part.

Choice of engine: built in the bags family on the fold engine, not in the vessels flexible family, because carrier bags need a real die with handle cutouts, the T-shirt U-cut, gussets, hems and patches, plus the box tools (faces, artwork, preflight, PDF) and the Bags picker group. Film softness is a renderer material: translucent opacity and a procedural wrinkle normal map. Handles and holes are real cutouts or accessory geometry.

Picker: one «أكياس» / "Bags" family in the catalogue picker with sub-families listed paper, then plastic, then reusable (the slug prefix orders them); the designer's own model groups keep a single "Bags" group in the same order.

### Pricing basis

- Rate card reference: a 30 x 8 x 40 cm bottom-gusset die-cut bag, film blank 0.365 m², LDPE 50 µm, 16.8 g, 4 colours. Tiers (buy, EGP per bag): 2.02 / 1.60 / 1.34 / 1.18 / 1.04, which is EGP 120 / 95 / 80 / 70 / 62 per kg. Material multipliers follow the weight: HDPE 50 x1.03, LDPE 70 x1.39, LDPE 100 x2. Non-woven: x6 (80 gsm), x7 (100 gsm), as sewn bags.
- 90 % of the price follows the bag area (resin and film dominate); bags are flexo printed (no digital on film); setup EGP 900 x the colour factor.
- MOQ: 5 kg of film bags (converted to bags per size), 100 non-woven bags. Estimates: no Egyptian MOQ in kg is published.
- Extras: welded soft loop 0.35, rigid clip 1.20, drawstring 0.25, film patch 0.08, sewn straps 0.90 EGP per bag (buy, estimates).
- Printer (seed): Cairo Label & Flex makes film bags (bag line with 6-colour CI flexo), Obour Box Works non-woven bags.

Sell prices, ex-VAT and ex-delivery, per bag, EPR included (seeded data):

| Model | Size (mm) | Material | Colours | 500 | 1,000 | 2,000 |
|---|---|---|---|---|---|---|
| PBAG_TSHIRT | 300 x 100 x 400 | HDPE 50 | 1 | 3.66 | 2.99 | 2.56 |
| PBAG_DIECUT (patch, bottom gusset) | 300 x 80 x 400 | LDPE 50 | 2 | 3.12 | 2.70 | 2.26 |
| PBAG_DIECUT (plain, black) | 400 x 100 x 600 | LDPE 70 | 4 | 7.59 | 6.81 | 5.99 |
| PBAG_KIDNEY | 350 x 80 x 450 | LDPE 50 | 2 | 3.64 | 3.12 | 2.59 |
| PBAG_MERCHANDISE (clear) | 200 x 350 | LDPE 50 | 1 | MOQ | 1.23 | 0.97 |
| PBAG_NONWOVEN | 350 x 120 x 400 | 80 gsm | 1 | 14.89 | 12.91 | 11.35 |

(The plastic rows above were computed before the plain die-cut handle cost was set to zero; the plain die-cut row is EGP 0.38 lower now.) Check: the die-cut bag at 2,000 is EGP 134/kg all-in, about EGP 96/kg before EPR and setup, the top of the public EGP 58 to 90/kg band, as short runs should be. The non-woven bag is EGP 11 to 15, inside AMPRO's EGP 6.24 to 17.26.

### Screenshots

`docs/screenshots/audit/bags/`: `closed-PBAG_*.png` (every plastic model), `plastic-diecut-white-bottom-gusset.png`, `plastic-diecut-clear.png`, `plastic-diecut-navy-side-gusset.png`, `plastic-diecut-navy-logo.png`, `plastic-tshirt.png`, `plastic-kidney-bottom-gusset.png`, `plastic-soft-loop.png`, `plastic-rigid-clip.png`, `plastic-drawstring.png`, `plastic-diecut-flat.png`, `plastic-nonwoven.png`; catalogue thumbnails `public/models/PBAG_*.webp`.

### Tests

`src/lib/dieline/families/bags/__tests__/plastic.test.ts` (every model x gusset x handle), `src/lib/pricing/__tests__/plastic-bags.test.ts` (EPR line, weight pricing, MOQ by kg, no digital, non-woven, quote-only), `e2e/models.spec.ts --grep "model PBAG_"` (8 of 8), `e2e/bags.spec.ts` (plastic journey: film tone, gusset, handle with and without patch, logo, instant price, the API quote carries the EPR line; screenshots). Geometry snapshot: 9 new keys (8 models and PLASTIC_BAG).

### Open items (plastic)

1. **50 µm minimum is press-reported.** ES 3040's text was not seen. If the real minimum is lower, add thinner T-shirt films (the market sells 15 to 30 µm) by adding materials; if enforcement starts, nothing changes.
2. **Price per kg and MOQ are estimates.** The public figures conflict (EGP 22 to 90/kg) and no MOQ in kg or cylinder cost is published. Ask Cairo Label & Flex for a per-kg rate card and cylinder costs.
3. **EPR on non-woven bags** is assumed out of scope (ES 8919, not ES 3040): confirm with WMRA.
4. **Soft loop, clip and drawstring bags** are quote only: no Egyptian supplier found.
5. **No biodegradable or compostable option** is offered: supplier claims are uncertified and Egypt's oxo position is unsettled.
6. **Recycled content** is not an option (no supplier gives percentages).
7. **Flat bags** ignore the Gusset field (the designer still shows it). Hide it for flat bags in a later designer pass.
8. **Bottom gusset approximation:** tapered side strips; the back is about 1 % taller than the front.
9. **Clear film** shows the film colour as an opaque print background on the artwork canvas, then 42 % opacity in 3D; unprinted clear areas read slightly milky.
10. The designer's "boxes" wording (open item 1 in section 7) applies to plastic bags too.
