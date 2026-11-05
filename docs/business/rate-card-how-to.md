# Rate Card: How to Fill `rate-card-template.csv`

The rate card is the vendor's **buy price** (what Elba pays the vendor), ex-VAT. The pricing engine in `src/lib/pricing` adds platform margin, delivery and 14% VAT on top, and shows the buyer a quote valid for 72 hours. One CSV row = one `RateCard` row in `prisma/schema.prisma` = one `PricingRateCard` in `src/lib/pricing/types.ts`, unique per **vendor + structure + material**.

> The engine factors quoted below are read from `src/lib/pricing/config.ts` (`DEFAULT_PRICING_CONFIG`) as of 5 Nov 2026. The pricing owner may tune them; if they change, re-run the normalisation in section 3 before importing.

---

## 1. Column reference

| CSV column | Engine / DB field | Unit | How to fill |
|---|---|---|---|
| `vendor_slug` | `Vendor.slug` → `vendorId` | text | Lower-case slug of the vendor profile, e.g. `nile-pack`. Rows starting with `EXAMPLE-` are demo rows from `prisma/seed.ts`; delete them. |
| `structure_code` | `Structure.code` → `structureCode` | code | One of `FEFCO_0427`, `FEFCO_0201`, `ECMA_RTE`, `ECMA_STE`, `PIZZA`, `SLEEVE` (`src/types/structure.ts`). |
| `material_code` | `Material.code` → `materialId` | code | One of `E_FLUTE_KRAFT`, `E_FLUTE_WHITE`, `B_FLUTE_KRAFT` (corrugated structures only) or `SBS_300`, `SBS_350` (folding-carton structures only). |
| `reference_area_m2` | `referenceAreaM2` | m² | Flat **blank** area (the rectangle the vendor cuts one box from, including trim) for the job the tier prices were quoted for. See section 2. |
| `tier_100_unit_piasters` ... `tier_2000_unit_piasters` | `qtyTiers: [{ minQty, unitPiasters }]` | piasters per unit | Unit buy price at each of the 5 quantity tiers (`QTY_TIERS` = 100, 250, 500, 1000, 2000), **normalised to 4-colour CMYK, one side** (section 3). 1 EGP = 100 piasters. Prices must not rise as quantity rises. |
| `setup_piasters` | `setupPiasters` | piasters per job | One-off setup: plates + make-ready, normalised to 4 colours. |
| `die_cost_piasters` | `dieCostPiasters` | piasters per job | Price of a **new** cutting die for this structure at the reference size. The engine waives it when the size matches a standard size (within 2 mm) or a die the vendor owns. Use `0` for RSC if made on a slotter with no die. |
| `print_sides_surcharge_pct` | `printSidesSurchargePct` | % | Extra % on the unit price when the buyer prints inside too (`printSides: BOTH`). Example: `35` = +35%. |
| `finish_MATTE_LAMINATION_unit_piasters` | `finishSurcharges.MATTE_LAMINATION` | piasters per unit | Extra unit buy price for matte lamination at the reference area. Leave **blank** if the vendor does not offer it (blank means "not offered", not "free"). |
| `finish_GLOSS_LAMINATION_unit_piasters` | `finishSurcharges.GLOSS_LAMINATION` | piasters per unit | As above. |
| `finish_SPOT_UV_unit_piasters` | `finishSurcharges.SPOT_UV` | piasters per unit | As above. Finish **setup** costs come from the platform `Finish` table, not from this row. |
| `lead_time_days` | `leadTimeDays` | working days | From approved file + payment to packed boxes, **with an existing die**. The engine adds 3 days when a new die is needed and subtracts 1 for digital runs. |
| `active` | `active` | true/false | `false` keeps the row but hides it from quotes. |
| `valid_from` | `validFrom` | ISO date | Date the vendor's prices were collected. Drives which FX/board index applies later (section 5). |
| `colours_quoted` | not imported | 1 to 6 | How many colours the vendor actually quoted. Audit only. |
| `source_quote_ref` | not imported | text | Link or file name of the vendor's quote (WhatsApp screenshot, PDF). Audit only. |
| `reference_job` | not imported | R1 to R5 | Which reference job from `reference-jobs-rfq.md`. Audit only. |
| `notes` | not imported | text | Anything unusual. Avoid commas or wrap the cell in double quotes. |

**Money rule:** every amount is an **integer number of piasters**. EGP 12.40 → `1240`. EGP 1,800 → `180000`. Never enter decimals or thousands separators in money columns.

## 2. Getting `reference_area_m2` right

The engine scales the **board share** of the unit price (60%, `boardShare: 0.6`) by `blank area of the buyer's box / reference_area_m2`, clamped between 0.25 and 6. So the tier prices and the reference area must describe the same box.

Easiest method: set `reference_area_m2` to the blank area of the reference job you asked the vendor to price.

1. Open the designer on the dev site with the reference job's structure and inner size; the dieline engine (`src/lib/dieline`) reports the blank size.
2. Or ask the vendor for the blank (sheet) size they cut each box from: `width mm x height mm / 1,000,000`.
3. If neither is available, estimate with the engine's fallback: `2 x (L x W + L x H + W x H) / 1,000,000 x factor`, factor = 2.44 (mailer), 1.38 (RSC), 2.0 (RTE), 1.75 (STE), 1.72 (pizza), 0.88 (sleeve).

Example R1 (mailer 250 x 200 x 80 mm): surface = 2 x (50,000 + 20,000 + 16,000) = 172,000 mm² = 0.172 m²; x 2.44 = **0.42 m²**.

## 3. Normalising vendor quotes

Vendors quote the job as asked (R1 is 1 colour, R3 and R4 are 2 colours). The engine expects rate cards **quoted for 4-colour CMYK, one side, no finish**, and applies colour factors itself:

| Colours | Unit factor (`colourUnitFactor`) | Setup factor (`colourSetupFactor`) |
|---|---|---|
| 1 | 0.85 | 0.40 |
| 2 | 0.90 | 0.60 |
| 3 | 0.95 | 0.80 |
| 4 | 1.00 | 1.00 |
| 5 | 1.08 | 1.25 |
| 6 | 1.15 | 1.50 |

```
tier_unit_piasters = round(vendor_unit_EGP x 100 / unit_factor[colours_quoted])
setup_piasters     = round(vendor_setup_EGP x 100 / setup_factor[colours_quoted])
```

Worked example (R1, 1 colour): vendor quotes EGP 15.00 per box at 250 and EGP 600 setup.
`tier_250 = 1500 / 0.85 = 1765`, `setup = 60000 / 0.40 = 150000`.

Cautions:
- Dividing a 1-colour setup by 0.40 can overstate the 4-colour setup. **Best practice: ask every vendor for a 4-colour price as well** and use it directly; use the formula only when you have nothing else.
- Remove finishes from the unit price and put them in the finish columns (R2: ask "with and without matte lamination").
- Remove delivery from the unit price. Delivery is priced by the engine from courier zone rates (`shipping.zones` in config).
- Remove the die from the unit price if the vendor amortised it; put it in `die_cost_piasters`.
- **Digital-only vendors:** the engine treats the rate card as the conventional (offset/flexo) price and adds a 20% digital premium (`digital.unitPremium: 1.2`) up to 1,000 units for vendors with `digitalShortRun`. For a digital-only shop enter `digital quote / 1.2` and tell the pricing owner, so the vendor's capabilities are set correctly.
- Fill missing tiers by asking the vendor. Do not invent them: the engine interpolates between tiers in log(quantity), so a bad tier distorts every nearby quantity.

## 4. Vendor-level fields (not in this CSV)

Enter these on the vendor profile (`Vendor` model, admin area). They change which rate cards are used:

| Field | Where | Effect on price |
|---|---|---|
| `minOrderQty` | `Vendor.minOrderQty` | Vendor is skipped for smaller quantities |
| `capabilities.structures / materials / finishes` | `Vendor.capabilities` | Vendor only quoted for what it can make |
| `capabilities.maxColors` | `Vendor.capabilities` | Vendor skipped above this colour count |
| `capabilities.digitalShortRun` | `Vendor.capabilities` | Enables digital pricing up to 1,000 units |
| `city` | `Vendor.city` | Origin delivery zone; other zones cost +15% and +1 day |
| `status`, `verified` | `Vendor` | Only `ACTIVE` vendors are quoted |
| Owned dies (structure + inner L x W x H) | `ownedDies` in the pricing data | Waives `die_cost_piasters` and the 3 extra die days for those sizes |
| `rating`, `onTimePct` | `Vendor` | Weight 25% in "Best match" ranking (price 50%, speed 25%) |

Record owned dies from the visit checklist (section 4) as: `vendor_slug, structure_code, L, W, H` (inner mm). Sizes within 2 mm of a catalog standard preset are already treated as standard for every vendor of that structure.

## 5. Keeping prices current (EGP and board moves)

- Do **not** edit every rate card when board prices or the EGP move. The engine multiplies the board share by a weekly index (`PRICE_INDEX_TABLE` in `src/lib/pricing/config.ts`: an `fx` factor plus a per-material `board` factor). Ops proposes a new index row every week (or when a mill announces a price change); the pricing owner or admin applies it.
- Re-collect full vendor quotes at least every 6 months, or when the index has moved more than 10% since `valid_from` [ASSUMPTION].
- After a re-quote, set the index back to baseline for that vendor's new `valid_from` date (talk to the pricing owner: the index is global today).

## 6. Checklist before import

- [ ] No `EXAMPLE-` rows left.
- [ ] Every `vendor_slug` exists; every structure/material pair is valid for the family (corrugated vs SBS).
- [ ] Only one row per vendor + structure + material.
- [ ] Money columns are positive integers; tier prices are flat or falling from 100 to 2,000.
- [ ] Finish columns blank where the vendor does not offer the finish.
- [ ] `reference_area_m2` > 0 and matches the quoted job.
- [ ] Margin test from `reference-jobs-rfq.md` section 4 passes for at least 3 vendors per launch structure.
- [ ] Vendor quote files saved and linked in `source_quote_ref` (needed for disputes and audits).
- [ ] The rate card is **confidential**: vendors must never see each other's prices, and buy prices never reach buyers (the engine strips `OfferInternal` before sending offers).

There is no CSV importer in the app yet. Until the admin rate-card editor supports upload, ops sends the checked CSV to the admin/pricing owner, who loads it through the admin editor or a seed script.
