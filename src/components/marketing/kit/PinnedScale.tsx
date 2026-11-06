"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion, useScrollProgress } from "./motion";
import styles from "./kit.module.css";

export interface PinnedScaleProps {
  /** The card that grows (an <img>, <video> or <picture>; fills the stage). */
  media: ReactNode;
  /** Content behind the card (a giant headline), visible around it while it is small. */
  behind?: ReactNode;
  /** Start scale (0 to 1). Default 0.45. */
  from?: number;
  /** Scroll length of the pinned stretch. Default "220vh". */
  length?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Scroll-scrubbed grow: the stage pins for `length` and the card scales from `from` to full
 * bleed (radius 32 to 0). CSS scroll-driven animation (view timeline) where supported, a rAF
 * scroll fallback elsewhere. Without JS, and under reduced motion, the card is shown full size
 * and nothing pins.
 */
export function PinnedScale({ media, behind, from = 0.45, length = "220vh", className, ...rest }: PinnedScaleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<"none" | "css" | "js">("none");
  useEffect(() => {
    if (reduce) return setMode("none");
    setMode(typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()") ? "css" : "js");
  }, [reduce]);
  const onProgress = useCallback((_p: number, r: DOMRect) => {
    const el = ref.current;
    if (!el) return;
    const span = r.height - window.innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, -r.top / (span * 0.7))) : 1;
    el.style.setProperty("--pin-p", p.toFixed(4));
  }, []);
  useScrollProgress(ref, onProgress, mode === "js");
  return (
    <div
      ref={ref}
      className={[styles.pin, className].filter(Boolean).join(" ")}
      style={{ "--pin-length": length, "--pin-from": from } as CSSProperties}
      data-css={mode === "css" ? "true" : undefined}
      data-js={mode === "js" ? "true" : undefined}
      role={rest["aria-label"] ? "group" : undefined}
      aria-label={rest["aria-label"]}
    >
      <div className={styles.pinStage}>
        {behind ? <div className={styles.pinBehind}>{behind}</div> : null}
        <div className={styles.pinMedia}>{media}</div>
      </div>
    </div>
  );
}
