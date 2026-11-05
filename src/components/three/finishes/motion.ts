/**
 * Motion curves for the 3D viewer (camera fits, fold, finish crossfades). Every animation in
 * the viewer jumps to its end state under prefers-reduced-motion; callers check that.
 */

/** Ease in-out cubic: gentle start and landing (camera fits, view changes). */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Ease out quint: fast start, long soft landing (fold/unfold, poster fade). */
export function easeOutQuint(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 5);
}

/** Frame-rate independent exponential approach factor for a time constant tau (s). */
export function damp(dt: number, tau: number): number {
  return 1 - Math.exp(-Math.max(0, dt) / Math.max(1e-4, tau));
}

/** Auto-rotate defaults: start after 4 s idle, one turn per ~60 s (calm, not a carousel). */
export const AUTO_ROTATE = { idleMs: 4000, degPerSec: 6, rampMs: 1200 } as const;
