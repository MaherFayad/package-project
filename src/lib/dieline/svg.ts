import type { DielineModel, PanelRole, Polygon, Segment } from "./types";
import { centroid, polygonArea, round } from "./geometry";

export interface DielineSvgOptions {
  showBleed?: boolean;
  showSafeZones?: boolean;
  showLabels?: boolean;
  /** Label per panel id or per role (panel id wins). Defaults to the role name in `locale`. */
  labels?: Record<string, string>;
  /** Language of the default panel labels (role names). Default "en". */
  locale?: "ar" | "en";
  /** Accessible title. */
  title?: string;
  /** Stroke width in mm (default 0.35). */
  strokeMm?: number;
  /** Optional fill per panel (e.g. a face preview); default white. */
  panelFill?: string;
  colors?: Partial<{ cut: string; crease: string; perf: string; bleed: string; safe: string; glue: string; label: string; film: string }>;
}

/**
 * Panel role names for dieline labels (MSA noun forms in Arabic, the same face names as the
 * designer). Used when the caller passes no `labels`, so every dieline (vendor job, proof,
 * download) reads in the page language.
 */
export const PANEL_ROLE_LABELS: Record<"ar" | "en", Record<PanelRole, string>> = {
  en: { front: "Front", back: "Back", left: "Left side", right: "Right side", top: "Top", bottom: "Bottom", tuck: "Tuck flap", dust: "Dust flap", flap: "Flap", glue: "Glue flap", inner: "Inner wall", ear: "Locking ear" },
  ar: { front: "الأمام", back: "الخلف", left: "الجانب الأيسر", right: "الجانب الأيمن", top: "الأعلى", bottom: "الأسفل", tuck: "لسان إدخال", dust: "لسان جانبي", flap: "جناح", glue: "لسان اللصق", inner: "جدار داخلي", ear: "أذن قفل" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => String(round(v, 2));
const polyPath = (p: Polygon) => `M${p.map((q) => `${n(q.x)} ${n(q.y)}`).join("L")}Z`;
const panelPath = (p: { polygon: Polygon; holes?: Polygon[] }) => [p.polygon, ...(p.holes ?? [])].map(polyPath).join("");
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
    perf: "#c70a24",
    film: "#2c6ecb",
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
      .map((p) => `<path data-panel="${esc(p.id)}" d="${panelPath(p)}" fill-rule="evenodd" fill="${p.role === "glue" ? c.glue : (opts.panelFill ?? "#ffffff")}"/>`)
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
  if (model.films?.length) {
    parts.push(`<g data-layer="film" fill="none" stroke="${c.film}" stroke-width="${n(sw * 0.6)}" stroke-dasharray="${n(sw * 1.5)} ${n(sw * 1.5)}">${model.films.map((f) => `<path d="${polyPath(f.polygon)}"/>`).join("")}</g>`);
  }
  if (model.perfLines?.length) {
    // Perforation: short cut / short bridge (dash-dot reads as "perf" to die makers).
    parts.push(`<path data-layer="perf" d="${segPath(model.perfLines)}" fill="none" stroke="${c.perf}" stroke-width="${n(sw)}" stroke-dasharray="${n(sw * 6)} ${n(sw * 3)} ${n(sw)} ${n(sw * 3)}"/>`);
  }
  parts.push(`<path data-layer="cut" d="${segPath(model.cutLines)}" fill="none" stroke="${c.cut}" stroke-width="${n(sw)}" stroke-linecap="round"/>`);
  if (opts.showLabels !== false) {
    // Size from the sheet's long side: fitted to a 600–1000 px viewer that is 10–16 px (WCAG 1.4.4
    // readable); a label is drawn only where its panel can hold it (≈ 40 px at the same fit).
    const locale = opts.locale ?? "en";
    const fs = Math.max(3, Math.min(18, Math.max(width, height) / 62));
    const roleLabels = PANEL_ROLE_LABELS[locale];
    parts.push(
      `<g data-layer="labels" fill="${c.label}" font-family="Inter, 'IBM Plex Sans Arabic', system-ui, sans-serif" font-size="${n(fs)}" font-weight="500" text-anchor="middle" dominant-baseline="middle"${locale === "ar" ? ' direction="rtl"' : ""}>${model.panels
        .map((p) => ({ p, text: opts.labels?.[p.id] ?? opts.labels?.[p.role] ?? roleLabels[p.role] ?? p.label }))
        // R5-3Q-L-02: a thin diagonal sliver (cone facets) passes the bbox test but cannot hold
        // text: also require the panel to fill at least 40 % of its bbox.
        .filter(({ p, text }) => p.bbox.width > Math.max(fs * 4, text.length * fs * 0.62) && p.bbox.height > fs * 2 && polygonArea(p.polygon) > 0.4 * p.bbox.width * p.bbox.height)
        .map(({ p, text }) => {
          const cc = centroid(p.polygon);
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
