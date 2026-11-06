"use client";

import { useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { IconPill } from "./Pill";
import { useReducedMotion } from "./motion";
import styles from "./kit.module.css";

/**
 * Wraps auto-moving decoration (Orbit, breathing Glow, any CSS loop) with a pause / play button
 * (WCAG 2.2.2 Pause, Stop, Hide). Pausing sets animation-play-state: paused on every descendant.
 * The button is hidden under reduced motion, where nothing moves.
 */
export function MotionScope({ children, className, pauseLabel, playLabel, buttonClassName }: { children: ReactNode; className?: string; pauseLabel?: string; playLabel?: string; buttonClassName?: string }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div className={[styles.motionScope, className].filter(Boolean).join(" ")} data-paused={paused ? "true" : "false"}>
      {children}
      {reduce ? null : (
        <IconPill className={buttonClassName ?? styles.pauseBtn} aria-label={paused ? (playLabel ?? t("mk.motion.play")) : (pauseLabel ?? t("mk.motion.pause"))} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
        </IconPill>
      )}
    </div>
  );
}
