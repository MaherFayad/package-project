import { Vector3 } from "three";
import { computePoses, panelLocalPoint, panelPivot } from "./fold";
import { round } from "./geometry";
import type { DielineModel } from "./types";

/**
 * Flat-shaded isometric illustration of a structure (catalogue thumbnails, emails, PDFs).
 * Projects every panel of the real fold model, so the picture always matches what the 3D
 * view and the die make. Painter's algorithm on panel faces; good for convex-ish boxes.
 */
export interface IllustrationOptions {
  width?: number;
  height?: number;
  /** 0 = flat … 1 = closed. Default 1. */
  progress?: number;
  /** Base colours of the outside and inside surfaces. */
  outside: string;
  inside: string;
  background?: string | null;
  /** Rotation of the view around the vertical axis (degrees). Default 35. */
  yawDeg?: number;
  /** Camera elevation (degrees). Default 28. */
  pitchDeg?: number;
  title?: string;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${[c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function structureIllustrationSvg(model: DielineModel, o: IllustrationOptions): string {
  const W = o.width ?? 800;
  const H = o.height ?? 600;
  const progress = o.progress ?? 1;
  const yaw = ((o.yawDeg ?? 35) * Math.PI) / 180;
  const pitch = ((o.pitchDeg ?? 28) * Math.PI) / 180;
  const t = model.thicknessMm;
  const poses = computePoses(model, progress);
  // view basis: right, up, toward the viewer
  const fwd = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new Vector3().crossVectors(fwd, right).normalize();
  const light = new Vector3(-0.35, 0.9, 0.45).normalize();

  type Face = { pts: { x: number; y: number }[]; holes: { x: number; y: number }[][]; depth: number; fill: string; smooth: boolean; rank: number };
  const faces: Face[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  // Pieces are drawn in order (box, then lid / sleeve that sits over it); inside each,
  // back to front. Hidden layers (stacked under another flap) are skipped once closed.
  const pieceRank = new Map(model.pieces.map((p, i) => [p.rootId, i]));
  for (const panel of model.panels) {
    const pose = poses.get(panel.id);
    if (!pose) continue;
    if (progress >= 0.999 && panel.stackOffset < 0) continue;
    const pv = panelPivot(panel, t);
    for (const depth of [0, 1] as const) {
      const pts3 = panel.polygon.map((p) => panelLocalPoint(panel, p, depth, pv, t).applyMatrix4(pose.world));
      const n = new Vector3(0, 0, depth === 0 ? 1 : -1).transformDirection(pose.world);
      if (n.dot(fwd) <= 0.02) continue; // back-facing
      const lit = 0.72 + 0.28 * Math.max(0, n.dot(light));
      const base = depth === 0 ? o.outside : o.inside;
      const proj = (q: Vector3) => ({ x: q.dot(right), y: -q.dot(up) });
      const pts = pts3.map(proj);
      const holes = (panel.holes ?? []).map((h) => h.map((p) => proj(panelLocalPoint(panel, p, depth, pv, t).applyMatrix4(pose.world))));
      for (const q of pts) {
        minX = Math.min(minX, q.x);
        maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y);
        maxY = Math.max(maxY, q.y);
      }
      const c = pts3.reduce((acc, q) => acc.add(q), new Vector3()).multiplyScalar(1 / pts3.length);
      const smooth = panel.hingeKind === "roll" || model.panels.some((k) => k.parentId === panel.id && k.hingeKind === "roll");
      faces.push({ pts, holes, depth: c.dot(fwd), fill: shade(base, lit), smooth, rank: pieceRank.get(panel.pieceId ?? model.rootId) ?? 0 });
    }
  }
  faces.sort((a, b) => a.rank - b.rank || a.depth - b.depth);
  const pad = 0.14;
  const sc = Math.min((W * (1 - 2 * pad)) / (maxX - minX || 1), (H * (1 - 2 * pad)) / (maxY - minY || 1));
  const ox = W / 2 - ((minX + maxX) / 2) * sc;
  const oy = H / 2 - ((minY + maxY) / 2) * sc - H * 0.02;
  const loop = (pts: { x: number; y: number }[]) => `M${pts.map((q) => `${round(ox + q.x * sc, 1)} ${round(oy + q.y * sc, 1)}`).join("L")}Z`;
  const pathOf = (f: Face) => [f.pts, ...f.holes].map(loop).join("");
  const groundY = round(oy + maxY * sc + H * 0.015, 1);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"${o.title ? ` aria-label="${o.title.replace(/"/g, "&quot;")}"` : ""}>`,
    o.background === null ? "" : `<rect width="${W}" height="${H}" fill="${o.background ?? "#f7f7f7"}"/>`,
    `<ellipse cx="${W / 2}" cy="${groundY}" rx="${round(((maxX - minX) * sc) / 2 * 0.95, 1)}" ry="${round(H * 0.055, 1)}" fill="rgba(0,0,0,.07)"/>`,
    `<g stroke="rgba(0,0,0,.18)" stroke-width="1" stroke-linejoin="round">${faces.map((f) => `<path d="${pathOf(f)}" fill-rule="evenodd" fill="${f.fill}"${f.smooth ? ` stroke="${f.fill}"` : ""}/>`).join("")}</g>`,
    "</svg>",
  ];
  return parts.join("\n");
}
