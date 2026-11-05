import { flatPoint, sleeveRatioAt, type LabelSpec, type VesselKind } from "@/lib/vessels";
import { labelOutlinePath } from "@/lib/vessels/svg";

/**
 * Paints label artwork in FLAT print space (mm -> px), exactly what a printer receives.
 * The 3D label meshes map their UVs onto this canvas with the same contract, so what you
 * see wrapped on the bottle is what gets printed.
 */
export type LabelArtStyle = "guides" | "sample";

export interface PaintLabelOptions {
  style: LabelArtStyle;
  kind: VesselKind;
  /** Transparent background (clear BOPP / clear sleeve). */
  transparent?: boolean;
  /** Shrink sleeves: stretch artwork by 1/girth ratio so it looks right after shrinking. */
  preDistort?: boolean;
  /** Max canvas side, px (<= 2048 for mobile GPUs). */
  maxPx?: number;
  font?: string;
  /** Text for the sample artwork. */
  brand?: string;
  subtitle?: string;
}

interface Theme {
  bg: [string, string];
  ink: string;
  accent: string;
  band: string;
}

const THEMES: Record<VesselKind, Theme> = {
  ROUND_BOTTLE: { bg: ["#0b5cad", "#41a5e8"], ink: "#ffffff", accent: "#bde4ff", band: "#ffffff" },
  BOSTON_ROUND: { bg: ["#f3ead7", "#e7d6b1"], ink: "#3a2a12", accent: "#6f8f3a", band: "#3a2a12" },
  DROPPER_BOTTLE: { bg: ["#e9efe7", "#d3dfd0"], ink: "#22352a", accent: "#7b9b74", band: "#22352a" },
  PUMP_BOTTLE: { bg: ["#ffffff", "#f1ede6"], ink: "#2b2b2b", accent: "#c9785d", band: "#c9785d" },
  PERFUME_SQUARE: { bg: ["#151515", "#2a2622"], ink: "#e8c77a", accent: "#e8c77a", band: "#e8c77a" },
  WIDE_JAR: { bg: ["#fbf3e2", "#f2e2bf"], ink: "#5a3508", accent: "#d88a12", band: "#5a3508" },
  CAN: { bg: ["#c3202c", "#8c0f1a"], ink: "#ffffff", accent: "#ffd34d", band: "#ffffff" },
  ROUND_TIN: { bg: ["#0f6b66", "#0b4f4b"], ink: "#fdf6e3", accent: "#f2b84b", band: "#fdf6e3" },
  STAND_UP_POUCH: { bg: ["#fdfaf3", "#f4ecdb"], ink: "#2e3b1f", accent: "#7a8f3a", band: "#2e3b1f" },
  SQUEEZE_TUBE: { bg: ["#fff4f1", "#ffe1d8"], ink: "#4a1f1a", accent: "#e46f5a", band: "#e46f5a" },
};

/** Canvas size (px) and scale for a spec. */
export function labelCanvasSize(spec: LabelSpec, maxPx = 2048) {
  const pxPerMm = Math.min(12, maxPx / spec.printWidthMm, maxPx / spec.printHeightMm);
  return { width: Math.max(2, Math.ceil(spec.printWidthMm * pxPerMm)), height: Math.max(2, Math.ceil(spec.printHeightMm * pxPerMm)), pxPerMm };
}

/** Paint the label into `canvas` (resized as needed). Returns the scale used. */
export function paintLabel(canvas: HTMLCanvasElement | OffscreenCanvas, spec: LabelSpec, opts: PaintLabelOptions): number {
  const { width, height, pxPerMm } = labelCanvasSize(spec, opts.maxPx);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) return pxPerMm;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(pxPerMm, pxPerMm);
  const font = opts.font ?? "system-ui, sans-serif";
  const theme = THEMES[opts.kind];
  const bleedPath = new Path2D(labelOutlinePath(spec, spec.bleedMm));
  ctx.save();
  ctx.clip(bleedPath);
  if (opts.style === "guides") paintGuides(ctx, spec, opts, font);
  else paintSample(ctx, spec, opts, theme, font);
  ctx.restore();
  return pxPerMm;
}

/** Horizontal stretch to apply at height t (sleeves with pre-distortion). */
const stretchAt = (spec: LabelSpec, t: number, on?: boolean) => (on && spec.sleeve ? 1 / Math.max(0.2, sleeveRatioAt(spec, t)) : 1);

function paintGuides(ctx: CanvasRenderingContext2D, spec: LabelSpec, opts: PaintLabelOptions, font: string) {
  const W = spec.printWidthMm;
  const H = spec.printHeightMm;
  // bleed zone (outside the trim) in pink, face in white
  ctx.fillStyle = opts.transparent ? "rgba(255,90,140,0.25)" : "#ffd9e4";
  ctx.fillRect(0, 0, W, H);
  const trim = new Path2D(labelOutlinePath(spec, 0));
  if (opts.transparent) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fill(trim);
    ctx.restore();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fill(trim);
  }
  // s/t grid (rays + arcs on sectors, straight on rectangles)
  ctx.lineWidth = 0.25;
  ctx.strokeStyle = "rgba(0, 91, 211, 0.45)";
  const ns = Math.max(4, Math.round(spec.trimWidthMm / 12));
  const nt = Math.max(2, Math.round(spec.trimHeightMm / 12));
  for (let i = 0; i <= ns; i++) {
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const p = flatPoint(spec, i / ns, k / 16);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let j = 0; j <= nt; j++) {
    ctx.beginPath();
    for (let k = 0; k <= 64; k++) {
      const p = flatPoint(spec, k / 64, j / nt);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  // circles: they must look round on the container (distortion check)
  const rr = Math.min(spec.trimWidthMm / ns, spec.trimHeightMm / nt) * 0.32;
  for (let i = 0; i < ns; i++)
    for (let j = 0; j < nt; j++) {
      const s = (i + 0.5) / ns;
      const t = (j + 0.5) / nt;
      const p = flatPoint(spec, s, t);
      const k = stretchAt(spec, t, opts.preDistort);
      ctx.fillStyle = (i + j) % 2 ? "#e0457b" : "#005bd3";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rr * k, rr, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  // safe zone + trim
  ctx.setLineDash([0.8, 0.8]);
  ctx.strokeStyle = "#1a9c55";
  ctx.lineWidth = 0.35;
  ctx.stroke(new Path2D(labelOutlinePath(spec, -spec.safeMm)));
  ctx.setLineDash([]);
  ctx.strokeStyle = "#303030";
  ctx.lineWidth = 0.3;
  ctx.stroke(trim);
  if (spec.overlapMm && spec.shape === "rect") {
    const x = spec.bleedMm + spec.trimWidthMm - spec.overlapMm;
    ctx.fillStyle = "rgba(0,91,211,0.12)";
    ctx.fillRect(x, spec.bleedMm, spec.overlapMm, spec.trimHeightMm);
  }
  // caption at the centre
  const c = flatPoint(spec, 0.5, 0.5);
  const size = Math.max(2.2, Math.min(6, spec.trimHeightMm * 0.09, spec.trimWidthMm * 0.06));
  ctx.fillStyle = "#303030";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${size}px ${font}`;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(stretchAt(spec, 0.5, opts.preDistort), 1);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const label = `${spec.name.en}`;
  const dims = `${spec.trimWidthMm} × ${spec.trimHeightMm} mm`;
  const tw = Math.max(ctx.measureText(label).width, ctx.measureText(dims).width) + size;
  ctx.fillRect(-tw / 2, -size * 1.3, tw, size * 2.6);
  ctx.fillStyle = "#303030";
  ctx.fillText(label, 0, -size * 0.55);
  ctx.font = `400 ${size * 0.85}px ${font}`;
  ctx.fillText(dims, 0, size * 0.65);
  ctx.restore();
}

/** Text along the arc of a sector label (or straight on rectangles). */
function arcText(ctx: CanvasRenderingContext2D, spec: LabelSpec, text: string, t: number, size: number, weight: number, font: string, color: string, preDistort?: boolean) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (spec.shape !== "sector" || !spec.sector) {
    const p = flatPoint(spec, 0.5, t);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(stretchAt(spec, t, preDistort), 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    return;
  }
  const g = spec.sector;
  const R = g.apexAbove ? g.outerRadiusMm - t * g.slantMm : g.innerRadiusMm + t * g.slantMm;
  const total = ctx.measureText(text).width;
  let a = -total / R / 2;
  const sgn = g.apexAbove ? 1 : -1;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const mid = a + w / R / 2;
    ctx.save();
    ctx.translate(g.apexX + R * Math.sin(mid), g.apexY + sgn * R * Math.cos(mid));
    ctx.rotate(g.apexAbove ? -mid : mid);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += w / R;
  }
}

function paintSample(ctx: CanvasRenderingContext2D, spec: LabelSpec, opts: PaintLabelOptions, theme: Theme, font: string) {
  const W = spec.printWidthMm;
  const H = spec.printHeightMm;
  if (!opts.transparent) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.bg[0]);
    grad.addColorStop(1, theme.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  const ink = opts.transparent ? (theme.ink === "#ffffff" ? "#0b3d75" : theme.ink) : theme.ink;
  const th = spec.trimHeightMm;
  const brand = opts.brand ?? "Nile Bloom";
  const sub = opts.subtitle ?? "Made in Egypt";

  if (spec.kind === "LID") {
    const cx = spec.bleedMm + spec.trimWidthMm / 2;
    const cy = cx;
    const r = spec.trimWidthMm / 2;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(0.6, r * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${r * 0.34}px ${font}`;
    ctx.fillText(brand.split(" ")[0], cx, cy - r * 0.08);
    ctx.font = `500 ${r * 0.13}px ${font}`;
    ctx.fillText(sub.toUpperCase(), cx, cy + r * 0.32);
    return;
  }

  // decorative bands top and bottom (wavy for a hand-made feel)
  ctx.fillStyle = theme.accent;
  const bandH = Math.max(1.5, th * 0.07);
  for (const [t0, t1] of [
    [0.06, 0.06 + bandH / th],
    [0.94 - bandH / th, 0.94],
  ]) {
    ctx.beginPath();
    const n = 96;
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const wave = Math.sin(s * Math.PI * 14) * 0.012;
      const p = flatPoint(spec, s, t0 + wave);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let k = n; k >= 0; k--) {
      const s = k / n;
      const wave = Math.sin(s * Math.PI * 14) * 0.012;
      const p = flatPoint(spec, s, t1 + wave);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  const big = Math.min(th * (spec.kind === "SHRINK_SLEEVE" ? 0.1 : 0.26), spec.trimWidthMm * 0.12);
  const repeats = spec.kind === "WRAP" || spec.kind === "SHRINK_SLEEVE" ? 2 : 1;
  const tBrand = spec.kind === "SHRINK_SLEEVE" ? 0.36 : 0.56;
  for (let rep = 0; rep < repeats; rep++) {
    const s = repeats === 1 ? 0.5 : rep === 0 ? 0.5 : 0.02; // second copy sits at the back seam
    if (spec.shape === "sector") {
      if (rep > 0) break;
      arcText(ctx, spec, brand, tBrand, big, 750, font, ink);
      arcText(ctx, spec, sub.toUpperCase(), tBrand - 0.26, big * 0.34, 600, font, ink);
      continue;
    }
    const p = flatPoint(spec, s, tBrand);
    const k = stretchAt(spec, tBrand, opts.preDistort);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(k, 1);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `750 ${big}px ${font}`;
    ctx.fillText(brand, 0, 0);
    ctx.font = `600 ${big * 0.3}px ${font}`;
    ctx.fillText(sub.toUpperCase(), 0, big * 0.85);
    // emblem circle
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(0.4, big * 0.05);
    ctx.beginPath();
    ctx.arc(0, -big * 1.25, big * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // back-panel style small print on the side for wraps / backs
  if (spec.kind === "WRAP" || spec.kind === "BACK" || spec.kind === "SHRINK_SLEEVE") {
    const s = spec.kind === "BACK" ? 0.5 : 0.18;
    const p = flatPoint(spec, s, 0.5);
    const size = Math.max(1.4, Math.min(2.6, th * 0.045));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(stretchAt(spec, 0.5, opts.preDistort), 1);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.85;
    ctx.textAlign = "center";
    ctx.font = `600 ${size * 1.2}px ${font}`;
    ctx.fillText("Ingredients", 0, -size * 3);
    ctx.font = `400 ${size}px ${font}`;
    ["Natural spring water, minerals", "Store in a cool, dry place", "Best before: see cap"].forEach((line, i) => ctx.fillText(line, 0, -size * 1.2 + i * size * 1.6));
    // barcode
    const bw = size * 12;
    const bh = size * 5;
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 1;
    ctx.fillRect(-bw / 2 - 1, size * 4, bw + 2, bh + 2);
    ctx.fillStyle = "#111111";
    let x = -bw / 2;
    let seed = 3;
    while (x < bw / 2) {
      seed = (seed * 9301 + 49297) % 233280;
      const w = 0.2 + (seed / 233280) * 0.6;
      ctx.fillRect(x, size * 4 + 1, w, bh);
      x += w + 0.25 + ((seed >> 3) % 3) * 0.15;
    }
    ctx.restore();
  }
}
