import type {
  Dims,
  DimsPreset,
  LocalizedText,
  MaterialCode,
  StructureCode,
  StructureFamily,
  StructureFeatures,
  StructureParamLimits,
} from "@/types";
import type { StructureDraft } from "../../structures";
import type { FeatureSupport } from "../../features";
import type { DielineModel, Rect } from "../../types";

/**
 * Local (family) types for the ECMA tuck-end / glued-end folding carton catalogue.
 * These extend the shared contracts without editing them: the integrator can fold them into
 * `src/types/structure.ts` / `src/lib/dieline/registry.ts` (see README.md).
 */

/** Catalogue codes owned by this family. Not (yet) members of the shared StructureCode union. */
export const ECMA_TUCK_CODES = [
  "ECMA_TUCK_STE", //        straight tuck end, closures on the back (A20.20.03.03)
  "ECMA_TUCK_RTE", //        reverse tuck end (A20.20.03.01)
  "ECMA_TUCK_AIRPLANE", //   straight tuck, closures on the front panel (A20.20.01.01)
  "ECMA_TUCK_FRENCH_RTE", // French / inverted reverse tuck (A20.20.01.03)
  "ECMA_TUCK_SNAP_LOCK", //  tuck top, 1-2-3 snap-lock bottom (A55.20.01.03)
  "ECMA_TUCK_CRASH_LOCK", // tuck top, crash-lock (auto) bottom (A60.20.00.03)
  "ECMA_SEAL_END", //        glued (full overlapping) flaps both ends (A10.10.01.01)
  "ECMA_SEAL_END_TEAR", //   seal end with perforated tear strip (A10.10.01.01 + X tear strip)
  "ECMA_HANGER_EURO", //     tuck end with extended back panel, Euro slot (A20.21.03.03)
  "ECMA_HANGER_ROUND", //    tuck end with extended back panel, round hole (A20.21.03.03)
  "ECMA_WINDOW_RTE", //      reverse tuck with die-cut, filmed window (A20.20.03.01 + window)
  "ECMA_PHARMA_RTE", //      pharma reverse tuck with leaflet allowance (A20.20.03.01)
  "ECMA_FLIP_TOP", //        hinged-lid (flip-top) pack with inner frame (no single ECMA code)
  "ECMA_DOUBLE_WALL_TUCK", // reverse tuck with doubled front and back walls (A20 based, no code)
] as const;
export type EcmaTuckCode = (typeof ECMA_TUCK_CODES)[number];

export type EcmaTuckSubFamily = "TUCK_END" | "TUCK_TOP_LOCK_BOTTOM" | "GLUED_END" | "HANGER" | "WINDOW" | "PHARMA" | "HINGED_LID" | "DOUBLE_WALL";

/** Tuck lock: friction (plain tuck) or slit lock (short cuts at the tuck crease ends). */
export type TuckLock = "friction" | "slit";
export type HangHole = "euro" | "round";

/**
 * Per-model construction options (all optional, all mm). Validated with
 * `ecmaTuckOptionsSchema` (zod) and clamped to the panel sizes inside the generators.
 */
export interface EcmaTuckOptions {
  /** Tuck flap depth (default: 0.35 W + 5, 10..30 mm). */
  tuckDepthMm?: number;
  /** Glue (manufacturer's joint) flap width (default 0.3 W, 10..15 mm). */
  glueFlapMm?: number;
  tuckLock?: TuckLock;
  /** Hanger models: hang hole shape. */
  hangHole?: HangHole;
  /** Hanger models: header (hang tab) height above the top crease. */
  headerHeightMm?: number;
  /** Pharma: folded patient-leaflet thickness added to the inner depth W. */
  leafletThicknessMm?: number;
  /** Flip-top: lid height on the front panel. */
  lidHeightMm?: number;
}

/** Zone on a panel that must stay ink-free (variable data: batch / expiry / price). */
export interface ReservedZone {
  panelId: string;
  rect: Rect;
  purpose: "variable-data";
  label: LocalizedText;
}

/** Dieline model of a family carton: the shared model plus its catalogue code and extras. */
export interface EcmaTuckDielineModel extends DielineModel {
  catalogCode: EcmaTuckCode;
  /** Options actually applied (after defaults). */
  options: Required<Pick<EcmaTuckOptions, "tuckLock">> & EcmaTuckOptions;
  /** Inner space the carton gives the product (equals dims, except pharma leaflet allowance on W). */
  cartonInner: Dims;
  reservedZones: ReservedZone[];
}

export type EcmaTuckGenerator = (dims: Dims, t: number, features: StructureFeatures, options: EcmaTuckOptions) => EcmaTuckDraft;

export interface EcmaTuckDraft extends StructureDraft {
  /** Inner dims the carton is built around (dims + allowances). */
  inner: Dims;
  /** Reserved zones by panel id; rects resolved after sheet normalisation. */
  reserved?: (panels: DielineModel["panels"]) => ReservedZone[];
}

/**
 * Catalogue entry. Mirrors the shared `StructureDef` (src/lib/dieline/registry.ts) field
 * for field, with `code` widened to the family code and these additions:
 * `baseCode` (closest shared StructureCode: used for `DielineModel.structureCode`, pricing
 * fallbacks and the material family), `subFamily`, `generator` and `optionsDefaults`.
 */
export interface EcmaTuckDefinition {
  code: EcmaTuckCode;
  baseCode: StructureCode;
  slug: string;
  family: StructureFamily;
  subFamily: EcmaTuckSubFamily;
  /** "ECMA A20.20.03.01", or "none" when the style has no single ECMA code. */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: MaterialCode[];
  features: FeatureSupport;
  /** Features on by default (window carton). */
  defaultFeatures?: StructureFeatures;
  optionsDefaults: EcmaTuckOptions;
  shape: "box";
  pieces: 1 | 2;
  glued: boolean;
  uses: ("ecommerce" | "food" | "cosmetics" | "apparel" | "retail" | "gift" | "shipping" | "pharma")[];
  generator: EcmaTuckGenerator;
}
