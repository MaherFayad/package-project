import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder } from "../../builder";
import { clamp, pt } from "../../geometry";
import type { StructureDraft } from "../../structures";
import type { Polygon, Pt } from "../../types";
import { TILT_UP, turn180 } from "./kit";

/**
 * FEFCO 0459 octagonal tray: the base is a rectangle with 45° chamfered corners; each of the
 * eight base edges carries a wall. The four main walls carry glue ears on both sides that
 * fold 45° onto the inside of the neighbouring corner walls.
 *
 * `chamferRatio` is the corner cut as a share of the shorter base side (default 0.2).
 */
export function octagonalTray(dims: Dims, t: number, _f: StructureFeatures = {}, chamferRatio = 0.2): StructureDraft {
  void _f;
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + t;
  const c = clamp(Math.min(Lp, Wp) * chamferRatio, 10, Math.min(Lp, Wp) * 0.3);
  const b = new DielineBuilder();
  const base: Polygon = [pt(c, 0), pt(Lp - c, 0), pt(Lp, c), pt(Lp, Wp - c), pt(Lp - c, Wp), pt(c, Wp), pt(0, Wp - c), pt(0, c)];
  b.root("base", "bottom", base, "Base");
  // Edges in order: back, corner, left(sheet right), corner, front, corner, right(sheet left), corner.
  const names = ["back", "cornerBR", "left", "cornerFR", "front", "cornerFL", "right", "cornerBL"] as const;
  const roles = { back: "back", left: "left", front: "front", right: "right" } as const;
  const cornerLen = c * Math.SQRT2;
  names.forEach((name, i) => {
    const a = base[i];
    const e = base[(i + 1) % 8];
    const role = name in roles ? roles[name as keyof typeof roles] : "flap";
    const wallPanel = b.attach(name, role, "base", [a, e], Hp, { kind: "rect" }, {
      // Main walls rise with their glue ears folded in; the corner walls then close over the ears.
      stage: role === "flap" ? 1 : 0,
      label: role === "flap" ? "Corner wall" : `${name} wall`,
    });
    if (role === "flap") return;
    // Glue ears on both side edges of the main wall (rim → base), folded 45° onto the corner walls.
    const others = wallPanel.polygon.filter((q) => Math.hypot(q.x - a.x, q.y - a.y) > 1e-6 && Math.hypot(q.x - e.x, q.y - e.y) > 1e-6);
    const near = (p: Pt) => others.reduce((best, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? q : best));
    // The ear is a triangle that fits the 45° gap between this wall and the corner wall.
    for (const [k, basePt] of [["a", a], ["b", e]] as const) {
      const rim = near(basePt);
      const fr = b.frame(name, [basePt, rim]);
      // Each corner wall takes one ear from each side: keep each under half its width so they never overlap.
      const d = Math.min(Hp * 0.8, (cornerLen * 0.5 - 1) / 0.9);
      const poly: Polygon = [basePt, rim, fr.at(rim, -d * 0.15, d * 0.9)];
      b.attachPoly(`ear_${name}_${k}`, "ear", name, [basePt, rim], poly, { fold: 45, stage: 0, stack: -1, label: "Glue ear" });
    }
  });
  turn180(b);
  return { builder: b, closedRotation: TILT_UP };
}
