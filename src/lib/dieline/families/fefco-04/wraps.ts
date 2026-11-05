import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, rectEdges } from "../../builder";
import { rectPolygon } from "../../geometry";
import type { StructureDraft } from "../../structures";
import type { Pt, Rect } from "../../types";
import { TILT_UP, rect, turn180 } from "./kit";

/**
 * Wrap-type 04 styles: the blank is a chain of panels hinged along L (product length) that
 * wraps around the product into a tube, closed at the ends by flaps on every panel.
 *
 *   0404 folder-type tube        bottom | front | top | back | glue        no end flaps
 *   0406 wrap-around blank       bottom | front | top | back | glue        end flaps (RSC-like ends)
 *   0409 / 0410 five panel folder bottom | front | top | back | 5th panel  end flaps
 *   0411 centre-seam FPF         ½top | front | bottom | back | ½top       end flaps
 *
 * The chain is laid out pre-turn as base, then front below it, top, back, closing panel.
 * After the 180° in-plane turn and a +90° tilt the base lies on the table, front to viewer.
 */
export type EndFlapKind = "none" | "meet" | "full";

export interface WrapOpts {
  /** How the tube is closed along its length. */
  joint: "glue" | "fifth-panel" | "centre-seam";
  /** Fifth panel depth as a share of W (FPF: 1 = full double face; "a" variants: partial). */
  fifthRatio?: number;
  /** Centre seam: share of the top taken by the front half (0.5 = seam in the middle). */
  seamRatio?: number;
  /** End flaps on the W-wide panels (bottom/top) and on the H-high panels (front/back). */
  endFlaps: { wPanels: EndFlapKind; hPanels: EndFlapKind; outer: "w" | "h" };
}

export function wrapFolder(dims: Dims, t: number, o: WrapOpts, _f: StructureFeatures = {}): StructureDraft {
  void _f;
  const { wPanels, hPanels, outer } = o.endFlaps;
  const endLayers = (wPanels === "none" ? 0 : wPanels === "full" ? 2 : 1) + (hPanels === "none" ? 0 : hPanels === "full" ? 2 : 1);
  const fifth = o.joint === "fifth-panel" ? (o.fifthRatio ?? 1) : 0;
  const Lp = dims.L + 2 * endLayers * t;
  const Wp = dims.W + 2 * t;
  // Bottom + top (+ the fifth panel lying on the bottom inside).
  const Hp = dims.H + 2 * t + (fifth > 0 ? t : 0);

  const b = new DielineBuilder();
  const chain: { id: string; role: "bottom" | "front" | "top" | "back" | "flap" | "glue"; r: Rect; across: "w" | "h" }[] = [];
  let y = 0;
  const push = (id: string, role: (typeof chain)[number]["role"], depth: number, across: "w" | "h") => {
    chain.push({ id, role, r: rect(0, y, Lp, depth), across });
    y += depth;
  };
  if (o.joint === "centre-seam") {
    // ½ top | back | bottom | front | ½ top, rooted at the bottom.
    push("topHalfB", "top", Wp * (1 - (o.seamRatio ?? 0.5)), "w");
    push("back", "back", Hp, "h");
    push("base", "bottom", Wp, "w");
    push("front", "front", Hp, "h");
    push("topHalfF", "top", Wp * (o.seamRatio ?? 0.5), "w");
  } else {
    push("base", "bottom", Wp, "w");
    push("front", "front", Hp, "h");
    push("top", "top", Wp, "w");
    push("back", "back", Hp, "h");
    if (o.joint === "glue") push("glue", "glue", Math.min(35, Hp * 0.5), "h");
    else push("fifth", "flap", Math.max(10, Wp * fifth - 2 * t), "w");
  }
  const rootIdx = chain.findIndex((c) => c.id === "base");
  b.root("base", "bottom", rectPolygon(chain[rootIdx].r.x, chain[rootIdx].r.y, Lp, chain[rootIdx].r.height), "Base");
  // Walk away from the root in both directions.
  for (const dir of [1, -1] as const) {
    for (let i = rootIdx + dir; i >= 0 && i < chain.length; i += dir) {
      const c = chain[i];
      const parent = chain[i - dir];
      const edge = dir > 0 ? rectEdges(parent.r).bottom : rectEdges(parent.r).top;
      const closing = c.id === "glue" || c.id === "fifth";
      b.attach(c.id, c.role, parent.id, edge, c.r.height, { kind: "rect" }, {
        stage: 0,
        stack: closing ? -1 : 0,
        printable: c.role !== "glue",
        label: c.id === "fifth" ? "Fifth (overlap) panel" : c.id === "glue" ? "Glue flap" : `${c.id} panel`,
      });
    }
  }

  // End flaps: on the x = 0 and x = Lp edges of every tube panel.
  const kindOf = (across: "w" | "h") => (across === "w" ? wPanels : hPanels);
  const counter = { w: 0, h: 0 };
  for (const c of chain) {
    if (c.id === "glue" || c.id === "fifth") continue;
    const kind = kindOf(c.across);
    if (kind === "none") continue;
    const isOuter = c.across === outer;
    // Depth of an end flap: it spans the end across the other dimension.
    const span = c.across === "w" ? Hp : Wp;
    const depth = kind === "full" ? span - 2 * t : span / 2 - 1;
    const order = counter[c.across]++;
    const stackBase = isOuter ? 0 : -(outer === "w" ? (wPanels === "full" ? 2 : 1) : hPanels === "full" ? 2 : 1);
    const stack = stackBase - (kind === "full" ? order % 2 : 0);
    const e = rectEdges(c.r);
    const sides: [string, [Pt, Pt]][] = [
      ["R", e.left],
      ["L", e.right],
    ];
    for (const [s, edge] of sides) {
      const taper = isOuter ? 0 : Math.min(depth * 0.3, c.r.height * 0.15);
      b.attach(`end_${c.id}_${s}`, "flap", c.id, edge, depth, { kind: "trapezoid", taperA: taper, taperB: taper }, {
        stage: isOuter ? 2 : 1,
        stack,
        label: isOuter ? "Outer end flap" : "Inner end flap",
      });
    }
  }
  turn180(b);
  return { builder: b, closedRotation: TILT_UP };
}
