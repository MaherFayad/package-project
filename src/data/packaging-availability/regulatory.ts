import type { RegulatoryNote } from "./types";

/**
 * Regulatory notes referenced by AVAILABILITY entries. Not legal advice: confirm with Egyptian
 * counsel and the authority before relying on any of these (status "to-verify" means the
 * decree text itself was not read).
 */
export const REGULATORY: Record<string, RegulatoryNote> = {
  "eg-nfsa-fcm": {
    id: "eg-nfsa-fcm",
    title: "Food contact materials: NFSA Decision 17/2022",
    authority: "National Food Safety Authority (NFSA)",
    scope: "egypt",
    summary:
      "Binding technical rules for food contact materials and articles, in force since 19 Oct 2022. Any packaging touching food (bakery boxes, cups, pouches, bottles, cans) needs supplier declarations of compliance and migration tests; ask vendors for food-grade board/film certificates and low-migration inks on the food side. Market reports claim tighter migration limits since 2025; no newer decision text found.",
    status: "verified",
    sources: ["usda-nfsa-fcm-2022"],
  },
  "eg-food-labelling": {
    id: "eg-food-labelling",
    title: "Food labelling: Arabic label, ES 1546/2024, NFSA traceability",
    authority: "NFSA / Egyptian Organization for Standardization and Quality (EOS)",
    scope: "egypt",
    summary:
      "ES 1546 (2024 total revision, based on Codex CXS 1-1985 rev. 2018) sets the content of prepackaged food labels (name, ingredients, net quantity, dates, lot, producer). EOS lists it as not obligatory by itself; it is applied through NFSA decisions and import rules, which require Arabic text on the label. NFSA traceability rules require a lot/batch code. Leave a print-safe area for date and batch inkjet coding on every food pack.",
    status: "to-verify",
    sources: ["eos-es1546", "trade-gov-egypt-labeling", "usda-nfsa-traceability"],
  },
  "eg-eda-pharma": {
    id: "eg-eda-pharma",
    title: "Medicines: EDA artwork and leaflet approval",
    authority: "Egyptian Drug Authority (EDA)",
    scope: "egypt",
    summary:
      "Cartons, labels, blisters and leaflets for registered medicines follow EDA mock-up guidelines (v2.0, from 30 Mar 2022): colour mock-ups submitted before print, registration number, batch, manufacturing and expiry dates on the outer pack, Arabic patient leaflet with English SmPC. Artwork changes need EDA approval, so pharma print runs are locked to approved files; the designer must not let a buyer change approved text.",
    status: "verified",
    sources: ["eda-mockup", "eda-inserts", "eda-leaflets", "eda-elabeling"],
  },
  "eg-eda-cosmetics": {
    id: "eg-eda-cosmetics",
    title: "Cosmetics: EDA notification and Arabic labelling",
    authority: "Egyptian Drug Authority (EDA)",
    scope: "egypt",
    summary:
      "Cosmetics sold in Egypt are notified/registered with EDA; the label carries the product name, ingredients, net content, batch, expiry or PAO, producer/importer and Arabic text. Treat as to-verify per product class.",
    status: "to-verify",
    sources: ["trade-gov-egypt-labeling"],
  },
  "eg-eos-standards": {
    id: "eg-eos-standards",
    title: "Egyptian Standards (ES) for packaging",
    authority: "EOS",
    scope: "egypt",
    summary:
      "Most packaging ES standards (corrugated board, glass containers, plastic containers) are voluntary unless a ministerial decree makes them mandatory. Ask vendors which ES or ISO tests they certify (ECT, BCT, burst for corrugated; ISO 9001 / FSSC 22000 / ISO 15378 for food and pharma plants).",
    status: "to-verify",
    sources: ["eos-es1546"],
  },
  "eg-epr": {
    id: "eg-epr",
    title: "EPR: Waste Management Law 202/2020",
    authority: "Ministry of Environment / WMRA",
    scope: "egypt",
    summary:
      "Law 202/2020 sets producer responsibility. First application: PM Decree 662/2025, a fee of EGP 37.5/kg on single-use plastic bags sold locally from 3 Jun 2025. A packaging EPR scheme for priority materials was in preparation in Aug 2026 (industry consulted Oct 2025); no final decree found. Expect fees per kg on plastic and multilayer packaging first.",
    status: "verified",
    sources: ["dla-epr-egypt", "egyptianstreets-bag-fee", "capmad-epr-packaging"],
  },
  "eg-vat": {
    id: "eg-vat",
    title: "VAT 14% (Law 67/2016 as amended)",
    authority: "Egyptian Tax Authority (ETA)",
    scope: "egypt",
    summary:
      "Standard rate 14% since 1 Jul 2017; amended by Law 157/2025 and Law 149/2026 (exempt schedule). No packaging exemption found, so printed packaging is treated as standard-rated: show prices ex-VAT with VAT separate, and issue ETA e-invoices to B2B buyers. Packaging bundled with an exempt food product may follow the product; ask an accountant.",
    status: "verified",
    sources: ["andersen-vat", "ey-vat-2025", "lookuptax-vat-149-2026"],
  },
  "eg-recycling-marks": {
    id: "eg-recycling-marks",
    title: "Recycling and material marks",
    authority: "None mandatory found in Egypt",
    scope: "global",
    summary:
      "No mandatory Egyptian recycling mark found. Use voluntary marks: resin identification codes (ASTM D7611, 1 PET to 7 Other) on plastics, ISO 14021 Mobius loop with a claim only when true, FSC/PEFC only with a chain-of-custody vendor, and Tidy Man. Export to the EU will need PPWR harmonised labels later.",
    status: "to-verify",
    sources: ["ppwr-bv-labelling"],
  },
  "eu-ppwr": {
    id: "eu-ppwr",
    title: "EU Packaging and Packaging Waste Regulation (EU) 2025/40",
    authority: "European Union",
    scope: "eu",
    summary:
      "In force 11 Feb 2025, applies from 12 Aug 2026 (replaces Directive 94/62/EC). Traceability labelling (manufacturer, identifier) applies now; harmonised sorting labels from 12 Aug 2028 at the earliest, tied to implementing acts. Recyclability grades, recycled-content targets for plastics and reuse targets follow. Food contact still governed by Reg. 1935/2004 and 10/2011 (plastics).",
    status: "verified",
    sources: ["ppwr-packaging-gateway", "ppwr-bv-labelling"],
  },
  "gcc-labelling": {
    id: "gcc-labelling",
    title: "GCC food labelling: GSO 9 (Arabic required)",
    authority: "GSO / SFDA (KSA)",
    scope: "gcc",
    summary:
      "SFDA.FD/GSO 9 requires Arabic on prepackaged food labels; other languages may sit alongside and must match the Arabic. KSA added produce packaging rules in Sept 2025 (food-grade, recyclable, name, net weight, pack date, origin, supplier). Designs sold into KSA and UAE should reserve an Arabic panel at least equal to the English one.",
    status: "verified",
    sources: ["sfda-gso9", "ksa-produce-packaging-2025"],
  },
  "us-fda-fcm": {
    id: "us-fda-fcm",
    title: "US food contact substances (21 CFR 174 to 186) and FPLA labelling",
    authority: "US FDA / FTC",
    scope: "us",
    summary:
      "Food contact materials must be GRAS, prior-sanctioned, regulated under 21 CFR 174 to 186 or covered by a food contact notification. Labels follow FPLA/21 CFR 101 (English, net quantity in US and metric units). Several states restrict PFAS in food packaging.",
    status: "to-verify",
    sources: [],
  },
};
