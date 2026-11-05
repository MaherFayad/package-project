import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureParamLimits } from "@/types";
import type { DielineModel } from "../../types";
import type { DimsIssue } from "../../limits";
import type { StructureDraft } from "../../structures";
import type { StructureDef } from "../../registry";

/**
 * FEFCO group 09: interior fittings (pads, liners, tubes, partitions, cushion pads,
 * scored sheets, corner protectors). Local types: they do not exist in the shared
 * `@/types` contracts yet (see README.md, "Integrator notes").
 */

/** FEFCO style number in this family, as printed in the code ("0900" … "0976a"). */
export type Fefco09Number =
  | "0900" | "0901" | "0902" | "0903"
  | "0904" | "0905" | "0906" | "0907" | "0908" | "0909" | "0910"
  | "0911" | "0913" | "0914"
  | "0920" | "0921"
  | "0929" | "0930" | "0931" | "0932" | "0933" | "0934" | "0935"
  | "0940" | "0941" | "0942" | "0943" | "0944" | "0945" | "0946" | "0947" | "0948" | "0949" | "0949a" | "0950" | "0950a"
  | "0951" | "0967"
  | "0970" | "0971" | "0971a" | "0972" | "0972a" | "0973" | "0974" | "0975" | "0976" | "0976a";

/** Catalogue code, e.g. "FEFCO_0900", "FEFCO_0971A". Not (yet) a member of StructureCode. */
export type FittingCode = `FEFCO_${Uppercase<Fefco09Number>}`;

export type FittingSubFamily =
  | "PAD" //            flat sheet pads (fill-in, bottom, side)
  | "LINER" //          open / wrap / overlap liners and trays
  | "COMPARTMENT" //    one-piece liners with folded double-wall dividers
  | "PARTITION" //      slotted N × M grids, C partitions, cell tubes
  | "CUSHION" //        folded cushion pads (layers, rails)
  | "CLEARANCE" //      pads on folded legs (head/foot space)
  | "SCORED_SHEET" //   flat sheets with score lines
  | "CORNER"; //        corner / edge protectors and corner braces

/**
 * Where a fitting sits in its host box (host inner coordinates: origin at the inner
 * bottom-left-back corner, x along L, y up along H, z along W toward the front).
 */
export type FittingSlot =
  | "floor" //          lies on the inner floor
  | "floor-gap" //      fills the gap between RSC inner flaps (top at floor level)
  | "end-wall" //       stands against the left W-side wall (x = 0)
  | "side-wall" //      stands against the back L-side wall (z = 0)
  | "walls" //          lines the walls (and maybe floor / top)
  | "cells" //          divides the volume into cells
  | "corner" //         vertical inner corner (x = 0, z = 0)
  | "edge"; //          along the bottom back edge

/** Integer / mm options a fitting accepts on top of the host dims. */
export type FittingOptionKey =
  | "rows" //         cells along W (partitions)
  | "cols" //         cells along L (partitions)
  | "heightMm" //     fitting height (walls, strips, legs)
  | "highMm" //       high divider height (FEFCO 0935)
  | "sizeMm" //       leg / flap / rail / corner size
  | "clearanceMm" //  total fit allowance per dimension (host inner − fitting outer)
  | "compartments" // compartments of a one-piece compartment liner
  | "scores" //       score lines of a scored sheet (per direction)
  | "layers"; //      layers of a folded cushion pad

export interface OptionSpec {
  min: number;
  max: number;
  /** Default value, or a function of the host inner dims (and the other raw inputs). */
  default: number | ((host: Dims, input: FittingParams) => number);
  int?: boolean;
}

export interface FittingParams {
  /** Inner dims of the host box the fitting goes into (mm). */
  host: Dims;
  rows?: number;
  cols?: number;
  heightMm?: number;
  highMm?: number;
  sizeMm?: number;
  clearanceMm?: number;
  compartments?: number;
  scores?: number;
  layers?: number;
}

/** Params after validation: every option the definition declares is resolved. */
export type ResolvedFittingParams = Required<Pick<FittingParams, "host">> & Partial<Record<FittingOptionKey, number>>;

export interface FittingPreset extends DimsPreset {
  /** Option overrides for this preset (cell counts …). `dims` is the HOST inner size. */
  options?: Partial<Record<FittingOptionKey, number>>;
}

/** A generator draft plus where the closed fitting sits in the host. */
export interface FittingDraft extends StructureDraft {
  /**
   * Host-inner position of the closed fitting's bounding-box minimum corner, or an explicit
   * model → host-inner matrix (column-major 4×4) for multi-piece fittings.
   */
  anchor: { x: number; y: number; z: number } | { matrix: number[] };
}

export interface FittingDefinition {
  code: FittingCode;
  fefco: Fefco09Number;
  slug: string;
  family: "INTERIOR_FITTING";
  subFamily: FittingSubFamily;
  /** "FEFCO 0900" … */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  /** How the geometry was derived (code title + notation; see README for sources). */
  interpretation: string;
  materials: MaterialCode[];
  defaultMaterial: MaterialCode;
  uses: StructureDef["uses"];
  slot: FittingSlot;
  /** Host inner size limits (mm). */
  hostLimits: StructureParamLimits;
  defaultHost: Dims;
  presets: FittingPreset[];
  options: Partial<Record<FittingOptionKey, OptionSpec>>;
  /** Separately cut blanks: 1, or "multi" (slotted partitions). */
  pieces: 1 | "multi";
  glued: boolean;
  /** Closed outer size of the fitting (L along x, W along z, H vertical) for these params. */
  outer(p: ResolvedFittingParams, t: number): Dims;
  /** Cross-field checks (cell size, flap size vs. pad size …) after defaults are applied. */
  check?(p: ResolvedFittingParams): DimsIssue[];
  build(p: ResolvedFittingParams, t: number): FittingDraft;
}

/** A fitting dieline: the shared DielineModel shape plus where it sits in the host. */
export interface FittingModel extends Omit<DielineModel, "structureCode"> {
  structureCode: FittingCode;
  params: ResolvedFittingParams;
  /** Closed fitting → host inner space (column-major 4×4, mm). */
  placement: { matrix: number[]; slot: FittingSlot; host: Dims };
}
