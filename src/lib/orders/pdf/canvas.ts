import {
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  drawObject,
  endPath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
  setGraphicsState,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  type PDFFont,
} from "pdf-lib";

/**
 * A tiny subset of CanvasRenderingContext2D that writes PDF operators instead of pixels.
 *
 * The dieline engine's `paintArtworkSurface()` paints a design onto a 2D canvas in sheet
 * millimetres; passing this adapter (with pxPerMm = 1) makes the print PDF use exactly the same
 * placement, clipping and face transforms as the 3D preview and the on-screen flat proof, but as
 * vectors (shapes, Latin text) and full-resolution embedded images.
 *
 * Coordinates: every point is transformed by the current canvas transform (sheet mm) and then by
 * `toPage` (sheet mm → PDF points, y up) before it is written, so the PDF stream never needs `cm`
 * except for images and text.
 */
export type Affine = [number, number, number, number, number, number];

export const MM_TO_PT = 72 / 25.4;

export function mul(a: Affine, b: Affine): Affine {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function apply(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** "#rrggbb" / "#rgb" / "rgb(a)(…)" → [r, g, b, a] in 0..1. Unknown → opaque black. */
export function parseColor(input: string | null | undefined): [number, number, number, number] {
  if (!input) return [0, 0, 0, 1];
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{6})$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16) / 255);
    return [r, g, b, 1];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, Math.max(0, Math.min(1, a))];
  }
  if (s === "transparent") return [0, 0, 0, 0];
  if (s === "white") return [1, 1, 1, 1];
  return [0, 0, 0, 1];
}

/** An embedded image (XObject name on the page). Passed through the painter's `images` map. */
export interface PdfImageHandle {
  readonly __pdfImage: true;
  name: PDFName;
  width: number;
  height: number;
}

/** A pre-rendered text line (non-Latin scripts are rasterised once with HarfBuzz via sharp). */
export interface TextRaster {
  image: PdfImageHandle;
  /** Size of the raster's ink box in mm. */
  widthMm: number;
  heightMm: number;
}

/** Key for a text line raster: must match what `fillText` sees. */
export function textRasterKey(weight: number, sizeMm: number, color: string, text: string): string {
  return `${weight}|${sizeMm.toFixed(3)}|${color.toLowerCase()}|${text}`;
}

/** Characters Helvetica (WinAnsi) can encode. Everything else needs a raster. */
export function isWinAnsi(text: string): boolean {
  return /^[ -~ -ÿ–—‘’“”•…€]*$/.test(text);
}

interface State {
  ctm: Affine;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  direction: CanvasDirection;
}

export interface PdfCanvasOptions {
  /** Sheet mm (y down) → page points (y up). */
  toPage: Affine;
  /** Register an alpha ExtGState on the page and return its name. */
  alphaState: (alpha: number) => PDFName;
  /** Helvetica / Helvetica-Bold for WinAnsi text. */
  fonts: { regular: { font: PDFFont; name: PDFName }; bold: { font: PDFFont; name: PDFName } };
  textRasters: Map<string, TextRaster>;
  /** Called for text that could not be drawn (no raster available). */
  onSkippedText?: (text: string) => void;
}

/** Records PDF operators for the painter. Read `ops` when painting is done. */
export class PdfCanvas {
  readonly ops: PDFOperator[] = [];
  /** Satisfies `ctx.canvas.width/height` reads (board fill is skipped: unprinted board = no ink). */
  readonly canvas = { width: 1, height: 1 };
  private s: State = {
    ctm: IDENTITY,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "400 10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    direction: "ltr",
  };
  private stack: State[] = [];
  private path: PDFOperator[] = [];
  private cur: [number, number] | null = null;
  private start: [number, number] | null = null;

  constructor(private readonly o: PdfCanvasOptions) {}

  // ── state ──────────────────────────────────────────────────────────
  get fillStyle() { return this.s.fillStyle; }
  set fillStyle(v: string) { this.s.fillStyle = String(v); }
  get strokeStyle() { return this.s.strokeStyle; }
  set strokeStyle(v: string) { this.s.strokeStyle = String(v); }
  get lineWidth() { return this.s.lineWidth; }
  set lineWidth(v: number) { this.s.lineWidth = v; }
  get globalAlpha() { return this.s.globalAlpha; }
  set globalAlpha(v: number) { this.s.globalAlpha = Math.max(0, Math.min(1, v)); }
  get font() { return this.s.font; }
  set font(v: string) { this.s.font = v; }
  get textAlign() { return this.s.textAlign; }
  set textAlign(v: CanvasTextAlign) { this.s.textAlign = v; }
  get textBaseline() { return this.s.textBaseline; }
  set textBaseline(v: CanvasTextBaseline) { this.s.textBaseline = v; }
  get direction() { return this.s.direction; }
  set direction(v: CanvasDirection) { this.s.direction = v; }

  save() {
    this.stack.push({ ...this.s });
    this.ops.push(pushGraphicsState());
  }
  restore() {
    const prev = this.stack.pop();
    if (!prev) return;
    this.s = prev;
    this.ops.push(popGraphicsState());
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.s.ctm = [a, b, c, d, e, f];
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.s.ctm = mul(this.s.ctm, [a, b, c, d, e, f]);
  }
  translate(x: number, y: number) {
    this.transform(1, 0, 0, 1, x, y);
  }
  rotate(rad: number) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    this.transform(c, s, -s, c, 0, 0);
  }
  scale(x: number, y: number) {
    this.transform(x, 0, 0, y, 0, 0);
  }

  // ── paths ──────────────────────────────────────────────────────────
  private pt(x: number, y: number): [number, number] {
    return apply(mul(this.o.toPage, this.s.ctm), x, y);
  }
  beginPath() {
    this.path = [];
    this.cur = null;
    this.start = null;
  }
  moveTo(x: number, y: number) {
    const p = this.pt(x, y);
    this.path.push(moveTo(p[0], p[1]));
    this.cur = [x, y];
    this.start = [x, y];
  }
  lineTo(x: number, y: number) {
    if (!this.cur) return this.moveTo(x, y);
    const p = this.pt(x, y);
    this.path.push(lineTo(p[0], p[1]));
    this.cur = [x, y];
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    if (!this.cur) this.moveTo(c1x, c1y);
    const a = this.pt(c1x, c1y);
    const b = this.pt(c2x, c2y);
    const p = this.pt(x, y);
    this.path.push(appendBezierCurve(a[0], a[1], b[0], b[1], p[0], p[1]));
    this.cur = [x, y];
  }
  closePath() {
    if (!this.cur) return;
    this.path.push(closePath());
    this.cur = this.start;
  }
  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
  /** Full ellipses only (what the painter draws), as four cubic Béziers. */
  ellipse(cx: number, cy: number, rx: number, ry: number, rotation = 0) {
    const k = 0.5522847498;
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const P = (x: number, y: number): [number, number] => [cx + x * c - y * s, cy + x * s + y * c];
    const m = P(rx, 0);
    this.moveTo(m[0], m[1]);
    const quad = (a: [number, number], b: [number, number], e: [number, number]) => {
      const A = P(...a);
      const B = P(...b);
      const E = P(...e);
      this.bezierCurveTo(A[0], A[1], B[0], B[1], E[0], E[1]);
    };
    quad([rx, ry * k], [rx * k, ry], [0, ry]);
    quad([-rx * k, ry], [-rx, ry * k], [-rx, 0]);
    quad([-rx, -ry * k], [-rx * k, -ry], [0, -ry]);
    quad([rx * k, -ry], [rx, -ry * k], [rx, 0]);
    this.closePath();
  }
  arc(cx: number, cy: number, r: number) {
    this.ellipse(cx, cy, r, r, 0);
  }

  private alpha(extra = 1) {
    const a = this.s.globalAlpha * extra;
    if (a < 0.999) this.ops.push(setGraphicsState(this.o.alphaState(a)));
  }

  fill() {
    if (!this.path.length) return;
    const [r, g, b, a] = parseColor(this.s.fillStyle);
    if (a <= 0) return;
    this.ops.push(pushGraphicsState());
    this.alpha(a);
    this.ops.push(setFillingRgbColor(r, g, b), ...this.path, fill(), popGraphicsState());
  }
  stroke() {
    if (!this.path.length) return;
    const [r, g, b, a] = parseColor(this.s.strokeStyle);
    if (a <= 0) return;
    const m = mul(this.o.toPage, this.s.ctm);
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    this.ops.push(pushGraphicsState());
    this.alpha(a);
    this.ops.push(setStrokingRgbColor(r, g, b), setLineWidth(this.s.lineWidth * scale), ...this.path, stroke(), popGraphicsState());
  }
  clip() {
    if (!this.path.length) return;
    this.ops.push(...this.path, clip(), endPath());
  }

  // Board colour is not ink: ignore full-canvas fills/clears.
  fillRect() {}
  clearRect() {}

  // ── images ─────────────────────────────────────────────────────────
  drawImage(img: unknown, dx: number, dy: number, dw?: number, dh?: number) {
    const h = img as PdfImageHandle;
    if (!h || !h.__pdfImage) return;
    const w = dw ?? h.width;
    const hh = dh ?? h.height;
    this.placeImage(h, [w, 0, 0, -hh, dx, dy + hh]);
  }

  private placeImage(h: PdfImageHandle, local: Affine, alpha = 1) {
    const m = mul(mul(this.o.toPage, this.s.ctm), local);
    this.ops.push(pushGraphicsState());
    this.alpha(alpha);
    this.ops.push(concatTransformationMatrix(...m), drawObject(h.name), popGraphicsState());
  }

  // ── text ───────────────────────────────────────────────────────────
  private parsedFont() {
    const m = /^\s*(\d{3})?\s*([\d.]+)px/.exec(this.s.font);
    return { weight: m?.[1] ? Number(m[1]) : 400, size: m ? Number(m[2]) : 10 };
  }

  fillText(text: string, x: number, y: number) {
    if (!text) return;
    const { weight, size } = this.parsedFont();
    const [r, g, b, a] = parseColor(this.s.fillStyle);
    if (a <= 0) return;
    const align = this.s.textAlign;
    const rtl = this.s.direction === "rtl";
    const anchor = align === "center" ? 0.5 : align === "right" || (align === "end" && !rtl) || (align === "start" && rtl) ? 1 : 0;

    if (isWinAnsi(text)) {
      const f = weight >= 600 ? this.o.fonts.bold : this.o.fonts.regular;
      const width = f.font.widthOfTextAtSize(text, size);
      // Baseline "middle": move down by ~0.35 em (Helvetica cap height 0.718 / 2).
      const base = this.s.textBaseline === "middle" ? size * 0.35 : this.s.textBaseline === "top" ? size * 0.8 : 0;
      const local: Affine = [1, 0, 0, -1, x - width * anchor, y + base];
      const m = mul(mul(this.o.toPage, this.s.ctm), local);
      this.ops.push(pushGraphicsState());
      this.alpha(a);
      this.ops.push(
        setFillingRgbColor(r, g, b),
        beginText(),
        setFontAndSize(f.name, size),
        setTextMatrix(...m),
        showText(f.font.encodeText(text)),
        endText(),
        popGraphicsState(),
      );
      return;
    }

    const raster = this.o.textRasters.get(textRasterKey(weight, size, this.s.fillStyle, text));
    if (!raster) {
      this.o.onSkippedText?.(text);
      return;
    }
    const w = raster.widthMm;
    const h = raster.heightMm;
    const top = this.s.textBaseline === "middle" ? y - h / 2 : this.s.textBaseline === "top" ? y : y - h * 0.8;
    this.placeImage(raster.image, [w, 0, 0, -h, x - w * anchor, top + h], a);
  }

  /** For callers that need to write raw operators in the same stream. */
  push(...ops: PDFOperator[]) {
    this.ops.push(...ops);
  }
}

/** `/OC /name BDC` (optional content) and spot-colour operators pdf-lib has no helper for. */
export const rawOps = {
  beginLayer: (prop: PDFName) => PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of("OC"), prop]),
  endLayer: () => PDFOperator.of(PDFOperatorNames.EndMarkedContent),
  strokeColorSpace: (cs: PDFName) => PDFOperator.of(PDFOperatorNames.StrokingColorspace, [cs]),
  strokeTint: (t: number) => PDFOperator.of(PDFOperatorNames.StrokingColorN, [PDFNumber.of(t)]),
  fillColorSpace: (cs: PDFName) => PDFOperator.of(PDFOperatorNames.NonStrokingColorspace, [cs]),
  fillTint: (t: number) => PDFOperator.of(PDFOperatorNames.NonStrokingColorN, [PDFNumber.of(t)]),
};
