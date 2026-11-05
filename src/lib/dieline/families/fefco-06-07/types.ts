import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureFamily, StructureFeatures, StructureParamLimits } from "@/types";
import type { StructureDef } from "@/lib/dieline/registry";
import type { StructureDraft } from "@/lib/dieline/structures";
import type { DielineModel } from "@/lib/dieline/types";

/**
 * LOCAL types for the FEFCO 06 / 07 family (see README: the integrator should fold these
 * into the shared registry once `StructureCode` is widened).
 *
 * `StructureCode` is a closed union in `src/types/structure.ts`, so the codes defined here
 * ("FEFCO_0601", "FEFCO_0711", …) are plain strings until the integrator adds them.
 */
export type FamilyCode = `FEFCO_06${string}` | `FEFCO_07${string}`;

/** Sub-families (catalogue filters). */
export type FefcoSubFamily =
  | "bliss-box" //            06: body + two separate end panels, stapled / glued
  | "rigid-sleeve-caps" //    06: tube with two separate end caps (0615, 0616)
  | "rigid-half-shells" //    06: two half shells joined by manufacturer's joints (0621)
  | "auto-bottom-case" //     07: crash-lock (auto-erect) bottom cases
  | "auto-bottom-telescope" // 07: crash-lock base + crash-lock lid (0714)
  | "auto-bottom-divided" //  07: crash-lock case with built-in partitions / handle (0715, 0717)
  | "ready-glued-tray" //     07: trays with pre-glued web (gusset) corners
  | "ready-glued-tube"; //    07: glued tube with cells (0752)

/** One step of the assembly / auto-erect sequence (human readable, matches fold stages). */
export interface FoldStep {
  stage: number;
  /** Arabic MSA, noun form, no diacritics. */
  ar: string;
  en: string;
}

export type Use = StructureDef["uses"][number] | "produce" | "industrial";

/**
 * Same shape as the shared `StructureDef`, except:
 * - `code` is a string (not yet in the StructureCode union),
 * - `pieces` can be 3 (bliss box: body + two ends),
 * - `features` is omitted (no optional features yet: windows etc. are not part of FEFCO 06/07),
 * - adds `subFamily`, `generate`, `foldSequence`, `outerAllowance`.
 */
export interface FamilyStructureDef {
  code: FamilyCode;
  slug: string;
  family: StructureFamily;
  subFamily: FefcoSubFamily;
  /** "FEFCO 0711" (FEFCO Code, 11th edition numbering). */
  standard: string;
  name: LocalizedText;
  description: LocalizedText;
  params: StructureParamLimits;
  defaultDims: Dims;
  presets: DimsPreset[];
  materials: MaterialCode[];
  shape: "box";
  /** Separately cut blanks. */
  pieces: 1 | 2 | 3;
  /** Delivered glued flat (needs a folder-gluer / stitcher at the plant). */
  glued: boolean;
  /** FEFCO closure letter: "M" manufacturer's joint, "A" assembled by stitching / gluing by the user, "M/A" either. */
  joint: "M" | "A" | "M/A";
  uses: Use[];
  /** Assembly sequence (stage numbers match `DielinePanel.foldStage`). */
  foldSequence: FoldStep[];
  /**
   * Outer size of the closed box from the inner size and caliper (board layers × t, plus
   * handles / stacking lugs). Pricing / shipping can use it without folding; tests check the
   * folded model against it.
   */
  outerSize: (dims: Dims, t: number) => Dims;
  /** Parametric generator (inner mm, board caliper mm). */
  generate: (dims: Dims, t: number, features?: StructureFeatures) => StructureDraft;
}

/** DielineModel with a string structure code (until the union is widened). */
export type FamilyDielineModel = Omit<DielineModel, "structureCode"> & { structureCode: FamilyCode };
