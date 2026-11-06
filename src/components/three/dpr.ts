/**
 * Device-pixel-ratio cap for the 3D canvases. Kept free of `three` so first-load route code
 * (the editor shell) can read it without pulling three.js core into its bundle (PERF-03).
 */
export function defaultMaxDpr(): number {
  if (typeof window === "undefined") return 1.5;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || cores <= 4) return 1.5;
  return 2;
}
