import type { Mm } from "@/types";
import {
  LABEL_STOCKS,
  SLEEVE_BLEED_MM,
  SLEEVE_EASE,
  SLEEVE_SAFE_MM,
  SLEEVE_SEAM_MM,
  bandSpec,
  discSpec,
  faceSpec,
  flatPoint,
  silhouetteLength,
  finishesForStock,
  stocksForSurface,
  type LabelSpec,
  type LabelStockCode,
  type PrintSurfaceKind,
  type SleeveGeometry,
} from "../../index";
import { bottleGirthAt, halfWidthAt } from "./builder";
import { BOTTLE_CLOSURES } from "./closures";
import { bottleSectionPerimeter, frontFlatWidth, sectionPointAtArc } from "./section";
import type { BottleClosureCode, BottleLabelSpec, BottleProfile, VesselDims } from "./types";

/**
 * Print surfaces for catalogue models, built on the core label helpers so the pricing engine,
 * SVG export and roll-label layout keep working. Round bodies reuse the core cylinder / cone
 * mapping as is; non-round bodies (oval, rectangle, hexagon) use developed arc length.
 */

const round1 = (n: number) => Math.round(n * 10) / 10;

function withSafe(spec: LabelSpec, mapping: BottleLabelSpec["mapping"]): BottleLabelSpec {
  const inset = spec.bleedMm + spec.safeMm;
  return {
    ...spec,
    mapping,
    safeRect: { x: inset, y: inset, width: Math.max(0, spec.printWidthMm - 2 * inset), height: Math.max(0, spec.printHeightMm - 2 * inset) },
  };
}

/** Sleeve on any section (core sleeveSpec only knows round / rounded rect). */
export function bottleSleeveSpec(p: BottleProfile, y0: Mm, y1: Mm): BottleLabelSpec {
  let maxG = 0;
  for (let y = y0; y <= y1; y += 0.5) maxG = Math.max(maxG, bottleGirthAt(p, y));
  const C = Math.ceil(maxG * (1 + SLEEVE_EASE));
  const film = LABEL_STOCKS.PETG_SHRINK.shrink!;
  const cutH = silhouetteLength(p.outer, y0, y1) * (1 + film.mdPct / 100);
  const ratios: SleeveGeometry["girthRatios"] = [];
  let minRatio = 1;
  const n = 24;
  for (let k = 0; k <= n; k++) {
    const y = y0 + ((y1 - y0) * k) / n;
    const ratio = bottleGirthAt(p, y) / C;
    minRatio = Math.min(minRatio, ratio);
    ratios.push({ t: k / n, y, ratio });
  }
  const maxShrink = 1 - minRatio;
  const warnings: string[] = [];
  if (maxShrink * 100 > film.designLimitPct) warnings.push(`sleeve.shrinkTooHigh:${Math.round(maxShrink * 100)}`);
  else if (maxShrink * 100 > 55) warnings.push(`sleeve.distortionZone:${Math.round(maxShrink * 100)}`);
  const stocks = stocksForSurface("SHRINK_SLEEVE");
  const w = C + SLEEVE_SEAM_MM;
  const spec: LabelSpec = {
    id: "shrink_sleeve",
    kind: "SHRINK_SLEEVE",
    name: { ar: "غلاف انكماش كامل", en: "Full shrink sleeve" },
    shape: "rect",
    placement: { type: "sleeve", y0, y1 },
    trimWidthMm: round1(w),
    trimHeightMm: round1(cutH),
    bleedMm: SLEEVE_BLEED_MM,
    safeMm: SLEEVE_SAFE_MM,
    printWidthMm: round1(w + 2 * SLEEVE_BLEED_MM),
    printHeightMm: round1(cutH + 2 * SLEEVE_BLEED_MM),
    trimAreaM2: (w * cutH) / 1e6,
    overlapMm: SLEEVE_SEAM_MM,
    sleeve: { circumferenceMm: C, layFlatMm: round1(C / 2 + SLEEVE_SEAM_MM / 2), seamMm: SLEEVE_SEAM_MM, cutHeightMm: round1(cutH), maxShrink, girthRatios: ratios },
    stocks,
    defaultStock: stocks[0],
    finishes: finishesForStock(stocks[0]),
    warnings,
  };
  return withSafe(spec, "sleeve");
}

export interface LabelOptions {
  closure?: BottleClosureCode;
  /** Wet / chilled products default to film labels. */
  wet?: boolean;
}

/** Every requested print surface for a profile. Unsupported surfaces are skipped. */
export function bottleLabelSpecs(p: BottleProfile, dims: VesselDims, surfaces: PrintSurfaceKind[], opts: LabelOptions = {}): BottleLabelSpec[] {
  const out: BottleLabelSpec[] = [];
  const b = p.body;
  const round = p.bottleSection.kind === "round";
  const margin = Math.min(3, (b.y1 - b.y0) * 0.06);
  const y0 = b.y0 + margin;
  const y1 = b.y1 - margin;
  const rAt = (y: Mm) => b.r0 + ((b.r1 - b.r0) * (y - b.y0)) / Math.max(1e-6, b.y1 - b.y0);
  const stock: LabelStockCode | undefined = opts.wet ? "WHITE_BOPP" : undefined;
  const cone = Math.abs(b.r0 - b.r1) >= 0.25;
  const roundMapping = cone ? "cone" : "cylinder";

  for (const s of surfaces) {
    if (s === "WRAP") {
      if (round) {
        out.push(withSafe(bandSpec("WRAP", y0, y1, rAt(y0), rAt(y1), -Math.PI, 2 * Math.PI, { defaultStock: stock }), roundMapping));
      } else {
        // girth-equivalent radius: r * 2 pi = developed girth, so the core band math is exact
        const { a, s: sq } = halfWidthAt(p, (y0 + y1) / 2);
        const rEq = bottleSectionPerimeter(p.bottleSection, a, sq) / (2 * Math.PI);
        out.push(withSafe(bandSpec("WRAP", y0, y1, rEq, rEq, -Math.PI, 2 * Math.PI, { defaultStock: stock }), "prism"));
      }
    } else if (s === "FRONT" || s === "BACK") {
      const h = (y1 - y0) * 0.86;
      const cy = (y0 + y1) / 2;
      if (round) {
        const span = (2 * Math.PI) / 2.3;
        const center = s === "FRONT" ? 0 : Math.PI;
        out.push(withSafe(bandSpec(s, cy - h / 2, cy + h / 2, rAt(cy - h / 2), rAt(cy + h / 2), center - span / 2, span, { defaultStock: stock }), roundMapping));
      } else {
        const { a } = halfWidthAt(p, cy);
        const flat = frontFlatWidth(p.bottleSection, a);
        const girth = bottleSectionPerimeter(p.bottleSection, a, 1);
        // a front label may run onto the corners but never past 40% of the girth
        const w = round1(Math.min(girth * 0.4, Math.max(flat * 0.9, flat + 0.5 * (girth / 2 - flat) * 0.5)));
        const spec = faceSpec(s, -w / 2, w / 2, cy - h / 2, cy + h / 2, stock);
        out.push(withSafe(spec, "developedFace"));
      }
    } else if (s === "SHRINK_SLEEVE") {
      const bottom = p.base.kind === "petaloid" ? p.base.clearanceMm + 4 : 1.5;
      out.push(bottleSleeveSpec(p, bottom, p.fillMaxY));
    } else if (s === "NECK" && p.neckZone) {
      const z = p.neckZone;
      const coneNeck = Math.abs(z.r0 - z.r1) >= 0.25;
      out.push(withSafe(bandSpec("NECK", z.y0, z.y1, z.r0, z.r1, -Math.PI, 2 * Math.PI), coneNeck ? "cone" : "cylinder"));
    } else if (s === "LID") {
      const c = opts.closure ? BOTTLE_CLOSURES[opts.closure] : undefined;
      if (c && !c.printableTop) continue;
      const capR = p.finishR + (c?.extraDiameterMm ?? 2) / 2;
      const r = capR - Math.max(2, capR * 0.08);
      if (r < 6) continue;
      out.push(withSafe(discSpec(p.finishTopY + (c?.heightAboveMm ?? 2), r), "disc"));
    }
  }
  void dims;
  return out;
}

/**
 * 3D point (container coordinates, mm) for flat label coordinates s (0..1 left to right as
 * seen from the front) and t (0..1 bottom to top). This is the inverse of the UV mapping: a
 * renderer that builds label geometry from it and samples UVs with core `surfaceUv` puts flat
 * artwork on the container without distortion (isometric for cylinders, cones and prisms).
 */
export function surfacePoint(spec: BottleLabelSpec, p: BottleProfile, s: number, t: number): { x: Mm; y: Mm; z: Mm } {
  const pl = spec.placement;
  if (pl.type === "band") {
    const y = pl.y0 + (pl.y1 - pl.y0) * t;
    if (spec.mapping === "prism") {
      const { a, s: sq } = halfWidthAt(p, y);
      const girth = bottleSectionPerimeter(p.bottleSection, a, sq);
      const u = (s - 0.5) * girth; // s = 0 / 1 at the back seam, 0.5 at the front centre
      const q = sectionPointAtArc(p.bottleSection, a, u, sq);
      return { x: q.x, y, z: q.z };
    }
    const r = pl.r0 + (pl.r1 - pl.r0) * t;
    const phi = pl.phiStart + s * pl.phiLength;
    return { x: r * Math.sin(phi), y, z: r * Math.cos(phi) };
  }
  if (pl.type === "face") {
    const y = pl.y0 + (pl.y1 - pl.y0) * t;
    const { a, s: sq } = halfWidthAt(p, y);
    const girth = bottleSectionPerimeter(p.bottleSection, a, sq);
    const u = pl.x0 + (pl.x1 - pl.x0) * s + (pl.face === "back" ? girth / 2 : 0);
    const q = sectionPointAtArc(p.bottleSection, a, u, sq);
    return { x: q.x, y, z: q.z };
  }
  if (pl.type === "disc") {
    return { x: (s - 0.5) * 2 * pl.radius, y: pl.y, z: (0.5 - t) * 2 * pl.radius };
  }
  // sleeve: t follows the silhouette height, s the full girth from the back seam
  const y = pl.y0 + (pl.y1 - pl.y0) * t;
  const { a, s: sq } = halfWidthAt(p, y);
  const girth = bottleSectionPerimeter(p.bottleSection, a, sq);
  const q = sectionPointAtArc(p.bottleSection, a, (s - 0.5) * girth, sq);
  return { x: q.x, y, z: q.z };
}

export { flatPoint };
