import type { LocalizedText } from "@/types";
import type { NeckFinish } from "../../../types";
import type { CatalogueDims, CataloguePreset } from "../types";

export const t = (en: string, ar: string): LocalizedText => ({ en, ar });

/** Preset shorthand. `ml` 0 = no liquid capacity. */
export function preset(
  id: string,
  en: string,
  ar: string,
  ml: number,
  dims: CatalogueDims,
  source: string,
  extra: { neck?: NeckFinish; brimfulMl?: number; egypt?: boolean } = {},
): CataloguePreset {
  return { id, name: { en, ar }, capacityMl: ml, dims, source, ...extra };
}

export const APPROX = "approx., confirm with the supplier drawing";
