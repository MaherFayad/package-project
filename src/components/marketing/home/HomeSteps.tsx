"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { IconPill } from "@/components/marketing/kit/Pill";
import s from "./home.module.css";

const STEP_MS = 5000;

/**
 * "Build fast" steps: 01/02/03 with an underline that fills while the step is shown; the active
 * step swaps the two images. Auto-advances every 5 s while visible, with a pause button
 * (WCAG 2.2.2); choosing a step stops the auto-advance. Static under reduced motion.
 */
export function HomeSteps({
  items,
  media,
  cta,
  labels,
}: {
  items: string[];
  /** Two image slots; each slot lists one image per step (cross-faded). */
  media: { src: string; srcSet?: string; fit?: "contain" }[][];
  cta: ReactNode;
  labels: { pause: string; play: string };
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      setPaused(true);
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.3,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (paused || !visible) return;
    const id = window.setTimeout(
      () => setActive((a) => (a + 1) % items.length),
      STEP_MS,
    );
    return () => window.clearTimeout(id);
  }, [active, paused, visible, items.length]);
  const running = !paused && visible;
  return (
    <div
      ref={ref}
      className={`${s.stepsGrid} ${s.stepsRoot}`}
      data-paused={running ? "false" : "true"}
      style={{ ["--step-dur" as string]: `${STEP_MS}ms` }}
    >
      <div>
        <ol className={s.stepList}>
          {items.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                className={s.stepBtn}
                aria-current={active === i ? "step" : undefined}
                onClick={() => {
                  setActive(i);
                  setPaused(true);
                }}
              >
                <span className={s.stepNum} aria-hidden="true">
                  0{i + 1}
                </span>
                <span className={s.stepLabel}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className={s.stepsFoot}>
          {cta}
          <IconPill
            className={undefined}
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? labels.play : labels.pause}
          >
            {paused ? (
              <Play size={18} aria-hidden />
            ) : (
              <Pause size={18} aria-hidden />
            )}
          </IconPill>
        </div>
      </div>
      <div className={s.stepMedia} aria-hidden="true">
        {media.map((slot, k) => (
          <div key={k} className={s.stepImg}>
            {slot.map((im, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={im.src}
                srcSet={im.srcSet}
                sizes="(min-width: 1024px) 300px, 45vw"
                alt=""
                loading="lazy"
                decoding="async"
                data-fit={im.fit}
                data-active={i === active ? "true" : "false"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
