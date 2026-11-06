"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import styles from "./why.module.css";

export interface TickerItem {
  label: string;
  kind: string;
  img?: string;
}

/**
 * Endless ticker of our box styles and finishes (the reference page runs customer logos here; we
 * have none to show, and would not invent them). Moves toward the reading end: right to left in
 * English, left to right in Arabic. Pause button and hover/focus pause (WCAG 2.2.2); static
 * under prefers-reduced-motion. The duplicate run is aria-hidden.
 */
export function Ticker({ items, label, pause, play }: { items: TickerItem[]; label: string; pause: string; play: string }) {
  const [paused, setPaused] = useState(false);
  // The thumbnails are decorative (alt="") and sit in the hero next to the LCP render: load them
  // only after the page has loaded, so they never compete with it on a slow phone connection.
  // The 56px box is reserved either way (no layout shift).
  const [thumbs, setThumbs] = useState(false);
  useEffect(() => {
    const go = () => setThumbs(true);
    if (document.readyState === "complete") {
      const id = setTimeout(go, 0);
      return () => clearTimeout(id);
    }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  const row = (copy: number) =>
    items.map((it, i) => (
      <li key={`${copy}-${i}`} className={styles.tickItem} aria-hidden={copy > 0 || undefined}>
        {it.img ? (
          thumbs ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.img} alt="" width={56} height={56} loading="lazy" decoding="async" fetchPriority="low" className={styles.tickImg} />
          ) : (
            <span className={styles.tickImg} aria-hidden="true" />
          )
        ) : (
          <span className={styles.tickDot} aria-hidden="true" />
        )}
        <span className={styles.tickText}>
          <span className={styles.tickLabel}>{it.label}</span>
          <span className={styles.tickKind}>{it.kind}</span>
        </span>
      </li>
    ));
  return (
    <div className={styles.ticker} data-paused={paused ? "true" : "false"}>
      <div className={styles.tickViewport} role="region" aria-label={label} tabIndex={0}>
        <ul className={styles.tickTrack}>
          {row(0)}
          {row(1)}
        </ul>
      </div>
      <button type="button" className={styles.tickToggle} onClick={() => setPaused((p) => !p)} aria-label={paused ? play : pause} aria-pressed={paused}>
        {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
      </button>
    </div>
  );
}
