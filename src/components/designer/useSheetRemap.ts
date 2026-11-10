"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dims, PrintSurface, SheetImage, SheetRemap } from "@/types";
import type { DielineModel } from "@/lib/dieline";
import type { DielineDetector } from "./lib/dielineDetect/client";
import type { Recognised, RecogniseResult } from "./lib/dielineRemap/recognise";
import type { RemapSource } from "./lib/dielineRemap/types";
import { prepareImage, SHEET_IMAGE_OPTIONS, type PrepareOptions } from "./uploadImage";

/**
 * Designer: a full artwork made on the buyer's own printer template. On upload the detector (Web
 * Worker) recognises the box, and the art is re-composed in Elba's template layout for the open
 * model, so the closed 3D box shows every face right. The upload itself is kept (`original`);
 * when the model or size changes, the sheet is made again from it.
 */

/** The upload kept for re-composing: the detector's own working size, as a JPEG. */
export const ORIGINAL_IMAGE_OPTIONS: PrepareOptions = { maxPx: 2400, maxChars: 2_500_000, opaque: true };

export type RecogniseState =
  | { status: "reading" }
  | { status: "done"; result: Omit<RecogniseResult, "image">; mode: "model" | "faces" | null }
  | { status: "error" };

/** What a re-composed sheet was made for: stale when the model, size, board or features change. */
export function remapTargetKey(code: string, model: DielineModel, surface: PrintSurface): string {
  const d = model.dims;
  return `${code}|${d.L}|${d.W}|${d.H}|${model.thicknessMm}|${JSON.stringify(model.features ?? {})}|${surface}`;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(b);
  });

async function workingCopy(src: Blob) {
  const { imageForDetection } = await import("./lib/dielineDetect/client");
  return imageForDetection(src);
}

export interface SheetRemapApi {
  state: Partial<Record<PrintSurface, RecogniseState>>;
  /** Start the worker and warm its model caches (the Full artwork section opened). */
  prepare: () => void;
  /** Upload: keep the original, recognise, re-compose for the open model. */
  upload: (file: File, side: PrintSurface) => Promise<void>;
  /** The sheet image to apply with a recognised match (switching model keeps it, then it is re-made). */
  withMatch: (side: PrintSurface, match: Recognised) => SheetImage | null;
}

export function useSheetRemap(opts: {
  model: DielineModel | null;
  modelCode: string;
  sheets: Record<PrintSurface, SheetImage | null | undefined>;
  enabled: boolean;
  /** Replace one surface's sheet image in the document. */
  setSheet: (side: PrintSurface, img: SheetImage | null, coalesce?: string) => void;
  onError?: () => void;
}): SheetRemapApi {
  const detector = useRef<DielineDetector | null>(null);
  const [state, setState] = useState<Partial<Record<PrintSurface, RecogniseState>>>({});
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const get = useCallback(async () => {
    if (!detector.current) {
      const { createDielineDetector } = await import("./lib/dielineDetect/client");
      detector.current ??= createDielineDetector();
    }
    return detector.current;
  }, []);
  useEffect(() => () => detector.current?.dispose(), []);
  const prepare = useCallback(() => {
    void get().then((d) => d.prepare());
  }, [get]);

  const latest = useRef<Partial<Record<PrintSurface, File>>>({});
  const recogniseFile = useCallback(
    async (file: File, side: PrintSurface) => {
      latest.current[side] = file;
      const stale = () => latest.current[side] !== file;
      try {
        const original = await prepareImage(file, ORIGINAL_IMAGE_OPTIONS);
        const [det, work] = await Promise.all([get(), workingCopy(file)]);
        const cur = optsRef.current;
        const target = cur.model;
        const scale = work.image.width / original.pxWidth;
        const { result, sheet } = await det.recognise(work.image, { scale, surface: side, target, dpi: work.dpi });
        if (stale()) return;
        if (sheet && result.source && target && result.report) {
          const src = await blobToDataUrl(sheet.blob);
          const remap: SheetRemap = {
            mode: result.source.mode,
            code: result.source.code,
            target: remapTargetKey(cur.modelCode, target, side),
            sourcePxPerMm: result.report.sourcePxPerMm,
            source: result.source as unknown as Record<string, unknown>,
          };
          optsRef.current.setSheet(side, { src, pxWidth: sheet.width, pxHeight: sheet.height, original, remap }, "remap");
        }
        setState((s) => ({ ...s, [side]: { status: "done", result, mode: result.source?.mode ?? null } }));
      } catch {
        if (stale()) return;
        setState((s) => ({ ...s, [side]: { status: "error" } }));
        optsRef.current.onError?.();
      }
    },
    [get],
  );

  const upload = useCallback(
    async (file: File, side: PrintSurface) => {
      const o = optsRef.current;
      // The file at full size first, as before: it stays when no cut lines are found.
      const full = await prepareImage(file, SHEET_IMAGE_OPTIONS);
      o.setSheet(side, full);
      if (!o.model || !o.enabled) return;
      setState((s) => ({ ...s, [side]: { status: "reading" } }));
      // Recognising runs on in the worker; the upload itself is done.
      void recogniseFile(file, side);
    },
    [recogniseFile],
  );

  // Model, size, board or features changed: make the sheet again from the kept original.
  const busy = useRef<Partial<Record<PrintSurface, string>>>({});
  const { model, modelCode, sheets, enabled } = opts;
  useEffect(() => {
    if (!model || !enabled) return;
    for (const side of ["outside", "inside"] as PrintSurface[]) {
      const img = sheets[side];
      if (!img?.remap || !img.original) continue;
      const key = remapTargetKey(modelCode, model, side);
      if (img.remap.target === key || busy.current[side] === key) continue;
      busy.current[side] = key;
      const original = img.original;
      const source = img.remap.source as unknown as RemapSource;
      void (async () => {
        try {
          const det = await get();
          const work = await workingCopy(await (await fetch(original.src)).blob());
          const { report, sheet } = await det.remap(work.image, { scale: work.image.width / original.pxWidth, surface: side, target: model, source });
          // still current?
          const now = optsRef.current;
          if (!now.model || remapTargetKey(now.modelCode, now.model, side) !== key) return;
          const src = await blobToDataUrl(sheet.blob);
          now.setSheet(side, { src, pxWidth: sheet.width, pxHeight: sheet.height, original, remap: { ...img.remap!, target: key, sourcePxPerMm: report.sourcePxPerMm } }, "remap");
        } catch {
          optsRef.current.onError?.();
        } finally {
          if (busy.current[side] === key) delete busy.current[side];
        }
      })();
    }
  }, [model, modelCode, sheets, enabled, get]);

  const withMatch = useCallback((side: PrintSurface, match: Recognised): SheetImage | null => {
    const img = optsRef.current.sheets[side];
    if (!img?.original) return null;
    return {
      ...img,
      remap: { mode: match.source.mode, code: match.code, target: "", sourcePxPerMm: img.remap?.sourcePxPerMm ?? 0, source: match.source as unknown as Record<string, unknown> },
    };
  }, []);

  return { state, prepare, upload, withMatch };
}

/** Inner dims from the proportions and one measurement: the lid's width (L) in mm. */
export function dimsFromLidWidth(proportions: Dims, lidWidthMm: number): Dims {
  const k = lidWidthMm / (proportions.L || 1);
  return { L: Math.round(proportions.L * k), W: Math.round(proportions.W * k), H: Math.round(proportions.H * k) };
}
