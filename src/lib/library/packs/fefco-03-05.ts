import * as F0305 from "@/lib/dieline/families/fefco-03-05";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef } from "./common-box";

/** Box models of the fefco-03-05 family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of F0305.DEFINITIONS)
    out.push(familyEntry("fefco-03-05", d as unknown as RawDef, (dims, o) => asModel(F0305.generateFamilyDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
