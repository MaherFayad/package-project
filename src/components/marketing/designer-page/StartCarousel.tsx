"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./designer-page.module.css";

/**
 * Three numbered step cards on a scroll-snap strip with previous / next buttons. Swipe, wheel
 * and keyboard scrolling work natively; the buttons scroll one card (direction-aware in RTL)
 * and disable at the ends. No auto-advance, so nothing to pause.
 */
export function StartCarousel({ steps, label, prev, next, locale }: { steps: string[]; label: string; prev: string; next: string; locale: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const rtl = locale === "ar";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft);
      setAtStart(pos <= 2);
      setAtEnd(pos >= max - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const go = (d: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = (card?.getBoundingClientRect().width ?? el.clientWidth) + 16;
    el.scrollBy({ left: d * step * (rtl ? -1 : 1) });
  };

  return (
    <>
      <div ref={ref} className={styles.stepsViewport} role="region" aria-label={label} tabIndex={0}>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={i} className={styles.step}>
              <span className={styles.num} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.stepNav}>
        <button type="button" className={styles.iconBtn} onClick={() => go(-1)} disabled={atStart} aria-label={prev}>
          {rtl ? <ArrowRight size={18} aria-hidden /> : <ArrowLeft size={18} aria-hidden />}
        </button>
        <button type="button" className={styles.iconBtn} onClick={() => go(1)} disabled={atEnd} aria-label={next}>
          {rtl ? <ArrowLeft size={18} aria-hidden /> : <ArrowRight size={18} aria-hidden />}
        </button>
      </div>
    </>
  );
}
