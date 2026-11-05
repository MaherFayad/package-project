import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, rectEdges } from "../../builder";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { Polygon, Pt } from "../../types";
import { IDENTITY, rect } from "./common";
import type { FamilyDraft } from "./types";

/**
 * Envelopes and mailer bags, as one folded sheet.
 *
 * Dims: L = finished width (along the opening), H = finished height, W = contents thickness
 * allowance (documented, enlarges the flaps' overlap only). ISO 269 / ISO 216 state finished
 * envelope sizes (C4 229 × 324, C5 162 × 229, C6 114 × 162, DL 110 × 220, tolerance +1.5 mm),
 * so envelope dims are the finished size, not an inner size.
 *
 * Layout: the FRONT (address side) is the root. Side flaps fold behind it (layer 1), the bottom
 * flap / back panel folds over them (layer 2) and the seal flap folds over the back (layer 3).
 * Pivot depths stack the layers exactly: 180° about a pivot d·t below a panel's printed face
 * lands the flap 2d·t − t behind it.
 */
export interface EnvelopeOpts {
  /** Side flap depth as a share of L (glue seams for bags). */
  side: "flaps" | "seams";
  /** Bottom flap depth as a share of H (1 = full back panel: mailer bag). */
  bottomRatio: number;
  /** Seal flap depth (mm). */
  sealDepth: number;
  sealShape: "straight" | "pointed" | "rounded";
  /** Peel-and-seal / tear strip perforation across the back (mailer bags). */
  tearStrip?: boolean;
}

export function envelopeDraft(dims: Dims, t: number, f: StructureFeatures, o: EnvelopeOpts): FamilyDraft {
  const L = dims.L;
  const H = dims.H;
  const b = new DielineBuilder();
  const front = rect(0, 0, L, H);
  const E = rectEdges(front);
  b.root("front", "front", rectPolygon(0, 0, L, H), "Front");
  b.pieceLabels.set("front", o.bottomRatio >= 1 ? "Bag" : "Envelope");

  // Side flaps (envelopes) or glue seams (bags). Layer 1: pivot depth 1.
  const sideD = o.side === "seams" ? clamp(L * 0.06, 12, 20) : clamp(L * 0.22 + (dims.W ?? 0), 15, L * 0.35);
  for (const [k, edge] of [["L", E.left], ["R", E.right]] as const) {
    const role = o.side === "seams" ? "glue" : "dust";
    const taperBase = o.side === "seams" ? sideD * 0.5 : Math.min(H * 0.18, sideD * 1.4);
    b.attach(`side${k}`, role, "front", [pt(edge[0].x, edge[0].y + 2), pt(edge[1].x, edge[1].y - 2)], sideD, { kind: "trapezoid", taperA: taperBase, taperB: taperBase }, {
      fold: 180,
      pivotDepth: 1,
      stage: 0,
      label: o.side === "seams" ? "Side seam" : "Side flap",
      printable: o.side !== "seams",
    });
  }

  // Bottom flap / back panel. Layer 2: pivot depth 1.5.
  const full = o.bottomRatio >= 1;
  const bottomD = full ? H - 1 : clamp(H * o.bottomRatio + (dims.W ?? 0), 20, H - 5);
  const taper = full ? 0 : Math.min(L * 0.12, bottomD * 0.5);
  b.attach("back", full ? "back" : "flap", "front", E.bottom, bottomD, { kind: "trapezoid", taperA: taper, taperB: taper }, { fold: 180, pivotDepth: 1.5, stage: 1, label: full ? "Back panel" : "Bottom flap" });

  // Seal flap from the top edge, over the back. Layer 3: pivot depth 2.
  const sD = Math.min(o.sealDepth, H * (full ? 0.3 : 0.45));
  const a: Pt = E.top[0];
  const z: Pt = E.top[1];
  let poly: Polygon;
  if (o.sealShape === "pointed") poly = [a, z, pt(z.x - L * 0.08, a.y - sD * 0.45), pt(L / 2 + L * 0.06, a.y - sD), pt(L / 2 - L * 0.06, a.y - sD), pt(a.x + L * 0.08, a.y - sD * 0.45)];
  else if (o.sealShape === "rounded") {
    poly = [a, z];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI;
      poly.push(pt(L / 2 + Math.cos(ang) * (L / 2 - 4), a.y - 4 - Math.sin(ang) * (sD - 4)));
    }
  } else poly = [a, z, pt(z.x - 8, a.y - sD), pt(a.x + 8, a.y - sD)];
  b.attachPoly("seal", "tuck", "front", E.top, poly, { fold: 180, pivotDepth: 2, stage: 2, label: "Seal flap" });

  if (o.tearStrip || f.tearStrip) {
    // Two perforations across the back panel near the opening (tear-open strip).
    // Near the opening edge of the back panel (its far edge on the sheet).
    const y = H + bottomD - Math.min(40, bottomD * 0.25) - 8;
    b.perfLines.push({ a: pt(6, y), b: pt(L - 6, y) }, { a: pt(6, y + 8), b: pt(L - 6, y + 8) });
  }
  return { builder: b, closedRotation: IDENTITY, faceDepthTol: 2.6 * t };
}
