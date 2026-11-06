import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import { DielineBuilder } from "../../builder";
import { bboxOf, pt } from "../../geometry";
import type { Polygon } from "../../types";
import { IDENTITY, type Quat } from "./engine";
import type { FittingDraft } from "./types";

/** Slot width for a board of caliper t (board + 0.6 mm play, common die practice). */
export const slotWidth = (t: number) => t + 0.6;

export interface SlottedGridInput {
  /** Host inner dims. */
  L: number;
  W: number;
  rows: number;
  cols: number;
  t: number;
  /** Height of the ordinary strips (mm). */
  heightMm: number;
  /** Clearance per dimension (strip length = host − clearance). */
  clearanceMm: number;
  /** Optional taller strip(s) along L (FEFCO 0935 "high divider"): row-divider indexes. */
  high?: { indexes: number[]; heightMm: number };
}

export interface CellLayout {
  /** Cell size along L and W (mm, clear opening between boards / walls). */
  cellL: number;
  cellW: number;
  /** Host-inner x of each W-direction strip's mid-plane (cols − 1). */
  xs: number[];
  /** Host-inner z of each L-direction strip's mid-plane (rows − 1). */
  zs: number[];
}

/** Equal cells: cols across L, rows across W, divider boards t thick. */
export function cellLayout(L: number, W: number, rows: number, cols: number, t: number): CellLayout {
  const cellL = (L - (cols - 1) * t) / cols;
  const cellW = (W - (rows - 1) * t) / rows;
  const xs = Array.from({ length: cols - 1 }, (_, j) => (j + 1) * cellL + j * t + t / 2);
  const zs = Array.from({ length: rows - 1 }, (_, i) => (i + 1) * cellW + i * t + t / 2);
  return { cellL, cellW, xs, zs };
}

/**
 * Strip outline (clockwise on screen) with rectangular slots cut `depth` deep from the top
 * or the bottom edge at positions `us` (mm from the strip's left end).
 */
export function slottedStrip(x0: number, y0: number, len: number, h: number, us: number[], fromTop: boolean, depth: number, sw: number): Polygon {
  const s = [...us].sort((a, b) => a - b);
  const out: Polygon = [pt(x0, y0)];
  if (fromTop) for (const u of s) out.push(pt(x0 + u - sw / 2, y0), pt(x0 + u - sw / 2, y0 + depth), pt(x0 + u + sw / 2, y0 + depth), pt(x0 + u + sw / 2, y0));
  out.push(pt(x0 + len, y0), pt(x0 + len, y0 + h));
  if (!fromTop) for (const u of s.reverse()) out.push(pt(x0 + u + sw / 2, y0 + h), pt(x0 + u + sw / 2, y0 + h - depth), pt(x0 + u - sw / 2, y0 + h - depth), pt(x0 + u - sw / 2, y0 + h));
  out.push(pt(x0, y0 + h));
  return out;
}

/**
 * Slotted partition (FEFCO 0930 / 0933 / 0934 / 0935): (rows − 1) strips along L slotted
 * from the bottom and (cols − 1) strips along W slotted from the top, half the lower strip
 * height each, so they interlock flush at the top of the low strips. Each strip is its own
 * blank. Placement is exact: strips sit at the cell pitch inside the host.
 */
export function slottedGrid(g: SlottedGridInput): FittingDraft {
  const { L, W, rows, cols, t, heightMm: h, clearanceMm: c } = g;
  const b = new DielineBuilder();
  const lay = cellLayout(L, W, rows, cols, t);
  const lenL = L - c;
  const lenW = W - c;
  const x0 = c / 2;
  const z0 = c / 2;
  const sw = slotWidth(t);
  const depth = h / 2;
  const gap = 10;
  const closedRotation: Quat = IDENTITY;

  type Strip = { id: string; poly: Polygon; len: number; hh: number; flatX: number; host: Matrix4 };
  const strips: Strip[] = [];
  let sx = 0;
  const sy = 0;
  const tallest = Math.max(h, g.high?.heightMm ?? 0);

  lay.zs.forEach((zc, i) => {
    const hh = g.high?.indexes.includes(i) ? g.high.heightMm : h;
    // Slots from the bottom, `depth` high, so the board above stays whole (taller strips too).
    const us = lay.xs.map((x) => x - x0);
    const poly = slottedStrip(sx, sy + (tallest - hh), lenL, hh, us, false, depth, sw);
    // flat (X, Y = -sheetY, Z) → host: x = X - sx + x0, y = Y + sy + tallest, z = Z + zc + t/2.
    const host = new Matrix4().makeTranslation(x0 - sx, sy + tallest, zc + t / 2);
    strips.push({ id: `rowDivider${i}`, poly, len: lenL, hh, flatX: sx, host });
    sx += lenL + gap;
  });
  lay.xs.forEach((xc, j) => {
    const us = lay.zs.map((zc) => zc - z0);
    const poly = slottedStrip(sx, sy + (tallest - h), lenW, h, us, true, depth, sw);
    // RotY(−90°): flat +X → host +Z, board −Z → host +X.
    const host = new Matrix4().makeTranslation(xc - t / 2, sy + tallest, z0).multiply(new Matrix4().makeRotationY(-Math.PI / 2)).multiply(new Matrix4().makeTranslation(-sx, 0, 0));
    strips.push({ id: `colDivider${j}`, poly, len: lenW, hh: h, flatX: sx, host });
    sx += lenW + gap;
  });
  if (!strips.length) throw new Error("slottedGrid needs rows > 1 or cols > 1");

  const [first, ...rest] = strips;
  const rootPanel = b.root(first.id, "inner", first.poly, first.id.startsWith("row") ? "Row divider" : "Column divider");
  rootPanel.printable = true;
  b.pieceLabels.set(first.id, "Divider");
  // Root model frame: model = flat − c (identity closed rotation). host = M0 · flat.
  // Same pivot as the fold engine's root panel (panelPivot): the bounding-box centre.
  const bb = bboxOf(rootPanel.polygon);
  const c0 = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  const toModel = new Matrix4().makeTranslation(-c0.x, c0.y, 0).multiply(first.host.clone().invert());
  for (const s of rest) {
    const m = toModel.clone().multiply(s.host);
    b.piece(s.id, "inner", s.poly, "Divider", { matrix: m.toArray(), stage: 1, lift: tallest * 1.2 }, { label: s.id.startsWith("row") ? "Row divider" : "Column divider" });
  }
  // model → host = M0 · T(c)
  const hostFromModel = first.host.clone().multiply(new Matrix4().makeTranslation(c0.x, -c0.y, 0));
  return { builder: b, closedRotation, anchor: { matrix: hostFromModel.toArray() } };
}
