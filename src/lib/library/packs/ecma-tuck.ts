import * as TUCK from "@/lib/dieline/families/ecma-tuck";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef } from "./common-box";

/** Box models of the ecma-tuck family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of TUCK.DEFINITIONS)
    out.push(familyEntry("ecma-tuck", d as unknown as RawDef, (dims, o) => asModel(TUCK.generateEcmaDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
