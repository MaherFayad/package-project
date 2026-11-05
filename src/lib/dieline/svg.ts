import type { DielineModel, Polygon, Segment } from "./types";
import { centroid, round } from "./geometry";

export interface DielineSvgOptions {
  showBleed?: boolean;
  showSafeZones?: boolean;
  showLabels?: boolean;
  /** Label per panel id or per role (panel id wins). Defaults to the panel's English label. */
  labels?: Record<string, string>;
  /** Accessible title. */
  title?: string;
  /** Stroke width in mm (default 0.35). */
  strokeMm?: number;
  /** Optional fill per panel (e.g. a face preview); default white. */
  panelFill?: string;
  colors?: Partial<{ cut: string; crease: string; bleed: string; safe: string; glue: string; label: string }>;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => String(round(v, 2));
const polyPath = (p: Polygon) => `M${p.map((q) => `${n(q.x)} ${n(q.y)}`).join("L")}Z`;
const segPath = (segs: Segment[]) => segs.map((s) => `M${n(s.a.x)} ${n(s.a.y)}L${n(s.b.x)} ${n(s.b.y)}`).join("");

/**
 * Render the dieline as a standalone SVG string in millimetres (viewBox = sheet).
 * Cut = solid, crease = dashed, bleed = tinted area, safe zone = dotted. Never mirrored.
 */
export function dielineToSvg(model: DielineModel, opts: DielineSvgOptions = {}): string {
  const c = {
    cut: "#1f2124",
    crease: "#2c6ecb",
    bleed: "#fde9e7",
    safe: "#29845a",
    glue: "#e3e3e3",
    label: "#616161",
    ...opts.colors,
  };
  const sw = opts.strokeMm ?? 0.35;
  const { width, height } = model.sheet;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}mm" height="${n(height)}mm" direction="ltr" role="img"${opts.title ? ` aria-label="${esc(opts.title)}"` : ""}>`,
  );
  if (opts.title) parts.push(`<title>${esc(opts.title)}</title>`);
  if (opts.showBleed !== false) {
    parts.push(`<g data-layer="bleed" fill="${c.bleed}" stroke="none">${model.bleedRegions.map((r) => `<path d="${polyPath(r.polygon)}"/>`).join("")}</g>`);
  }
  parts.push(
    `<g data-layer="panels" stroke="none">${model.panels
      .map((p) => `<path data-panel="${esc(p.id)}" d="${polyPath(p.polygon)}" fill="${p.role === "glue" ? c.glue : (opts.panelFill ?? "#ffffff")}"/>`)
      .join("")}</g>`,
  );
  if (opts.showSafeZones !== false) {
    parts.push(
      `<g data-layer="safe" fill="none" stroke="${c.safe}" stroke-width="${n(sw * 0.8)}" stroke-dasharray="${n(sw * 2)} ${n(sw * 3)}">${model.safeZones
        .map((z) => `<rect x="${n(z.rect.x)}" y="${n(z.rect.y)}" width="${n(z.rect.width)}" height="${n(z.rect.height)}"/>`)
        .join("")}</g>`,
    );
  }
  parts.push(`<path data-layer="crease" d="${segPath(model.creaseLines)}" fill="none" stroke="${c.crease}" stroke-width="${n(sw)}" stroke-dasharray="${n(sw * 8)} ${n(sw * 5)}"/>`);
  parts.push(`<path data-layer="cut" d="${segPath(model.cutLines)}" fill="none" stroke="${c.cut}" stroke-width="${n(sw)}" stroke-linecap="round"/>`);
  if (opts.showLabels !== false) {
    const fs = Math.max(2.5, Math.min(10, Math.min(width, height) / 30));
    parts.push(
      `<g data-layer="labels" fill="${c.label}" font-family="Inter, system-ui, sans-serif" font-size="${n(fs)}" text-anchor="middle" dominant-baseline="middle">${model.panels
        .filter((p) => p.bbox.width > fs * 4 && p.bbox.height > fs * 2)
        .map((p) => {
          const cc = centroid(p.polygon);
          const text = opts.labels?.[p.id] ?? opts.labels?.[p.role] ?? p.label;
          return `<text x="${n(cc.x)}" y="${n(cc.y)}">${esc(text)}</text>`;
        })
        .join("")}</g>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

/** Alias kept short for callers: `svg(dieline)`. */
export const svg = dielineToSvg;
