"use client";

import { useEffect, useRef } from "react";

/**
 * A number that counts up once when it scrolls into view. The final value is in the server HTML
 * (no layout shift, correct for no-JS, screen readers and reduced motion); the animation only
 * rewrites the visible digits, with tabular figures so the width does not move.
 */
export function CountUp({ value, prefix = "", suffix = "", className }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const fmt = new Intl.NumberFormat("en-US");
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // already visible: leave the final value
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 900;
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          el.textContent = `${prefix}${fmt.format(Math.round(value * eased))}${suffix}`;
          if (k < 1) raf = requestAnimationFrame(step);
        };
        el.textContent = `${prefix}0${suffix}`;
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, prefix, suffix]);
  return (
    <span ref={ref} className={className}>
      {`${prefix}${new Intl.NumberFormat("en-US").format(value)}${suffix}`}
    </span>
  );
}
