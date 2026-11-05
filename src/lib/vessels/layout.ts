import type { Mm } from "@/types";
import type { LabelSpec } from "./types";

/**
 * Roll-label imposition and run length: the label-stock numbers the pricing engine needs
 * (labels across the web, repeat, linear metres and m² of face stock for a quantity).
 * Defaults match a 330 mm (13 in) narrow-web flexo/digital press, common in Egyptian label shops.
 */
export interface LabelRunOptions {
  /** Printable web width. Default 330 mm. */
  webWidthMm?: Mm;
  /** Matrix gap between die-cut labels, both directions. Default 3 mm (0 for sleeves). */
  gapMm?: Mm;
  /** Unprinted edge trim on each side of the web. Default 5 mm. */
  edgeTrimMm?: Mm;
  /** Make-ready waste per job. Default 40 m (sleeves 60 m). */
  setupWasteM?: number;
  /** Running waste. Default 4%. */
  runningWastePct?: number;
}

export interface LabelRun {
  /** true if the label runs rotated (its height across the web). */
  rotated: boolean;
  across: number;
  /** Advance per row along the web (mm). */
  repeatMm: Mm;
  labelsPerMeter: number;
  linearMeters: number;
  /** Face stock consumed incl. waste and matrix (m²). */
  stockAreaM2: number;
  /** Finished labels area (m²): quantity x trim area. */
  labelAreaM2: number;
  /** Die: round/rect labels use stock dies, sectors and odd shapes need a custom die. */
  die: "STOCK_RECT" | "STOCK_ROUND" | "CUSTOM" | "NONE";
  fits: boolean;
}

export function labelRun(spec: LabelSpec, quantity: number, opts: LabelRunOptions = {}): LabelRun {
  const sleeve = spec.kind === "SHRINK_SLEEVE";
  const web = opts.webWidthMm ?? 330;
  const gap = opts.gapMm ?? (sleeve ? 0 : 3);
  const edge = opts.edgeTrimMm ?? 5;
  const setup = opts.setupWasteM ?? (sleeve ? 60 : 40);
  const waste = (opts.runningWastePct ?? 4) / 100;
  const usable = web - 2 * edge;
  // die cut at trim; bleed prints into the matrix. Sleeves are printed flat at full print width.
  const w = sleeve ? spec.printWidthMm : spec.trimWidthMm;
  const h = sleeve ? spec.trimHeightMm : spec.trimHeightMm;
  const fit = (across: Mm, along: Mm) => {
    const n = Math.floor((usable + gap) / (across + gap));
    return { n, repeat: along + gap, perM: n > 0 ? (n * 1000) / (along + gap) : 0 };
  };
  const a = fit(w, h);
  // sleeves always run with the girth across the web (the tube is formed from the web)
  const b = sleeve || spec.overlapMm ? { n: 0, repeat: 0, perM: 0 } : fit(h, w);
  const rotated = b.perM > a.perM;
  const best = rotated ? b : a;
  const q = Math.max(0, Math.ceil(quantity));
  const rows = best.n > 0 ? Math.ceil(q / best.n) : 0;
  const runM = (rows * best.repeat) / 1000;
  const linearMeters = best.n > 0 ? Math.ceil(setup + runM * (1 + waste)) : 0;
  return {
    rotated,
    across: best.n,
    repeatMm: best.repeat,
    labelsPerMeter: Math.round(best.perM * 10) / 10,
    linearMeters,
    stockAreaM2: Math.round(((linearMeters * web) / 1000) * 1000) / 1000,
    labelAreaM2: Math.round(q * spec.trimAreaM2 * 10000) / 10000,
    die: sleeve ? "NONE" : spec.shape === "circle" ? "STOCK_ROUND" : spec.shape === "rect" ? "STOCK_RECT" : "CUSTOM",
    fits: best.n > 0,
  };
}
