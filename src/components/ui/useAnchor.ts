"use client";

import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

export type Alignment = "start" | "center" | "end";
export type Placement = "below" | "above";

/**
 * Position a floating panel (position: fixed) next to an anchor, mirroring for RTL and
 * flipping above when there is no room below. Fixed positioning escapes overflow clipping
 * (scrolling tables, cards) without moving the panel in the DOM, so Tab order stays natural.
 */
export function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  { alignment = "start", preferred = "below", gap = 4 }: { alignment?: Alignment; preferred?: Placement; gap?: number } = {},
) {
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden", top: 0, left: 0 });
  const [placement, setPlacement] = useState<Placement>(preferred);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const rtl = getComputedStyle(anchor).direction === "rtl";
    const margin = 8;

    const spaceBelow = vh - a.bottom - gap - margin;
    const spaceAbove = a.top - gap - margin;
    const place: Placement =
      preferred === "below" ? (spaceBelow < ph && spaceAbove > spaceBelow ? "above" : "below") : spaceAbove < ph && spaceBelow > spaceAbove ? "below" : "above";
    const top = place === "below" ? a.bottom + gap : a.top - gap - ph;

    // Logical alignment -> physical left.
    let left: number;
    const alignStart = (alignment === "start" && !rtl) || (alignment === "end" && rtl);
    if (alignment === "center") left = a.left + a.width / 2 - pw / 2;
    else if (alignStart) left = a.left;
    else left = a.right - pw;
    left = Math.max(margin, Math.min(left, vw - pw - margin));

    setPlacement(place);
    setStyle({
      position: "fixed",
      top: Math.max(margin, top),
      left,
      maxHeight: Math.max(160, (place === "below" ? spaceBelow : spaceAbove)),
      visibility: "visible",
    });
  }, [anchorRef, panelRef, alignment, preferred, gap]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    const onChange = () => update();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [open, update]);

  return { style, placement, update };
}
