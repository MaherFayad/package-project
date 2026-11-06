"use client";

import { useEffect } from "react";

/**
 * The one client island of /start (R6). It writes scroll progress into CSS custom properties and
 * start.module.css does the rest, so the page stays server-rendered and the island is tiny.
 *
 * - `[data-sp="view"]`: --sp goes 0 → 1 as the element crosses the viewport (bottom edge enters →
 *   top edge leaves). Drives collage parallax and the card-fan drift.
 * - `[data-sp="pin"]`: --sp goes 0 → 1 over the element's sticky run (top reaches 0 → bottom
 *   reaches the viewport bottom). Drives the pinned "choose your box" card scale.
 *
 * Content is visible without it: the CSS defaults are the final state (card full size, collage
 * at rest). It sets html[data-start-motion="on"] only when motion is allowed, and does nothing
 * under prefers-reduced-motion (WCAG 2.2 SC 2.3.3). Writes are rAF-batched and only touch
 * transforms via custom properties (no layout, no CLS).
 *
 * Swap for the foundation kit's PinnedScale / Collage / CardFan once that branch is merged.
 */
export function StartMotion() {
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) return;
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-sp]"));
    if (!els.length) return;
    root.setAttribute("data-start-motion", "on");

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        let p: number;
        if (el.dataset.sp === "pin") {
          const run = r.height - vh;
          p = run > 0 ? -r.top / run : r.top <= 0 ? 1 : 0;
        } else {
          p = (vh - r.top) / (vh + r.height);
        }
        el.style.setProperty("--sp", Math.min(1, Math.max(0, p)).toFixed(4));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onMotionPref = () => {
      if (mq?.matches) {
        stop();
      }
    };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mq?.removeEventListener?.("change", onMotionPref);
      if (frame) cancelAnimationFrame(frame);
      root.removeAttribute("data-start-motion");
      for (const el of els) el.style.removeProperty("--sp");
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    mq?.addEventListener?.("change", onMotionPref);
    return stop;
  }, []);
  return null;
}
