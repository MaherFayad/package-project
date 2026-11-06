"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { srcSetFor } from "./assets";
import styles from "./marketing.module.css";

/**
 * Endless strip of printed-sample photos. Pauses on hover and with its own button (WCAG 2.2.2);
 * stops under prefers-reduced-motion (motion.css / marketing.module.css). The second copy of
 * the list exists only for the seamless loop and is hidden from assistive tech.
 */
export function Marquee({ items, label, pause, play }: { items: { src: string; alt: string }[]; label: string; pause: string; play: string }) {
  const [paused, setPaused] = useState(false);
  const loop = [...items, ...items];
  return (
    <section className={styles.marquee} aria-label={label} data-paused={paused ? "true" : "false"}>
      <div className={`${styles.container} ${styles.marqueeHead}`}>
        <p className={styles.small}>{label}</p>
        <button type="button" className={styles.iconPill} onClick={() => setPaused((p) => !p)} aria-label={paused ? play : pause}>
          {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
        </button>
      </div>
      <div className={styles.marqueeViewport} role="group" aria-label={label}>
        <ul className={styles.marqueeTrack}>
          {loop.map((it, i) => (
            <li key={i} className={styles.marqueeItem} aria-hidden={i >= items.length || undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.src} srcSet={srcSetFor(it.src)} sizes="240px" alt={i >= items.length ? "" : it.alt} width={240} height={300} loading="lazy" decoding="async" fetchPriority="low" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
