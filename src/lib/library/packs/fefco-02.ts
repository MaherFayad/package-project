import * as F02 from "@/lib/dieline/families/fefco-02";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef } from "./common-box";

/** Box models of the fefco-02 family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of F02.DEFINITIONS)
    out.push(familyEntry("fefco-02", d as unknown as RawDef, (dims, o) => asModel(F02.buildFefco02Dieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
