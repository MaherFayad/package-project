import * as FOOD from "@/lib/dieline/families/foodservice";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef } from "./common-box";

/** Box models of the foodservice family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of FOOD.DEFINITIONS) {
    if (d.kind !== "dieline") continue;
    out.push(
      familyEntry("foodservice", d as unknown as RawDef, (dims, o) => {
        const r = FOOD.buildFoodservice(d.code, dims, { thicknessMm: o.thicknessMm, features: o.features });
        if (r.kind !== "dieline") throw new Error(`${d.code} is not a dieline`);
        return asModel(r.model);
      }),
    );
  }
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
