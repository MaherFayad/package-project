"use client";

import { useEffect, type RefObject } from "react";

/**
 * Scroll reveals, once. Every element with [data-reveal] inside `root` (default: document)
 * gets [data-revealed] the first time it enters the viewport; motion.css animates the change.
 *
 * - Elements already on screen when this runs are revealed at once (no flash of hidden content).
 * - Nothing is hidden before this runs: the hidden state needs html[data-motion="on"].
 * - Under prefers-reduced-motion everything is revealed immediately and nothing moves.
 * - New [data-reveal] nodes added later (client navigation) are picked up by a MutationObserver.
 */
export function useReveal(root?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope: ParentNode = root?.current ?? document;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const reveal = (el: Element) => el.setAttribute("data-revealed", "");
    const pending = () => Array.from(scope.querySelectorAll("[data-reveal]:not([data-revealed])"));

    if (reduce || typeof IntersectionObserver === "undefined") {
      pending().forEach(reveal);
      return;
    }
    const vh = window.innerHeight;
    pending().forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.95 && r.bottom > 0) reveal(el);
    });
    document.documentElement.setAttribute("data-motion", "on");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal(e.target);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const observeAll = () => pending().forEach((el) => io.observe(el));
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(scope instanceof Document ? scope.body : (scope as Node), { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [root]);
}

/** Drop-in client island for server pages: <RevealScope /> once per page. */
export function RevealScope() {
  useReveal();
  return null;
}
