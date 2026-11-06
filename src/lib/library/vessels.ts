import type { VesselModelDef } from "./types";
import * as CORE from "./packs/vessel-core";
import * as BOTTLES from "./packs/vessel-bottles";
import * as COSMETIC from "./packs/vessel-cosmetic";
import * as FLEXIBLE from "./packs/vessel-flexible";

/**
 * Container library (eager): the core containers, bottles / jars / tubs, cosmetic / pharma /
 * cans / tubes and flexible packs. One pack per family (./packs, PERF-04); the browser loads
 * only the open family through ./registry.
 */

export { describeVesselModel } from "./packs/common-vessel";

function dedupe(list: VesselModelDef[]): VesselModelDef[] {
  const codes = new Set<string>();
  const slugs = new Set<string>();
  const out: VesselModelDef[] = [];
  for (const m of list) {
    if (codes.has(m.code)) continue;
    codes.add(m.code);
    const slug = slugs.has(m.slug) ? `${m.slug}-${m.code.toLowerCase().replace(/_/g, "-")}` : m.slug;
    slugs.add(slug);
    out.push(slug === m.slug ? m : { ...m, slug });
  }
  return out;
}

export const VESSEL_MODELS: VesselModelDef[] = dedupe([...CORE.models, ...BOTTLES.models, ...COSMETIC.models, ...FLEXIBLE.models]);
