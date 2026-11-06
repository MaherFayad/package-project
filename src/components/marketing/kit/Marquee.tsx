"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { IconPill } from "./Pill";
import styles from "./kit.module.css";

export interface MarqueeProps {
  items: ReactNode[];
  /** Accessible name of the strip (a named, focusable region). */
  label: string;
  /** Seconds per loop. Default 40. */
  duration?: number;
  /** Run the other way (two-row logo marquee: one row reversed). */
  reverse?: boolean;
  /** Gap between items, CSS length. Default "24px". */
  gap?: string;
  /** Show the pause button (WCAG 2.2.2). Default true; pass false only when another control pauses this strip. */
  controls?: boolean;
  /** Externally controlled pause (e.g. one button for two rows). */
  paused?: boolean;
  pauseLabel?: string;
  playLabel?: string;
  className?: string;
}

/**
 * Endless strip. RTL-correct (runs the reading direction), pauses on hover and focus and with
 * its own button (WCAG 2.2.2); under reduced motion it becomes a plain horizontal scroller with
 * a single copy. The loop copy is aria-hidden.
 */
export function Marquee({ items, label, duration = 40, reverse = false, gap = "24px", controls = true, paused: pausedProp, pauseLabel, playLabel, className }: MarqueeProps) {
  const { t } = useI18n();
  const [pausedState, setPaused] = useState(false);
  const paused = pausedProp ?? pausedState;
  return (
    <div className={[styles.marquee, className].filter(Boolean).join(" ")} data-paused={paused ? "true" : "false"} data-reverse={reverse ? "true" : undefined} style={{ "--marquee-dur": `${duration}s`, "--marquee-gap": gap } as CSSProperties}>
      {controls && pausedProp === undefined ? (
        <div className={styles.marqueeHead}>
          <IconPill aria-label={paused ? (playLabel ?? t("mk.motion.playMarquee")) : (pauseLabel ?? t("mk.motion.pauseMarquee"))} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
          </IconPill>
        </div>
      ) : null}
      <div className={styles.marqueeViewport} role="region" aria-label={label} tabIndex={0}>
        <ul className={styles.marqueeTrack}>
          {items.map((it, i) => (
            <li key={`a${i}`}>{it}</li>
          ))}
          {items.map((it, i) => (
            <li key={`b${i}`} aria-hidden="true" inert>
              {it}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Big-type ticker (words with accent separators), built on Marquee. */
export function Ticker({ words, label, duration = 30, reverse, className }: { words: string[]; label: string; duration?: number; reverse?: boolean; className?: string }) {
  return (
    <Marquee
      label={label}
      duration={duration}
      reverse={reverse}
      gap="0px"
      className={[styles.ticker, className].filter(Boolean).join(" ")}
      items={words.map((w, i) => (
        <span key={i}>
          {w}
          <span className={styles.tickerSep} aria-hidden="true">
            ●
          </span>
        </span>
      ))}
    />
  );
}
