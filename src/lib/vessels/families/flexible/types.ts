import type { LocalizedText, Mm } from "@/types";

/**
 * Local contracts for flexible packaging (film pouches, bags, sachets, wraps, sleeves, bladders).
 * Kept inside this folder on purpose: the shared vessel types (src/lib/vessels/types.ts) are
 * still evolving. See README.md for how the integrator can map these onto VesselDefinition.
 *
 * Coordinates follow the vessel engine: mm, Y up, the pack stands on y = 0, front faces +Z,
 * x increases to the viewer's right when looking at the front.
 */

export const FLEXIBLE_CODES = [
  "FLEX_STAND_UP_POUCH",
  "FLEX_FLAT_POUCH",
  "FLEX_THREE_SIDE_SEAL",
  "FLEX_PILLOW_BAG",
  "FLEX_QUAD_SEAL_BAG",
  "FLEX_SIDE_GUSSET_BAG",
  "FLEX_FLAT_BOTTOM_POUCH",
  "FLEX_SACHET",
  "FLEX_STICK_PACK",
  "FLEX_RETORT_POUCH",
  "FLEX_VACUUM_PACK",
  "FLEX_FLOW_WRAP",
  "FLEX_SHRINK_SLEEVE",
  "FLEX_MAILER_BAG",
  "FLEX_BAG_IN_BOX",
] as const;
export type FlexibleCode = (typeof FLEXIBLE_CODES)[number];

export type FlexibleFamily = "FLEXIBLE";
export type FlexibleSubFamily = "POUCH" | "BAG" | "SACHET" | "WRAP" | "SLEEVE" | "BLADDER";

/** Film laminate families the 3D view can render (appearance + print behaviour). */
export const FILM_MATERIAL_CODES = ["FILM_MATTE", "FILM_GLOSS", "FILM_METALLISED", "FILM_KRAFT_LAMINATE", "FILM_CLEAR"] as const;
export type FilmMaterialCode = (typeof FILM_MATERIAL_CODES)[number];

/** Which surface model builds the filled shape. */
export type ShapeModel =
  /** Two plies sealed at the edges (or a folded tube); cross-section is a lens (superellipse). */
  | "pillow"
  /** Pillow with a W-folded bottom gusset that opens into an oval base. */
  | "standup"
  /** Front, back and two side gussets: rounded box section with a flat (block) bottom. */
  | "box"
  /** Printed tube shrunk onto a container. */
  | "sleeve";

/** Print panels ("faces") a flexible pack can carry. */
export const FLEX_PANEL_IDS = ["front", "back", "gussetLeft", "gussetRight", "bottom", "sleeve"] as const;
export type FlexPanelId = (typeof FLEX_PANEL_IDS)[number];

/**
 * Size of a flexible pack (all FLAT dimensions, as converters quote them):
 *  - W: face width (lay-flat width for tubes and sleeves).
 *  - H: face height (bag length for side-gusset bags; cut height for sleeves; bar length for flow wrap).
 *  - G: gusset (fully opened depth): bottom gusset (stand-up) or side gusset (box styles).
 */
export interface FlexDims {
  W: Mm;
  H: Mm;
  G?: Mm;
}

export interface FlexRange {
  min: Mm;
  max: Mm;
}

export type SpoutPosition = "none" | "corner" | "top" | "front";
export type HangHole = "none" | "round" | "euro";

/** Construction options. Each definition says which ones it allows. */
export interface FlexOptions {
  zipper: boolean;
  spout: SpoutPosition;
  /** Unprinted clear window on the front (needs a clear or metallised-free inner ply). */
  window: boolean;
  tearNotch: boolean;
  hangHole: HangHole;
  roundCorners: boolean;
  /** One-way degassing valve (coffee). */
  valve: boolean;
  /** Tin tie (wire reclosure strip) under the top seal. */
  tinTie: boolean;
  /** Peel-and-seal adhesive flap (mailers). */
  adhesiveFlap: boolean;
}
export type FlexOptionKey = keyof FlexOptions;

/** Seal and construction constants of a style (mm). side = 0 means a folded edge (tube). */
export interface Construction {
  model: ShapeModel;
  seals: { top: Mm; bottom: Mm; side: Mm };
  /** One web folded at the bottom: no bottom seal, the fold rounds out when filled. */
  bottomFold?: boolean;
  /** Centre back (fin) seal width, 0 = none. */
  backFin: Mm;
  /** Vertical corner seals (quad seal / box pouch), 0 = none. */
  cornerFins: Mm;
  /** Superellipse exponent of the cross-section (2 = ellipse, larger = flatter slab). */
  sectionExponent: number;
  /** Shape of the thickness along the height (smaller = blunter ends). */
  endExponent: number;
  /** Full thickness at fill = 1 as a fraction of the smaller inner face dimension. */
  maxThicknessRatio: number;
  /** "horizontal": the long axis (H) lies along X (flow-wrapped bars lie on the shelf). */
  orientation: "vertical" | "horizontal";
  /** Crimp serration pitch on the seal jaws (mm). */
  crimpPitchMm: Mm;
}

export interface FlexPreset {
  id: string;
  name: LocalizedText;
  dims: FlexDims;
  /** Nominal fill (g or ml) the size is sold for. */
  nominal: string;
  /** Where the numbers come from. */
  source: string;
}

export interface FlexibleDefinition {
  code: FlexibleCode;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  family: FlexibleFamily;
  subFamily: FlexibleSubFamily;
  /** Published standard, or null when the style has none (flexibles are converter-defined). */
  standard: string | null;
  construction: Construction;
  materials: FilmMaterialCode[];
  defaultMaterial: FilmMaterialCode;
  typicalUses: LocalizedText[];
  limits: { W: FlexRange; H: FlexRange; G?: FlexRange };
  defaultDims: FlexDims;
  presets: FlexPreset[];
  /** Options the style supports, and their defaults. */
  allowedOptions: FlexOptionKey[];
  defaultOptions: Partial<FlexOptions>;
  /** Default fill (0 = empty and flat, 1 = fully inflated). */
  defaultFill: number;
  panels: FlexPanelId[];
}

/** A rectangle in flat panel coordinates (mm, origin top-left of the TRIM, y down). */
export interface FlatRect {
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
}

/**
 * Printable panel. Flat coordinates: origin top-left of the PRINT area (trim + bleed), x right
 * as seen from outside the pack, y down.
 */
export interface FlexPrintPanel {
  id: FlexPanelId;
  name: LocalizedText;
  trimWidthMm: Mm;
  trimHeightMm: Mm;
  bleedMm: Mm;
  /** Minimum distance of critical copy from the trim edge (before seals are taken into account). */
  safeMm: Mm;
  printWidthMm: Mm;
  printHeightMm: Mm;
  /** Live area for copy and logos (print coordinates): inside the trim, clear of seals. */
  safeRect: FlatRect;
  /** Seal bands (print coordinates). Printable, but crimped and partly hidden. */
  seals: FlatRect[];
  /** Areas where no critical copy may go (zipper, fin, valve, window, hang hole), print coordinates. */
  keepOut: { kind: "zipper" | "fin" | "valve" | "window" | "hangHole" | "tinTie" | "spout" | "flap" | "seam"; rect: FlatRect }[];
  /** Clear window (print coordinates), if any. */
  window?: FlatRect;
  trimAreaM2: number;
  /** Trim coordinates of the face's flat origin (where 3D flat coords s = 0, tFlat = 0 land). */
  faceOrigin: { x: Mm; y: Mm };
}

export interface FlexPrintLayout {
  code: FlexibleCode;
  panels: FlexPrintPanel[];
  /** Flat film blank for one pack (all plies, before forming), mm. */
  blank: { widthMm: Mm; lengthMm: Mm; areaM2: number; note: string };
  totalTrimAreaM2: number;
  warnings: string[];
}
