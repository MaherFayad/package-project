/**
 * Web Worker entry for the dieline detector. Start it with `createDielineDetector()` (./client.ts);
 * messages:
 *
 *   → { type: "prepare" }                                  load the box models, warm the caches
 *   → { type: "detect", id, image, dpi?, pxPerMm?, maxCandidates? }
 *   ← { type: "ready", models }                            after prepare (or the first detect)
 *   ← { type: "result", id, result }                       DetectResult
 *   ← { type: "error", id, message }
 */
import { detectDieline, loadDetectModels, prepareModels, type DetectModel, type DetectResult, type RgbaImage } from "./index";

export type DetectorRequest =
  | { type: "prepare" }
  | { type: "detect"; id: number; image: RgbaImage; dpi?: number | null; pxPerMm?: number | null; maxCandidates?: number };

export type DetectorResponse =
  | { type: "ready"; models: number }
  | { type: "result"; id: number; result: DetectResult }
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
      .catch((err: unknown) => ctx.postMessage({ type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err) }));
  }
};
