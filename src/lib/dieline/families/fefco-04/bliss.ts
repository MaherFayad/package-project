import { Matrix4 } from "three";
import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, rectEdges } from "../../builder";
import { boundsAt } from "../../fold";
import { bboxOf, clamp, pt, rectPolygon } from "../../geometry";
import type { StructureDraft } from "../../structures";
import type { Polygon, Pt } from "../../types";
import { TILT_UP, rect, turn180 } from "./kit";

/**
 * FEFCO 0405 Bliss-style container: three blanks. The body is the base, both long walls and
 * the cover flaps hinged on the long walls; two separate end panels carry glue flaps on all
 * four edges, which are glued to the inside of the body (base, walls and cover).
 *
 * Compensation: the end panels sit inside the body, so the body is L + 2t long; the end
 * panels are the body's inner opening (outer W − 2t by outer H − 2t).
 */
export function blissContainer(dims: Dims, t: number, _f: StructureFeatures = {}): StructureDraft {
  void _f;
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 2 * t;
  const b = new DielineBuilder();
  const base = rect(0, 0, Lp, Wp);
  const back = rect(0, -Hp, Lp, Hp);
  const front = rect(0, Wp, Lp, Hp);
  b.root("base", "bottom", rectPolygon(0, 0, Lp, Wp), "Base");
  b.attach("back", "back", "base", rectEdges(base).top, Hp, { kind: "rect" }, { stage: 0, label: "Back wall" });
  b.attach("front", "front", "base", rectEdges(base).bottom, Hp, { kind: "rect" }, { stage: 0, label: "Front wall" });
  b.attach("coverBack", "flap", "back", rectEdges(back).top, Wp / 2 - 1, { kind: "rect" }, { stage: 2, label: "Cover flap" });
  b.attach("coverFront", "flap", "front", rectEdges(front).bottom, Wp / 2 - 1, { kind: "rect" }, { stage: 2, label: "Cover flap" });
  turn180(b);
  b.pieceLabels.set("base", "Body");

  const closed = boundsAt({ panels: b.panels, rootId: "base", thicknessMm: t, closedRotation: TILT_UP }, 1);
  const outerW = closed.max.z - closed.min.z;
  const outerH = closed.max.y - closed.min.y;
  const ew = outerW - 2 * t;
  const eh = outerH - 2 * t;
  const glue = clamp(Math.min(ew, eh) * 0.25, 15, 40);
  const cy = (closed.max.y + closed.min.y) / 2;
  const cz = (closed.max.z + closed.min.z) / 2;

  const sheet = bboxOf(b.panels.flatMap((p) => p.polygon));
  const gap = 10;
  for (const side of ["R", "L"] as const) {
    // One end panel on each side of the body, on the side it ends up on: it then slides in
    // from outside along the box axis instead of travelling through the body.
    const x0 = side === "R" ? sheet.x + sheet.width + gap + glue : sheet.x - gap - glue - ew;
    const id = `end${side}`;
    const y0 = sheet.y + glue;
    const poly: Polygon = rectPolygon(x0, y0, ew, eh);
    // Flat-frame centre of the end panel (X = sheet x, Y = -sheet y).
    const c: Pt = pt(x0 + ew / 2, y0 + eh / 2);
    // Right end: printed side (+Z) → +X, sheet x → −Z (front edge toward the viewer). Left: mirrored.
    const rotY = side === "R" ? Math.PI / 2 : -Math.PI / 2;
    const target = side === "R" ? closed.max.x : closed.min.x;
    const m = new Matrix4()
      .makeTranslation(target, cy, cz)
      .multiply(new Matrix4().makeRotationY(rotY))
      .multiply(new Matrix4().makeTranslation(-c.x, c.y, 0));
    b.piece(id, side === "R" ? "right" : "left", poly, side === "R" ? "Right end" : "Left end", { matrix: m.toArray(), stage: 1, lift: dims.H * 0.7 }, { label: "End panel" });
    const e = rectEdges({ x: x0, y: y0, width: ew, height: eh });
    for (const [k, edge] of Object.entries(e)) {
      const len = Math.hypot(edge[1].x - edge[0].x, edge[1].y - edge[0].y);
      const taper = Math.min(glue * 0.8, len * 0.2);
      b.attach(`${id}_glue_${k}`, "glue", id, edge, glue, { kind: "trapezoid", taperA: taper, taperB: taper }, { stage: 0, stack: 0, printable: false, label: "Glue flap" });
    }
  }
  return { builder: b, closedRotation: TILT_UP };
}
