import type { Artwork, ArtworkLayer, PrintSurface, TextLayer } from "@/types";
import { paintArtworkSurface, surfaceCanvasSize, type DielineModel } from "@/lib/dieline";
import { FINISHES, type FinishChoice } from "@/lib/configurator";
import { FOIL_LOOKS } from "./looks";

/**
 * Finish masks painted from the artwork layers each finish points at, in sheet space (the
 * same UV space as the artwork texture, so masks line up with print across every fold).
 *
 *   finish: R = spot UV coverage (0..1)
 *   foil:   RGB = foil colour, A = foil coverage
 *   relief: grey 0.5 = flat, white = emboss, black = deboss (half resolution, softened)
 */
export interface FinishMapCanvases {
  finish: HTMLCanvasElement | null;
  foil: HTMLCanvasElement | null;
  relief: HTMLCanvasElement | null;
  /** Stable key of what was painted (to know when textures must re-upload). */
  key: string;
}

export interface PaintMasksOptions {
  images?: Map<string, CanvasImageSource>;
  resolveFont?: (family: TextLayer["fontFamily"]) => string;
  /** Longest side in px (default 2048, never more). */
  maxPx?: number;
  createCanvas?: (w: number, h: number) => HTMLCanvasElement;
}

const defaultCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

function layersFor(art: Artwork, surface: PrintSurface, ids: readonly string[]): ArtworkLayer[] {
  const set = new Set(ids);
  return art[surface].layers.filter((l) => set.has(l.id) && l.surface === surface && !l.hidden);
}

/** Paint the selected layers' silhouette in one flat colour onto `target`. */
function silhouette(
  target: CanvasRenderingContext2D,
  tmp: HTMLCanvasElement,
  model: DielineModel,
  layers: ArtworkLayer[],
  surface: PrintSurface,
  color: string,
  pxPerMm: number,
  opts: PaintMasksOptions,
) {
  const ctx = tmp.getContext("2d");
  if (!ctx || layers.length === 0) return;
  paintArtworkSurface(ctx, model, { background: null, layers }, { surface, pxPerMm, boardColor: "rgba(0,0,0,0)", images: opts.images, resolveFont: opts.resolveFont });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.restore();
  target.drawImage(tmp, 0, 0, target.canvas.width, target.canvas.height);
}

export function finishMaskKey(finishes: readonly FinishChoice[], surface: PrintSurface, art: Artwork | null | undefined): string {
  const masked = finishes.filter((f) => FINISHES[f.code].masked && (f.mask?.surface ?? "outside") === surface);
  if (!art || masked.length === 0) return "";
  const ids = new Set(masked.flatMap((f) => f.mask?.layerIds ?? []));
  const layers = art[surface].layers.filter((l) => ids.has(l.id));
  return JSON.stringify([masked.map((f) => [f.code, f.mask?.layerIds]), layers]);
}

/**
 * Paint the finish masks for one printed surface. Returns null when nothing on that surface is
 * masked (callers then use neutral 1×1 maps). Browser only (needs a 2D canvas).
 */
export function paintFinishMaps(model: DielineModel, art: Artwork, finishes: readonly FinishChoice[], surface: PrintSurface, opts: PaintMasksOptions = {}): FinishMapCanvases | null {
  const key = finishMaskKey(finishes, surface, art);
  if (!key || typeof document === "undefined") return null;
  const make = opts.createCanvas ?? defaultCanvas;
  const { width, height, pxPerMm } = surfaceCanvasSize(model, Math.min(2048, opts.maxPx ?? 2048), 6);
  const tmp = make(width, height);
  const on = (f: FinishChoice) => (f.mask?.surface ?? "outside") === surface && (f.mask?.layerIds.length ?? 0) > 0;

  let finish: HTMLCanvasElement | null = null;
  let foil: HTMLCanvasElement | null = null;
  let relief: HTMLCanvasElement | null = null;

  const uv = finishes.filter((f) => f.code === "SPOT_UV" && on(f));
  if (uv.length) {
    finish = make(width, height);
    const ctx = finish.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    for (const f of uv) silhouette(ctx, tmp, model, layersFor(art, surface, f.mask!.layerIds), surface, "#ffffff", pxPerMm, opts);
  }

  const foils = finishes.filter((f) => FINISHES[f.code].group === "foil" && on(f));
  if (foils.length) {
    foil = make(width, height);
    const ctx = foil.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    for (const f of foils) silhouette(ctx, tmp, model, layersFor(art, surface, f.mask!.layerIds), surface, FOIL_LOOKS[f.code as keyof typeof FOIL_LOOKS].color, pxPerMm, opts);
  }

  const reliefs = finishes.filter((f) => FINISHES[f.code].group === "relief" && on(f));
  if (reliefs.length) {
    // Half resolution: bilinear sampling softens the die edge like real board does.
    const rw = Math.max(1, Math.round(width / 2));
    const rh = Math.max(1, Math.round(height / 2));
    relief = make(rw, rh);
    const ctx = relief.getContext("2d")!;
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, rw, rh);
    const blur = "filter" in ctx;
    if (blur) (ctx as CanvasRenderingContext2D).filter = "blur(1.2px)";
    for (const f of reliefs) silhouette(ctx, tmp, model, layersFor(art, surface, f.mask!.layerIds), surface, f.code === "EMBOSS" ? "#ffffff" : "#000000", pxPerMm, opts);
    if (blur) (ctx as CanvasRenderingContext2D).filter = "none";
  }

  return { finish, foil, relief, key };
}
