"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { IconPill } from "./Pill";
import { useReducedMotion } from "./motion";
import styles from "./kit.module.css";

export interface StepItem {
  title: ReactNode;
  body?: ReactNode;
  /** Image / video shown while this step is active. */
  media: ReactNode;
}

export interface StepsProps {
  items: StepItem[];
  /** Auto-advance interval in ms (progress bar fills over it). Default 6000; 0 = manual only. */
  interval?: number;
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
}

/**
 * Numbered steps (01 / 02 / 03) with an underline progress bar; the active step swaps the media.
 * ARIA tabs (arrow keys, Home / End). Auto-advances with a pause button (WCAG 2.2.2); stops on
 * hover, on focus inside and under reduced motion. Without JS the first step is open.
 */
export function Steps({ items, interval = 6000, label, className }: StepsProps) {
  const { t } = useI18n();
  const id = useId();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const auto = interval > 0 && !reduce;
  const running = auto && !paused && !hold;

  useEffect(() => {
    if (!running) return;
    const h = setTimeout(() => setActive((a) => (a + 1) % items.length), interval);
    return () => clearTimeout(h);
  }, [running, active, interval, items.length]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = items.length;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let next = -1;
    if (e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (i + 1) % n;
    else if (e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div
      className={[styles.steps, className].filter(Boolean).join(" ")}
      data-auto={auto ? "true" : undefined}
      data-paused={!running ? "true" : "false"}
      style={{ "--step-dur": `${interval}ms` } as CSSProperties}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false);
      }}
    >
      <div>
        <div role="tablist" aria-label={label} aria-orientation="vertical" className={styles.stepList}>
          {items.map((it, i) => (
            <button
              key={i}
              ref={(el) => void (tabs.current[i] = el)}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${id}-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              className={styles.stepBtn}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className={styles.stepNum} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={styles.stepTitle}>{it.title}</span>
              {it.body ? <span className={styles.stepBody}>{it.body}</span> : null}
              <span className={styles.stepBar} aria-hidden="true">
                <span className={styles.stepBarFill} key={i === active ? `on-${active}` : "off"} />
              </span>
            </button>
          ))}
        </div>
        {auto ? (
          <div className={styles.stepControls}>
            <IconPill aria-label={paused ? t("mk.motion.playSteps") : t("mk.motion.pauseSteps")} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
            </IconPill>
          </div>
        ) : null}
      </div>
      <div className={styles.stepMedia}>
        {items.map((it, i) => (
          <div key={i} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} className={styles.stepPanel} data-active={i === active ? "true" : "false"} aria-hidden={i !== active}>
            {it.media}
          </div>
        ))}
      </div>
    </div>
  );
}
