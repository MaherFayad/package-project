# Packaging availability: Egypt and worldwide

**Data:** `src/data/packaging-availability` (`AVAILABILITY`, `REGULATORY`, `SOURCES`, mapping helpers) · **Researched:** Nov 2026 · **Status:** research data, estimates flagged

## How to read this

- **Egypt:** `local` = made by Egyptian converters at volume. `imported` = mostly imported (stock or custom), local finishing at most. `rare` = hard to source in Egypt at all.
- **Values marked `*` are estimates** (`estimate: true` in the data): MOQ, lead time and EGP price bands come from typical Egyptian trade practice, not from published price lists. I found **no public EGP rate cards for custom printed packaging** in Egypt, so price bands are directional only. Replace them with vendor rate cards before showing them to buyers.
- Price bands assume ~EGP 47 to 50 per USD (2025 to 2026), **exclude 14% VAT**, delivery and one-off tooling (cutting die, flexo plates, gravure cylinders). Imported board, film and kraft mean prices follow the EGP/USD rate (see `packaging-costs-egypt-45`). Reprice at least quarterly.
- Clusters and manufacturer types come from public listings (Yellow Pages Egypt, FindInEgypt, CPHI, trade press). Directory listings are self-reported: they show a manufacturer type exists in a cluster, not its current capacity. No contact details are stored.
- Sub-families inherit their family's fields and override what differs.

## Integration

```ts
import { availabilityFor, availabilityForStandard, AVAILABILITY } from "@/data/packaging-availability";

availabilityFor({ structureCode: "FEFCO_0427" });          // corrugated/fefco-04
availabilityFor({ vesselKind: "STAND_UP_POUCH" });         // flexible/stand-up-pouch
availabilityFor({ standard: "ECMA A60.20" });              // folding-carton/ecma-glued
availabilityFor({ family: "metal", subFamily: "aerosol" }); // metal/aerosol (egypt: "rare")
availabilityForStandard("FEFCO 0711");                     // corrugated/fefco-07 (FEFCO maps by series)
```

Lookups fall back from the most specific key to the family, so a new model code (`structureCode` not yet in `STRUCTURE_TO_AVAILABILITY`) still resolves through its `standard` or `family`. When other agents add structure codes or vessel kinds, add one line to `STRUCTURE_TO_AVAILABILITY` / `VESSEL_TO_AVAILABILITY`; the test fails until every current code is mapped.

## What I'd ship in the catalogue

1. **Show the Egypt badge, not the price band.** Badges: "صناعة محلية" (local), "مستورد" (imported), "توفر محدود" (rare). The price bands are too uncertain to show as numbers; use them only to rank and to sanity-check vendor quotes.
2. **Gate system-supplied formats.** Aseptic and gable-top liquid cartons, printed 2-piece beverage cans and blister films are sold with filling-line contracts at 100,000+ units. Keep them as **preview only** with "Request a quote", never instant pricing.
3. **Route SMEs to label/sleeve when the container is imported.** For beverage cans, cosmetic glass, airless and pump bottles, Egyptian vendors print the **label or shrink sleeve**, not the container. The vessel models already work that way (`label-only`).
4. **Seasonality:** book bakery and gift-box capacity 4 to 6 weeks before Ramadan and Eid.

## Availability table (Egypt)

| Family / sub-family | Slug | Egypt | Egyptian print methods | MOQ | Lead time (days) | Price band EGP (ex-VAT) | Clusters |
|---|---|---|---|---|---|---|---|
| **Corrugated board** | `corrugated` | local | flexo-postprint, litho-lamination, digital-toner | 300 to 1,000 pcs* | 7 to 21* | 12 to 45 / printed box* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| ↳ Slotted boxes (FEFCO 02) | `corrugated/fefco-02` | local | flexo-postprint, litho-lamination, digital-toner | 500 to 1,000 pcs* | 5 to 12* | 8 to 35 / box* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| ↳ Telescope boxes (FEFCO 03) | `corrugated/fefco-03` | local | flexo-postprint, litho-lamination, digital-toner | 300 to 1,000 pcs* | 7 to 21* | 18 to 60 / lid + base set* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| ↳ Folder and tray boxes (FEFCO 04) | `corrugated/fefco-04` | local | flexo-postprint, litho-lamination, digital-toner, digital-inkjet-corrugated | 300 to 1,000 pcs* | 7 to 18* | 15 to 45 / mailer* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| ↳ Slide boxes (FEFCO 05) | `corrugated/fefco-05` | local | flexo-postprint, litho-lamination, digital-toner | 500 to 2,000 pcs* | 7 to 21* | 12 to 45 / printed box* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| ↳ Rigid-type / bliss boxes (FEFCO 06) | `corrugated/fefco-06` | rare | flexo-postprint, litho-lamination, digital-toner | 1,000 to 5,000 pcs* | 14 to 30* | 12 to 45 / printed box* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| ↳ Ready-glued boxes (FEFCO 07) | `corrugated/fefco-07` | local | flexo-postprint, litho-lamination, digital-toner | 1,000 to 3,000 pcs* | 7 to 21* | 10 to 40 / box* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| ↳ Interior fittings (FEFCO 09) | `corrugated/fefco-09` | local | flexo-postprint | 300 to 1,000 pcs* | 7 to 21* | 2 to 12 / insert set* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, borg-el-arab, alexandria, quesna |
| **Folding cartons** | `folding-carton` | local | offset-sheetfed, digital-toner, hot-foil | 500 to 3,000 pcs* | 7 to 15* | 2 to 9 / printed carton* | 10th-of-ramadan, 6th-of-october, obour, greater-cairo, alexandria, borg-el-arab |
| ↳ Tuck end cartons (RTE, STE) | `folding-carton/ecma-tuck` | local | offset-sheetfed, digital-toner, hot-foil | 500 to 3,000 pcs* | 7 to 15* | 1.5 to 7 / carton* | 10th-of-ramadan, 6th-of-october, obour, greater-cairo, alexandria, borg-el-arab |
| ↳ Glued-bottom cartons (crash-lock, snap-lock) | `folding-carton/ecma-glued` | local | offset-sheetfed, digital-toner, hot-foil | 2,000 to 5,000 pcs* | 7 to 15* | 2.5 to 10 / carton* | 10th-of-ramadan, 6th-of-october, obour, greater-cairo, alexandria, borg-el-arab |
| ↳ Trays (ECMA B series) | `folding-carton/ecma-tray` | local | offset-sheetfed, digital-toner, hot-foil | 500 to 3,000 pcs* | 7 to 15* | 2 to 9 / printed carton* | 10th-of-ramadan, 6th-of-october, obour, greater-cairo, alexandria, borg-el-arab |
| ↳ Sleeves | `folding-carton/ecma-sleeve` | local | offset-sheetfed, digital-toner, hot-foil | 500 to 3,000 pcs* | 7 to 15* | 1 to 5 / sleeve* | 10th-of-ramadan, 6th-of-october, obour, greater-cairo, alexandria, borg-el-arab |
| ↳ Specials (gable carry, display, pillow, hexagon) | `folding-carton/ecma-special` | local | offset-sheetfed, digital-toner, hot-foil | 500 to 3,000 pcs* | 10 to 20* | 2 to 9 / printed carton* | 10th-of-ramadan, 6th-of-october, obour, greater-cairo, alexandria, borg-el-arab |
| ↳ Gable-top liquid cartons (chilled) | `folding-carton/gable-top-liquid` | imported | flexo-flexible, offset-sheetfed | 100,000 to 500,000 blanks* | 30 to 75* | n/a | 6th-of-october |
| ↳ Aseptic liquid cartons (brick) | `folding-carton/aseptic-liquid` | imported | flexo-flexible, rotogravure | 200,000 to 1,000,000 packs* | 30 to 90* | n/a | 6th-of-october |
| **Rigid set-up boxes** | `rigid-box` | local | offset-sheetfed, digital-toner, hot-foil, screen | 100 to 500 pcs* | 10 to 25* | 60 to 250 / box* | greater-cairo, 6th-of-october, 10th-of-ramadan, obour |
| ↳ Lid and base | `rigid-box/lid-base` | local | offset-sheetfed, digital-toner, hot-foil, screen | 100 to 500 pcs* | 10 to 25* | 60 to 250 / box* | greater-cairo, 6th-of-october, 10th-of-ramadan, obour |
| ↳ Magnetic book box | `rigid-box/magnetic-book` | local | offset-sheetfed, digital-toner, hot-foil, screen | 100 to 500 pcs* | 10 to 25* | 80 to 300 / box* | greater-cairo, 6th-of-october, 10th-of-ramadan, obour |
| ↳ Drawer / slide box | `rigid-box/drawer` | local | offset-sheetfed, digital-toner, hot-foil, screen | 100 to 500 pcs* | 10 to 25* | 60 to 250 / box* | greater-cairo, 6th-of-october, 10th-of-ramadan, obour |
| **Paper tubes and composite cans** | `paper-tube` | local | offset-sheetfed, hot-foil, digital-toner | 300 to 2,000 pcs* | 12 to 25* | 30 to 120 / tube* | 10th-of-ramadan, 6th-of-october, greater-cairo |
| ↳ Retail paper tube | `paper-tube/retail-tube` | local | offset-sheetfed, hot-foil, digital-toner | 300 to 2,000 pcs* | 12 to 25* | 30 to 120 / tube* | 10th-of-ramadan, 6th-of-october, greater-cairo |
| ↳ Composite can (metal ends) | `paper-tube/composite-can` | rare | offset-sheetfed, hot-foil, digital-toner | 300 to 2,000 pcs* | 12 to 25* | 30 to 120 / tube* | 10th-of-ramadan, 6th-of-october, greater-cairo |
| **Pallet boxes and bulk bins** | `pallet-box` | local | flexo-postprint | 50 to 300 pcs* | 10 to 21* | 600 to 2500 / bin* | 10th-of-ramadan, sadat-city, borg-el-arab |
| ↳ Triple-wall bin | `pallet-box/triple-wall-bin` | local | flexo-postprint | 50 to 300 pcs* | 10 to 21* | 600 to 2500 / bin* | 10th-of-ramadan, sadat-city, borg-el-arab |
| ↳ Octabin | `pallet-box/octabin` | rare | flexo-postprint | 50 to 300 pcs* | 10 to 21* | 600 to 2500 / bin* | 10th-of-ramadan, sadat-city, borg-el-arab |
| **Envelopes and paper mailers** | `envelope-mailer` | local | offset-sheetfed, flexo-flexible, digital-toner | 500 to 5,000 pcs* | 5 to 15* | 2 to 10 / envelope* | greater-cairo, 6th-of-october, 10th-of-ramadan |
| ↳ Paper envelope | `envelope-mailer/paper-envelope` | local | offset-sheetfed, flexo-flexible, digital-toner | 500 to 5,000 pcs* | 5 to 15* | 2 to 10 / envelope* | greater-cairo, 6th-of-october, 10th-of-ramadan |
| ↳ Kraft courier mailer | `envelope-mailer/kraft-mailer` | local | offset-sheetfed, flexo-flexible, digital-toner | 500 to 5,000 pcs* | 5 to 15* | 2 to 10 / envelope* | greater-cairo, 6th-of-october, 10th-of-ramadan |
| ↳ Padded / bubble mailer | `envelope-mailer/padded-mailer` | imported | offset-sheetfed, flexo-flexible, digital-toner | 500 to 5,000 pcs* | 5 to 15* | 2 to 10 / envelope* | greater-cairo, 6th-of-october, 10th-of-ramadan |
| **Food service packaging** | `food-service` | local | offset-sheetfed, flexo-flexible, flexo-postprint, dry-offset | 1,000 to 10,000 pcs* | 7 to 21* | n/a | 10th-of-ramadan, 6th-of-october, obour, sadat-city, greater-cairo |
| ↳ Cake and bakery boxes | `food-service/bakery-box` | local | offset-sheetfed, flexo-flexible, flexo-postprint, dry-offset | 500 to 3,000 pcs* | 7 to 21* | 4 to 18 / box* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, greater-cairo |
| ↳ Burger clamshell | `food-service/burger-box` | local | offset-sheetfed, flexo-flexible, flexo-postprint, dry-offset | 1,000 to 10,000 pcs* | 7 to 21* | 1.5 to 5 / box* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, greater-cairo |
| ↳ Noodle / takeaway pail | `food-service/noodle-box` | imported | offset-sheetfed, flexo-flexible, flexo-postprint, dry-offset | 1,000 to 10,000 pcs* | 7 to 21* | n/a | 10th-of-ramadan, 6th-of-october, obour, sadat-city, greater-cairo |
| ↳ Paper cups | `food-service/paper-cup` | local | flexo-flexible, offset-sheetfed | 10,000 to 50,000 pcs* | 7 to 21* | 0.9 to 3.5 / cup* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, greater-cairo |
| ↳ Paper bowls and salad boxes | `food-service/paper-bowl` | imported | offset-sheetfed, flexo-flexible, flexo-postprint, dry-offset | 10,000 to 50,000 pcs* | 7 to 21* | n/a | 10th-of-ramadan, 6th-of-october, obour, sadat-city, greater-cairo |
| ↳ Paper bags | `food-service/paper-bag` | local | flexo-flexible, offset-sheetfed | 1,000 to 10,000 pcs* | 7 to 21* | 3 to 15 / bag* | 6th-of-october, borg-el-arab, alexandria, greater-cairo |
| ↳ Molded pulp / fibre | `food-service/molded-pulp` | local | label-only | 5,000 to 20,000 pcs* | 7 to 21* | n/a | sadat-city, 6th-of-october |
| ↳ Tags and inserts | `food-service/hang-tag` | local | offset-sheetfed, digital-toner, hot-foil | 100 to 1,000 pcs* | 2 to 7* | 0.5 to 4 / tag* | 10th-of-ramadan, 6th-of-october, obour, sadat-city, greater-cairo |
| **Flexible packaging** | `flexible` | local | rotogravure, flexo-flexible, digital-toner | 5,000 to 30,000 pcs* | 14 to 35* | n/a | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Stand-up pouches (doypack) | `flexible/stand-up-pouch` | local | rotogravure, flexo-flexible, digital-toner | 3,000 to 10,000 pcs* | 14 to 35* | 3 to 12 / pouch* | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Pillow bags (VFFS) | `flexible/pillow-bag` | local | rotogravure, flexo-flexible, digital-toner | 300 to 1,000 kg film* | 14 to 35* | n/a | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Coffee bags (side gusset, flat bottom, valve) | `flexible/coffee-bag` | local | rotogravure, flexo-flexible, digital-toner | 5,000 to 30,000 pcs* | 14 to 35* | 5 to 18 / bag* | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Sachets (3/4-side seal) | `flexible/sachet` | local | rotogravure, flexo-flexible, digital-toner | 300 to 1,000 kg film* | 14 to 35* | n/a | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Stick packs | `flexible/stick-pack` | local | rotogravure, flexo-flexible, digital-toner | 300 to 1,000 kg film* | 14 to 35* | n/a | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Flow wrap (HFFS) | `flexible/flow-wrap` | local | rotogravure, flexo-flexible, digital-toner | 300 to 1,000 kg film* | 14 to 35* | n/a | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Shrink sleeves | `flexible/shrink-sleeve` | local | rotogravure, flexo-flexible, digital-toner | 10,000 to 50,000 sleeves* | 14 to 35* | 0.4 to 2 / sleeve* | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Poly mailers | `flexible/poly-mailer` | local | flexo-flexible | 5,000 to 20,000 pcs* | 14 to 35* | 1 to 4 / mailer* | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Bag-in-box | `flexible/bag-in-box` | imported | rotogravure, flexo-flexible, digital-toner | 5,000 to 30,000 pcs* | 14 to 35* | n/a | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| ↳ Lidding foil and roll stock | `flexible/lidding-roll` | local | rotogravure, flexo-flexible, digital-toner | 5,000 to 30,000 pcs* | 14 to 35* | n/a | obour, 6th-of-october, 10th-of-ramadan, borg-el-arab, sadat-city |
| **Glass containers** | `glass` | local | label-only, screen | 1 to 10 pallets* | 3 to 30* | 6 to 25 / container* | greater-cairo, 10th-of-ramadan, sadat-city, alexandria |
| ↳ Glass bottles | `glass/glass-bottle` | local | label-only, screen | 1 to 10 pallets* | 3 to 30* | 6 to 25 / container* | greater-cairo, 10th-of-ramadan, sadat-city, alexandria |
| ↳ Glass jars | `glass/glass-jar` | local | label-only, screen | 1 to 10 pallets* | 3 to 30* | 6 to 25 / container* | greater-cairo, 10th-of-ramadan, sadat-city, alexandria |
| ↳ Cosmetic and perfume glass | `glass/cosmetic-glass` | imported | label-only, screen | 1 to 10 pallets* | 3 to 30* | 6 to 25 / container* | greater-cairo, 10th-of-ramadan, sadat-city, alexandria |
| **Rigid plastic containers** | `rigid-plastic` | local | label-only, screen, iml, dry-offset | 5,000 to 50,000 pcs* | 5 to 30* | n/a | 10th-of-ramadan, 6th-of-october, borg-el-arab, obour, sadat-city |
| ↳ PET bottles | `rigid-plastic/pet-bottle` | local | label-only, screen, iml, dry-offset | 5,000 to 50,000 pcs* | 5 to 30* | 1.5 to 5 / bottle* | 10th-of-ramadan, 6th-of-october, borg-el-arab, obour, sadat-city |
| ↳ HDPE bottles | `rigid-plastic/hdpe-bottle` | local | label-only, screen, iml, dry-offset | 5,000 to 50,000 pcs* | 5 to 30* | n/a | 10th-of-ramadan, 6th-of-october, borg-el-arab, obour, sadat-city |
| ↳ Plastic jars | `rigid-plastic/plastic-jar` | local | label-only, screen, iml, dry-offset | 5,000 to 50,000 pcs* | 5 to 30* | n/a | 10th-of-ramadan, 6th-of-october, borg-el-arab, obour, sadat-city |
| ↳ Tubs (thermoformed / IML) | `rigid-plastic/tub` | local | dry-offset, iml, label-only | 5,000 to 50,000 pcs* | 5 to 30* | n/a | 10th-of-ramadan, 6th-of-october, borg-el-arab, obour, sadat-city |
| ↳ Pails | `rigid-plastic/pail` | local | iml, screen, dry-offset | 5,000 to 50,000 pcs* | 5 to 30* | 25 to 80 / pail* | 10th-of-ramadan, 6th-of-october, borg-el-arab, obour, sadat-city |
| ↳ Jerrycans | `rigid-plastic/jerrycan` | local | label-only, screen | 5,000 to 50,000 pcs* | 5 to 30* | 35 to 100 / can* | 10th-of-ramadan, 6th-of-october, borg-el-arab, obour, sadat-city |
| **Cosmetic and pharma containers** | `cosmetic-pharma` | local | label-only, screen, hot-foil, offset-sheetfed, dry-offset | 1,000 to 10,000 pcs* | 10 to 45* | n/a | 10th-of-ramadan, 6th-of-october, obour, borg-el-arab |
| ↳ Cosmetic bottles (pump, mist, dropper) | `cosmetic-pharma/cosmetic-bottle` | imported | label-only, screen, hot-foil, offset-sheetfed, dry-offset | 1,000 to 10,000 pcs* | 10 to 45* | n/a | 10th-of-ramadan, 6th-of-october, obour, borg-el-arab |
| ↳ Cream jars | `cosmetic-pharma/cosmetic-jar` | imported | label-only, screen, hot-foil, offset-sheetfed, dry-offset | 1,000 to 10,000 pcs* | 10 to 45* | n/a | 10th-of-ramadan, 6th-of-october, obour, borg-el-arab |
| ↳ Pharma bottles (amber, HDPE) | `cosmetic-pharma/pharma-bottle` | local | label-only, screen, hot-foil, offset-sheetfed, dry-offset | 1,000 to 10,000 pcs* | 10 to 45* | n/a | 10th-of-ramadan, 6th-of-october, obour, borg-el-arab |
| ↳ Blisters | `cosmetic-pharma/blister` | imported | rotogravure, flexo-flexible | 1,000 to 10,000 pcs* | 10 to 45* | n/a | 10th-of-ramadan, 6th-of-october, obour, borg-el-arab |
| ↳ Squeeze tubes (laminated, plastic) | `cosmetic-pharma/squeeze-tube` | local | dry-offset, screen, hot-foil, flexo-label | 5,000 to 10,000 tubes* | 10 to 45* | 3 to 10 / tube* | 10th-of-ramadan, 6th-of-october, obour, borg-el-arab |
| ↳ Collapsible aluminium tubes | `cosmetic-pharma/aluminium-tube` | local | dry-offset | 10,000 to 20,000 tubes* | 10 to 45* | n/a | 10th-of-ramadan, 6th-of-october, obour, borg-el-arab |
| **Metal packaging** | `metal` | local | metal-litho, dry-offset, label-only | 5,000 to 100,000 pcs* | 21 to 60* | n/a | 10th-of-ramadan, greater-cairo, 6th-of-october |
| ↳ Beverage cans (2-piece aluminium) | `metal/beverage-can` | imported | label-only, dry-offset | 100,000 to 500,000 cans* | 30 to 90* | n/a | 10th-of-ramadan, greater-cairo, 6th-of-october |
| ↳ Food cans (3-piece tinplate) | `metal/food-can` | local | metal-litho, dry-offset, label-only | 5,000 to 100,000 pcs* | 21 to 60* | n/a | 10th-of-ramadan, greater-cairo, 6th-of-october |
| ↳ Tins (round, rectangular, hinged) | `metal/tin` | local | metal-litho, dry-offset, label-only | 3,000 to 10,000 tins* | 21 to 60* | 15 to 50 / tin* | 10th-of-ramadan, greater-cairo, 6th-of-october |
| ↳ Aerosol cans | `metal/aerosol` | rare | metal-litho, dry-offset, label-only | 5,000 to 100,000 pcs* | 21 to 60* | n/a | 10th-of-ramadan, greater-cairo, 6th-of-october |
| **Labels and sleeves** | `labels` | local | flexo-label, digital-toner, offset-sheetfed, rotogravure, hot-foil, screen | 1,000 to 10,000 labels* | 4 to 14* | 0.3 to 2.5 / label* | greater-cairo, 6th-of-october, 10th-of-ramadan, obour |
| ↳ Self-adhesive labels | `labels/self-adhesive` | local | flexo-label, digital-toner, offset-sheetfed, rotogravure, hot-foil, screen | 1,000 to 10,000 labels* | 4 to 14* | 0.3 to 2.5 / label* | greater-cairo, 6th-of-october, 10th-of-ramadan, obour |
| ↳ Wrap-around labels | `labels/wrap-label` | local | rotogravure, flexo-label | 1,000 to 10,000 labels* | 4 to 14* | 0.3 to 2.5 / label* | greater-cairo, 6th-of-october, 10th-of-ramadan, obour |

`*` estimate. "n/a" = no band: system-supplied formats, or no defensible public basis.

## Key Egypt findings

- **Corrugated is the deepest local supply.** It is about 53% of Egypt's paperboard packaging market (Mordor). Integrated plants cluster in 10th of Ramadan (e.g. Cepack Group); Greenliner started a recycled containerboard machine there in Nov 2025, which cuts some import dependence for fluting and testliner. Higher-grade kraft liners are still imported. FEFCO 02 and 04 (shipping, mailer, pizza) are easiest. FEFCO 06 (bliss) is rare.
- **Folding cartons:** offset printers in 10th of Ramadan, 6th of October, Obour and Greater Cairo; strong pharma carton base (EDA-controlled artwork). FBB for food and cosmetics is imported.
- **Flexible:** a strong rotogravure base (e.g. Arab Pack, Obour and Borg El Arab) and CI flexo in 6th of October. Gravure cylinders set the MOQ. Digital pouches exist but cost several times more per unit.
- **Glass:** local furnace supply (Middle East Glass Manufacturing, EGX: MEGM, Cairo) for food and beverage; premium cosmetic and perfume glass is imported.
- **PET/HDPE:** mature local supply (ACIP in Borg El Arab, Delta El Nile, Aquah group; Alpla took full control of Taba in 2025).
- **Tubes:** two long-standing local makers of aluminium and laminated tubes (TUBE since 1982; Tubal Egypt since 1981).
- **Blisters:** films and cold-form foil imported; local slitting and printing (e.g. MedPack).
- **Metal:** 3-piece tinplate food cans and tins are local (CairoPac/ASAT, Europack in 10th of Ramadan, El Gohary in Abou Rawash). **I found no public source for an operating 2-piece aluminium beverage can plant in Egypt in 2025 to 2026**, so `metal/beverage-can` is `imported`. Verify before relying on it. Aerosols are `rare`.
- **Liquid cartons:** Tetra Pak (two 6th of October sites per a 2015 release) and SIG (Juhayna fills SIG packs in 6th of October) supply under system contracts. UBC recycling started in 2024 to 2025 (Tetra Pak with Uniboard; SIG with Carta Misr and TileGreen). No Elopak operation found.
- **Molded fibre:** Huhtamaki Egypt (Sadat City) got a golden licence in Jan 2025 for a new molded fibre plant with Korra; recycled-fibre tray makers in 6th of October.
- **Paper bags:** automatic lines in 6th of October, multiwall sacks in Borg El Arab and Cairo, recycled-kraft bag makers in Alexandria. Bag kraft (80 to 110 gsm) is largely imported.

## Regulatory notes

> Not legal advice. Status `to-verify` means the decree text itself was not read; confirm with counsel and the authority.

### Food contact materials: NFSA Decision 17/2022

*National Food Safety Authority (NFSA) · scope: egypt · verified*

Binding technical rules for food contact materials and articles, in force since 19 Oct 2022. Any packaging touching food (bakery boxes, cups, pouches, bottles, cans) needs supplier declarations of compliance and migration tests; ask vendors for food-grade board/film certificates and low-migration inks on the food side. Market reports claim tighter migration limits since 2025; no newer decision text found.

Sources: [USDA FAS: NFSA issues technical requirements for food contact materials (Decision 17/2022)](https://www.fas.usda.gov/data/egypt-egypts-national-food-safety-authority-issued-technical-requirements-food-contact)

### Food labelling: Arabic label, ES 1546/2024, NFSA traceability

*NFSA / Egyptian Organization for Standardization and Quality (EOS) · scope: egypt · to-verify*

ES 1546 (2024 total revision, based on Codex CXS 1-1985 rev. 2018) sets the content of prepackaged food labels (name, ingredients, net quantity, dates, lot, producer). EOS lists it as not obligatory by itself; it is applied through NFSA decisions and import rules, which require Arabic text on the label. NFSA traceability rules require a lot/batch code. Leave a print-safe area for date and batch inkjet coding on every food pack.

Sources: [EOS catalogue: ES 1546 labelling of prepackaged foods (2024, based on CXS 1-1985 rev. 2018)](https://eos.org.eg/en/ICS/67?page=2) · [US Trade.gov Egypt Country Commercial Guide: labeling and marking requirements](https://www.trade.gov/country-commercial-guides/egypt-labeling-marking-requirements) · [USDA FAS: NFSA requirements for food traceability](https://www.fas.usda.gov/data/egypt-egypts-national-food-safety-authority-issued-requirements-food-traceability-0)

### Medicines: EDA artwork and leaflet approval

*Egyptian Drug Authority (EDA) · scope: egypt · verified*

Cartons, labels, blisters and leaflets for registered medicines follow EDA mock-up guidelines (v2.0, from 30 Mar 2022): colour mock-ups submitted before print, registration number, batch, manufacturing and expiry dates on the outer pack, Arabic patient leaflet with English SmPC. Artwork changes need EDA approval, so pharma print runs are locked to approved files; the designer must not let a buyer change approved text.

Sources: [EDA: guidelines for mock-up design of human pharmaceutical products](https://edaegypt.gov.eg/media/x3gfwst5/guidelines-for-mock-up-design-of-human-pharmaceutical-products-_compressed.pdf) · [EDA: medical inserts submission guidance (Arabic PIL, English SmPC)](https://edaegypt.gov.eg/media/ivlh0cha/medical-inserts-submission-guidance.pdf) · [EDA: Egyptian guidelines on medical leaflets of medicinal products for human use v3](https://www.edaegypt.gov.eg/media/30xfwmew/egyptian-guidelines-on-medical-leaflets-of-medicinal-products-for-human-use-ver3.pdf) · [EDA: e-labelling guidelines v9](https://edaegypt.gov.eg/media/jwzfv3hz/elabeling-guidelines-v9_.pdf)

### Cosmetics: EDA notification and Arabic labelling

*Egyptian Drug Authority (EDA) · scope: egypt · to-verify*

Cosmetics sold in Egypt are notified/registered with EDA; the label carries the product name, ingredients, net content, batch, expiry or PAO, producer/importer and Arabic text. Treat as to-verify per product class.

Sources: [US Trade.gov Egypt Country Commercial Guide: labeling and marking requirements](https://www.trade.gov/country-commercial-guides/egypt-labeling-marking-requirements)

### Egyptian Standards (ES) for packaging

*EOS · scope: egypt · to-verify*

Most packaging ES standards (corrugated board, glass containers, plastic containers) are voluntary unless a ministerial decree makes them mandatory. Ask vendors which ES or ISO tests they certify (ECT, BCT, burst for corrugated; ISO 9001 / FSSC 22000 / ISO 15378 for food and pharma plants).

Sources: [EOS catalogue: ES 1546 labelling of prepackaged foods (2024, based on CXS 1-1985 rev. 2018)](https://eos.org.eg/en/ICS/67?page=2)

### EPR: Waste Management Law 202/2020

*Ministry of Environment / WMRA · scope: egypt · verified*

Law 202/2020 sets producer responsibility. First application: PM Decree 662/2025, a fee of EGP 37.5/kg on single-use plastic bags sold locally from 3 Jun 2025. A packaging EPR scheme for priority materials was in preparation in Aug 2026 (industry consulted Oct 2025); no final decree found. Expect fees per kg on plastic and multilayer packaging first.

Sources: [DLA Piper: Extended producer responsibility in Egypt](https://www.dlapiper.com/en/insights/publications/2026/02/extended-producer-responsibility-in-egypt) · [Egyptian Streets: fees on producers of single-use plastic bags (EGP 37.5/kg from 3 Jun 2025)](https://egyptianstreets.com/2025/03/16/egypt-introduces-fees-on-producers-to-reduce-single-use-plastic-bags/) · [Capmad: Egypt extends EPR scheme to packaging waste](https://www.capmad.com/post/extended-producer-responsibility-egypt-extends-scheme-to-packaging-waste)

### VAT 14% (Law 67/2016 as amended)

*Egyptian Tax Authority (ETA) · scope: egypt · verified*

Standard rate 14% since 1 Jul 2017; amended by Law 157/2025 and Law 149/2026 (exempt schedule). No packaging exemption found, so printed packaging is treated as standard-rated: show prices ex-VAT with VAT separate, and issue ETA e-invoices to B2B buyers. Packaging bundled with an exempt food product may follow the product; ask an accountant.

Sources: [Andersen Egypt: VAT in Egypt (Law 67/2016, 14% since 1 Jul 2017)](https://eg.andersen.com/vat-in-egypt/) · [EY: Egypt introduces significant VAT updates (Law 157/2025)](https://www.ey.com/en_gl/technical/tax-alerts/egypt-introduces-significant-vat-updates-on-certain-goods-and-services) · [LookupTax: VAT exempt schedule, Law 149/2026](https://lookuptax.com/tax-changes/egypt/vat-exempt-schedule-law-149-2026)

### Recycling and material marks

*None mandatory found in Egypt · scope: global · to-verify*

No mandatory Egyptian recycling mark found. Use voluntary marks: resin identification codes (ASTM D7611, 1 PET to 7 Other) on plastics, ISO 14021 Mobius loop with a claim only when true, FSC/PEFC only with a chain-of-custody vendor, and Tidy Man. Export to the EU will need PPWR harmonised labels later.

Sources: [Bureau Veritas: labelling under Regulation (EU) 2025/40 (PPWR)](https://www.cps.bureauveritas.com/newsroom/labelling-regulation-eu-202540-packaging-and-packaging-waste-ppwr)

### EU Packaging and Packaging Waste Regulation (EU) 2025/40

*European Union · scope: eu · verified*

In force 11 Feb 2025, applies from 12 Aug 2026 (replaces Directive 94/62/EC). Traceability labelling (manufacturer, identifier) applies now; harmonised sorting labels from 12 Aug 2028 at the earliest, tied to implementing acts. Recyclability grades, recycled-content targets for plastics and reuse targets follow. Food contact still governed by Reg. 1935/2004 and 10/2011 (plastics).

Sources: [Packaging Gateway: new EU-wide packaging rules take effect in August 2026](https://www.packaging-gateway.com/news/new-eu-wide-packaging-rules-take-effect-in-august-2026/) · [Bureau Veritas: labelling under Regulation (EU) 2025/40 (PPWR)](https://www.cps.bureauveritas.com/newsroom/labelling-regulation-eu-202540-packaging-and-packaging-waste-ppwr)

### GCC food labelling: GSO 9 (Arabic required)

*GSO / SFDA (KSA) · scope: gcc · verified*

SFDA.FD/GSO 9 requires Arabic on prepackaged food labels; other languages may sit alongside and must match the Arabic. KSA added produce packaging rules in Sept 2025 (food-grade, recyclable, name, net weight, pack date, origin, supplier). Designs sold into KSA and UAE should reserve an Arabic panel at least equal to the English one.

Sources: [SFDA FAQ: SFDA.FD/GSO 9 labelling of prepackaged food (Arabic required)](https://www.sfda.gov.sa/en/faq?page=29&tags=46) · [Gulf News: Saudi rules on packaging and labelling of fruit and vegetables (Sept 2025)](https://gulfnews.com/world/gulf/saudi/saudi-arabia-issues-new-rules-on-packaging-and-labeling-of-fruits-and-vegetables-1.500276079)

### US food contact substances (21 CFR 174 to 186) and FPLA labelling

*US FDA / FTC · scope: us · to-verify*

Food contact materials must be GRAS, prior-sanctioned, regulated under 21 CFR 174 to 186 or covered by a food contact notification. Labels follow FPLA/21 CFR 101 (English, net quantity in US and metric units). Several states restrict PFAS in food packaging.

### What this means for the designer (standards tie-in)

| Rule | Standard / authority | Designer behaviour |
|---|---|---|
| Food contact | NFSA Decision 17/2022; EU 1935/2004; US 21 CFR 174 to 186 | Tag a material "food-safe" only when the vendor has a declaration of compliance. Ask for low-migration inks on food packs. |
| Arabic label | ES 1546/2024 + NFSA import rules; GSO 9 for GCC | Reserve an Arabic panel at least equal to the English one; warn if Arabic text is missing on food templates. |
| Lot and dates | NFSA traceability; EDA for medicines | Reserve an unprinted area for inkjet date/batch coding. |
| Pharma artwork | EDA mock-up guideline v2.0 (2022) | Lock approved text; pharma orders need the EDA-approved file. |
| EPR | Law 202/2020; PM Decree 662/2025 (bags, EGP 37.5/kg) | Show a note on poly mailers and carrier bags; prefer mono-material films. |
| VAT | Law 67/2016 as amended (14%) | Prices ex-VAT with VAT separate (already `VAT_RATE` in `src/types/common.ts`). |
| Recycling marks | None mandatory in Egypt; ASTM D7611 resin codes, ISO 14021 | Offer resin-code and Mobius icons; never add a recyclable claim by default. |
| EU export | PPWR (EU) 2025/40, applies 12 Aug 2026; harmonised labels from Aug 2028 at the earliest | Flag "EU-bound" designs for traceability marking now and sorting labels later. |

## Worldwide availability by family

| Family | MENA | GCC | EU | US | Asia |
|---|---|---|---|---|---|
| Corrugated board | common: Made in every MENA market; Egypt, Morocco and Turkey export cartons. | common: Dense local production in KSA and UAE (Napco, Middle East Paper); higher unit cost than Egypt. | common: Mature; FEFCO standard originates here; PPWR recyclability grades from 2028. | common: Mature; quoted in inches, ECT/Mullen ratings; low-MOQ web shops (Packlane, Arka). | common: China and India dominate low-cost export production; digital short runs common. |
| Folding cartons | common: Common everywhere; Egypt is a regional carton exporter for pharma and FMCG. | common: Local printers in KSA/UAE; premium cosmetics often imported from EU/China. | common: Mature (ECMA); low-migration inks standard for food. | common: Mature; many web-to-print shops at low MOQ. | common: China dominant for premium decoration at volume. |
| Rigid set-up boxes | common: Workshop production in Egypt, Lebanon, Turkey; strong Ramadan/Eid seasonality. | available: Mostly imported from China/Turkey or made by UAE workshops. | common: Automated rigid-box lines; premium spirits and cosmetics. | common: Mostly imported from Asia; domestic for luxury short runs. | common: China (Dongguan, Shenzhen) is the global supplier. |
| Paper tubes and composite cans | available: Industrial cores widely made; printed retail tubes niche. | available: Mostly imported for retail; local cores. | common: Common (composite cans for snacks, tea, spirits). | common: Common. | common: China is the main export source for printed tubes. |
| Pallet boxes and bulk bins | available: Produced by large plants; heavy-duty board partly imported. | common: Available locally. | common: Common. | common: Common. | common: Common. |
| Envelopes and paper mailers | common: Common. | common: Common. | common: Common; paper mailers replacing poly under PPWR. | common: Common. | common: Common. |
| Food service packaging | common: Large local supply; cloud kitchens drive demand. | common: Local converters plus heavy imports; single-use plastic restrictions in UAE. | common: Single-Use Plastics Directive pushes paper and fibre; PFAS bans. | common: Mature; state PFAS bans. | common: China, Vietnam, India export at scale. |
| Flexible packaging | common: Strong local gravure base in Egypt and Turkey. | common: Local converters (Hotpack, Huhtamaki UAE) plus imports. | common: Push to mono-material recyclable films under PPWR. | common: Mature; digital pouch services at low MOQ. | common: China and India are the global low-MOQ pouch sources. |
| Glass containers | common: Egypt, Turkey (Şişecam) supply the region. | common: Local furnaces plus imports from Egypt/Turkey/China. | common: Mature (Verallia, Vetropack, Estal); high-end decoration. | common: Mature (O-I, Anchor). | common: China is the main export source for cosmetic glass. |
| Rigid plastic containers | common: Strong local supply. | common: Strong local supply. | common: Recycled-content targets (PPWR, SUP). | common: Mature. | common: Mature. |
| Cosmetic and pharma containers | common: Egypt has a large pharma base, so tubes and blisters are local. | common: Mostly imported components; filling local. | common: Mature; premium components. | common: Mature. | common: China dominates cosmetic components; India dominates pharma foil. |
| Metal packaging | common: Tinplate local; aluminium beverage cans from regional plants. | common: Crown and Ball-type 2-piece plants in KSA and UAE. | common: Mature. | common: Mature. | common: Mature. |
| Labels and sleeves | common: Common. | common: Common. | common: Common; wash-off labels for PET recycling. | common: Common. | common: Common. |


## Open questions (validate with vendors)

1. Real EGP rate cards per family (start with 0201, 0427, tuck carton, stand-up pouch, roll label, cake box).
2. Whether any 2-piece beverage can line operates in Egypt (2026).
3. Whether the PM Decree 662/2025 bag fee covers courier poly mailers.
4. The final packaging EPR decree (in preparation as of Aug 2026): materials, fee per kg, start date.
5. Which ES packaging standards are mandatory by ministerial decree.

## Sources

- `usda-nfsa-fcm-2022`: [USDA FAS: NFSA issues technical requirements for food contact materials (Decision 17/2022)](https://www.fas.usda.gov/data/egypt-egypts-national-food-safety-authority-issued-technical-requirements-food-contact) (2022)
- `usda-nfsa-traceability`: [USDA FAS: NFSA requirements for food traceability](https://www.fas.usda.gov/data/egypt-egypts-national-food-safety-authority-issued-requirements-food-traceability-0) (2023)
- `eos-es1546`: [EOS catalogue: ES 1546 labelling of prepackaged foods (2024, based on CXS 1-1985 rev. 2018)](https://eos.org.eg/en/ICS/67?page=2) (2024)
- `trade-gov-egypt-labeling`: [US Trade.gov Egypt Country Commercial Guide: labeling and marking requirements](https://www.trade.gov/country-commercial-guides/egypt-labeling-marking-requirements) (2025)
- `eda-mockup`: [EDA: guidelines for mock-up design of human pharmaceutical products](https://edaegypt.gov.eg/media/x3gfwst5/guidelines-for-mock-up-design-of-human-pharmaceutical-products-_compressed.pdf) (2022)
- `eda-inserts`: [EDA: medical inserts submission guidance (Arabic PIL, English SmPC)](https://edaegypt.gov.eg/media/ivlh0cha/medical-inserts-submission-guidance.pdf) (undated)
- `eda-leaflets`: [EDA: Egyptian guidelines on medical leaflets of medicinal products for human use v3](https://www.edaegypt.gov.eg/media/30xfwmew/egyptian-guidelines-on-medical-leaflets-of-medicinal-products-for-human-use-ver3.pdf) (undated)
- `eda-elabeling`: [EDA: e-labelling guidelines v9](https://edaegypt.gov.eg/media/jwzfv3hz/elabeling-guidelines-v9_.pdf) (undated)
- `dla-epr-egypt`: [DLA Piper: Extended producer responsibility in Egypt](https://www.dlapiper.com/en/insights/publications/2026/02/extended-producer-responsibility-in-egypt) (2026)
- `egyptianstreets-bag-fee`: [Egyptian Streets: fees on producers of single-use plastic bags (EGP 37.5/kg from 3 Jun 2025)](https://egyptianstreets.com/2025/03/16/egypt-introduces-fees-on-producers-to-reduce-single-use-plastic-bags/) (2025)
- `capmad-epr-packaging`: [Capmad: Egypt extends EPR scheme to packaging waste](https://www.capmad.com/post/extended-producer-responsibility-egypt-extends-scheme-to-packaging-waste) (2026)
- `ey-vat-2025`: [EY: Egypt introduces significant VAT updates (Law 157/2025)](https://www.ey.com/en_gl/technical/tax-alerts/egypt-introduces-significant-vat-updates-on-certain-goods-and-services) (2025)
- `lookuptax-vat-149-2026`: [LookupTax: VAT exempt schedule, Law 149/2026](https://lookuptax.com/tax-changes/egypt/vat-exempt-schedule-law-149-2026) (2026)
- `andersen-vat`: [Andersen Egypt: VAT in Egypt (Law 67/2016, 14% since 1 Jul 2017)](https://eg.andersen.com/vat-in-egypt/) (2025)
- `ppwr-packaging-gateway`: [Packaging Gateway: new EU-wide packaging rules take effect in August 2026](https://www.packaging-gateway.com/news/new-eu-wide-packaging-rules-take-effect-in-august-2026/) (2026)
- `ppwr-bv-labelling`: [Bureau Veritas: labelling under Regulation (EU) 2025/40 (PPWR)](https://www.cps.bureauveritas.com/newsroom/labelling-regulation-eu-202540-packaging-and-packaging-waste-ppwr) (2025)
- `sfda-gso9`: [SFDA FAQ: SFDA.FD/GSO 9 labelling of prepackaged food (Arabic required)](https://www.sfda.gov.sa/en/faq?page=29&tags=46) (2025)
- `ksa-produce-packaging-2025`: [Gulf News: Saudi rules on packaging and labelling of fruit and vegetables (Sept 2025)](https://gulfnews.com/world/gulf/saudi/saudi-arabia-issues-new-rules-on-packaging-and-labeling-of-fruits-and-vegetables-1.500276079) (2025)
- `mordor-egypt-paperboard`: [Mordor Intelligence: Egypt paperboard packaging market (corrugated 53% share)](https://www.mordorintelligence.com/industry-reports/egypt-paperboard-packaging-market2) (2025)
- `greenliner-pm1`: [Paperfirst: Greenliner starts up PM1 containerboard machine, 10th of Ramadan](https://www.paperfirst.info/?p=28810) (2025)
- `hsa-cepack`: [HSA Group: Cepack Group (corrugated, 10th of Ramadan)](https://hsagroup.com/explore-hsa-business/our-companies/industrial-companies/cepack-group.aspx) (2025)
- `yp-corrugated`: [Yellow Pages Egypt: corrugated carton factory listings](https://yellowpages.com.eg/en/keyword/corrugated-carton-factory) (2025)
- `yp-flexo`: [Yellow Pages Egypt: flexo / plastic bag printing listings](https://yellowpages.com.eg/en/keyword/plastic-bag-printing) (2025)
- `findinegypt-yoropack`: [FindInEgypt: Yoro Pack (lids, rolls, Obour)](https://findinegypt.com/c/yoro-pack-for-printing-packaging-solutions-346443) (undated)
- `yp-paper-bag`: [Yellow Pages Egypt: paper bag manufacturers](https://yellowpages.com.eg/en/keyword/paper-bag) (2025)
- `leeline-paper-bags-eg`: [Leeline: paper bag manufacturers in Egypt (directory)](https://www.leelinebags.com/paper-bags-manufacturers-in-egypt/) (2025)
- `huhtamaki-golden-license`: [Business Today Egypt: golden licence for Huhtamaki Egypt molded fibre plant (Sadat City)](https://www.businesstodayegypt.com/amp/1/5889/Egyptian-Cabinet-approves-golden-license-for-Huhtamaki-Egypt-to-establish) (2025)
- `zawya-huhtamaki-korra`: [Zawya: Huhtamaki Egypt with Korra, Sadat City molded fibre facility](https://www.zawya.com/en/press-release/companies-news/huhtamaki-egypt-secures-golden-license-to-establish-the-middle-easts-largest-sustainable-packaging-facility-in-partnership-with-korra-in-sadat-city-lhefi1j4) (2025)
- `juhayna-sig`: [Packaging Insights: Juhayna fills in SIG Combibloc cartons, 6th of October](https://www.packaginginsights.com/news/juhayna-beverage-cartons-and-filling-technology-from-sig-combibloc.html) (undated)
- `sig-recycling-egypt`: [FoodBev: SIG sets up Egypt's first beverage-carton recycling system](https://www.foodbev.com/news/sig-partners-with-local-firms-to-establish-egypt-s-first-comprehensive-recycling-system-for-beverage) (2025)
- `tetrapak-uniboard`: [Zawya: Tetra Pak and Uniboard beverage carton recycling project](https://www.zawya.com/en/projects/industry/tetra-pak-to-partner-with-uniboard-for-beverage-carton-recycling-project-in-egypt-hkltgo7q) (2024)
- `zawya-tetrapak-2015`: [Zawya: Tetra Pak owns two factories in 6th of October (2015 release)](https://www.zawya.com/en/press-release/during-gulfood-manufacturing-2015-domty-the-biggest-white-cheese-producer-in-the-world-in-tetra-pak-packages-ttqytava) (2015)
- `zawya-meg-2025`: [Zawya: Middle East Glass Manufacturing 2025 profits](https://www.zawya.com/en/capital-markets/equities/egypt-middle-east-glass-manufacturings-profits-hike-550-yoy-in-2025-t7lea35u) (2026)
- `stockanalysis-meg`: [StockAnalysis: Middle East Glass Manufacturing (EGX: MEGM) profile](https://stockanalysis.com/quote/egx/MEGM/company) (2026)
- `petpla-egypt-2025`: [PETplanet Insider 04/2025: Egypt PET preform and bottle makers (ACIP Borg El Arab, Delta El Nile, Aquah)](https://petpla.net/assets/ebooks/PP202504/10/) (2025)
- `plasticsnews-alpla-taba`: [Plastics News: Alpla fully acquires Egyptian bottle maker Taba](https://www.plasticsnews.com/news/alpla-fully-acquires-egyptian-bottle-manufacturer-taba/) (2025)
- `yp-can`: [Yellow Pages Egypt: can manufacturers (CairoPac, Europack 10th of Ramadan, El Gohary Abou Rawash)](https://yellowpages.com.eg/en/map-category/can-manufacturers) (2025)
- `yp-tin-cans`: [Yellow Pages Egypt: tin cans](https://yellowpages.com.eg/en/keyword/tin-cans) (2025)
- `cphi-tube-egypt`: [CPHI Online: The National Company for Manufacturing Collapsible Tubes (TUBE), Egypt](https://www.cphi-online.com/company/the-national-company-for-manufacturing-collapsible/) (2025)
- `maghreb-medpack`: [Maghreb Pharma: MedPack Egypt (blister films and foil, slitting and printing)](https://www.maghrebpharma.com/en/exhibitors/medpack-egypt-246973/) (2025)
- `blog-blister-egypt`: [PackTalk: current challenges in pharmaceutical blister packaging in Egypt (blog, non-authoritative)](https://packtalkbywaseem.blogspot.com/2025/12/current-challenges-in-pharmaceutical.html) (2025)
- `yp-cosmetic-pack`: [Yellow Pages Egypt: cosmetics packaging manufacturers](https://yellowpages.com.eg/en/keyword/manufacturing-cosmetics-packaging) (2025)
- `packaging-costs-egypt-45`: [Packaging Connections: packaging costs in Egypt have risen around 45%](https://www.packagingconnections.com/v3/news/packaging-costs-egypt-have-risen-around-45.htm) (undated)
- `crown-10k-2025`: [Crown Holdings FY2025 10-K (European Beverage segment covers MENA)](https://www.sec.gov/Archives/edgar/data/1219601/000162828026012904/cck-20251231.htm) (2026)
- `ubuy-mailer-egp`: [Ubuy Egypt: imported 45-pack corrugated mailers listed at EGP 2,087 (retail import reference)](https://www.ubuy.com.eg/en/product/PRUDVQKNO-45-pack-shipping-boxes-9x6x2-inches-colorful-corrugated-cardboard-mailer-box-for-small-business-mailing-packing-literature-gift) (2026)
- `repo-research-report`: [docs/research-report.md (this repo): Egypt market, suppliers, legal](research-report.md) (2026)
