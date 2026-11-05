import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { clamp, rectPolygon } from "../../geometry";
import { IDENTITY, rect, slit } from "./kit";
import type { EcmaDraft } from "./types";

/**
 * Pivot depth (in board thicknesses) of a 180° fold that leaves `gapMm` of free space
 * between the two panels' inner surfaces. A 180° roll about a pivot p·t below the printed
 * surface puts the rolled panel's inner surface 2p·t − 2t behind the parent's inner surface.
 */
export const pivotForGap = (gapMm: number, t: number) => 1 + gapMm / (2 * t);

/* ───────────────────────── Presentation folder (A4) ───────────────────────── */

/**
 * Presentation folder: front cover, optional spine (W = capacity), back cover with a glued
 * pocket inside (business-card slits). Layout seen from outside, left → right:
 * back cover | spine | front cover; pocket below the back cover, its glue flap at the outer edge.
 * L = cover width, H = cover height, W = spine capacity (0 = flat fold).
 */
export function presentationFolder(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const L = dims.L;
  const H = dims.H;
  const spine = dims.W >= 2 ? dims.W + 2 * t : 0;
  const pocketH = clamp(H * 0.32, 60, 110);
  const b = new DielineBuilder();
  const front = rect(0, 0, L, H);
  b.root("front", "front", rectPolygon(0, 0, L, H), "Front cover");
  let backX: number;
  if (spine > 0) {
    b.attach("spine", "left", "front", rectEdges(front).left, spine, { kind: "rect" }, { fold: 90, stage: 2, label: "Spine" });
    const sp = rect(-spine, 0, spine, H);
    b.attach("back", "back", "spine", rectEdges(sp).left, L, { kind: "rect" }, { fold: 90, stage: 2, label: "Back cover" });
    backX = -spine - L;
  } else {
    // Flat fold: leave room for the pocket and its glue flap (2 layers).
    b.attach("back", "back", "front", rectEdges(front).left, L, { kind: "rect" }, { fold: 180, pivotDepth: pivotForGap(2 * t + 0.4, t), stage: 2, label: "Back cover" });
    backX = -L;
  }
  const back = rect(backX, 0, L, H);
  // Pocket on the inside of the back cover (the right-hand panel when the folder is open).
  const pocket = rect(backX, H, L, pocketH);
  const shoulder = Math.min(25, L * 0.12);
  const pocketPoly = [
    { x: backX, y: H },
    { x: backX + L, y: H },
    { x: backX + L, y: H + pocketH - shoulder },
    { x: backX + L - shoulder * 2.5, y: H + pocketH },
    { x: backX, y: H + pocketH },
  ];
  b.attachPoly("pocket", "inner", "back", rectEdges(back).bottom, pocketPoly, { fold: 180, pivotDepth: pivotForGap(t + 0.2, t), stage: 1, label: "Pocket" });
  // Glue flap on the pocket's outer (spine-far) edge, glued to the back cover.
  const gw = 12;
  b.attach("pocketGlue", "glue", "pocket", insetSeg(rectEdges(pocket).left, 2, 2), gw, { kind: "trapezoid", taperA: gw * 0.6, taperB: gw * 0.6 }, { fold: 180, pivotDepth: 1, stage: 0, label: "Pocket glue flap" });
  // Business-card slits (two 45° cuts holding a 90 × 50 mm card).
  const p = b.byId("pocket");
  const cx = backX + L * 0.55;
  const cy = H + pocketH * 0.5;
  p.holes = [slit(cx - 45, cy, 14, false), slit(cx + 45, cy, 14, false)];
  return {
    builder: b,
    closedRotation: IDENTITY,
  };
}

/* ───────────────────────── F60.92 wallet with end flap (CD-style) ───────────────────────── */

/**
 * Wallet with closing end flap (ECMA F60.92): front panel, back panel folded up behind it
 * (gap = W, the content thickness), two side glue flaps glued to the front's inside and an end
 * flap that folds over the opening onto the front. CD / card / voucher wallets.
 * L = width, H = height, W = content thickness.
 */
export function endFlapWallet(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  void f;
  const L = dims.L + 2;
  const H = dims.H + 2;
  const gap = Math.max(0.5, dims.W);
  const b = new DielineBuilder();
  const front = rect(0, 0, L, H);
  b.root("front", "front", rectPolygon(0, 0, L, H), "Front");
  const p = pivotForGap(gap, t);
  b.attach("back", "back", "front", rectEdges(front).bottom, H + 2 * t, { kind: "rect" }, { fold: 180, pivotDepth: p, stage: 1, label: "Back" });
  const back = rect(0, H, L, H + 2 * t);
  const gw = clamp(L * 0.08, 10, 15);
  // Side glue flaps: rolled 180° from the back so they land on the front's inner surface.
  for (const [k, e] of [["L", rectEdges(back).left], ["R", rectEdges(back).right]] as const) {
    b.attach(`glue${k}`, "glue", "back", insetSeg(e, 3, 3), gw, { kind: "trapezoid", taperA: gw * 0.5, taperB: gw * 0.5 }, { fold: 180, pivotDepth: Math.max(1, p - 0.5), stage: 0, label: "Side glue flap" });
  }
  // End flap over the opening, closing onto the outside of the front.
  const ed = clamp(H * 0.22, 20, 45);
  b.attach("endFlap", "flap", "back", rectEdges(back).bottom, ed, { kind: "tuck", shoulder: 1 }, { fold: 180, pivotDepth: p + 0.5, stage: 2, label: "End flap" });
  return { builder: b, closedRotation: IDENTITY, faceDepthTol: t + 0.2 };
}
