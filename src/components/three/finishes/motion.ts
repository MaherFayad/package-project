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

/**
 * The app's one motion scale (CR-18), mirrored from src/styles/tokens.css (--motion-*, --ease-*)
 * for JS-driven animation. Keep the two in sync. Durations in ms; curves as cubic-bezier control
 * points [x1, y1, x2, y2]. Under prefers-reduced-motion the CSS durations are 0; JS callers
 * must check the media query themselves and jump to the end state.
 */
export const MOTION_MS = { instant: 80, fast: 150, base: 200, slow: 300, reveal: 480 } as const;
export const EASE = {
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
  /** Small overshoot; transform only. */
  spring: [0.34, 1.56, 0.64, 1],
} as const;
