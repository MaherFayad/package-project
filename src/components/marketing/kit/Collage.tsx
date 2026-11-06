"use client";

import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion, useScrollProgress } from "./motion";
import styles from "./kit.module.css";

export interface CollageItem {
  media: ReactNode;
  /** Position of the item's start edge and top, as CSS lengths (percent of the collage). Logical: x mirrors in RTL. */
  x: string;
  y: string;
  /** Width (desktop). Phones get 1.6x. Default "18%". */
  w?: string;
  /** Parallax depth: -1 (moves up faster) to 1 (lags behind). 0 = static. */
  depth?: number;
  rotate?: number;
  /** Sit above the centre content. */
  front?: boolean;
  hideOnPhone?: boolean;
}

export interface CollageProps {
  items: CollageItem[];
  /** Centre content (giant words, pills). */
  children: ReactNode;
  /** Min height. Default "90svh". */
  height?: string;
  /** Parallax travel in px at depth 1. Default 160. */
  travel?: number;
  className?: string;
}

/**
 * Collage fly-in: product pieces scattered around giant words, each drifting at its own speed on
 * scroll (per-item depth). Off under reduced motion; without JS the items sit still.
 */
export function Collage({ items, children, height = "90svh", travel = 160, className }: CollageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const onProgress = useCallback(
    (p: number) => {
      const el = ref.current;
      if (!el) return;
      el.querySelectorAll<HTMLElement>("[data-depth]").forEach((n) => {
        const d = Number(n.dataset.depth) || 0;
        n.style.setProperty("--py", `${((p - 0.5) * -2 * d * travel).toFixed(1)}px`);
      });
    },
    [travel],
  );
  useScrollProgress(ref, onProgress, !reduce);
  return (
    <div ref={ref} className={[styles.collage, className].filter(Boolean).join(" ")} style={{ "--collage-h": height } as CSSProperties}>
      {items.map((it, i) => (
        <div
          key={i}
          className={styles.collageItem}
          data-depth={it.depth ?? 0}
          data-front={it.front ? "true" : undefined}
          data-phone={it.hideOnPhone ? "hide" : undefined}
          style={{ "--x": it.x, "--y": it.y, "--w": it.w ?? "18%", "--r": `${it.rotate ?? 0}deg`, ...(reduce ? { "--py": "0px" } : null) } as CSSProperties}
        >
          {it.media}
        </div>
      ))}
      <div className={styles.collageCenter}>{children}</div>
    </div>
  );
}
