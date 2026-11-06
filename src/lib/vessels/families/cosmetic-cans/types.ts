import type { LocalizedText, Mm } from "@/types";
import type {
  ClosureKind,
  FlatShape,
  LabelFinishCode,
  LabelStockCode,
  NeckFinish,
  PrintSurfaceKind,
  Range,
  SectorGeometry,
  SleeveGeometry,
  SurfacePlacement,
  VesselDims,
  VesselKind,
  VesselMaterialCode,
  VesselProfile,
} from "../../types";

/**
 * Local types for the cosmetic / pharma / cans / tubs / tubes catalogue. The core vessel types
 * (src/lib/vessels/types.ts) use closed unions (VesselKind, VesselMaterialCode, ClosureKind,
 * PrintSurfaceKind). This folder must not edit them, so every union here is a SUPERSET of the
 * core one and every profile is a plain core `VesselProfile`. See README.md for the merge plan.
 */

export const CATALOGUE_FAMILIES = ["COSMETIC", "PHARMA", "CAN", "TUB_CUP", "TUBE"] as const;
export type CatalogueFamily = (typeof CATALOGUE_FAMILIES)[number];

/** Container materials: the core codes plus pharma glass, PP/PS/LDPE, laminates and board. */
export const EXTRA_MATERIAL_CODES = [
  "GLASS_TYPE1_CLEAR",
  "GLASS_TYPE1_AMBER",
  "PP_WHITE",
  "PP_NATURAL",
  "PP_CLEAR",
  "PS_WHITE",
  "LDPE_NATURAL",
  "LDPE_WHITE",
  "HDPE_NATURAL",
  "PETG_CLEAR",
  "ACRYLIC_CLEAR",
  "ABS_BLACK",
  "APET_CLEAR",
  "RPET_CLEAR",
  "PVC_PVDC_CLEAR",
  "ALU_COLD_FORM",
  "ALU_TUBE",
  "LAMINATE_ABL",
  "LAMINATE_PBL",
  "PE_BOARD",
] as const;
export type ExtraMaterialCode = (typeof EXTRA_MATERIAL_CODES)[number];
export type CatalogueMaterialCode = VesselMaterialCode | ExtraMaterialCode;

/** Closures: core kinds plus the ones these containers need. */
export const EXTRA_CLOSURE_KINDS = [
  "AIRLESS_PUMP",
  "TREATMENT_PUMP",
  "MIST_PUMP_COLLAR",
  "ROLL_BALL_CAP",
  "TWIST_UP",
  "BULLET_CAP",
  "WAND_CAP",
  "BRUSH_CAP",
  "HINGED_COMPACT_LID",
  "DOUBLE_WALL_CAP",
  "CRIMP_FLIP_OFF",
  "OPC_BREAK",
  "CHILD_RESISTANT_CAP",
  "DROPPER_TIP_CAP",
  "LIDDING_FOIL",
  "PIERCING_CAP",
  "DOUBLE_SEAM_END",
  "EASY_OPEN_END",
  "LEVER_LID",
  "PLUG_LID",
  "AEROSOL_VALVE",
  "PEEL_FOIL",
  "SNAP_LID",
  "HINGED_LID",
  "TOP_SEAL_FILM",
] as const;
export type ExtraClosureKind = (typeof EXTRA_CLOSURE_KINDS)[number];
export type CatalogueClosureKind = ClosureKind | ExtraClosureKind;

/**
 * Print surfaces: the core label kinds plus
 *  - DIRECT_PRINT: ink straight on the container (can body, tube, tin litho, lipstick case);
 *    seamless 360 degrees, no overlap.
 *  - IML: in-mould label on a moulded cup or tub (sector on tapered cups).
 *  - LID_TOP: rectangular label or litho on top of a rectangular lid.
 *  - LID_FOIL: heat-seal lidding foil (die-cut with a pull tab).
 *  - CARD_FRONT / CARD_BACK: blister lidding foil or backing card.
 */
export const EXTRA_SURFACE_KINDS = ["DIRECT_PRINT", "IML", "LID_TOP", "LID_FOIL", "CARD_FRONT", "CARD_BACK"] as const;
export type ExtraSurfaceKind = (typeof EXTRA_SURFACE_KINDS)[number];
export type CatalogueSurfaceKind = PrintSurfaceKind | ExtraSurfaceKind;

export type PrintProcess = "label" | "sleeve" | "direct" | "iml" | "foil" | "card";

/** Cross-section of a container body. "stadium" is used for ovals (see README: ellipse request). */
export type SectionKind = "round" | "square" | "rect" | "stadium";

/**
 * Size. Same letters as core VesselDims:
 *  - D: body diameter / width across (cups and tubs: RIM width at the top).
 *  - H: height without the closure (cases, tins, clamshells: closed height incl. lid).
 *  - G: depth for non-round sections (defaults to D) / cavity depth for blisters.
 *  - taper: cups and tubs: rim width minus base width (wider at the top, unlike core jars).
 * Blisters also read rows, cols and cavityD.
 */
export interface CatalogueDims extends VesselDims {
  rows?: number;
  cols?: number;
  cavityD?: Mm;
}

export interface CatalogueLimits {
  D: Range;
  H: Range;
  G?: Range;
  taper?: Range;
  rows?: Range;
  cols?: Range;
  cavityD?: Range;
}

export interface CataloguePreset {
  id: string;
  name: LocalizedText;
  /** Nominal (labelled) capacity, ml. 0 = not a liquid capacity (cases, compacts, blisters). */
  capacityMl: number;
  /** Brimful / overflow capacity when the standard states one (vials, cans), ml. */
  brimfulMl?: number;
  dims: CatalogueDims;
  neck?: NeckFinish;
  source: string;
  /** Common in the Egyptian market (shown first in the picker). */
  egypt?: boolean;
}

/** Parametric shape recipe (serialisable data; geometry.ts turns it into a profile). */
export type ShapeSpec =
  | {
      type: "bottle";
      section: SectionKind;
      shoulder: "round" | "flat" | "cone";
      glass: boolean;
      wallMm: Mm;
      baseMm: Mm;
      /** Straight neck between the shoulder and the finish, mm. */
      neckMm?: Mm;
      /** Cone shoulder height as a multiple of (R - neckR). */
      coneRatio?: number;
      /** Decorative collar over the crimp finish (perfume), mm high. */
      collarMm?: Mm;
    }
  | { type: "case"; section: SectionKind; capSplit: number; wallMm: Mm; /** Overcap drawn by the renderer: "bullet" (lipstick), "twist" (stick); the split sits under its edge. */ cap?: "bullet" | "twist" }
  | { type: "ampoule" }
  | { type: "jar"; doubleWall: boolean; wallMm: Mm; baseMm: Mm }
  | { type: "bevcan" }
  | {
      type: "metalcan";
      section: SectionKind;
      bottomSeam: boolean;
      beads: boolean;
      /** Depth of the top end panel below the seam (lever lids sit deeper), mm. */
      endDepthMm: Mm;
    }
  | { type: "tin"; section: SectionKind; lid: "slip" | "plug" }
  | { type: "aerosol"; monobloc: boolean }
  | { type: "cup"; section: SectionKind; flangeMm: Mm; wallMm: Mm; lid: "foil" | "snap" | "none" | "hinged" }
  | { type: "tube"; oval: boolean; metal: boolean }
  | { type: "blister" };

export type GeometryKind = "lathe" | "extrusion" | "tube" | "blister";

/** Lid or end panel the 3D view draws separately from the body profile. */
export interface LidGeometry {
  type: "slip" | "plug" | "lever" | "snap" | "foil" | "hinged" | "end" | "none";
  section: SectionKind;
  /** Bottom and top of the lid (mm, same frame as the profile). */
  y0: Mm;
  y1: Mm;
  /** Outer half width of the lid. */
  r: Mm;
  depthRatio: number;
  /** Flat printable area on top (half width) */
  topR: Mm;
}

export interface BlisterCavity {
  x: Mm;
  y: Mm;
  d: Mm;
}

export interface BlisterGeometry {
  widthMm: Mm;
  heightMm: Mm;
  cavityDepthMm: Mm;
  /** Cavity centres on the card, origin top-left, y down. */
  cavities: BlisterCavity[];
  /** Sealing border around the card edge, mm (no cavity closer than this). */
  borderMm: Mm;
  foilMicron: number;
}

export interface CatalogueGeometry {
  kind: GeometryKind;
  /** Revolved / extruded outer profile in the core format (null for blisters). */
  profile: VesselProfile | null;
  lid: LidGeometry | null;
  blister: BlisterGeometry | null;
  /** Interior top used for capacity (mm). */
  innerTopY: Mm;
  /** Vertical extent a shrink sleeve may cover. */
  sleeveY0: Mm;
  sleeveY1: Mm;
  /** Body print zone (direct print / wrap) */
  printY0: Mm;
  printY1: Mm;
  /** Overall closed height incl. closure, for boxes. */
  overallHeightMm: Mm;
}

/** Placements beyond the core SurfacePlacement. */
export type CataloguePlacement =
  | SurfacePlacement
  /** Full girth of a non-round section between y0 and y1; s = 0 at the back centre, seam there. */
  | { type: "girth"; y0: Mm; y1: Mm; perimeterStart: number }
  /** Rectangle on top of a rectangular lid at height y (x across, z depth, centred). */
  | { type: "top"; y: Mm; x0: Mm; x1: Mm; z0: Mm; z1: Mm }
  /** Blister lidding foil / card. */
  | { type: "card"; face: "front" | "back"; widthMm: Mm; heightMm: Mm };

/**
 * A print area. Field-compatible with core `LabelSpec` (same flat coordinate contract: origin
 * top-left of the print area incl. bleed, x right, y down), with a wider kind/placement and a
 * nullable stock (direct print has no label stock).
 */
export interface CataloguePrintSurface {
  id: string;
  kind: CatalogueSurfaceKind;
  process: PrintProcess;
  name: LocalizedText;
  shape: FlatShape;
  placement: CataloguePlacement;
  trimWidthMm: Mm;
  trimHeightMm: Mm;
  bleedMm: Mm;
  safeMm: Mm;
  printWidthMm: Mm;
  printHeightMm: Mm;
  /** Live (safe) area inside the trim, mm. */
  safeWidthMm: Mm;
  safeHeightMm: Mm;
  trimAreaM2: number;
  overlapMm?: Mm;
  cornerRadiusMm?: Mm;
  sector?: SectorGeometry;
  sleeve?: SleeveGeometry;
  /** Zones that cannot carry ink (blister cavities), flat print coords. */
  keepOut?: { x: Mm; y: Mm; d: Mm }[];
  stocks: LabelStockCode[];
  defaultStock: LabelStockCode | null;
  finishes: LabelFinishCode[];
  warnings: string[];
}

export interface CatalogueVesselDefinition {
  /** Stable code, e.g. "COS-DROPPER". */
  code: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  family: CatalogueFamily;
  subFamily: { code: string; name: LocalizedText };
  /** Published standard the geometry follows, or null. */
  standard: string | null;
  /** Closest core kind (renderer fallback, closure models). */
  coreKind: VesselKind | null;
  geometry: GeometryKind;
  shape: ShapeSpec;
  materials: CatalogueMaterialCode[];
  defaultMaterial: CatalogueMaterialCode;
  closures: CatalogueClosureKind[];
  defaultClosure: CatalogueClosureKind;
  neck?: NeckFinish;
  limits: CatalogueLimits;
  presets: CataloguePreset[];
  defaultPresetId: string;
  surfaces: CatalogueSurfaceKind[];
  defaultSurfaces: CatalogueSurfaceKind[];
  typicalUses: LocalizedText[];
  fillable: boolean;
  defaultFill: number;
  /** Brimful/nominal capacity check applies (false for cases, pistons, compacts, tubes). */
  volumeCheck: boolean;
}

export interface CatalogueVesselDescription {
  geometry: CatalogueGeometry;
  surfaces: CataloguePrintSurface[];
  brimfulMl: number;
  envelope: { width: Mm; depth: Mm; height: Mm };
}
