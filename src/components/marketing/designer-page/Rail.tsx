"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import styles from "./designer-page.module.css";

/**
 * A drifting strip (box styles wall, materials wall). Server-rendered items come in as
 * children twice: `items` (real, focusable) and `echo` (the copy that closes the loop, hidden
 * from assistive tech and inert). It pauses on hover, on focus inside and with its own button
 * (WCAG 2.2.2), and is a plain keyboard-scrollable strip under reduced motion or when paused.
 */
export function Rail({
  items,
  echo,
  label,
  pause,
  play,
  variant,
  controls = "below",
}: {
  items: ReactNode;
  echo: ReactNode;
  label: string;
  pause: string;
  play: string;
  variant: "wall" | "materials";
  controls?: "below" | "none";
}) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) {
      setReduced(true);
      setPaused(true);
    }
  }, []);
  const viewport = variant === "wall" ? styles.wallViewport : styles.matRail;
  const track = variant === "wall" ? styles.wallTrack : styles.matTrack;
  return (
    <div data-paused={paused ? "true" : "false"}>
      <div className={viewport} role="region" aria-label={label} tabIndex={0}>
        <ul className={track}>
          {items}
          {reduced ? null : echo}
        </ul>
      </div>
      {controls === "below" && !reduced ? (
        <div className={styles.wallBar}>
          <button type="button" className={styles.iconBtn} onClick={() => setPaused((p) => !p)} aria-label={paused ? play : pause}>
            {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
