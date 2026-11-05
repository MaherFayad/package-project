import type { Source } from "./types";

/**
 * Public sources behind the availability data (searched Nov 2026). Company directories are
 * self-reported listings: they establish that a manufacturer TYPE exists in a cluster, not its
 * current capacity. Price bands are estimates unless a source here says otherwise.
 */
export const SOURCES: Record<string, Source> = {
  // Regulatory, Egypt
  "usda-nfsa-fcm-2022": { title: "USDA FAS: NFSA issues technical requirements for food contact materials (Decision 17/2022)", url: "https://www.fas.usda.gov/data/egypt-egypts-national-food-safety-authority-issued-technical-requirements-food-contact", year: "2022" },
  "usda-nfsa-traceability": { title: "USDA FAS: NFSA requirements for food traceability", url: "https://www.fas.usda.gov/data/egypt-egypts-national-food-safety-authority-issued-requirements-food-traceability-0", year: "2023" },
  "eos-es1546": { title: "EOS catalogue: ES 1546 labelling of prepackaged foods (2024, based on CXS 1-1985 rev. 2018)", url: "https://eos.org.eg/en/ICS/67?page=2", year: "2024" },
  "trade-gov-egypt-labeling": { title: "US Trade.gov Egypt Country Commercial Guide: labeling and marking requirements", url: "https://www.trade.gov/country-commercial-guides/egypt-labeling-marking-requirements", year: "2025" },
  "eda-mockup": { title: "EDA: guidelines for mock-up design of human pharmaceutical products", url: "https://edaegypt.gov.eg/media/x3gfwst5/guidelines-for-mock-up-design-of-human-pharmaceutical-products-_compressed.pdf", year: "2022" },
  "eda-inserts": { title: "EDA: medical inserts submission guidance (Arabic PIL, English SmPC)", url: "https://edaegypt.gov.eg/media/ivlh0cha/medical-inserts-submission-guidance.pdf", year: "undated" },
  "eda-leaflets": { title: "EDA: Egyptian guidelines on medical leaflets of medicinal products for human use v3", url: "https://www.edaegypt.gov.eg/media/30xfwmew/egyptian-guidelines-on-medical-leaflets-of-medicinal-products-for-human-use-ver3.pdf", year: "undated" },
  "eda-elabeling": { title: "EDA: e-labelling guidelines v9", url: "https://edaegypt.gov.eg/media/jwzfv3hz/elabeling-guidelines-v9_.pdf", year: "undated" },
  "dla-epr-egypt": { title: "DLA Piper: Extended producer responsibility in Egypt", url: "https://www.dlapiper.com/en/insights/publications/2026/02/extended-producer-responsibility-in-egypt", year: "2026" },
  "egyptianstreets-bag-fee": { title: "Egyptian Streets: fees on producers of single-use plastic bags (EGP 37.5/kg from 3 Jun 2025)", url: "https://egyptianstreets.com/2025/03/16/egypt-introduces-fees-on-producers-to-reduce-single-use-plastic-bags/", year: "2025" },
  "capmad-epr-packaging": { title: "Capmad: Egypt extends EPR scheme to packaging waste", url: "https://www.capmad.com/post/extended-producer-responsibility-egypt-extends-scheme-to-packaging-waste", year: "2026" },
  "ey-vat-2025": { title: "EY: Egypt introduces significant VAT updates (Law 157/2025)", url: "https://www.ey.com/en_gl/technical/tax-alerts/egypt-introduces-significant-vat-updates-on-certain-goods-and-services", year: "2025" },
  "lookuptax-vat-149-2026": { title: "LookupTax: VAT exempt schedule, Law 149/2026", url: "https://lookuptax.com/tax-changes/egypt/vat-exempt-schedule-law-149-2026", year: "2026" },
  "andersen-vat": { title: "Andersen Egypt: VAT in Egypt (Law 67/2016, 14% since 1 Jul 2017)", url: "https://eg.andersen.com/vat-in-egypt/", year: "2025" },

  // Regulatory, other regions
  "ppwr-packaging-gateway": { title: "Packaging Gateway: new EU-wide packaging rules take effect in August 2026", url: "https://www.packaging-gateway.com/news/new-eu-wide-packaging-rules-take-effect-in-august-2026/", year: "2026" },
  "ppwr-bv-labelling": { title: "Bureau Veritas: labelling under Regulation (EU) 2025/40 (PPWR)", url: "https://www.cps.bureauveritas.com/newsroom/labelling-regulation-eu-202540-packaging-and-packaging-waste-ppwr", year: "2025" },
  "sfda-gso9": { title: "SFDA FAQ: SFDA.FD/GSO 9 labelling of prepackaged food (Arabic required)", url: "https://www.sfda.gov.sa/en/faq?page=29&tags=46", year: "2025" },
  "ksa-produce-packaging-2025": { title: "Gulf News: Saudi rules on packaging and labelling of fruit and vegetables (Sept 2025)", url: "https://gulfnews.com/world/gulf/saudi/saudi-arabia-issues-new-rules-on-packaging-and-labeling-of-fruits-and-vegetables-1.500276079", year: "2025" },

  // Market and supply, Egypt
  "mordor-egypt-paperboard": { title: "Mordor Intelligence: Egypt paperboard packaging market (corrugated 53% share)", url: "https://www.mordorintelligence.com/industry-reports/egypt-paperboard-packaging-market2", year: "2025" },
  "greenliner-pm1": { title: "Paperfirst: Greenliner starts up PM1 containerboard machine, 10th of Ramadan", url: "https://www.paperfirst.info/?p=28810", year: "2025" },
  "hsa-cepack": { title: "HSA Group: Cepack Group (corrugated, 10th of Ramadan)", url: "https://hsagroup.com/explore-hsa-business/our-companies/industrial-companies/cepack-group.aspx", year: "2025" },
  "yp-corrugated": { title: "Yellow Pages Egypt: corrugated carton factory listings", url: "https://yellowpages.com.eg/en/keyword/corrugated-carton-factory", year: "2025" },
  "yp-flexo": { title: "Yellow Pages Egypt: flexo / plastic bag printing listings", url: "https://yellowpages.com.eg/en/keyword/plastic-bag-printing", year: "2025" },
  "findinegypt-yoropack": { title: "FindInEgypt: Yoro Pack (lids, rolls, Obour)", url: "https://findinegypt.com/c/yoro-pack-for-printing-packaging-solutions-346443", year: "undated" },
  "yp-paper-bag": { title: "Yellow Pages Egypt: paper bag manufacturers", url: "https://yellowpages.com.eg/en/keyword/paper-bag", year: "2025" },
  "leeline-paper-bags-eg": { title: "Leeline: paper bag manufacturers in Egypt (directory)", url: "https://www.leelinebags.com/paper-bags-manufacturers-in-egypt/", year: "2025" },
  "huhtamaki-golden-license": { title: "Business Today Egypt: golden licence for Huhtamaki Egypt molded fibre plant (Sadat City)", url: "https://www.businesstodayegypt.com/amp/1/5889/Egyptian-Cabinet-approves-golden-license-for-Huhtamaki-Egypt-to-establish", year: "2025" },
  "zawya-huhtamaki-korra": { title: "Zawya: Huhtamaki Egypt with Korra, Sadat City molded fibre facility", url: "https://www.zawya.com/en/press-release/companies-news/huhtamaki-egypt-secures-golden-license-to-establish-the-middle-easts-largest-sustainable-packaging-facility-in-partnership-with-korra-in-sadat-city-lhefi1j4", year: "2025" },
  "juhayna-sig": { title: "Packaging Insights: Juhayna fills in SIG Combibloc cartons, 6th of October", url: "https://www.packaginginsights.com/news/juhayna-beverage-cartons-and-filling-technology-from-sig-combibloc.html", year: "undated" },
  "sig-recycling-egypt": { title: "FoodBev: SIG sets up Egypt's first beverage-carton recycling system", url: "https://www.foodbev.com/news/sig-partners-with-local-firms-to-establish-egypt-s-first-comprehensive-recycling-system-for-beverage", year: "2025" },
  "tetrapak-uniboard": { title: "Zawya: Tetra Pak and Uniboard beverage carton recycling project", url: "https://www.zawya.com/en/projects/industry/tetra-pak-to-partner-with-uniboard-for-beverage-carton-recycling-project-in-egypt-hkltgo7q", year: "2024" },
  "zawya-tetrapak-2015": { title: "Zawya: Tetra Pak owns two factories in 6th of October (2015 release)", url: "https://www.zawya.com/en/press-release/during-gulfood-manufacturing-2015-domty-the-biggest-white-cheese-producer-in-the-world-in-tetra-pak-packages-ttqytava", year: "2015" },
  "zawya-meg-2025": { title: "Zawya: Middle East Glass Manufacturing 2025 profits", url: "https://www.zawya.com/en/capital-markets/equities/egypt-middle-east-glass-manufacturings-profits-hike-550-yoy-in-2025-t7lea35u", year: "2026" },
  "stockanalysis-meg": { title: "StockAnalysis: Middle East Glass Manufacturing (EGX: MEGM) profile", url: "https://stockanalysis.com/quote/egx/MEGM/company", year: "2026" },
  "petpla-egypt-2025": { title: "PETplanet Insider 04/2025: Egypt PET preform and bottle makers (ACIP Borg El Arab, Delta El Nile, Aquah)", url: "https://petpla.net/assets/ebooks/PP202504/10/", year: "2025" },
  "plasticsnews-alpla-taba": { title: "Plastics News: Alpla fully acquires Egyptian bottle maker Taba", url: "https://www.plasticsnews.com/news/alpla-fully-acquires-egyptian-bottle-manufacturer-taba/", year: "2025" },
  "yp-can": { title: "Yellow Pages Egypt: can manufacturers (CairoPac, Europack 10th of Ramadan, El Gohary Abou Rawash)", url: "https://yellowpages.com.eg/en/map-category/can-manufacturers", year: "2025" },
  "yp-tin-cans": { title: "Yellow Pages Egypt: tin cans", url: "https://yellowpages.com.eg/en/keyword/tin-cans", year: "2025" },
  "cphi-tube-egypt": { title: "CPHI Online: The National Company for Manufacturing Collapsible Tubes (TUBE), Egypt", url: "https://www.cphi-online.com/company/the-national-company-for-manufacturing-collapsible/", year: "2025" },
  "maghreb-medpack": { title: "Maghreb Pharma: MedPack Egypt (blister films and foil, slitting and printing)", url: "https://www.maghrebpharma.com/en/exhibitors/medpack-egypt-246973/", year: "2025" },
  "blog-blister-egypt": { title: "PackTalk: current challenges in pharmaceutical blister packaging in Egypt (blog, non-authoritative)", url: "https://packtalkbywaseem.blogspot.com/2025/12/current-challenges-in-pharmaceutical.html", year: "2025" },
  "yp-cosmetic-pack": { title: "Yellow Pages Egypt: cosmetics packaging manufacturers", url: "https://yellowpages.com.eg/en/keyword/manufacturing-cosmetics-packaging", year: "2025" },
  "packaging-costs-egypt-45": { title: "Packaging Connections: packaging costs in Egypt have risen around 45%", url: "https://www.packagingconnections.com/v3/news/packaging-costs-egypt-have-risen-around-45.htm", year: "undated" },
  "crown-10k-2025": { title: "Crown Holdings FY2025 10-K (European Beverage segment covers MENA)", url: "https://www.sec.gov/Archives/edgar/data/1219601/000162828026012904/cck-20251231.htm", year: "2026" },
  "ubuy-mailer-egp": { title: "Ubuy Egypt: imported 45-pack corrugated mailers listed at EGP 2,087 (retail import reference)", url: "https://www.ubuy.com.eg/en/product/PRUDVQKNO-45-pack-shipping-boxes-9x6x2-inches-colorful-corrugated-cardboard-mailer-box-for-small-business-mailing-packing-literature-gift", year: "2026" },

  // Repo-internal research
  "repo-research-report": { title: "docs/research-report.md (this repo): Egypt market, suppliers, legal", url: "docs/research-report.md", year: "2026" },
};
