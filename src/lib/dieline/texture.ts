import type { ArtworkLayer, ArtworkSurface, FaceId, PrintSurface, TextLayer } from "@/types";
import { faceTransform, partRect } from "./fold";
import type { DielineModel, Polygon } from "./types";

/**
 * 2D texture painting in sheet space. One canvas per printed surface covers the whole
 * sheet (die + bleed); the 3D model maps every panel to its region of that canvas, so
 * artwork wraps across folds exactly like the printed blank.
 */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const MAX_TEXTURE_PX = 2048;
const PT_TO_MM = 25.4 / 72;

/** Canvas pixel size for a sheet, longest side ≤ maxPx (default 2048). */
export function surfaceCanvasSize(model: DielineModel, maxPx = MAX_TEXTURE_PX, targetPxPerMm = 6) {
  const cap = Math.min(maxPx, MAX_TEXTURE_PX);
  const pxPerMm = Math.min(targetPxPerMm, cap / Math.max(model.sheet.width, model.sheet.height));
  return {
    width: Math.max(1, Math.round(model.sheet.width * pxPerMm)),
    height: Math.max(1, Math.round(model.sheet.height * pxPerMm)),
    pxPerMm,
  };
}

function tracePolygon(ctx: Ctx2D, poly: Polygon) {
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}

/** A drawable image with its intrinsic size. */
export type LoadedImage = CanvasImageSource & { width: number | SVGAnimatedLength; height: number | SVGAnimatedLength };

export interface PaintOptions {
  surface: PrintSurface;
  pxPerMm: number;
  /** Unprinted board colour (fills the whole canvas first). */
  boardColor: string;
  /** Decoded images keyed by ImageLayer.src. Missing images are skipped. */
  images?: Map<string, CanvasImageSource>;
  /** Map a TextLayer.fontFamily to the CSS font-family list to use on canvas. */
  resolveFont?: (family: TextLayer["fontFamily"]) => string;
  /** Only paint these faces (default: all). */
  faces?: FaceId[];
}

/**
 * Paint an artwork surface (background + layers) onto a canvas sized with
 * `surfaceCanvasSize`. Layers are placed per face (face-local mm) and clipped to the
 * panel's bleed region, so they are never drawn on glue flaps.
 */
export function paintArtworkSurface(ctx: Ctx2D, model: DielineModel, art: ArtworkSurface | null, opts: PaintOptions) {
  const s = opts.pxPerMm;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = opts.boardColor;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(s, 0, 0, s, 0, 0);

  const regions = opts.surface === "outside" ? model.printRegions.outside : model.printRegions.inside;
  if (art?.background) {
    ctx.fillStyle = art.background;
    ctx.beginPath();
    for (const r of regions) tracePolygon(ctx, r);
    ctx.fill();
  }

  const layers = (art?.layers ?? []).filter((l) => !l.hidden && l.surface === opts.surface);
  for (const layer of layers) {
    if (opts.faces && !opts.faces.includes(layer.face)) continue;
    const face = model.faces[layer.face];
    if (!face) continue;
    for (const part of face.parts) {
      const bleed = model.bleedRegions.find((b) => b.panelId === part.panelId);
      if (!bleed) continue;
      ctx.save();
      ctx.beginPath();
      tracePolygon(ctx, bleed.polygon);
      ctx.clip();
      const m = faceTransform(face, part, opts.surface);
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      // Clip to this part's share of the face (+ bleed) so multi-panel faces don't double-draw.
      const r = partRect(face, part, opts.surface);
      const b = model.bleedMm;
      ctx.beginPath();
      ctx.rect(r.x - (r.x <= 0.01 ? b : 0), r.y - (r.y <= 0.01 ? b : 0), r.width + b * 2, r.height + b * 2);
      ctx.clip();
      drawLayer(ctx, layer, opts);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Draw one layer in face-local mm (the current transform maps face mm → canvas). */
export function drawLayer(ctx: Ctx2D, layer: ArtworkLayer, opts: Pick<PaintOptions, "images" | "resolveFont">) {
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.translate(layer.x, layer.y);
  if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
  const w = layer.width;
  const h = layer.height;
  switch (layer.kind) {
    case "shape": {
      ctx.beginPath();
      if (layer.shape === "rect") ctx.rect(-w / 2, -h / 2, w, h);
      else if (layer.shape === "ellipse") ctx.ellipse(0, 0, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(-w / 2, 0);
        ctx.lineTo(w / 2, 0);
      }
      if (layer.fill && layer.shape !== "line") {
        ctx.fillStyle = layer.fill;
        ctx.fill();
      }
      if (layer.stroke && layer.strokeWidthMm > 0) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidthMm;
        ctx.stroke();
      }
      break;
    }
    case "image": {
      const img = opts.images?.get(layer.src);
      if (!img) break;
      const iw = layer.pxWidth || 1;
      const ih = layer.pxHeight || 1;
      let dw = w;
      let dh = h;
      const fit = layer.fit ?? "contain";
      if (fit !== "stretch") {
        const sc = fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
        dw = iw * sc;
        dh = ih * sc;
      }
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.clip();
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      break;
    }
    case "text": {
      const sizeMm = layer.fontSizePt * PT_TO_MM;
      const family = opts.resolveFont?.(layer.fontFamily) ?? `"${layer.fontFamily}", system-ui, sans-serif`;
      ctx.font = `${layer.fontWeight} ${sizeMm}px ${family}`;
      ctx.fillStyle = layer.color;
      const dir = layer.direction === "auto" ? (/[؀-ۿ]/.test(layer.text) ? "rtl" : "ltr") : layer.direction;
      if ("direction" in ctx) (ctx as CanvasRenderingContext2D).direction = dir;
      const alignX = layer.align === "center" ? 0 : (layer.align === "start") === (dir === "ltr") ? -w / 2 : w / 2;
      ctx.textAlign = layer.align === "center" ? "center" : (layer.align === "start") === (dir === "ltr") ? "left" : "right";
      ctx.textBaseline = "middle";
      const lines = layer.text.split("\n");
      const lh = sizeMm * 1.25;
      lines.forEach((line, i) => ctx.fillText(line, alignX, (i - (lines.length - 1) / 2) * lh));
      break;
    }
  }
  ctx.restore();
}

const FACE_COLORS: Record<FaceId, string> = {
  front: "#2c6ecb",
  back: "#8051ff",
  left: "#29845a",
  right: "#b98900",
  top: "#e51c00",
  bottom: "#616161",
};

/**
 * A diagnostic artwork: every face filled with its own colour and labelled with its
 * name and an "up" arrow, so face mapping and orientation can be checked by eye.
 */
export function testPatternArtwork(model: DielineModel, surface: PrintSurface = "outside", labels?: Partial<Record<FaceId, string>>): ArtworkSurface {
  const layers: ArtworkLayer[] = [];
  for (const face of Object.values(model.faces)) {
    if (!face) continue;
    const { width: w, height: h } = face;
    const size = Math.max(4, Math.min(w, h) * 0.18) / PT_TO_MM;
    layers.push({
      id: `${face.face}-bg`, kind: "shape", shape: "rect", face: face.face, surface,
      x: w / 2, y: h / 2, width: w, height: h, rotation: 0, fill: FACE_COLORS[face.face], stroke: "#ffffff", strokeWidthMm: Math.min(w, h) * 0.04,
    });
    layers.push({
      id: `${face.face}-label`, kind: "text", face: face.face, surface, x: w / 2, y: h / 2, width: w * 0.9, height: h * 0.4, rotation: 0,
      text: labels?.[face.face] ?? face.face.toUpperCase(), fontFamily: "Inter", fontSizePt: size, fontWeight: 700, color: "#ffffff", align: "center", direction: "auto",
    });
    layers.push({
      id: `${face.face}-up`, kind: "text", face: face.face, surface, x: w / 2, y: Math.min(h * 0.18, h / 2 - size * PT_TO_MM), width: w * 0.5, height: h * 0.2, rotation: 0,
      text: "▲", fontFamily: "Inter", fontSizePt: size * 0.8, fontWeight: 700, color: "#ffffff", align: "center", direction: "ltr",
    });
  }
  return { background: null, layers };
}
