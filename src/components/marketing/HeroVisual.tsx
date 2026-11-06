"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, MapPin, Pause, Play, Star } from "lucide-react";
import type { HeroScene3DProps } from "./HeroScene3D";
import styles from "./marketing.module.css";

const HeroScene3D = dynamic<HeroScene3DProps>(() => import("./HeroScene3D"), { ssr: false });

export interface HeroChips {
  priceTitle: string;
  priceValue: string;
  priceNote: string;
  approved: string;
  approvedBy: string;
  rating: string;
  ratingCount: string;
  delivered: string;
  deliveredMeta: string;
}

/**
 * Hero visual: a static poster render (the LCP image) that becomes the live 3D box once the
 * hero is on screen and the browser is idle, with floating proof chips around it. One pause
 * button stops both the turntable and the floating chips (WCAG 2.2.2); both start paused
 * under prefers-reduced-motion.
 */
export function HeroVisual({
  poster,
  chips,
  labels,
}: {
  poster: string;
  chips: HeroChips;
  labels: { viewer: string; roleDescription: string; keyboardHint: string; unsupported: string; pause: string; play: string };
}) {
  const [mount3d, setMount3d] = useState(false);
  const [playing, setPlaying] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    const el = ref.current;
    if (!el) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idle = 0;
    let timer = 0;
    const start = () => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setMount3d(true), { timeout: 2000 });
      else timer = window.setTimeout(() => setMount3d(true), 400);
    };
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
              io?.disconnect();
              start();
            }
          })
        : null;
    if (io) io.observe(el);
    else start();
    return () => {
      io?.disconnect();
      if (idle) w.cancelIdleCallback?.(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className={styles.heroVisual} ref={ref} data-paused={playing ? "false" : "true"}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroStage}>
        {mount3d ? (
          <HeroScene3D playing={playing} poster={poster} labels={labels} onInteract={() => setPlaying(false)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className={styles.heroPoster} width={960} height={640} fetchPriority="high" decoding="async" />
        )}
      </div>

      <div className={`${styles.chip} ${styles.chipDark} ${styles.chipPrice}`} style={{ ["--chip-i" as string]: 0 }} aria-hidden="true">
        <span className={styles.chipMeta}>{chips.priceTitle}</span>
        <span className={`${styles.chipValue} ${styles.num}`}>{chips.priceValue}</span>
        <span className={styles.chipUp}>{chips.priceNote}</span>
      </div>
      <div className={`${styles.chip} ${styles.chipApproved}`} style={{ ["--chip-i" as string]: 1 }} aria-hidden="true">
        <span className={styles.chipRow}>
          <span className={styles.chipIcon}>
            <BadgeCheck size={16} />
          </span>
          <span>
            <span className={styles.chipTitle}>{chips.approved}</span>
            <br />
            <span className={styles.chipMeta}>{chips.approvedBy}</span>
          </span>
        </span>
      </div>
      <div className={`${styles.chip} ${styles.chipRating}`} style={{ ["--chip-i" as string]: 2 }} aria-hidden="true">
        <span className={styles.chipRow}>
          <span className={`${styles.chipIcon} ${styles.chipStar}`} style={{ background: "#fff5d6" }}>
            <Star size={16} fill="currentColor" />
          </span>
          <span>
            <span className={`${styles.chipTitle} ${styles.num}`}>{chips.rating}</span>
            <br />
            <span className={styles.chipMeta}>{chips.ratingCount}</span>
          </span>
        </span>
      </div>
      <div className={`${styles.chip} ${styles.chipDelivered}`} style={{ ["--chip-i" as string]: 3 }} aria-hidden="true">
        <span className={styles.chipRow}>
          <span className={styles.chipIcon}>
            <MapPin size={16} />
          </span>
          <span>
            <span className={styles.chipTitle}>{chips.delivered}</span>
            <br />
            <span className={styles.chipMeta}>{chips.deliveredMeta}</span>
          </span>
        </span>
      </div>

      <div className={styles.heroToggle}>
        <button type="button" className={styles.iconPill} onClick={() => setPlaying((p) => !p)} aria-label={playing ? labels.pause : labels.play}>
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
