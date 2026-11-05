import type { LabelSpec } from "./types";

export interface LabelSvgOptions {
  title?: string;
  /** Show the bleed (pink), trim (solid), safe zone (dotted green). Default true. */
  guides?: boolean;
  /** Fill of the label face. Default white. */
  face?: string;
  /** Guides only (no fills), to lay over a picture of the artwork. */
  overlay?: boolean;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/** Path of the label outline offset by `d` mm (positive = outward), in print coordinates. */
export function labelOutlinePath(spec: LabelSpec, d: number): string {
  const b = spec.bleedMm;
  if (spec.shape === "sector" && spec.sector) {
    const g = spec.sector;
    const rIn = Math.max(0.1, g.innerRadiusMm - d);
    const rOut = g.outerRadiusMm + d;
    // offset the straight edges by rotating the half angle by d / radius (approximation that stays parallel)
    const half = g.angle / 2 + d / ((rIn + rOut) / 2);
    const sgn = g.apexAbove ? 1 : -1;
    const pt = (R: number, a: number) => `${f(g.apexX + R * Math.sin(a))} ${f(g.apexY + sgn * R * Math.cos(a))}`;
    const large = 2 * half > Math.PI ? 1 : 0;
    const sweepOuter = g.apexAbove ? 0 : 1;
    const sweepInner = g.apexAbove ? 1 : 0;
    return `M${pt(rOut, -half)} A${f(rOut)} ${f(rOut)} 0 ${large} ${sweepOuter} ${pt(rOut, half)} L${pt(rIn, half)} A${f(rIn)} ${f(rIn)} 0 ${large} ${sweepInner} ${pt(rIn, -half)} Z`;
  }
  if (spec.shape === "circle") {
    const r = spec.trimWidthMm / 2 + d;
    const cx = b + spec.trimWidthMm / 2;
    const cy = b + spec.trimHeightMm / 2;
    return `M${f(cx - r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
  }
  const x = b - d;
  const y = b - d;
  const w = spec.trimWidthMm + 2 * d;
  const h = spec.trimHeightMm + 2 * d;
  const r = Math.max(0, (spec.cornerRadiusMm ?? 0) + d);
  if (r <= 0) return `M${f(x)} ${f(y)} H${f(x + w)} V${f(y + h)} H${f(x)} Z`;
  return `M${f(x + r)} ${f(y)} H${f(x + w - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V${f(y + h - r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H${f(x + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V${f(y + r)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`;
}

/** Flat label/sleeve artwork template (mm units, viewBox = print area). */
export function labelSvg(spec: LabelSpec, opts: LabelSvgOptions = {}): string {
  const W = spec.printWidthMm;
  const H = spec.printHeightMm;
  const guides = opts.guides ?? true;
  const face = opts.face ?? "#ffffff";
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}mm" height="${f(H)}mm" role="img">`);
  if (opts.title) parts.push(`<title>${opts.title.replace(/[<&>]/g, "")}</title>`);
  if (guides) parts.push(`<path d="${labelOutlinePath(spec, spec.bleedMm)}" fill="${opts.overlay ? "none" : "#ffd9e4"}" stroke="#e0457b" stroke-width="0.3"/>`);
  parts.push(`<path d="${labelOutlinePath(spec, 0)}" fill="${opts.overlay ? "none" : face}" stroke="#303030" stroke-width="0.4"/>`);
  if (guides) {
    parts.push(`<path d="${labelOutlinePath(spec, -spec.safeMm)}" fill="none" stroke="#1a9c55" stroke-width="0.3" stroke-dasharray="0.6 0.9"/>`);
    if (spec.overlapMm && spec.shape === "rect") {
      const x = spec.bleedMm + spec.trimWidthMm - spec.overlapMm;
      parts.push(`<rect x="${f(x)}" y="${f(spec.bleedMm)}" width="${f(spec.overlapMm)}" height="${f(spec.trimHeightMm)}" fill="#005bd3" fill-opacity="0.08" stroke="#005bd3" stroke-width="0.3" stroke-dasharray="1.5 1"/>`);
    }
  }
  parts.push("</svg>");
  return parts.join("");
}
