import * as F0607 from "@/lib/dieline/families/fefco-06-07";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef } from "./common-box";

/** Box models of the fefco-06-07 family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of F0607.DEFINITIONS)
    out.push(familyEntry("fefco-06-07", d as unknown as RawDef, (dims, o) => asModel(F0607.generateFamilyDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
