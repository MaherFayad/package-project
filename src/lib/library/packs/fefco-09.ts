import * as F09 from "@/lib/dieline/families/fefco-09";
import type { Dims } from "@/types";
import type { BoxModelDef } from "../types";
import { familyEntry, asModel, type RawDef, UNPRINTED_FITTINGS } from "./common-box";

/** Box models of the fefco-09 family (one pack per family: PERF-04). Not deduplicated (see ../boxes.ts). */
function build(): BoxModelDef[] {
  const out: (BoxModelDef | null)[] = [];
  for (const d of F09.DEFINITIONS) {
    if (UNPRINTED_FITTINGS.has(d.code)) continue;
    const presets = d.presets.map((p) => ({ id: p.id, name: p.name, dims: p.dims, ...(p.standard ? { standard: p.standard } : {}) }));
    const optionsFor = (dims: Dims) => d.presets.find((p) => p.dims.L === dims.L && p.dims.W === dims.W && p.dims.H === dims.H)?.options ?? {};
    out.push(
      familyEntry(
        "fefco-09",
        { ...(d as unknown as RawDef), family: "INTERIOR_FITTING", standard: d.standard },
        (dims, o) => asModel(F09.generateFitting(d.code, { host: dims, ...optionsFor(dims) }, { thicknessMm: o.thicknessMm })),
        d.hostLimits,
        d.defaultHost,
        presets,
      ),
    );
  }
  return out.filter((x): x is BoxModelDef => !!x);
}

export const models: BoxModelDef[] = build();
