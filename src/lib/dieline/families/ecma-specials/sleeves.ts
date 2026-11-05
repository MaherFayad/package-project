import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { cutWindow, notchPanel } from "../../features";
import { clamp, rectPolygon } from "../../geometry";
import { IDENTITY, glueWidth, rect, slit, tube4 } from "./kit";
import type { EcmaDraft } from "./types";

/* ───────────────────────── A01.01.00.00 open-end sleeve (vertical tube) ───────────────────────── */

/**
 * ECMA A01.01.00.00: long-seam-glued tube, no flaps top or bottom. Slides over a tray,
 * jar or bottle; finger notches on the front and back edges help pull the product out.
 */
export function openSleeve(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const b = new DielineBuilder();
  const w = tube4(b, dims.L + 2 * t, dims.W + 2 * t, dims.H, glueWidth(dims.W));
  if (f.thumbNotch) {
    const r = Math.min(12, dims.L * 0.1, dims.H * 0.2);
    for (const id of ["front", "back"] as const) {
      notchPanel(b.byId(id), rectEdges(w[id]).top, r);
      notchPanel(b.byId(id), rectEdges(w[id]).bottom, r);
    }
  }
  if (f.window) cutWindow(b, f.window.face === "back" ? "back" : "front", f.window);
  return { builder: b, closedRotation: IDENTITY };
}

/* ───────────────────────── E30 self-locking wrap-around ───────────────────────── */

/**
 * Self-locking wrap-around (ECMA Group E30, cubical products, open side panels): a band of
 * top | front | bottom | back with a closing flap that tucks under the top panel; two lock
 * nibs on the closing flap catch in slits next to the top/back crease. No glue, so the
 * product can be wrapped by hand. L runs along the open axis.
 */
export function lockWrap(dims: Dims, t: number, f: StructureFeatures = {}): EcmaDraft {
  const Lx = dims.L;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const b = new DielineBuilder();
  const top = rect(0, -Wp, Lx, Wp);
  const front = rect(0, 0, Lx, Hp);
  const bottom = rect(0, Hp, Lx, Wp);
  const back = rect(0, Hp + Wp, Lx, Hp);
  b.root("front", "front", rectPolygon(0, 0, Lx, Hp), "Front");
  b.attach("top", "top", "front", rectEdges(front).top, Wp, { kind: "rect" }, { stage: 0, label: "Top" });
  b.attach("bottom", "bottom", "front", rectEdges(front).bottom, Wp, { kind: "rect" }, { stage: 0, label: "Bottom" });
  b.attach("back", "back", "bottom", rectEdges(bottom).bottom, Hp, { kind: "rect" }, { stage: 1, label: "Back" });
  const cd = clamp(Wp * 0.45, 15, 60);
  b.attach("closer", "tuck", "back", insetSeg(rectEdges(back).bottom, 2), cd, { kind: "rect" }, { stage: 2, stack: -1, label: "Closing flap" });
  // Lock nibs: small tongues on the closing flap's far edge; slits in the top panel.
  const nibW = Math.min(20, Lx * 0.15);
  const nibD = Math.min(6, cd * 0.3);
  const yFar = back.y + Hp + cd;
  for (const [k, cx] of [["L", Lx * 0.25], ["R", Lx * 0.75]] as const) {
    b.attach(`nib${k}`, "tuck", "closer", [{ x: cx - nibW / 2, y: yFar }, { x: cx + nibW / 2, y: yFar }], nibD, { kind: "trapezoid", taperA: nibD * 0.5, taperB: nibD * 0.5 }, { fold: 0, stage: 2, stack: -1, label: "Lock nib" });
  }
  const tp = b.byId("top");
  tp.holes = [slit(Lx * 0.25, top.y + cd - t, nibW + 1), slit(Lx * 0.75, top.y + cd - t, nibW + 1)];
  if (f.window) cutWindow(b, f.window.face === "top" ? "top" : "front", f.window);
  return { builder: b, closedRotation: IDENTITY };
}
