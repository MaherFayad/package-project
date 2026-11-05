import type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureFamily, StructureFeatures, StructureParamLimits } from "@/types";
import type { FeatureSupport } from "../../features";
import type { StructureDef } from "../../registry";
import type { StructureDraft } from "../../structures";
import type { DielineModel } from "../../types";

/**
 * LOCAL shared types for the FEFCO group 04 family (see README: the integrator merges these
 * into `src/types/structure.ts` / `registry.ts`). `StructureCode` is a closed union owned by
 * the core build, so family codes are plain strings here ("FEFCO_0421_1").
 */
export type Fefco04Code = `FEFCO_04${string}`;

export type Fefco04SubFamily =
  | "one-piece-folder" //       0400–0403, 0412–0420: walls hinged on the base, closed by flaps from the walls
  | "five-panel-folder" //      0409–0411: tube of 4 panels + overlap panel, end flaps
  | "wrap-around" //            0404, 0406: tube / wrap blanks glued around the product
  | "multi-piece-folder" //     0405 Bliss: body + two end panels
  | "self-locking-tray" //      0421–0437, 0447, 0457: rolled double walls trap corner ears, no glue
  | "lidded-tray" //            0421, 0426–0429, 0440–0442, 0458, 0470–0471: tray with hinged lid
  | "glued-tray" //             0443–0445, 0450–0455: corner glue flaps (gluer)
  | "display-tray" //           0435, 0449, 0460: lowered front / header / raised panels for POS
  | "interior-flap-tray" //     0439, 0470–0472: rolled walls ending in interior bottom flaps
  | "octagonal-tray"; //        0459

/** Same shape as the core `Generator`, kept local so the family does not depend on GENERATORS. */
export type FamilyGenerator = (dims: Dims, t: number, features: StructureFeatures) => StructureDraft;

/**
 * One catalogue entry. Mirrors `StructureDef` (registry.ts) field for field, except `code`
 * (string, not the closed StructureCode union) plus family extras.
 */
export interface Fefco04Definition extends Omit<StructureDef, "code" | "family" | "features" | "uses" | "pieces"> {
  code: Fefco04Code;
  /** FEFCO style number as printed in the code book, incl. variant suffix ("0421_1", "0422a"). */
  fefco: string;
  family: Extract<StructureFamily, "CORRUGATED">;
  subFamily: Fefco04SubFamily;
  features: FeatureSupport;
  uses: StructureDef["uses"];
  /** Separately cut blanks (Bliss 0405 = 3: body + two ends; core StructureDef allows 1 | 2). */
  pieces: 1 | 2 | 3;
  /** Builds the panels (inner mm in, sheet layout out). */
  generate: FamilyGenerator;
  /** How literally the geometry follows the FEFCO drawing (see README). */
  fidelity: "described" | "interpreted";
}

/** A DielineModel whose `structureCode` is a family code. */
export type Fefco04Model = Omit<DielineModel, "structureCode"> & { structureCode: Fefco04Code };

export type { Dims, DimsPreset, LocalizedText, MaterialCode, StructureParamLimits };
