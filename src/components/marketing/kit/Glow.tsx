import type { CSSProperties } from "react";
import styles from "./kit.module.css";

export interface GlowProps {
  color?: "violet" | "green" | "navy" | "white";
  /** Centre, as CSS lengths from the inline start / top of the positioned parent. Default 50% / 50%. */
  x?: string;
  y?: string;
  /** Diameter. Default "60vmax". */
  size?: string;
  blur?: number;
  /**
   * Slow 8s opacity breathing (mc-glow-fade). Decorative, opacity only; it is auto-motion, so put
   * the section inside <MotionScope> to give it a pause button (WCAG 2.2.2). Off under reduced motion.
   */
  breathe?: boolean;
}

/** Radial glow orb behind media (CSS only, aria-hidden). Place inside a position:relative parent (Sheet is). */
export function Glow({ color = "violet", x = "50%", y = "50%", size = "60vmax", blur = 40, breathe = false }: GlowProps) {
  return <span aria-hidden="true" className={styles.glow} data-color={color} data-breathe={breathe ? "true" : undefined} style={{ "--gx": x, "--gy": y, "--gs": size, "--gb": `${blur}px` } as CSSProperties} />;
}
