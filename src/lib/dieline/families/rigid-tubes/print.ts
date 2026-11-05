import { polygonArea } from "../../geometry";
import type { DielineModel } from "../../types";

/**
 * Print area math of a model (m²): trim = printable panels as cut, bleed = trim grown by the
 * bleed on cut edges, safe = sum of safe zones (keep text and logos inside).
 */
export function printAreas(model: DielineModel): { trimM2: number; bleedM2: number; safeM2: number; sheetM2: number } {
  const printable = model.panels.filter((p) => p.printable);
  const holes = (p: (typeof printable)[number]) => (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0);
  const trim = printable.reduce((s, p) => s + polygonArea(p.polygon) - holes(p), 0);
  const bleed = model.bleedRegions.reduce((s, r) => s + polygonArea(r.polygon), 0);
  const safe = model.safeZones.reduce((s, z) => s + z.rect.width * z.rect.height, 0);
  return { trimM2: trim / 1e6, bleedM2: bleed / 1e6, safeM2: safe / 1e6, sheetM2: (model.sheet.width * model.sheet.height) / 1e6 };
}
