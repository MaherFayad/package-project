import * as SPEC from "@/lib/dieline/families/ecma-specials";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef } from "./common-box";

/** Box models of the ecma-specials family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of SPEC.DEFINITIONS)
    out.push(familyEntry("ecma-specials", d as unknown as RawDef, (dims, o) => asModel(SPEC.generateFamilyDieline(d, dims, { thicknessMm: o.thicknessMm, features: o.features }))));
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
