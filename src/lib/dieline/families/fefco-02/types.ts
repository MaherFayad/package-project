import type { z } from "zod";
import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureFamily, StructureFeatures, StructureParamLimits } from "@/types";
import type { FeatureSupport } from "../../features";
import type { StructureDraft } from "../../structures";
import type { DielineModel } from "../../types";

/**
 * Local types for the FEFCO group 02 (slotted-type boxes) family.
 *
 * `Fefco02Code` values are NOT yet members of the shared `StructureCode` union
 * (src/types/structure.ts). The integrator adds them there; until then this folder keeps
 * its own code type and its own model wrapper (see README.md).
 */
export const FEFCO02_CODES = [
  "FEFCO_0200",
  "FEFCO_0201",
  "FEFCO_0202",
  "FEFCO_0203",
  "FEFCO_0204",
  "FEFCO_0205",
  "FEFCO_0206",
  "FEFCO_0207",
  "FEFCO_0208",
  "FEFCO_0209",
  "FEFCO_0210",
  "FEFCO_0211",
  "FEFCO_0212",
  "FEFCO_0214",
  "FEFCO_0215",
  "FEFCO_0216",
  "FEFCO_0217",
  "FEFCO_0218",
  "FEFCO_0225",
  "FEFCO_0226",
  "FEFCO_0227",
  "FEFCO_0228",
  "FEFCO_0229",
  "FEFCO_0230",
  "FEFCO_0231",
] as const;
export type Fefco02Code = (typeof FEFCO02_CODES)[number];

/** Sub-families inside group 02, for catalogue filters. */
export type Fefco02SubFamily =
  | "slotted" //          flap-closed containers (0200–0206, 0230, 0231)
  | "slotted-open" //     open or frame top (0209, 0214, 0226)
  | "slotted-tuck" //     tuck-in lid closures (0210, 0211, 0212, 0215, 0227)
  | "slotted-lock" //     snap-lock bottoms and locking tongues (0216, 0217, 0218)
  | "slotted-divided"; // integral divisions / liners (0207, 0208, 0225, 0228, 0229)

/** FEFCO erection indication: M manual, A automated, M/A either. */
export type Erection = "M" | "A" | "M/A";

/** Style parameters beyond L × W × H (all mm / degrees, all optional with defaults). */
export interface Fefco02Params {
  /** Overlap of the outer flaps (0202) or of the split joint panels (0228, 0230, 0231). FEFCO's 4th dimension "o". */
  overlapMm?: number;
  /** Depth of the short top frame flaps (0209). */
  rimMm?: number;
  /** Tray height left after tearing the top off along the perforation (0214). FEFCO "h". */
  trayHeightMm?: number;
  /** Height of the integral inner front liner and end wings (0225). FEFCO "h ≤ H". */
  linerHeightMm?: number;
  /** Fold angle of the bevelled top flaps from the wall (0226): 90 = flat. */
  bevelFoldDeg?: number;
}

/** A generator with the shared engine signature plus the style parameters. */
export type Fefco02Generator = (dims: Dims, t: number, features: StructureFeatures, params?: Fefco02Params) => StructureDraft;

export type Fefco02Use = "ecommerce" | "food" | "cosmetics" | "apparel" | "retail" | "gift" | "shipping";

/**
 * Mirrors `StructureDef` (src/lib/dieline/registry.ts) field for field, except `code` is a
 * `Fefco02Code` and the style-specific extras at the end.
 */
export interface Fefco02Definition {
  code: Fefco02Code;
  slug: string;
  family: StructureFamily;
  subFamily: Fefco02SubFamily;
  /** "FEFCO 0201" */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: MaterialCode[];
  features: FeatureSupport;
  shape: "box";
  pieces: 1;
  glued: boolean;
  uses: Fefco02Use[];
  /** FEFCO erection indication printed next to the style in the Code. */
  erection: Erection;
  /** Style parameter schema (zod) and defaults resolved from dims. */
  paramsSchema: z.ZodType<Fefco02Params>;
  defaultParams: (dims: Dims) => Fefco02Params;
  /** Generator with the shared engine signature (style params at their defaults). */
  generate: (dims: Dims, t: number, features: StructureFeatures) => StructureDraft;
  /** Generator taking explicit style params. */
  generateWith: Fefco02Generator;
  /**
   * Board layers stacked at each end of the closed box (for the inner-height compensation
   * H panel = H + (top + bottom) × t). Used by tests and pricing previews.
   */
  endLayers: { top: number; bottom: number };
  /**
   * "exact": flap sizes follow the FEFCO drawing proportions.
   * "simplified": construction follows the drawing, but secondary lock/tab cut details
   * are reduced to plain shapes (see `notes`).
   */
  fidelity: "exact" | "simplified";
  notes?: string;
}

/** Same as DielineModel but with a family code (until the codes join StructureCode). */
export type Fefco02Model = Omit<DielineModel, "structureCode"> & { structureCode: Fefco02Code };
