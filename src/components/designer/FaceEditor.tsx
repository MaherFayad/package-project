"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { ArtworkLayer, PrintSurface } from "@/types";
import { drawLayer, partRect, type FaceInfo } from "@/lib/dieline";
import { normAngle, round1, scaleLayer, type P } from "./lib/geometry";
import { resolveFont } from "./fonts";
import styles from "./designer.module.css";

type DragMode = "move" | "scale" | "rotate";

interface Drag {
  mode: DragMode;
  id: string;
  pointerId: number;
  start: P;
  layer: ArtworkLayer;
  key: string;
}

export interface FaceEditorProps {
  face: FaceInfo;
  surface: PrintSurface;
  layers: ArtworkLayer[];
  background: string | null;
  boardColor: string;
  safeMm: number;
  images: Map<string, CanvasImageSource>;
  /** Bumps when images or fonts finish loading. */
  paintVersion: string | number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Replace a layer; same `coalesce` key = one undo step. */
  onChange: (layer: ArtworkLayer, coalesce?: string) => void;
  /** End of a drag or key-repeat group. */
  onCommit: () => void;
  onDelete: (id: string) => void;
  label: string;
  hint: string;
}

/**
 * 2D artwork editor for one face (face-local mm, as seen from outside; never mirrored in RTL).
 * Pointer: drag to move, corner handle to resize, top handle to rotate.
 * Keyboard (WCAG 2.1.1): arrows move 1 mm (Shift: 10 mm), + / - resize, [ / ] rotate 15°,
 * Delete removes, Escape deselects. The Artwork panel offers the same with buttons (WCAG 2.5.7).
 */
export function FaceEditor(props: FaceEditorProps) {
  const { face, surface, layers, background, boardColor, safeMm, images, paintVersion, selectedId, onSelect, onChange, onCommit, onDelete, label, hint } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const hintId = useId();
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Fit the face into the available area.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 28; // px around the face for handles
  const scale = box.w > 0 && box.h > 0 ? Math.max(0.05, Math.min((box.w - pad * 2) / face.width, (box.h - pad * 2) / face.height)) : 0;
  const cssW = Math.max(1, Math.round(face.width * scale));
  const cssH = Math.max(1, Math.round(face.height * scale));

  // Paint the face.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || scale <= 0) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const raf = requestAnimationFrame(() => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = background ?? boardColor;
      ctx.fillRect(0, 0, w, h);
      const k = (w / face.width + h / face.height) / 2;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, face.width, face.height);
      ctx.clip();
      for (const l of layers) if (!l.hidden) drawLayer(ctx, l, { images, resolveFont });
      ctx.restore();
    });
    return () => cancelAnimationFrame(raf);
  }, [layers, background, boardColor, face.width, face.height, cssW, cssH, scale, images, paintVersion]);

  const toMm = (e: { clientX: number; clientY: number }): P => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };

  const begin = (e: ReactPointerEvent, layer: ArtworkLayer, mode: DragMode) => {
    e.stopPropagation();
    onSelect(layer.id);
    if (layer.locked || e.button !== 0) return;
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    drag.current = { mode, id: layer.id, pointerId: e.pointerId, start: toMm(e), layer, key: `${mode}:${layer.id}:${Date.now()}` };
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = toMm(e);
    const l = d.layer;
    if (d.mode === "move") {
      onChange({ ...l, x: round1(l.x + p.x - d.start.x), y: round1(l.y + p.y - d.start.y) }, d.key);
    } else if (d.mode === "scale") {
      const d0 = Math.hypot(d.start.x - l.x, d.start.y - l.y) || 1;
      const d1 = Math.hypot(p.x - l.x, p.y - l.y);
      const next = scaleLayer(l, d1 / d0);
      onChange({ ...next, width: round1(next.width), height: round1(next.height) }, d.key);
    } else {
      let deg = (Math.atan2(p.y - l.y, p.x - l.x) * 180) / Math.PI + 90;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      onChange({ ...l, rotation: normAngle(deg) }, d.key);
    }
  };

  const end = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current && drag.current.pointerId === e.pointerId) {
      drag.current = null;
      onCommit();
    }
  };

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    if (e.key === "Escape") {
      onSelect(null);
      e.preventDefault();
      return;
    }
    if (selected.locked) return;
    const step = e.shiftKey ? 10 : 1;
    const key = `key:${selected.id}`;
    let next: ArtworkLayer | null = null;
    switch (e.key) {
      case "ArrowLeft":
        next = { ...selected, x: round1(selected.x - step) };
        break;
      case "ArrowRight":
        next = { ...selected, x: round1(selected.x + step) };
        break;
      case "ArrowUp":
        next = { ...selected, y: round1(selected.y - step) };
        break;
      case "ArrowDown":
        next = { ...selected, y: round1(selected.y + step) };
        break;
      case "+":
      case "=":
        next = scaleLayer(selected, 1.1);
        break;
      case "-":
      case "_":
        next = scaleLayer(selected, 1 / 1.1);
        break;
      case "]":
        next = { ...selected, rotation: normAngle(selected.rotation + 15) };
        break;
      case "[":
        next = { ...selected, rotation: normAngle(selected.rotation - 15) };
        break;
      case "Delete":
      case "Backspace":
        onDelete(selected.id);
        e.preventDefault();
        return;
      default:
        return;
    }
    e.preventDefault();
    onChange(next, key);
  };

  // Handle sizes are fixed in screen pixels (≥ 24 px targets, WCAG 2.5.8).
  const px = scale > 0 ? 1 / scale : 1;
  const seams = face.parts.length > 1 ? face.parts.map((p) => partRect(face, p, surface)) : [];

  return (
    <div
      ref={wrapRef}
      className={styles.faceStage}
      dir="ltr"
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby={hintId}
      onKeyDown={onKeyDown}
      onKeyUp={() => onCommit()}
    >
      <span id={hintId} className="visually-hidden">
        {hint}
      </span>
      {scale > 0 && (
        <div className={styles.faceSheet} style={{ width: cssW, height: cssH }}>
          <canvas ref={canvasRef} className={styles.faceCanvas} style={{ width: cssW, height: cssH }} aria-hidden="true" />
          <svg
            ref={svgRef}
            className={styles.faceOverlay}
            viewBox={`0 0 ${face.width} ${face.height}`}
            width={cssW}
            height={cssH}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerDown={() => onSelect(null)}
            aria-hidden="true"
          >
            <rect
              x={safeMm}
              y={safeMm}
              width={Math.max(0, face.width - 2 * safeMm)}
              height={Math.max(0, face.height - 2 * safeMm)}
              className={styles.safeGuide}
              vectorEffect="non-scaling-stroke"
            />
            {seams.slice(1).map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} className={styles.seamGuide} vectorEffect="non-scaling-stroke" />
            ))}
            {layers.map((l) =>
              l.hidden ? null : (
                <g key={l.id} transform={`translate(${l.x} ${l.y}) rotate(${l.rotation})`}>
                  <rect
                    x={-l.width / 2}
                    y={-l.height / 2}
                    width={l.width}
                    height={l.height}
                    className={styles.hit}
                    data-layer-id={l.id}
                    onPointerDown={(e) => begin(e, l, "move")}
                  />
                </g>
              ),
            )}
            {selected && !selected.hidden ? (
              <g transform={`translate(${selected.x} ${selected.y}) rotate(${selected.rotation})`}>
                <rect
                  x={-selected.width / 2}
                  y={-selected.height / 2}
                  width={selected.width}
                  height={selected.height}
                  className={styles.selection}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(e) => begin(e, selected, "move")}
                />
                {!selected.locked && (
                  <>
                    <line x1={0} y1={-selected.height / 2} x2={0} y2={-selected.height / 2 - 18 * px} className={styles.handleLine} vectorEffect="non-scaling-stroke" />
                    <circle cx={0} cy={-selected.height / 2 - 18 * px} r={6 * px} className={styles.handle} vectorEffect="non-scaling-stroke" />
                    <circle
                      cx={0}
                      cy={-selected.height / 2 - 18 * px}
                      r={12 * px}
                      className={styles.handleHit}
                      data-handle="rotate"
                      onPointerDown={(e) => begin(e, selected, "rotate")}
                    />
                    <circle cx={selected.width / 2} cy={selected.height / 2} r={6 * px} className={styles.handle} vectorEffect="non-scaling-stroke" />
                    <circle
                      cx={selected.width / 2}
                      cy={selected.height / 2}
                      r={12 * px}
                      className={styles.handleHit}
                      data-handle="scale"
                      onPointerDown={(e) => begin(e, selected, "scale")}
                    />
                  </>
                )}
              </g>
            ) : null}
          </svg>
        </div>
      )}
    </div>
  );
}
