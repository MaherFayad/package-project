import type { ArtworkLayer, DesignDoc, FaceId, ImageLayer, PreflightIssue, PreflightSeverity, PrintSurface } from "@/types";
import { applyAffine, faceTransform, type DielineModel, type FaceInfo } from "@/lib/dieline";
import { convexOverlap, layerQuad, type P } from "./geometry";

/** Print resolution thresholds (effective dots per inch at the printed size). */
export const DPI_ERROR = 150;
export const DPI_WARNING = 300;
/** Smallest text that prints cleanly on board (points). */
export const MIN_TEXT_PT = 6;

const SEVERITY_ORDER: Record<PreflightSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Effective DPI of an image layer at its printed size. */
export function effectiveDpi(l: Pick<ImageLayer, "width" | "height" | "pxWidth" | "pxHeight" | "fit">): number {
  const iw = Math.max(1, l.pxWidth);
  const ih = Math.max(1, l.pxHeight);
  const fit = l.fit ?? "contain";
  if (fit === "stretch") return Math.min(iw / (l.width / 25.4), ih / (l.height / 25.4));
  const mmPerPx = fit === "contain" ? Math.min(l.width / iw, l.height / ih) : Math.max(l.width / iw, l.height / ih);
  return 25.4 / mmPerPx;
}

/** Layer outline in sheet mm, one polygon per face part it is painted on. */
function sheetFootprints(layer: ArtworkLayer, face: FaceInfo, surface: PrintSurface): { panelId: string; poly: P[] }[] {
  const quad = layerQuad(layer);
  return face.parts.map((part) => {
    const m = faceTransform(face, part, surface);
    return { panelId: part.panelId, poly: quad.map((p) => applyAffine(m, p.x, p.y)) };
  });
}

function insideRect(quad: P[], minX: number, minY: number, maxX: number, maxY: number, tol = 0.01): boolean {
  return quad.every((p) => p.x >= minX - tol && p.x <= maxX + tol && p.y >= minY - tol && p.y <= maxY + tol);
}

/**
 * Production preflight on the design + its dieline. Pure: the designer shows the result live
 * and the order flow can run the same function server-side.
 *
 * - LOW_DPI: images under 300 dpi (warning) or 150 dpi (error) at their printed size.
 * - ON_GLUE_FLAP: an item runs onto a glue flap (that part is cut off: glue flaps stay ink-free).
 * - CROSSES_FOLD: an item crosses a fold line (it is clipped at the fold). Error for text.
 * - OUTSIDE_SAFE_ZONE: text or an image sits closer to an edge than the safe margin.
 * - TEXT_TOO_SMALL: text under 6 pt.
 * - EMPTY_DESIGN: nothing printed on the outside (info).
 * The inside surface is only checked when printSides is BOTH.
 */
export function runPreflight(doc: DesignDoc, model: DielineModel): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const surfaces: PrintSurface[] = doc.printSides === "BOTH" ? ["outside", "inside"] : ["outside"];
  const glue = model.panels.filter((p) => p.role === "glue").map((p) => p.polygon);
  const creases = model.creaseLines.map((s) => [s.a, s.b]);
  const safe = model.safeMm;

  for (const surface of surfaces) {
    for (const layer of doc.artwork[surface].layers) {
      if (layer.hidden || layer.surface !== surface) continue;
      const face = model.faces[layer.face];
      if (!face) continue;
      const push = (code: PreflightIssue["code"], severity: PreflightSeverity) =>
        issues.push({ code, severity, layerId: layer.id, face: layer.face, messageKey: `preflight.${code}` });

      if (layer.kind === "image") {
        const dpi = effectiveDpi(layer);
        if (dpi < DPI_ERROR) push("LOW_DPI", "error");
        else if (dpi < DPI_WARNING) push("LOW_DPI", "warning");
      }
      if (layer.kind === "text") {
        if (!layer.text.trim()) continue;
        if (layer.fontSizePt < MIN_TEXT_PT) push("TEXT_TOO_SMALL", "warning");
      }

      const prints = sheetFootprints(layer, face, surface);
      const onGlue = prints.some(({ poly }) => glue.some((g) => convexOverlap(poly, g)));
      const crossesFold = !onGlue && prints.some(({ poly }) => creases.some((seg) => convexOverlap(poly, seg, 0.25)));
      if (onGlue) push("ON_GLUE_FLAP", layer.kind === "text" ? "error" : "warning");
      else if (crossesFold) push("CROSSES_FOLD", layer.kind === "text" ? "error" : "warning");
      else if (layer.kind !== "shape" && !insideRect(layerQuad(layer), safe, safe, face.width - safe, face.height - safe)) {
        push("OUTSIDE_SAFE_ZONE", "warning");
      }
    }
  }

  const outside = doc.artwork.outside;
  const hasVisible = outside.layers.some((l) => !l.hidden && (l.kind !== "text" || l.text.trim()));
  if (!outside.background && !hasVisible) {
    issues.push({ code: "EMPTY_DESIGN", severity: "info", messageKey: "preflight.EMPTY_DESIGN" });
  }

  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export interface PreflightSummary {
  errors: number;
  warnings: number;
  infos: number;
  empty: boolean;
  /** Green "Ready to print": something to print and no errors or warnings. */
  ready: boolean;
}

export function summarizePreflight(issues: PreflightIssue[]): PreflightSummary {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  const empty = issues.some((i) => i.code === "EMPTY_DESIGN");
  return { errors, warnings, infos, empty, ready: errors === 0 && warnings === 0 && !empty };
}

/** Faces with at least one issue (for badges on the face picker). */
export function facesWithIssues(issues: PreflightIssue[]): Set<FaceId> {
  return new Set(issues.filter((i) => i.face && i.severity !== "info").map((i) => i.face!));
}
