/**
 * Web Worker entry for the dieline detector and the panel remap. Start it with
 * `createDielineDetector()` (./client.ts); messages:
 *
 *   → { type: "prepare" }                                  load the box models, warm the caches
 *   → { type: "detect", id, image, dpi?, pxPerMm?, maxCandidates? }
 *   → { type: "recognise", id, image, scale, surface, target, dpi?, pxPerMm? }
 *   → { type: "remap", id, image, scale, surface, target, source }
 *   ← { type: "ready", models }                            after prepare (or the first job)
 *   ← { type: "result", id, result }                       DetectResult
 *   ← { type: "recognised", id, result, sheet }            RecogniseResult (+ the JPEG sheet)
 *   ← { type: "remapped", id, report, sheet }
 *   ← { type: "error", id, message }
 */
import type { DielineModel } from "@/lib/dieline";
import type { PrintSurface } from "@/types";
import { candidateModelOf, recognise, type RecogniseResult } from "../dielineRemap/recognise";
import { remapSheet, scaleSource, type RemapReport, type RemapSource } from "../dielineRemap";
import { detectDieline, loadDetectModels, prepareModels, type DetectModel, type DetectResult, type RgbaImage } from "./index";

/** A re-composed sheet, encoded (JPEG), with its pixel size. */
export interface EncodedSheet {
  blob: Blob;
  width: number;
  height: number;
}

export type DetectorRequest =
  | { type: "prepare" }
  | { type: "detect"; id: number; image: RgbaImage; dpi?: number | null; pxPerMm?: number | null; maxCandidates?: number }
  | { type: "recognise"; id: number; image: RgbaImage; scale: number; surface: PrintSurface; target: DielineModel | null; dpi?: number | null; pxPerMm?: number | null }
  | { type: "remap"; id: number; image: RgbaImage; scale: number; surface: PrintSurface; target: DielineModel; source: RemapSource };

export type DetectorResponse =
  | { type: "ready"; models: number }
  | { type: "result"; id: number; result: DetectResult }
  | { type: "recognised"; id: number; result: Omit<RecogniseResult, "image">; sheet: EncodedSheet | null }
  | { type: "remapped"; id: number; report: RemapReport; sheet: EncodedSheet }
  | { type: "error"; id: number; message: string };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<DetectorRequest>) => void) | null;
  postMessage(msg: DetectorResponse): void;
};

let ready: Promise<DetectModel[]> | null = null;
const models = () =>
  (ready ??= loadDetectModels().then((list) => {
    const n = prepareModels(list);
    ctx.postMessage({ type: "ready", models: n });
    return list;
  }));

/** JPEG of a sheet (opaque print art), quality 0.92. */
async function encode(img: RgbaImage): Promise<EncodedSheet> {
  const canvas = new OffscreenCanvas(img.width, img.height);
  const c2d = canvas.getContext("2d");
  if (!c2d) throw new Error("2D canvas unavailable");
  c2d.putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer as ArrayBuffer, img.data.byteOffset, img.data.length), img.width, img.height), 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  return { blob, width: img.width, height: img.height };
}

const fail = (id: number) => (err: unknown) => ctx.postMessage({ type: "error", id, message: err instanceof Error ? err.message : String(err) });

ctx.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "prepare") {
    void models();
    return;
  }
  if (msg.type === "detect") {
    models()
      .then((list) => {
        const result = detectDieline(msg.image, { models: list, dpi: msg.dpi, pxPerMm: msg.pxPerMm, maxCandidates: msg.maxCandidates });
        ctx.postMessage({ type: "result", id: msg.id, result });
      })
      .catch(fail(msg.id));
    return;
  }
  if (msg.type === "recognise") {
    models()
      .then(async (list) => {
        const { image, ...result } = recognise(msg.image, { models: list, dpi: msg.dpi, pxPerMm: msg.pxPerMm, surface: msg.surface, target: msg.target, scale: msg.scale });
        ctx.postMessage({ type: "recognised", id: msg.id, result, sheet: image ? await encode(image) : null });
      })
      .catch(fail(msg.id));
    return;
  }
  if (msg.type === "remap") {
    models()
      .then(async (list) => {
        const r = remapSheet(msg.image, msg.target, scaleSource(msg.source, msg.scale), candidateModelOf(msg.source, list), { surface: msg.surface });
        ctx.postMessage({ type: "remapped", id: msg.id, report: r.report, sheet: await encode(r.image) });
      })
      .catch(fail(msg.id));
  }
};
