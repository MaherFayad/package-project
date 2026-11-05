import type { TextLayer } from "@/types";

/** CSS font-family list for canvas text, using the next/font variables from the root layout. */
export function resolveFont(family: TextLayer["fontFamily"]): string {
  const fallback = family === "Inter" ? "system-ui, sans-serif" : "'Noto Sans Arabic', system-ui, sans-serif";
  if (typeof document === "undefined") return `"${family}", ${fallback}`;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(family === "Inter" ? "--font-inter" : "--font-plex-arabic")
    .trim();
  return v ? `${v}, ${fallback}` : `"${family}", ${fallback}`;
}

const PT_TO_MM = 25.4 / 72;
let measureCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Size (mm) of a text layer's rendered text, matching drawLayer (line height 1.25 em), so the
 * layer box — used for selection, placement and preflight — is exactly the printed text.
 */
export function measureText(l: Pick<TextLayer, "text" | "fontFamily" | "fontSizePt" | "fontWeight">): { width: number; height: number } {
  const sizeMm = l.fontSizePt * PT_TO_MM;
  const lines = l.text.split("\n");
  const pad = sizeMm * 0.15;
  if (measureCtx === undefined) measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  let em: number;
  if (measureCtx) {
    measureCtx.font = `${l.fontWeight} 100px ${resolveFont(l.fontFamily)}`;
    em = Math.max(0.3, ...lines.map((s) => measureCtx!.measureText(s).width / 100));
  } else {
    em = Math.max(0.3, ...lines.map((s) => s.length * 0.55));
  }
  return { width: em * sizeMm + pad * 2, height: lines.length * sizeMm * 1.25 + pad };
}

/** Text layers keep their box equal to the measured text (centre stays put). */
export function fitTextBox<T extends { kind: string }>(layer: T): T {
  if (layer.kind !== "text") return layer;
  const t = layer as unknown as TextLayer;
  const m = measureText(t);
  return { ...layer, width: Math.round(m.width * 10) / 10, height: Math.round(m.height * 10) / 10 };
}
