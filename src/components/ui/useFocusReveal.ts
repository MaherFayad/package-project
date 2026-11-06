"use client";

import { useEffect } from "react";

/**
 * Keyboard focus inside a horizontal scroller is always brought fully into view (WCAG 2.4.7 Focus
 * visible, 2.4.11 Focus not obscured; a11y R5-AX-01).
 *
 * Chromium only scrolls a focused element into view when it is completely outside its scroller.
 * In a chip row or product rail a control that is partly clipped receives focus with no scroll at
 * all, so every second Tab lands on a chip that is 60 to 100 % off screen (catalogue family chips
 * at 320 and 390 px, ar + en). On keyboard focus (`:focus-visible`, no pointer pressed) this walks
 * the scrolling ancestors and, if any clips the control horizontally, scrolls it to the nearest
 * edge. Pointer focus never scrolls: moving the target between pointerdown and pointerup would
 * swallow the click (same rule as the cookie notice, R4-K01).
 *
 * Installed once per document, however many <AppProvider>s are mounted.
 */
let installs = 0;
let pointerDown = false;

function clipped(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (p.scrollWidth <= p.clientWidth + 1) continue;
    const ox = getComputedStyle(p).overflowX;
    if (ox !== "auto" && ox !== "scroll" && ox !== "hidden") continue;
    const pr = p.getBoundingClientRect();
    if (r.left < pr.left - 1 || r.right > pr.right + 1) return true;
  }
  return false;
}

const onPointerDown = () => (pointerDown = true);
const onPointerUp = () => (pointerDown = false);
function onFocusIn(e: FocusEvent) {
  const t = e.target;
  if (pointerDown || !(t instanceof HTMLElement) || !t.matches(":focus-visible")) return;
  if (clipped(t)) t.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" as ScrollBehavior });
}

export function useFocusReveal(): void {
  useEffect(() => {
    if (installs++ === 0) {
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("pointerup", onPointerUp, true);
      document.addEventListener("pointercancel", onPointerUp, true);
      document.addEventListener("focusin", onFocusIn);
    }
    return () => {
      if (--installs === 0) {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("pointerup", onPointerUp, true);
        document.removeEventListener("pointercancel", onPointerUp, true);
        document.removeEventListener("focusin", onFocusIn);
        pointerDown = false;
      }
    };
  }, []);
}
