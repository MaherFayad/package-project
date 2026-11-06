import type { PerspectiveCamera } from "three";

/**
 * Framing around overlays (owner: 3D engine). A toolbar floating over the canvas (ViewControls,
 * a badge) hides part of it; the camera fit frames the model inside the VISIBLE rectangle and
 * shifts the projection centre to that rectangle's centre (CR-13).
 */
export interface FitInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export const NO_INSETS: Required<FitInsets> = { top: 0, right: 0, bottom: 0, left: 0 };

export function normInsets(...list: (FitInsets | null | undefined)[]): Required<FitInsets> {
  const out = { ...NO_INSETS };
  for (const i of list) {
    if (!i) continue;
    out.top = Math.max(out.top, i.top ?? 0);
    out.right = Math.max(out.right, i.right ?? 0);
    out.bottom = Math.max(out.bottom, i.bottom ?? 0);
    out.left = Math.max(out.left, i.left ?? 0);
  }
  return out;
}

export const sameInsets = (a: Required<FitInsets>, b: Required<FitInsets>) =>
  Math.abs(a.top - b.top) < 2 && Math.abs(a.right - b.right) < 2 && Math.abs(a.bottom - b.bottom) < 2 && Math.abs(a.left - b.left) < 2;

/** Visible fraction of the canvas (horizontal, vertical), never below 40 %. */
export function visibleFraction(size: { width: number; height: number }, i: Required<FitInsets>): { fx: number; fy: number } {
  const w = Math.max(1, size.width);
  const h = Math.max(1, size.height);
  return { fx: Math.max(0.4, (w - i.left - i.right) / w), fy: Math.max(0.4, (h - i.top - i.bottom) / h) };
}

/** Shift the projection so the scene centre lands in the centre of the visible rectangle. */
export function applyViewInsets(camera: PerspectiveCamera, size: { width: number; height: number }, i: Required<FitInsets>) {
  const w = Math.max(1, Math.round(size.width));
  const h = Math.max(1, Math.round(size.height));
  const dx = (i.right - i.left) / 2;
  const dy = (i.bottom - i.top) / 2;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    if (camera.view?.enabled) camera.clearViewOffset();
    return;
  }
  camera.setViewOffset(w, h, dx, dy, w, h);
}
