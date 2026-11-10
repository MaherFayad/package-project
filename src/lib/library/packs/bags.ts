import * as BAGS from "@/lib/dieline/families/bags";
import type { BoxModelDef } from "../types";
import { search } from "./common-box";

/**
 * Store (carrier) bags pack (src/lib/dieline/families/bags). Every bag is produced and priced as
 * the core PAPER_BAG structure; the handle (type and colour) lives in `features.bagHandle`.
 */
export const models: BoxModelDef[] = BAGS.DEFINITIONS.map((d) => ({
  kind: "box",
  code: d.code,
  slug: d.slug,
  group: "BAGS",
  source: "bags",
  standard: d.standard,
  name: d.name,
  description: d.description,
  search: search(d.code, d.code.replace(/_/g, " "), d.name.en, d.name.ar, d.slug, d.subFamily, "bag bags carrier shopping كيس أكياس شنطة شنط", d.line === "handmade" ? "art paper couche كوشيه" : "kraft كرافت"),
  family: "PAPER_BAG",
  shape: "box",
  limits: d.params,
  defaultDims: d.defaultDims,
  presets: d.presets,
  materials: d.materials,
  features: d.features,
  baseFor: () => "PAPER_BAG",
  build: (dims, o) => BAGS.buildBag(d.code, dims, { thicknessMm: o.thicknessMm, features: o.features }),
  fidelity: "exact",
  openTop: true,
}));
