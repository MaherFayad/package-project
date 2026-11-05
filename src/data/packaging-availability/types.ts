import type { LocalizedText } from "@/types";

/**
 * Availability of a packaging family or sub-family in Egypt and worldwide.
 *
 * Research data, not engine data. Every figure that is not quoted from a public source is an
 * ESTIMATE and is flagged as such (`estimate: true` on MOQ, lead time and price band). Use it to
 * set expectations in the catalogue ("made locally, ~10 to 15 days") and to route quotes; never
 * show an estimated price as a firm price.
 */

/** "local": made by Egyptian converters at volume. "imported": mostly imported (stock or custom). "rare": hard to source in Egypt at all. */
export type EgyptAvailability = "local" | "imported" | "rare";

/** Print / decoration processes Egyptian converters actually run on this format. */
export const PRINT_METHODS = [
  "flexo-postprint", //       direct flexo on corrugated board (1 to 4 colours, inline with the die-cutter)
  "litho-lamination", //      offset-printed liner laminated onto corrugated (E/F/B flute)
  "offset-sheetfed", //       sheet-fed offset on folding boxboard, the default for cartons
  "digital-toner", //         short-run toner/inkjet digital (HP Indigo, Konica, Xerox)
  "digital-inkjet-corrugated", // single-pass/scanning inkjet on board (few in Egypt)
  "rotogravure", //           gravure for flexible laminates (main process for Egyptian FMCG films)
  "flexo-flexible", //        CI flexo on film and paper (bags, wraps, sleeves)
  "flexo-label", //           narrow-web flexo for self-adhesive and wrap labels
  "screen", //                screen print (glass ACL, rigid-box foil, tubes, pails)
  "hot-foil", //              hot-foil stamping and embossing (rigid boxes, cartons, labels)
  "dry-offset", //            dry offset (cups, tubs, two-piece cans, tubes)
  "metal-litho", //           offset on tinplate sheet before forming (3-piece cans, tins, aerosols)
  "iml", //                   in-mould labelling (tubs, pails)
  "pad", //                   pad print (closures, cosmetic parts)
  "label-only", //            container itself is not printed locally; decoration is a label or sleeve
] as const;
export type PrintMethod = (typeof PRINT_METHODS)[number];

/** Main Egyptian manufacturing clusters for packaging. */
export const EGYPT_CLUSTERS = [
  "10th-of-ramadan",
  "6th-of-october",
  "obour",
  "borg-el-arab",
  "sadat-city",
  "new-damietta",
  "alexandria",
  "greater-cairo", // Shubra El Kheima, Abou Rawash, Cairo workshops (short-run printers)
  "sokhna", //       Ain Sokhna / SCZone
  "quesna", //       Menoufia industrial zone
] as const;
export type EgyptCluster = (typeof EGYPT_CLUSTERS)[number];

export const REGIONS = ["MENA", "GCC", "EU", "US", "ASIA"] as const;
export type Region = (typeof REGIONS)[number];

export interface RangeEstimate {
  min: number;
  max: number;
  /** true when not taken from a public quote/list (most entries). */
  estimate: boolean;
  note?: string;
}

export interface PriceBandEGP extends RangeEstimate {
  /** What one unit of price means ("per printed box", "per 1,000 labels"). */
  unit: string;
  /** Spec and quantity the band assumes. */
  basis: string;
  /** Month the band was set (EGP moves with the USD, so bands age fast). */
  asOf: string;
}

export interface RegionNote {
  /** How easy to source: "common" | "available" | "niche". */
  level: "common" | "available" | "niche";
  note: string;
}

export interface AvailabilityEntry {
  /** Same as the record key. Families: "corrugated". Sub-families: "corrugated/fefco-02". */
  slug: string;
  /** Parent family slug for sub-families; undefined for families. */
  family?: string;
  name: LocalizedText;
  /** Industry codes this entry covers ("FEFCO 02xx", "ECMA A20.20", "PCO 1881"). */
  standards: string[];
  egypt: EgyptAvailability;
  egyptPrintMethods: PrintMethod[];
  /** Common Egyptian sizes, in the unit the trade quotes them in. */
  sizes: string[];
  moq: RangeEstimate & { unit: string };
  leadTimeDays: RangeEstimate;
  priceBandEGP?: PriceBandEGP;
  clusters: EgyptCluster[];
  /** Publicly listed manufacturer TYPES (and public company names as examples); never contact details. */
  manufacturerTypes: string[];
  /** Keys into REGULATORY. */
  regulatory: string[];
  regions: Record<Region, RegionNote>;
  /** Keys into SOURCES. */
  sources: string[];
  notes?: string;
}

export interface RegulatoryNote {
  id: string;
  title: string;
  authority: string;
  scope: "egypt" | "gcc" | "eu" | "us" | "global";
  summary: string;
  /** "verified" = read in a primary/secondary source; "to-verify" = reported, decree text not seen. */
  status: "verified" | "to-verify";
  sources: string[];
}

export interface Source {
  title: string;
  url: string;
  /** Year of the source (or "undated"). */
  year: string;
}
