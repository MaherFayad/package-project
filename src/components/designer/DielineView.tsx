"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dielineToSvg, type DielineModel } from "@/lib/dieline";
import styles from "./designer.module.css";

/**
 * The flat dieline with the painted artwork underneath (sheet space, never mirrored).
 * Cut = solid, fold = dashed blue, safe zone = dotted green, glue flap = grey.
 */
export function DielineView({
  model,
  source,
  version,
  label,
  legend,
  panelLabels,
  locale = "en",
}: {
  model: DielineModel;
  source: HTMLCanvasElement | null;
  version: number;
  label: string;
  legend: string;
  panelLabels: Record<string, string>;
  /** Role names (tuck, dust flap, ear…) for panels without a face label (CR-27). */
  locale?: "ar" | "en";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const figRef = useRef<HTMLElement>(null);
  // Panel names only when the sheet is drawn large enough to read them (phones: legend only).
  const [roomy, setRoomy] = useState(true);
  useEffect(() => {
    const el = figRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setRoomy(el.clientWidth >= 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !source || !source.width) return;
    if (c.width !== source.width || c.height !== source.height) {
      c.width = source.width;
      c.height = source.height;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    // Show only the die shape: board outside the cut line is waste.
    ctx.save();
    const k = c.width / model.sheet.width;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.beginPath();
    for (const p of model.panels) {
      ctx.moveTo(p.polygon[0].x, p.polygon[0].y);
      for (const q of p.polygon.slice(1)) ctx.lineTo(q.x, q.y);
      ctx.closePath();
    }
    ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(source, 0, 0);
    ctx.restore();
  }, [source, version, model]);

  const svg = useMemo(
    () =>
      dielineToSvg(model, {
        showBleed: false,
        panelFill: "none",
        labels: panelLabels,
        showLabels: roomy,
        locale,
        colors: { glue: "rgba(48, 48, 48, 0.18)", label: "#303030" },
        strokeMm: Math.max(0.35, Math.max(model.sheet.width, model.sheet.height) / 900),
      }),
    [model, panelLabels, roomy, locale],
  );
  // White halo so panel names stay readable on dark artwork.
  const haloed = svg.replace('<g data-layer="labels"', `<g data-layer="labels" stroke="#ffffff" stroke-width="${Math.max(0.6, model.sheet.width / 500)}" paint-order="stroke" stroke-linejoin="round"`);

  return (
    <figure ref={figRef} className={styles.dieline} dir="ltr" aria-label={label}>
      <div className={styles.dielineSheet} style={{ aspectRatio: `${model.sheet.width} / ${model.sheet.height}` }}>
        <canvas ref={canvasRef} className={styles.dielineCanvas} aria-hidden="true" />
        <div className={styles.dielineSvg} aria-hidden="true" dangerouslySetInnerHTML={{ __html: haloed }} />
      </div>
      <figcaption className={styles.dielineLegend}>{legend}</figcaption>
    </figure>
  );
}
