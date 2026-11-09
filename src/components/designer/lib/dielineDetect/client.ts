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
import type { DetectResult, RgbaImage } from "./types";
import type { DetectorRequest, DetectorResponse } from "./worker";
import { readImageDpi } from "./dpi";

export interface DielineDetector {
  prepare(): void;
  detect(image: RgbaImage, opts?: { dpi?: number | null; pxPerMm?: number | null; maxCandidates?: number }): Promise<DetectResult>;
  dispose(): void;
}

export function createDielineDetector(): DielineDetector {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<number, { resolve: (r: DetectResult) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  worker.onmessage = (e: MessageEvent<DetectorResponse>) => {
    const msg = e.data;
    if (msg.type === "ready") return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.type === "result") p.resolve(msg.result);
    else p.reject(new Error(msg.message));
  };
  const post = (m: DetectorRequest, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
  return {
    prepare: () => post({ type: "prepare" }),
    detect(image, opts = {}) {
      const id = nextId++;
      return new Promise<DetectResult>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        post({ type: "detect", id, image, ...opts });
      });
    },
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
