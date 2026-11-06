import type { BoxModelDef } from "./types";
import * as FOOD from "@/lib/dieline/families/foodservice";
import * as RT from "@/lib/dieline/families/rigid-tubes";
import { UNPRINTED_FITTINGS } from "./packs/common-box";
import * as CORE from "./packs/core";
import * as F02 from "./packs/fefco-02";
import * as F0305 from "./packs/fefco-03-05";
import * as F04 from "./packs/fefco-04";
import * as F0607 from "./packs/fefco-06-07";
import * as TUCK from "./packs/ecma-tuck";
import * as SPEC from "./packs/ecma-specials";
import * as FOODP from "./packs/foodservice";
import * as RTP from "./packs/rigid-tubes";
import * as F09 from "./packs/fefco-09";

/**
 * Box library (eager, server and scripts): the 13 core structures plus every family generator
 * whose output folds in the shared 3D engine and whose boards printers in Egypt quote. Each
 * family is its own pack (./packs, PERF-04) so the browser can load only the open family through
 * ./registry; this module loads them all. Families that are not dielines (paper cups, lids,
 * moulded pulp) or whose stocks no seeded printer quotes are left out (`EXCLUDED_FAMILY_MODELS`).
 */

export { baseStructure, isOpenTop } from "./packs/common-box";

/** Packs in precedence order: the first pack wins a duplicate code (core before families). */
const BOX_PACKS = [CORE, F02, F0305, F04, F0607, TUCK, SPEC, FOODP, RTP, F09];

function dedupe(list: BoxModelDef[]): BoxModelDef[] {
  const codes = new Set<string>();
  const slugs = new Set<string>();
  const out: BoxModelDef[] = [];
  for (const m of list) {
    if (codes.has(m.code)) continue;
    codes.add(m.code);
    let slug = m.slug;
    if (slugs.has(slug)) slug = `${slug}-${m.code.toLowerCase().replace(/_/g, "-")}`;
    slugs.add(slug);
    out.push(slug === m.slug ? m : { ...m, slug });
  }
  return out;
}

/** Every box model, core first. */
export const BOX_MODELS: BoxModelDef[] = dedupe(BOX_PACKS.flatMap((p) => p.models));

/** Family models left out of the designer and why (documentation + tests). */
export const EXCLUDED_FAMILY_MODELS: { code: string; reason: string }[] = (() => {
  const inLib = new Set(BOX_MODELS.map((m) => m.code));
  const out: { code: string; reason: string }[] = [];
  for (const d of FOOD.DEFINITIONS) {
    if (d.kind !== "dieline") out.push({ code: d.code, reason: `${d.kind} part (cup, lid or moulded pulp), not a folding dieline` });
    else if (!inLib.has(d.code)) out.push({ code: d.code, reason: "paper or food stock no seeded printer quotes yet" });
  }
  for (const code of UNPRINTED_FITTINGS) out.push({ code, reason: "unprinted interior fitting (partition set / cushion): no face carries artwork" });
  for (const d of RT.DEFINITIONS) if (!inLib.has(d.code)) out.push({ code: d.code, reason: "stock no seeded printer quotes yet (envelope paper, BC / triple wall)" });
  return out;
})();
