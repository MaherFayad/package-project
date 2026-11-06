"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";
import styles from "./kit.module.css";

export interface CountUpProps {
  /** Final value (a real Elba number: model count, finishes, printers, delivery days, prices). */
  value: number;
  /** Text before / after the number, e.g. suffix "+" or " EGP". */
  prefix?: string;
  suffix?: string;
  /** Decimal places. Default 0. */
  decimals?: number;
  /** ms. Default 1400. */
  duration?: number;
  className?: string;
}

const fmt = (v: number, d: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

/**
 * Counts up once when it scrolls into view (ease-out). The server HTML holds the final value
 * (visible without JS, correct for crawlers); screen readers get the final value only.
 * Western digits in both locales (platform convention). Static under reduced motion.
 */
export function CountUp({ value, prefix = "", suffix = "", decimals = 0, duration = 1400, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // already visible: keep the final value
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / duration);
          setShown(value * (1 - Math.pow(1 - k, 3)));
          if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  const final = `${prefix}${fmt(value, decimals)}${suffix}`;
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true" dir="ltr" style={{ unicodeBidi: "isolate" }}>
        {prefix}
        {fmt(shown, decimals)}
        {suffix}
      </span>
      <span className={styles.srOnly}>{final}</span>
    </span>
  );
}

/** Stat block: big count-up value + label. */
export function Stat({ label, ...count }: CountUpProps & { label: string }) {
  return (
    <div className={styles.stat}>
      <CountUp {...count} className={styles.statValue} />
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
