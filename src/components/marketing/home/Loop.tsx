"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import s from "./home.module.css";

/**
 * Wrapper for an auto-moving region (rail, icon wall): one pause/play button (WCAG 2.2.2), hover
 * and focus pause in CSS, paused while off screen, and paused from the start under
 * prefers-reduced-motion (2.3.3). Children render on the server; this only toggles data-paused.
 */
export function Loop({
  className,
  children,
  labels,
  controlClassName,
  head,
}: {
  className?: string;
  children: ReactNode;
  labels: { pause: string; play: string };
  controlClassName?: string;
  head?: ReactNode;
}) {
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const button = (
    <button type="button" className={`${s.iconBtn} ${controlClassName ?? ""}`} onClick={() => setPaused((p) => !p)} aria-label={paused ? labels.play : labels.pause}>
      {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
    </button>
  );
  return (
    <div ref={ref} className={className} data-paused={paused || offscreen ? "true" : "false"}>
      {head ? (
        <div className={s.railHead}>
          {head}
          {button}
        </div>
      ) : null}
      {children}
      {head ? null : button}
    </div>
  );
}
