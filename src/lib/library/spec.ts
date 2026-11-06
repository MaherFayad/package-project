import type { DesignDoc, Locale } from "@/types";
import { FINISHES } from "@/lib/configurator/catalog";
import { docModel } from "./doc";

/**
 * Human summary of a design's configuration (checkout proof, order pages): the model, its
 * size in mm, container / closure / print areas for containers and every finish by name.
 * Strings come from the library and configurator catalogues (Arabic + English).
 */
export interface DocSpec {
  model: string | null;
  standard: string | null;
  /** "65 × 197 mm" style size for containers (boxes use formatDims on doc.dims). */
  vesselSize: string | null;
  container: string | null;
  closure: string | null;
  surfaces: string[];
  finishes: string[];
}

export function docSpec(doc: DesignDoc, locale: Locale): DocSpec {
  const m = docModel(doc);
  const finishes = (doc.finishes ?? []).map((f) => FINISHES[f.code]?.name[locale] ?? f.code);
  if (!m) return { model: null, standard: null, vesselSize: null, container: null, closure: null, surfaces: [], finishes };
  if (m.kind === "box") return { model: m.name[locale], standard: m.standard || null, vesselSize: null, container: null, closure: null, surfaces: [], finishes };
  const v = doc.vessel;
  const d = v?.dims;
  const mm = locale === "ar" ? "مم" : "mm";
  return {
    model: m.name[locale],
    standard: m.standard || null,
    vesselSize: d ? `⁦${[d.D, d.H, d.G].filter((x): x is number => typeof x === "number").map((x) => Math.round(x)).join(" × ")} ${mm}⁩` : null,
    container: m.containers.find((c) => c.code === v?.container)?.name[locale] ?? null,
    closure: m.closures.find((c) => c.code === v?.closure)?.name[locale] ?? null,
    surfaces: v?.surfaces ?? [],
    finishes,
  };
}
