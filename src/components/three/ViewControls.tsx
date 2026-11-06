"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import type { PackagingSceneHandle } from "./PackagingScene";
import styles from "./ViewControls.module.css";

export interface ViewControlsLabels {
  group: string;
  rotateLeft: string;
  rotateRight: string;
  tiltUp: string;
  tiltDown: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
}

export const DEFAULT_VIEW_CONTROL_LABELS: ViewControlsLabels = {
  group: "View controls",
  rotateLeft: "Rotate left",
  rotateRight: "Rotate right",
  tiltUp: "Tilt up",
  tiltDown: "Tilt down",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  reset: "Reset view",
};

/**
 * Single-pointer alternative to dragging the 3D view (WCAG 2.5.7): 44 px buttons.
 * Always laid out left-to-right because the arrows are spatial, not reading order.
 */
export function ViewControls({
  handle,
  labels = DEFAULT_VIEW_CONTROL_LABELS,
  className,
}: {
  handle: RefObject<PackagingSceneHandle | null>;
  labels?: ViewControlsLabels;
  className?: string;
}) {
  const items: [keyof ViewControlsLabels, LucideIcon, () => void][] = [
    ["rotateLeft", ArrowLeft, () => handle.current?.rotate(-20)],
    ["tiltUp", ArrowUp, () => handle.current?.rotate(0, 12)],
    ["tiltDown", ArrowDown, () => handle.current?.rotate(0, -12)],
    ["rotateRight", ArrowRight, () => handle.current?.rotate(20)],
    ["zoomIn", ZoomIn, () => handle.current?.zoom(0.8)],
    ["zoomOut", ZoomOut, () => handle.current?.zoom(1.25)],
    ["reset", RotateCcw, () => handle.current?.reset()],
  ];
  const bar = useRef<HTMLDivElement>(null);
  useOverlayInsets(bar, handle);
  return (
    <div ref={bar} role="toolbar" aria-label={labels.group} dir="ltr" className={[styles.bar, className].filter(Boolean).join(" ")}>
      {items.map(([key, Icon, onClick]) => (
        <button key={key} type="button" className={styles.button} onClick={onClick} aria-label={labels[key]} title={labels[key]}>
          <Icon size={20} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/**
 * When the toolbar floats over the 3D canvas, tell the viewer how much of the canvas it covers so
 * the camera frames the model in the visible part (CR-13). Measured on resize; no-op when the bar
 * sits outside the canvas. Bottom / top overlays only (the bar spans most of a phone's width).
 */
function useOverlayInsets(bar: RefObject<HTMLDivElement | null>, handle: RefObject<PackagingSceneHandle | null>) {
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof window === "undefined") return;
    let last = "";
    let raf = 0;
    let tries = 0;
    const measure = () => {
      const h = handle.current;
      const canvas = h?.getCanvas();
      if (!h || !canvas) {
        // the viewer may still be loading (lazy chunk / WebGL init): retry for a few seconds
        if (tries++ < 240) raf = requestAnimationFrame(measure);
        return;
      }
      const c = canvas.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const overlapX = Math.min(c.right, b.right) - Math.max(c.left, b.left);
      const overlapY = Math.min(c.bottom, b.bottom) - Math.max(c.top, b.top);
      let insets = {};
      if (overlapX > 0 && overlapY > 0) {
        const gap = 12;
        const centreY = (b.top + b.bottom) / 2;
        insets = centreY > (c.top + c.bottom) / 2 ? { bottom: c.bottom - b.top + gap } : { top: b.bottom - c.top + gap };
      }
      const key = JSON.stringify(insets);
      if (key !== last) {
        last = key;
        h.setFitInsets?.(insets);
      }
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    ro?.observe(el);
    const canvas = handle.current?.getCanvas();
    if (canvas) ro?.observe(canvas);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      // the latest handle on purpose: the viewer that is mounted now
      // eslint-disable-next-line react-hooks/exhaustive-deps
      handle.current?.setFitInsets?.(null);
    };
  }, [bar, handle]);
}
