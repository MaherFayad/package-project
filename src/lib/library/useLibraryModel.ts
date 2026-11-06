"use client";

import { useEffect, useState } from "react";
import { isModelLoaded, loadModel, modelSourceOf } from "./registry";

/**
 * Browser: load the family pack of a model code (PERF-04) and report when it is ready.
 * Starts false on the server render and the first client render (no hydration mismatch), then
 * true once `modelByCode(code)` / `docGeometry` can see the model. Unknown codes are "ready"
 * (callers show their own error).
 */
export function useLibraryModel(code: string | null | undefined): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!code || !modelSourceOf(code) || isModelLoaded(code)) {
      setReady(true);
      return;
    }
    setReady(false);
    loadModel(code)
      .catch(() => null)
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [code]);
  return ready;
}
