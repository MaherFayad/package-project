"use client";

import { useEffect } from "react";

/**
 * a11y R4-02: the phone card rails ([data-rail]) use mandatory scroll snapping, which pulled the
 * rail back to the first card when Tab focused a later one, leaving the focused control mostly
 * out of view (WCAG 2.4.11 / 2.4.12). On focus inside a rail, scroll that card fully into view;
 * the snap point is its start, so snapping keeps it there. One document listener, no markup.
 */
export function RailFocus() {
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const t = e.target as Element | null;
      const card = t?.closest?.("[data-rail] > li");
      if (!card) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ inline: "start", block: "nearest", behavior: reduce ? "auto" : "smooth" });
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);
  return null;
}
