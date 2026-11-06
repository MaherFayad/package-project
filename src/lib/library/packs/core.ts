import { STRUCTURE_LIST, generateDieline } from "@/lib/dieline";
import type { BoxModelDef } from "../types";
import { groupOf, isOpenTop, search } from "./common-box";

/** The 13 core structures (pack "core"). */
export const models: BoxModelDef[] = STRUCTURE_LIST.filter((s) => s.shape !== "flat").map((s) => ({
  kind: "box",
  code: s.code,
  slug: s.slug,
  group: groupOf(s.family, "", s.code),
  source: "core",
  standard: s.standard,
  name: s.name,
  description: s.description,
  search: search(s.code, s.code.replace(/_/g, " "), s.name.en, s.name.ar, s.standard, s.slug),
  family: s.family,
  shape: s.shape === "cylinder" ? "cylinder" : "box",
  limits: s.params,
  defaultDims: s.defaultDims,
  presets: s.presets,
  materials: s.materials,
  features: s.features,
  baseFor: () => s.code,
  build: (dims, o) => generateDieline(s.code, dims, { thicknessMm: o.thicknessMm, features: o.features }),
  fidelity: "exact",
  ...(isOpenTop(s.code, "") ? { openTop: true } : {}),
}));

