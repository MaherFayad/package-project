"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { IconPill } from "./Pill";
import { useReducedMotion } from "./motion";
import styles from "./kit.module.css";

/**
 * Wraps auto-moving decoration (Orbit, breathing Glow, any CSS loop) with a pause / play button
 * (WCAG 2.2.2 Pause, Stop, Hide). Pausing sets animation-play-state: paused on every descendant.
 * The button is hidden under reduced motion, where nothing moves.
 *
 * Page-local loops (your own CSS keyframes outside the kit) register by carrying
 * `data-mk-motion` on the animated element or an ancestor:
 *   - inside a MotionScope they pause with it (every descendant does);
 *   - anywhere else on the page they pause when a MotionScope with `global` is paused (it sets
 *     html[data-mk-motion-paused]);
 *   - under prefers-reduced-motion the kit turns their animation off (animation: none).
 * A page with loops outside any scope must render one `<MotionScope global>` (WCAG 2.2.2).
 */
export function MotionScope({ children, className, pauseLabel, playLabel, buttonClassName, global = false }: { children: ReactNode; className?: string; pauseLabel?: string; playLabel?: string; buttonClassName?: string; global?: boolean }) {
  const { t } = useI18n();
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!global) return;
    const html = document.documentElement;
    if (paused) html.setAttribute("data-mk-motion-paused", "");
    else html.removeAttribute("data-mk-motion-paused");
    return () => html.removeAttribute("data-mk-motion-paused");
  }, [global, paused]);
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
