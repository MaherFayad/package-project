"use client";

import { useEffect, useState } from "react";

/**
 * A decorative image (alt="") that loads only after window load. Used for the hero marquee
 * thumbnails, which sit next to the phone LCP render and would otherwise compete with it on a
 * slow connection. The box keeps its size before and after (no layout shift).
 */
export function DeferredImg({ src, width, height, className }: { src: string; width: number; height: number; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    if (document.readyState === "complete") {
      const id = setTimeout(go, 0);
      return () => clearTimeout(id);
    }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  if (!ready) return <span className={className} style={{ display: "block", inlineSize: width, blockSize: height }} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={width} height={height} decoding="async" fetchPriority="low" className={className} />;
}
