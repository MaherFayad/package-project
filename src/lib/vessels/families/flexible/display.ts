import { definitionFor } from "./definitions";
import type { FlexConfig } from "./schema";
import { solveShape } from "./shape";
import type { FlexPanelId, FlexibleCode } from "./types";

/**
 * Framing and default print panels for the 3D view (audit 3d-cans-flexible E-06, E-07).
 * The envelope is the FILLED pack as displayed (pillows shrink and bulge, flow wraps lie on their
 * side), not the flat W x H: frame the camera on this.
 */
export function flexDisplayEnvelope(cfg: FlexConfig): { width: number; depth: number; height: number } {
  return solveShape(cfg).envelope;
}

/** Every panel of the pack is printed on a real job (gussets and bottoms included). */
export function defaultPrintPanels(code: FlexibleCode): FlexPanelId[] {
  return [...definitionFor(code).panels];
}
