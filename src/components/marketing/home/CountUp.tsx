"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` once when it scrolls into view (0.9 s ease-out). The server HTML holds the
 * final number, so it reads correctly without JavaScript and under reduced motion; the count only
 * starts from zero for numbers that are still below the fold when the page hydrates.
 */
export function CountUp({
  value,
  locale,
  className,
}: {
  value: number;
  locale: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setShown(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 900);
          setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
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
  }, [value]);
  const fmt = new Intl.NumberFormat(
    locale === "ar" ? "ar-EG-u-nu-latn" : "en-EG",
  );
  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{fmt.format(shown)}</span>
      <span
        style={{
          position: "absolute",
          inlineSize: 1,
          blockSize: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
        }}
      >
        {fmt.format(value)}
      </span>
    </span>
  );
}
