import type { LocalizedText } from "@/types";
import type { EgyptAvailability, Region } from "@/data/packaging-availability/types";

/**
 * Worldwide packaging catalogue (owner: catalogue integrator).
 *
 * ONE serialisable row per 3D model: the 370 designer-ready models of the model library
 * (`src/lib/library`, wired into the designer, pricing and seed) plus the family models the
 * library leaves out (paper cups, lids, moulded pulp, paper bags, flat stock, envelopes, bulk
 * bins, unprinted FEFCO 09 fittings, blister cards). Taxonomy, standard codes and Egyptian
 * availability come from `src/data/packaging-availability` (research data, see
 * docs/packaging-availability.md). No generators here: rows are safe to ship to the browser.
 */

/** How the model is drawn in 3D (see src/components/catalogue/CatalogueViewer). */
export type CatalogueRender =
  | "box" //       library box: folding dieline in the designer engine
  | "vessel" //    library container: lathe or film model
  | "dieline" //   family dieline outside the library (bags, flat stock, envelopes, bulk bins)
  | "fitting" //   FEFCO 09 interior fitting, drawn inside an open host box
  | "cup" //       paper cup, bowl or cup sleeve (conical wrap)
  | "lid" //       revolved lid
  | "pulp" //      moulded pulp height field
  | "blister"; //  blister card with cavities

export type StandardSystem = "FEFCO" | "ECMA" | "none";

export interface CatalogueStandard {
  system: StandardSystem;
  /** "0201", "0421.1", "A60.20" (null when the style has no FEFCO / ECMA code). */
  code: string | null;
  /** What printers recognise ("FEFCO 0201", "ECMA A60.20", "ISO 269 (C4)", "PCO 1881"). */
  label: string;
}

/** Size axes in the order the trade quotes them. */
export type AxisKey = "L" | "W" | "H" | "D" | "G" | "topD" | "bottomD" | "rimD";

export interface CataloguePresetRow {
  id: string;
  name: LocalizedText;
  dims: Partial<Record<AxisKey, number>>;
  capacityMl?: number;
}

export interface CatalogueEntry {
  /** Unique model code; also the thumbnail file name (public/models/<code>.webp). */
  code: string;
  /** Unique URL slug (catalogue detail page). */
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Generator library the model comes from (library ModelSource or family folder). */
  source: string;
  render: CatalogueRender;
  /** Availability family slug ("corrugated", "food-service", "glass" …). */
  family: string;
  /** Availability sub-family slug ("corrugated/fefco-02", "food-service/paper-cup" …). */
  subFamily: string;
  /** The family generator's own style group ("slotted-lock", "TUCK_END", "skincare" …). */
  style: string;
  standard: CatalogueStandard;
  availableInEgypt: EgyptAvailability;
  /** Regions where the format is common or available (niche regions left out). */
  regions: Region[];
  /** In the model library: opens in the free designer with artwork, pricing and checkout. */
  designer: boolean;
  /** Board / stock no seeded Egyptian printer prices yet: always a quote, never an instant price. */
  quoteOnly: boolean;
  axes: AxisKey[];
  defaultDims: Partial<Record<AxisKey, number>>;
  presets: CataloguePresetRow[];
  /** Lower-case search haystack: codes, both names, standard, family and sub-family names. */
  search: string;
}

/** What the browser needs for a grid card. `search` holds codes, names and standard only; add family names client-side. */
export type CatalogueCard = Pick<
  CatalogueEntry,
  "code" | "slug" | "name" | "family" | "subFamily" | "standard" | "availableInEgypt" | "regions" | "designer" | "quoteOnly" | "search" | "render"
> & { instantPrice: boolean };
