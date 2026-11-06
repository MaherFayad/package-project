"use client";

import { useEffect } from "react";

/**
 * Marks the table-of-contents link of the section in view with [data-active] (the 2 px rule on
 * the TOC line, as on the reference legal pages). Progressive: without JS the TOC is a plain
 * list of anchors. No motion, so nothing changes under reduced motion.
 */
export function TocSpy({ navId }: { navId: string }) {
  useEffect(() => {
    const nav = document.getElementById(navId);
    if (!nav || typeof IntersectionObserver === "undefined") return;
    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        const first = links.find((a) => seen.get(decodeURIComponent(a.hash.slice(1))));
        if (!first) return;
        links.forEach((a) => (a === first ? a.setAttribute("data-active", "") : a.removeAttribute("data-active")));
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    byId.forEach((_, id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [navId]);
  return null;
}
