"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BadgeCheck, MapPin, Pause, Play, Star } from "lucide-react";
import type { HeroScene3DProps } from "./HeroScene3D";
import { HeroImage } from "./HeroImage";
import styles from "./marketing.module.css";

const loadHeroScene = () => import("./HeroScene3D");
const HeroScene3D = dynamic<HeroScene3DProps>(loadHeroScene, { ssr: false });

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
 * Hero visual: a static poster render (the same mailer, artwork and angle) that stays mounted as
 * the LCP element. The live 3D box (three + r3f, ~260 KB gz and a ~0.5 s boot) mounts over it
 * only on intent: the pointer enters or presses the box itself (not the pause button, which must
 * never start heavier motion). Keyboard users keep the poster; the designer has the full
 * keyboard-operable 3D viewer. Booting it on idle blocked first taps (INP 600+ ms on phones, 300 ms on desktop). It fades in after its
 * first frame, with floating proof chips around it. One pause button
 * stops both the turntable and the floating chips (WCAG 2.2.2); both start paused under
 * prefers-reduced-motion.
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
  const [ready3d, setReady3d] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

  // Load the 3D chunk first, then mount on the next idle period so the pointer event that
  // showed intent paints immediately.
  const intent = () => {
    if (mount3d) return;
    void loadHeroScene()
      .catch(() => undefined)
      .then(() => {
        const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
        if (w.requestIdleCallback) w.requestIdleCallback(() => setMount3d(true), { timeout: 1000 });
        else window.setTimeout(() => setMount3d(true), 50);
      });
  };

  return (
    <div className={styles.heroVisual} data-paused={playing ? "false" : "true"}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroStage} data-live={ready3d ? "true" : "false"} onPointerEnter={intent} onPointerDown={intent}>
        {/* AVIF + preload (R4-MK-06); sizes = the contained render's real width (stage 89% of the visual on phones). */}
        <HeroImage src={poster} sizes="(min-width: 1024px) 600px, calc(89vw - 28px)" alt="" className={styles.heroPoster} width={914} height={608} />
        {mount3d ? (
          <div className={styles.heroCanvas} data-ready={ready3d ? "true" : "false"}>
            <HeroScene3D playing={playing} labels={labels} onReady={() => setReady3d(true)} onInteract={() => setPlaying(false)} />
          </div>
        ) : null}
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
