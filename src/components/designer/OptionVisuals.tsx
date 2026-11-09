"use client";

import { useId, useMemo, useRef, type KeyboardEvent } from "react";
import type { DesignFinishCode, Dims, FaceId, MaterialCode } from "@/types";
import { FACE_IDS } from "@/types";
import type { DielineModel, Pt } from "@/lib/dieline";
import o from "./options.module.css";

/**
 * Small drawings for the «All options» panel (options-visual, 2026-11-09): board samples, finish
 * swatches, add-on line drawings, a box sketch per common size and the flat panel map. Inline
 * SVG and CSS only (no images, no three.js). Every drawing is decorative (aria-hidden) except
 * the panel map, which is the panel picker itself.
 */

/* ───────────────────────────── board samples ───────────────────────────── */

type Top = "kraft" | "white" | "grey";
type Edge = "E" | "B" | "card" | "rigid" | "tube";
const BOARD_LOOK: Partial<Record<MaterialCode, { top: Top; edge: Edge }>> = {
  E_FLUTE_KRAFT: { top: "kraft", edge: "E" },
  E_FLUTE_WHITE: { top: "white", edge: "E" },
  B_FLUTE_KRAFT: { top: "kraft", edge: "B" },
  SBS_300: { top: "white", edge: "card" },
  SBS_350: { top: "white", edge: "card" },
  GREYBOARD_WRAP: { top: "white", edge: "rigid" },
  KRAFT_TUBE: { top: "kraft", edge: "tube" },
};
const TOP_FILL: Record<Top, string> = { kraft: "#c39a6b", white: "#f7f6f2", grey: "#b9b6ae" };
const KRAFT_CORE = "#b48452";

/** A wave between two liners: the flute seen on the cut edge of corrugated board. */
function flutePath(x0: number, x1: number, yTop: number, yBot: number, wave: number): string {
  const mid = (yTop + yBot) / 2;
  const amp = (yBot - yTop) / 2;
  let d = `M${x0} ${mid}`;
  for (let x = x0; x < x1; x += wave) d += ` q${wave / 4} ${-amp * 2} ${wave / 2} 0 t${wave / 2} 0`;
  return d;
}

/** A board sample: its printed face on top (kraft fibres or smooth white), its cut edge below. */
export function BoardSwatch({ code }: { code: MaterialCode }) {
  const uid = useId().replace(/:/g, "");
  const look = BOARD_LOOK[code] ?? { top: "white", edge: "card" };
  const W = 80;
  const H = 56;
  const edgeH = look.edge === "B" ? 15 : look.edge === "E" ? 9 : look.edge === "rigid" ? 10 : look.edge === "tube" ? 7 : 3;
  const yEdge = H - edgeH;
  const kraftTop = look.top === "kraft";
  return (
    <svg className={o.boardSwatch} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <defs>
        {/* Long thin noise: paper fibres along the machine direction. */}
        <filter id={`f${uid}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={kraftTop ? "0.9 0.08" : "1.6 1.6"} numOctaves={kraftTop ? 3 : 1} seed={code.length} />
          <feColorMatrix type="matrix" values={kraftTop ? "0 0 0 0 0.32  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 -1.6 1.05" : "0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 -2.2 1.12"} />
        </filter>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={kraftTop ? 0.18 : 0.7} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity={kraftTop ? 0.12 : 0.05} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={yEdge} fill={TOP_FILL[look.top]} />
      <rect x="0" y="0" width={W} height={yEdge} filter={`url(#f${uid})`} opacity={kraftTop ? 0.55 : 0.18} />
      <rect x="0" y="0" width={W} height={yEdge} fill={`url(#g${uid})`} />
      {look.edge === "E" || look.edge === "B" ? (
        <g>
          <rect x="0" y={yEdge} width={W} height={edgeH} fill="#8a6038" />
          <path d={flutePath(0, W, yEdge + 1.6, H - 1.6, look.edge === "B" ? 9 : 5)} fill="none" stroke={KRAFT_CORE} strokeWidth={look.edge === "B" ? 1.6 : 1.1} />
          <rect x="0" y={yEdge} width={W} height="1.6" fill={TOP_FILL[look.top]} />
          <rect x="0" y={H - 1.6} width={W} height="1.6" fill={KRAFT_CORE} />
        </g>
      ) : look.edge === "rigid" ? (
        <g>
          <rect x="0" y={yEdge} width={W} height={edgeH} fill="#8f8c86" />
          <rect x="0" y={yEdge} width={W} height="1.2" fill="#f7f6f2" />
          <rect x="0" y={H - 1.2} width={W} height="1.2" fill="#f7f6f2" />
        </g>
      ) : look.edge === "tube" ? (
        <rect x="0" y={yEdge} width={W} height={edgeH} fill={KRAFT_CORE} />
      ) : (
        <rect x="0" y={yEdge} width={W} height={edgeH} fill="#dedbd3" />
      )}
      <line x1="0" y1={yEdge} x2={W} y2={yEdge} stroke="rgba(0,0,0,.18)" strokeWidth="0.6" />
    </svg>
  );
}

/* ───────────────────────────── finish swatches ───────────────────────────── */

/** The finish as you would see it on a card sample: sheen, metal, a raised or pressed mark. */
export function FinishSwatch({ code, base }: { code: DesignFinishCode; base: "kraft" | "white" }) {
  return <span className={o.finishSwatch} data-finish={code} data-base={base} aria-hidden="true" />;
}

/* ───────────────────────────── box sketches ───────────────────────────── */

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

/** Isometric outline of an L × W × H box fitted into a w × h drawing (mm in, px out). */
function isoBox(d: Dims, w: number, h: number, pad = 3, fit: Dims = d) {
  const p = (x: number, y: number, z: number): Pt => ({ x: (x - y) * COS, y: (x + y) * SIN - z });
  const corners = (b: Dims) => [p(0, 0, 0), p(b.L, 0, 0), p(b.L, b.W, 0), p(0, b.W, 0), p(0, 0, b.H), p(b.L, 0, b.H), p(b.L, b.W, b.H), p(0, b.W, b.H)];
  const pts = corners(d);
  const ext = (q: Pt[]) => ({ minX: Math.min(...q.map((v) => v.x)), maxX: Math.max(...q.map((v) => v.x)), minY: Math.min(...q.map((v) => v.y)), maxY: Math.max(...q.map((v) => v.y)) });
  const e = ext(pts);
  const big = ext(corners(fit));
  // scale from the `fit` box (the largest preset), so smaller boxes are drawn smaller
  const s = Math.min((w - 2 * pad) / (big.maxX - big.minX), (h - 2 * pad) / (big.maxY - big.minY));
  const ox = (w - (e.maxX - e.minX) * s) / 2 - e.minX * s;
  // sit on the same floor line
  const oy = h - pad - e.maxY * s;
  const at = (i: number) => `${(ox + pts[i].x * s).toFixed(1)},${(oy + pts[i].y * s).toFixed(1)}`;
  const poly = (...i: number[]) => i.map(at).join(" ");
  return {
    top: poly(4, 5, 6, 7),
    right: poly(1, 2, 6, 5),
    left: poly(2, 3, 7, 6),
    at: (x: number, y: number, z: number) => {
      const q = p(x, y, z);
      return { x: ox + q.x * s, y: oy + q.y * s };
    },
  };
}

/** A box drawn to the preset's own proportions, so "Shoe box" looks long and "Cosmetics kit" flat. */
export function BoxSketch({ dims, fit }: { dims: Dims; fit?: Dims }) {
  const b = isoBox(dims, 72, 52, 3, fit);
  return (
    <svg className={o.boxSketch} viewBox="0 0 72 52" aria-hidden="true" focusable="false">
      <polygon points={b.left} className={o.sketchLeft} />
      <polygon points={b.right} className={o.sketchRight} />
      <polygon points={b.top} className={o.sketchTop} />
    </svg>
  );
}

/* ───────────────────────────── add-on drawings ───────────────────────────── */

export type AddOnKind = "window" | "handle" | "tearStrip" | "thumbNotch" | "displayFront" | "dividers";

const ADDON_DIMS: Dims = { L: 60, W: 40, H: 34 };

/** Line drawing of what the option does to the box. */
export function AddOnIcon({ kind }: { kind: AddOnKind }) {
  const b = isoBox(ADDON_DIMS, 72, 52, 4);
  const { L, W, H } = ADDON_DIMS;
  // a face-local quad on the front-left wall (y = W): u along L (0..1), v up (0..1)
  const leftQuad = (u0: number, u1: number, v0: number, v1: number) =>
    [b.at(L * (1 - u0), W, H * v0), b.at(L * (1 - u1), W, H * v0), b.at(L * (1 - u1), W, H * v1), b.at(L * (1 - u0), W, H * v1)].map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const line = (a: Pt, c: Pt, cls?: string) => <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} className={cls} />;
  return (
    <svg className={o.addOnIcon} viewBox="0 0 72 52" aria-hidden="true" focusable="false">
      {kind === "displayFront" ? (
        <>
          <polygon points={b.right} className={o.sketchRight} />
          <polygon points={leftQuad(0, 1, 0, 0.45)} className={o.sketchLeft} />
          <polygon points={[b.at(0, 0, H), b.at(L, 0, H), b.at(L, W, H * 0.45), b.at(0, W, H * 0.45)].map((q) => `${q.x},${q.y}`).join(" ")} className={o.sketchInside} />
        </>
      ) : kind === "dividers" ? (
        <>
          <polygon points={b.left} className={o.sketchLeft} />
          <polygon points={b.right} className={o.sketchRight} />
          <polygon points={b.top} className={o.sketchInside} />
          {line(b.at(L / 2, 0, H), b.at(L / 2, W, H), o.accent)}
          {line(b.at(0, W / 2, H), b.at(L, W / 2, H), o.accent)}
          {line(b.at(L / 2, W / 2, H), b.at(L / 2, W / 2, H * 0.35), o.accent)}
        </>
      ) : (
        <>
          <polygon points={b.left} className={o.sketchLeft} />
          <polygon points={b.right} className={o.sketchRight} />
          <polygon points={b.top} className={o.sketchTop} />
          {kind === "window" ? (
            <>
              <polygon points={leftQuad(0.2, 0.8, 0.25, 0.75)} className={o.window} />
              {line(b.at(L * 0.62, W, H * 0.68), b.at(L * 0.72, W, H * 0.42), o.shine)}
              {line(b.at(L * 0.5, W, H * 0.68), b.at(L * 0.6, W, H * 0.42), o.shine)}
            </>
          ) : kind === "handle" ? (
            <polygon points={leftQuad(0.36, 0.64, 0.66, 0.8)} className={o.hole} />
          ) : kind === "tearStrip" ? (
            <>
              {line(b.at(L, W, H * 0.62), b.at(0, W, H * 0.62), o.perf)}
              {line(b.at(L, W, H * 0.78), b.at(0, W, H * 0.78), o.perf)}
              <polygon points={leftQuad(-0.02, 0.1, 0.62, 0.78)} className={o.tab} />
            </>
          ) : kind === "thumbNotch" ? (
            (() => {
              const a = b.at(L * 0.6, W, H);
              const c = b.at(L * 0.4, W, H);
              const r = Math.hypot(c.x - a.x, c.y - a.y) / 2;
              return <path d={`M${a.x} ${a.y} A ${r} ${r * 0.9} 0 0 0 ${c.x} ${c.y} Z`} className={o.hole} />;
            })()
          ) : null}
        </>
      )}
    </svg>
  );
}

/* ───────────────────────────── panel map ───────────────────────────── */

const path = (poly: Pt[]) => `M${poly.map((q) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join("L")}Z`;

/**
 * The flat box, drawn from the current DielineModel: every face's panels are one radio (click,
 * or arrow keys), the selected face is filled. Flaps that are not a face are drawn faint. The
 * sheet is never mirrored (RTL or not).
 */
export function FaceMap({
  dieline,
  face,
  faceLabel,
  onFace,
  label,
}: {
  dieline: DielineModel;
  face: FaceId;
  faceLabel: (f: FaceId) => string;
  onFace: (f: FaceId) => void;
  label: string;
}) {
  const refs = useRef<Partial<Record<FaceId, SVGGElement | null>>>({});
  const { order, byFace, other } = useMemo(() => {
    const owner = new Map<string, FaceId>();
    for (const f of FACE_IDS) for (const part of dieline.faces[f]?.parts ?? []) owner.set(part.panelId, f);
    const byFace: Partial<Record<FaceId, typeof dieline.panels>> = {};
    const other: typeof dieline.panels = [];
    for (const p of dieline.panels) {
      const f = owner.get(p.id);
      if (f) (byFace[f] ??= []).push(p);
      else other.push(p);
    }
    return { order: FACE_IDS.filter((f) => byFace[f]?.length), byFace, other };
  }, [dieline]);
  const b = dieline.dieBounds;
  const pad = Math.max(b.width, b.height) * 0.02;
  const fontMax = Math.max(b.width, b.height) / 20;

  const onKey = (e: KeyboardEvent<SVGGElement>, f: FaceId) => {
    const i = order.indexOf(f);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      e.preventDefault();
      const next = order[(i + step + order.length) % order.length];
      onFace(next);
      refs.current[next]?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onFace(f);
    }
  };

  return (
    <div className={o.faceMap} dir="ltr" data-testid="face-map">
      <svg viewBox={`${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}`} role="radiogroup" aria-label={label} className={o.faceMapSvg}>
        <g aria-hidden="true">
          {other.map((p) => (
            <path key={p.id} d={path(p.polygon)} className={o.flap} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        {order.map((f) => {
          const panels = byFace[f]!;
          const big = panels.reduce((a, c) => (c.bbox.width * c.bbox.height > a.bbox.width * a.bbox.height ? c : a));
          // tall narrow panels (the side walls) get their name turned along the panel
          const tall = big.bbox.height > big.bbox.width * 1.2;
          const along = tall ? big.bbox.height : big.bbox.width;
          const across = tall ? big.bbox.width : big.bbox.height;
          const size = Math.min(across * 0.3, along / Math.max(4, faceLabel(f).length * 0.62), fontMax);
          const cx = big.bbox.x + big.bbox.width / 2;
          const cy = big.bbox.y + big.bbox.height / 2;
          const on = f === face;
          return (
            <g
              key={f}
              ref={(el) => {
                refs.current[f] = el;
              }}
              role="radio"
              aria-checked={on}
              aria-label={faceLabel(f)}
              tabIndex={on ? 0 : -1}
              data-face={f}
              data-on={on || undefined}
              className={o.face}
              onClick={() => onFace(f)}
              onKeyDown={(e) => onKey(e, f)}
            >
              {panels.map((p) => (
                <path key={p.id} d={path(p.polygon)} vectorEffect="non-scaling-stroke" />
              ))}
              <text x={cx} y={cy} fontSize={size} dominantBaseline="central" textAnchor="middle" transform={tall ? `rotate(-90 ${cx} ${cy})` : undefined} aria-hidden="true">
                {faceLabel(f)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
