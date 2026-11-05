import type { LocalizedText, Mm } from "@/types";
import { pouchDims, radiusAt, sectionPerimeter, silhouetteLength, squarenessAt, tinLidHeight, tubeDims, type SectionPoint } from "./profile";
import { LABEL_STOCKS, finishesForStock, stocksForSurface } from "./stocks";
import type { LabelSpec, LabelStockCode, PrintSurfaceKind, SectorGeometry, SleeveGeometry, SurfacePlacement, VesselDims, VesselKind, VesselProfile } from "./types";

/** Default prepress numbers for roll labels (mm). */
export const LABEL_BLEED_MM = 2;
export const LABEL_SAFE_MM = 2.5;
export const WRAP_OVERLAP_MM = 8;
export const SLEEVE_BLEED_MM = 3;
export const SLEEVE_SAFE_MM = 3;
/** Sleeve is cut 3% larger in girth than the widest point so it slides on. */
export const SLEEVE_EASE = 0.03;
export const SLEEVE_SEAM_MM = 6;
/** Below this radius difference a band is treated as a cylinder (rectangle label). */
const CONE_EPS_MM = 0.25;

const NAMES: Record<PrintSurfaceKind, LocalizedText> = {
  WRAP: { ar: "ملصق دائري كامل", en: "Wrap-around label" },
  FRONT: { ar: "ملصق أمامي", en: "Front label" },
  BACK: { ar: "ملصق خلفي", en: "Back label" },
  SHRINK_SLEEVE: { ar: "غلاف انكماش كامل", en: "Full shrink sleeve" },
  NECK: { ar: "ملصق العنق", en: "Neck label" },
  LID: { ar: "ملصق الغطاء", en: "Lid label" },
};

const round1 = (n: number) => Math.round(n * 10) / 10;

interface Base {
  kind: PrintSurfaceKind;
  placement: SurfacePlacement;
  warnings?: string[];
  defaultStock?: LabelStockCode;
}

function finishSpec(b: Base, shape: LabelSpec["shape"], trimW: Mm, trimH: Mm, trimAreaMm2: number, bleed: Mm, safe: Mm, extra: Partial<LabelSpec> = {}): LabelSpec {
  const stocks = stocksForSurface(b.kind);
  const defaultStock = b.defaultStock && stocks.includes(b.defaultStock) ? b.defaultStock : stocks[0];
  return {
    id: b.kind.toLowerCase(),
    kind: b.kind,
    name: NAMES[b.kind],
    shape,
    placement: b.placement,
    trimWidthMm: round1(trimW),
    trimHeightMm: round1(trimH),
    bleedMm: bleed,
    safeMm: safe,
    printWidthMm: round1(trimW + 2 * bleed),
    printHeightMm: round1(trimH + 2 * bleed),
    trimAreaM2: trimAreaMm2 / 1e6,
    stocks,
    defaultStock,
    finishes: finishesForStock(defaultStock),
    warnings: b.warnings ?? [],
    ...extra,
  };
}

/** Unroll a cone frustum band into an annular sector (exact, no distortion). */
export function sectorFor(r0: Mm, r1: Mm, height: Mm, phiLength: number, bleed: Mm): { sector: SectorGeometry; trimW: Mm; trimH: Mm; areaMm2: number } {
  const slant = Math.hypot(r1 - r0, height);
  const rBig = Math.max(r0, r1);
  const rSmall = Math.min(r0, r1);
  const outer = (slant * rBig) / (rBig - rSmall);
  const inner = outer - slant;
  const angle = (phiLength * rBig) / outer;
  const apexAbove = r0 > r1;
  // bounding box in apex-local coords (y down when the apex is above)
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const steps = 64;
  for (let k = 0; k <= steps; k++) {
    const a = -angle / 2 + (k / steps) * angle;
    for (const R of [inner, outer]) {
      const x = R * Math.sin(a);
      const y = apexAbove ? R * Math.cos(a) : -R * Math.cos(a);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  // the extreme of a wide sector can be at a = ±90° (inside the sweep)
  if (angle > Math.PI) {
    minX = Math.min(minX, -outer);
    maxX = Math.max(maxX, outer);
  }
  const sector: SectorGeometry = {
    apexX: bleed - minX,
    apexY: bleed - minY,
    innerRadiusMm: inner,
    outerRadiusMm: outer,
    angle,
    apexAbove,
    slantMm: slant,
  };
  return { sector, trimW: maxX - minX, trimH: maxY - minY, areaMm2: 0.5 * angle * (outer * outer - inner * inner) };
}

/** Band label (wrap, front, back, neck) on the revolved wall. */
export function bandSpec(kind: PrintSurfaceKind, y0: Mm, y1: Mm, r0: Mm, r1: Mm, phiStart: number, phiLength: number, opts: { warnings?: string[]; defaultStock?: LabelStockCode } = {}): LabelSpec {
  const bleed = LABEL_BLEED_MM;
  const safe = LABEL_SAFE_MM;
  const placement: SurfacePlacement = { type: "band", y0, y1, r0, r1, phiStart, phiLength };
  const full = phiLength >= 2 * Math.PI - 1e-6;
  if (Math.abs(r0 - r1) < CONE_EPS_MM) {
    const r = (r0 + r1) / 2;
    const overlap = full ? WRAP_OVERLAP_MM : 0;
    const w = r * phiLength + overlap;
    const h = Math.hypot(y1 - y0, r1 - r0);
    return finishSpec({ kind, placement, ...opts }, "rect", w, h, w * h, bleed, safe, { overlapMm: full ? overlap : undefined, cornerRadiusMm: full ? 0 : 2 });
  }
  const { sector, trimW, trimH, areaMm2 } = sectorFor(r0, r1, y1 - y0, phiLength, bleed);
  return finishSpec({ kind, placement, ...opts }, "sector", trimW, trimH, areaMm2, bleed, safe, { sector });
}

/** Shrink sleeve that conforms to the profile between y0 and y1. */
export function sleeveSpec(profile: VesselProfile, y0: Mm, y1: Mm): LabelSpec {
  const outer = profile.outer as SectionPoint[];
  const girth = (y: Mm) => sectionPerimeter(profile.section, radiusAt(outer, y), profile.section.kind === "round" ? 1 : squarenessAt(outer, y));
  let maxG = 0;
  for (let y = y0; y <= y1; y += 0.5) maxG = Math.max(maxG, girth(y));
  const C = Math.ceil(maxG * (1 + SLEEVE_EASE));
  const stock = LABEL_STOCKS.PETG_SHRINK.shrink!;
  const arc = silhouetteLength(profile.outer, y0, y1);
  const cutH = arc * (1 + stock.mdPct / 100);
  const ratios: SleeveGeometry["girthRatios"] = [];
  let minRatio = 1;
  const n = 24;
  for (let k = 0; k <= n; k++) {
    const y = y0 + ((y1 - y0) * k) / n;
    const ratio = girth(y) / C;
    minRatio = Math.min(minRatio, ratio);
    ratios.push({ t: k / n, y, ratio });
  }
  const maxShrink = 1 - minRatio;
  const warnings: string[] = [];
  if (maxShrink * 100 > stock.designLimitPct) warnings.push(`sleeve.shrinkTooHigh:${Math.round(maxShrink * 100)}`);
  else if (maxShrink * 100 > 55) warnings.push(`sleeve.distortionZone:${Math.round(maxShrink * 100)}`);
  const sleeve: SleeveGeometry = {
    circumferenceMm: C,
    layFlatMm: round1(C / 2 + SLEEVE_SEAM_MM / 2),
    seamMm: SLEEVE_SEAM_MM,
    cutHeightMm: round1(cutH),
    maxShrink,
    girthRatios: ratios,
  };
  return finishSpec(
    { kind: "SHRINK_SLEEVE", placement: { type: "sleeve", y0, y1 }, warnings },
    "rect",
    C + SLEEVE_SEAM_MM,
    cutH,
    (C + SLEEVE_SEAM_MM) * cutH,
    SLEEVE_BLEED_MM,
    SLEEVE_SAFE_MM,
    { sleeve, overlapMm: SLEEVE_SEAM_MM },
  );
}

export function discSpec(y: Mm, radius: Mm): LabelSpec {
  const d = 2 * radius;
  return finishSpec({ kind: "LID", placement: { type: "disc", y, radius } }, "circle", d, d, Math.PI * radius * radius, LABEL_BLEED_MM, LABEL_SAFE_MM);
}

export function faceSpec(kind: "FRONT" | "BACK", x0: Mm, x1: Mm, y0: Mm, y1: Mm, defaultStock?: LabelStockCode): LabelSpec {
  const w = x1 - x0;
  const h = y1 - y0;
  return finishSpec({ kind, placement: { type: "face", face: kind === "FRONT" ? "front" : "back", x0, x1, y0, y1 }, defaultStock }, "rect", w, h, w * h, LABEL_BLEED_MM, LABEL_SAFE_MM, {
    cornerRadiusMm: 3,
  });
}

/** Top of the closure where a lid label sits, and the usable flat radius. */
export function lidTop(kind: VesselKind, dims: VesselDims, profile: VesselProfile): { y: Mm; radius: Mm } | null {
  switch (kind) {
    case "WIDE_JAR":
      return { y: profile.finishTopY + 1.6, radius: profile.finishR + 0.8 - 4 };
    case "ROUND_TIN":
      return { y: dims.H + 0.6, radius: dims.D / 2 + 0.6 - 3.5 };
    case "ROUND_BOTTLE":
    case "BOSTON_ROUND":
      return { y: profile.finishTopY + 3, radius: profile.finishR + 1.4 - 2 };
    default:
      return null;
  }
}

/** Every print surface a container offers, sized to the container (mm). */
export function labelSpecsFor(kind: VesselKind, dims: VesselDims, profile: VesselProfile, surfaces: PrintSurfaceKind[]): LabelSpec[] {
  const out: LabelSpec[] = [];
  const b = profile.body;
  const margin = Math.min(3, (b.y1 - b.y0) * 0.06);
  const y0 = b.y0 + margin;
  const y1 = b.y1 - margin;
  const rAt = (y: number) => b.r0 + ((b.r1 - b.r0) * (y - b.y0)) / Math.max(1e-6, b.y1 - b.y0);
  const isPouch = kind === "STAND_UP_POUCH";
  const isSquare = profile.section.kind === "roundedRect" && !isPouch;
  const wet = kind === "CAN" || kind === "ROUND_BOTTLE";

  for (const s of surfaces) {
    if (s === "WRAP" && !isSquare && !isPouch) {
      out.push(bandSpec("WRAP", y0, y1, rAt(y0), rAt(y1), -Math.PI, 2 * Math.PI, { defaultStock: wet ? "WHITE_BOPP" : undefined }));
    } else if ((s === "FRONT" || s === "BACK") && (isSquare || isPouch)) {
      if (isPouch) {
        const p = pouchDims(dims);
        const w = Math.round(p.W * 0.62);
        const top = p.zipperY - 14;
        const h = Math.round(Math.min(p.H * 0.42, top - p.G * 0.55));
        out.push(faceSpec(s, -w / 2, w / 2, top - h, top, "WHITE_BOPP"));
      } else {
        const half = dims.D / 2;
        const w = Math.round((half * 2 - 2 * half * 0.16) * 0.84);
        const h = Math.round((y1 - y0) * 0.72);
        const cy = (y0 + y1) / 2;
        out.push(faceSpec(s, -w / 2, w / 2, cy - h / 2, cy + h / 2));
      }
    } else if ((s === "FRONT" || s === "BACK") && !isSquare && !isPouch) {
      const span = Math.min(0.42 * 2 * Math.PI, (2 * Math.PI) / 2.3);
      const h = (y1 - y0) * 0.86;
      const cy = (y0 + y1) / 2;
      const center = s === "FRONT" ? 0 : Math.PI;
      out.push(bandSpec(s, cy - h / 2, cy + h / 2, rAt(cy - h / 2), rAt(cy + h / 2), center - span / 2, span));
    } else if (s === "SHRINK_SLEEVE" && !isSquare && !isPouch) {
      const top = kind === "CAN" ? profile.finishTopY - 3.4 : kind === "WIDE_JAR" ? profile.finishTopY - profile.finishH - 1.2 : profile.fillMaxY;
      const bottom = kind === "CAN" ? 3 : kind === "SQUEEZE_TUBE" ? tubeDims(dims).bodyY0 : 1;
      out.push(sleeveSpec(profile, bottom, top));
    } else if (s === "NECK" && profile.shoulder) {
      const sh = profile.shoulder;
      out.push(bandSpec("NECK", sh.y0, sh.y1, sh.r0, sh.r1, -Math.PI, 2 * Math.PI));
    } else if (s === "LID") {
      const lid = lidTop(kind, dims, profile);
      if (lid) out.push(discSpec(lid.y, lid.radius));
    }
  }
  if (kind === "ROUND_TIN") {
    const lidH = tinLidHeight(dims);
    for (const spec of out) if (spec.kind === "WRAP" && spec.trimHeightMm < 8) spec.warnings.push(`wrap.tooShortUnderLid:${lidH}`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Flat <-> surface mapping (the UV contract between the 3D model and the artwork canvas)
// ---------------------------------------------------------------------------------------------

/**
 * Flat print coordinates (mm, origin top-left of the print area incl. bleed, y down) of a point
 * on the surface. s = 0..1 across (left to right as seen from the front), t = 0..1 bottom to
 * top (for sleeves: fraction of the silhouette arc length). The 3D models use exactly this
 * for their UVs, so artwork drawn in flat space lands on the container without distortion.
 */
export function flatPoint(spec: LabelSpec, s: number, t: number): { x: Mm; y: Mm } {
  const bleed = spec.bleedMm;
  if (spec.shape === "sector" && spec.sector) {
    const g = spec.sector;
    const a = (s - 0.5) * g.angle;
    const R = g.apexAbove ? g.outerRadiusMm - t * g.slantMm : g.innerRadiusMm + t * g.slantMm;
    return g.apexAbove ? { x: g.apexX + R * Math.sin(a), y: g.apexY + R * Math.cos(a) } : { x: g.apexX + R * Math.sin(a), y: g.apexY - R * Math.cos(a) };
  }
  const usableW = spec.trimWidthMm - (spec.overlapMm ?? 0);
  return { x: bleed + s * usableW, y: bleed + (1 - t) * spec.trimHeightMm };
}

/** UV (0..1, v up as in WebGL) of a surface point for a texture covering the print area. */
export function surfaceUv(spec: LabelSpec, s: number, t: number): [number, number] {
  const p = flatPoint(spec, s, t);
  return [p.x / spec.printWidthMm, 1 - p.y / spec.printHeightMm];
}

/** Horizontal squeeze the artwork gets at height t of a sleeve (1 = none). Pre-distort by 1/ratio. */
export function sleeveRatioAt(spec: LabelSpec, t: number): number {
  const r = spec.sleeve?.girthRatios;
  if (!r?.length) return 1;
  const k = Math.min(r.length - 2, Math.max(0, Math.floor(t * (r.length - 1))));
  const a = r[k];
  const b = r[k + 1];
  const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return a.ratio + (b.ratio - a.ratio) * Math.min(1, Math.max(0, f));
}
