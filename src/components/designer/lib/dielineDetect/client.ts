/**
 * Browser side of the dieline detector (designer: full artwork). Runs the detector in a Web
 * Worker so the UI never blocks:
 *
 *   const detector = createDielineDetector();   // once, e.g. when the artwork panel opens
 *   detector.prepare();                         // optional: warm the model caches early
 *   const { image, dpi } = await imageForDetection(file);
 *   const res = await detector.detect(image, { dpi });
 *   if (res.found) suggest(res.candidates[0]);  // code, dims, scaleKnown, why
 *   detector.dispose();
 */
import type { DielineModel } from "@/lib/dieline";
import type { PrintSurface } from "@/types";
import type { RecogniseResult } from "../dielineRemap/recognise";
import type { RemapReport, RemapSource } from "../dielineRemap/types";
import type { DetectResult, RgbaImage } from "./types";
import type { DetectorRequest, DetectorResponse, EncodedSheet } from "./worker";

export type { EncodedSheet };
import { readImageDpi } from "./dpi";

export interface DielineDetector {
  prepare(): void;
  detect(image: RgbaImage, opts?: { dpi?: number | null; pxPerMm?: number | null; maxCandidates?: number }): Promise<DetectResult>;
  /** Detect, rank for the designer and re-compose the sheet for `target` (the open model). */
  recognise(
    image: RgbaImage,
    opts: { scale: number; surface: PrintSurface; target: DielineModel | null; dpi?: number | null; pxPerMm?: number | null },
  ): Promise<{ result: Omit<RecogniseResult, "image">; sheet: EncodedSheet | null }>;
  /** Re-compose a sheet from a stored source for another model or size. */
  remap(image: RgbaImage, opts: { scale: number; surface: PrintSurface; target: DielineModel; source: RemapSource }): Promise<{ report: RemapReport; sheet: EncodedSheet }>;
  dispose(): void;
}

export function createDielineDetector(): DielineDetector {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = new Map<number, { resolve: (r: any) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  worker.onmessage = (e: MessageEvent<DetectorResponse>) => {
    const msg = e.data;
    if (msg.type === "ready") return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.type === "result") p.resolve(msg.result);
    else if (msg.type === "recognised") p.resolve({ result: msg.result, sheet: msg.sheet });
    else if (msg.type === "remapped") p.resolve({ report: msg.report, sheet: msg.sheet });
    else p.reject(new Error(msg.message));
  };
  // The worker script failed to load or threw: every waiting job fails (the caller keeps the plain
  // upload) instead of waiting for ever, and so does every later one.
  let broken: Error | null = null;
  const failAll = (err: Error) => {
    broken = err;
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };
  worker.onerror = (e) => {
    e.preventDefault?.();
    failAll(new Error(e.message || "detector worker failed"));
  };
  worker.onmessageerror = () => failAll(new Error("detector worker message failed"));
  const post = (m: DetectorRequest, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
  const job = <T,>(make: (id: number) => DetectorRequest) => {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      if (broken) return reject(broken);
      pending.set(id, { resolve, reject });
      post(make(id));
    });
  };
  return {
    prepare: () => post({ type: "prepare" }),
    detect: (image, opts = {}) => job<DetectResult>((id) => ({ type: "detect", id, image, ...opts })),
    recognise: (image, opts) => job((id) => ({ type: "recognise", id, image, ...opts })),
    remap: (image, opts) => job((id) => ({ type: "remap", id, image, ...opts })),
    dispose() {
      worker.terminate();
      for (const p of pending.values()) p.reject(new Error("detector disposed"));
      pending.clear();
    },
  };
}

/**
 * Decode an uploaded file into RGBA pixels (long side capped at `maxSide`; the detector reduces
 * further itself) and read its print resolution from the file header. When the image is scaled
 * down the dpi is scaled with it, so `dpi` always refers to the returned pixels.
 */
export async function imageForDetection(file: Blob, maxSide = 2400): Promise<{ image: RgbaImage; dpi: number | null; scale: number }> {
  const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const fileDpi = readImageDpi(head);
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const c2d = canvas.getContext("2d");
  if (!c2d) throw new Error("2D canvas unavailable");
  c2d.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const data = c2d.getImageData(0, 0, w, h);
  return { image: { data: data.data, width: w, height: h }, dpi: fileDpi ? fileDpi * scale : null, scale };
}
