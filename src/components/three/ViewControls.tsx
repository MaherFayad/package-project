"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import type { RefObject } from "react";
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
  return (
    <div role="toolbar" aria-label={labels.group} dir="ltr" className={[styles.bar, className].filter(Boolean).join(" ")}>
      {items.map(([key, Icon, onClick]) => (
        <button key={key} type="button" className={styles.button} onClick={onClick} aria-label={labels[key]} title={labels[key]}>
          <Icon size={20} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
