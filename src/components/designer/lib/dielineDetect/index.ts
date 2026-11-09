/**
 * Dieline detector (designer: full artwork). Given an uploaded artwork that has the box's
 * cut / fold lines drawn on it, find which library box it is and at what size.
 *
 *   const models = await loadDetectModels();                 // every box model (lazy packs)
 *   const res = detectDieline(ctx.getImageData(0, 0, w, h), { models, dpi: readImageDpi(bytes) });
 *   res.candidates[0] // { code: "FEFCO_0427", dims, proportions, score, scaleKnown, why }
 *   res.overlay       // the top template in image px, to draw over the upload
 *
 * Pure TS (no DOM): runs in a Web Worker (./worker.ts) and in Node tests.
 */
import type { BoxModelDef } from "@/lib/library/types";

export { detectDieline, prepareModels, FOUND_SCORE } from "./detect";
export { readImageDpi, usableDpi } from "./dpi";
export type * from "./types";

/** Every library box model, loading the family packs on demand (browser-safe, one chunk each). */
export async function loadDetectModels(): Promise<BoxModelDef[]> {
  const [{ MODEL_INDEX }, { loadModel }] = await Promise.all([import("@/lib/library/model-index.generated"), import("@/lib/library/registry")]);
  const codes = Object.entries(MODEL_INDEX)
    .filter(([, [source]]) => !source.startsWith("vessel-"))
    .map(([code]) => code);
  const list = await Promise.all(codes.map((c) => loadModel(c)));
  return list.filter((m): m is BoxModelDef => m?.kind === "box");
}
