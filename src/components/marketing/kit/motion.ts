"use client";

import { useEffect, useState } from "react";

/** True when the visitor asked for reduced motion (OS setting), or the kit gallery forces it (html[data-mk-reduced]). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.hasAttribute("data-mk-reduced") || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Reactive prefersReducedMotion(): follows the OS setting and the gallery toggle. SSR value: false. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(prefersReducedMotion());
    on();
    mq?.addEventListener?.("change", on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mk-reduced"] });
    return () => {
      mq?.removeEventListener?.("change", on);
      mo.disconnect();
    };
  }, []);
  return reduce;
}

/** Calls `fn(progress)` on scroll for `el` (0 when its top meets the viewport bottom, 1 when its bottom leaves the top), rAF-throttled. */
export function useScrollProgress(el: React.RefObject<HTMLElement | null>, fn: (p: number, rect: DOMRect) => void, enabled = true) {
  useEffect(() => {
    if (!enabled || !el.current) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const node = el.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      fn(p, r);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [el, fn, enabled]);
}
