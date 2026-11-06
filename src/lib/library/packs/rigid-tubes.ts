import * as RT from "@/lib/dieline/families/rigid-tubes";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef } from "./common-box";

/** Box models of the rigid-tubes family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of RT.DEFINITIONS)
    out.push(familyEntry("rigid-tubes", d as unknown as RawDef, (dims, o) => asModel(d.generate(dims, { thicknessMm: o.thicknessMm, features: o.features }))));
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
