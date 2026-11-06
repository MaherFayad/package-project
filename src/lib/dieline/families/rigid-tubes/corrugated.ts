import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { stadium } from "../../features";
import { clamp, rectPolygon } from "../../geometry";
import { rsc, telescope } from "../../structures";
import { IDENTITY, rect } from "./common";
import type { FamilyDraft } from "./types";

/**
 * Bulk corrugated containers.
 *
 * Pallet box: FEFCO 0201 regular slotted container sized to an ISO 6780 pallet footprint
 * (1200 × 1000 / 1200 × 800 / 1100 × 1100 mm), double or triple wall; optional hand holes.
 * The engine's `rsc` generator already implements the FEFCO 0201 geometry, so this reuses it.
 * Pallet box with lid: FEFCO 0320 (two FEFCO 0200 HSC halves).
 */
export const palletBox = (dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft => rsc(dims, t, f);
export function palletBoxWithLid(dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  const draft = telescope(dims, t, { ...f, lidHeightMm: f.lidHeightMm ?? clamp(Math.round(dims.H * 0.2), 60, 200) });
  // The core telescope lid clears the base by max(1, t/2) per side, but its joint flap sits a
  // full caliper inside the lid wall: on 7 mm BC board it pierced the base wall by 3.5 mm.
  // Draw the joint mostly inside the lid wall, standing proud by less than the clearance.
  const joint = draft.builder.panels.find((p) => p.id === "lid_glue");
  if (joint) joint.stackOffset = -Math.min(0.9, Math.max(0.1, (Math.max(1, t * 0.5) - 0.2) / t));
  return draft;
}

/** Corner chamfer (inner leg, mm) of an octabin: a regular octagon on the shorter side. */
export const octabinChamfer = (L: number, W: number) => Math.round(Math.min(L, W) * (1 - 1 / (1 + Math.SQRT2)) * 0.5 * 10) / 10;

/**
 * Octabin (octagonal bulk bin): an 8-panel corrugated sleeve, 45° folds, with RSC-style
 * flaps top and bottom on the four main panels and short corner flaps on the diagonals.
 * No FEFCO number is assigned to octabins; dimensions follow the pallet footprint.
 *
 * Panel widths are measured on the outer surface: an octagon offset outward by t grows every
 * side by 2·t·tan(22.5°), so the folded inner octagon is L × W with corner legs c.
 * Height compensation as FEFCO 0201: H + 4t (minor + major flap at both ends).
 */
export function octabin(dims: Dims, t: number, f: StructureFeatures = {}): FamilyDraft {
  const c = octabinChamfer(dims.L, dims.W);
  const grow = 2 * t * Math.tan(Math.PI / 8);
  const front = dims.L - 2 * c + grow;
  const side = dims.W - 2 * c + grow;
  const diag = c * Math.SQRT2 + grow;
  const Hp = dims.H + 4 * t;
  const j = Math.min(50, Hp * 0.15);
  const slot = clamp(2 * t + 2, 6, 20);
  const b = new DielineBuilder();
  const seq: { id: string; role: "front" | "right" | "back" | "left" | "flap"; w: number }[] = [
    { id: "front", role: "front", w: front },
    { id: "diagFR", role: "flap", w: diag },
    { id: "right", role: "right", w: side },
    { id: "diagRB", role: "flap", w: diag },
    { id: "back", role: "back", w: front },
    { id: "diagBL", role: "flap", w: diag },
    { id: "left", role: "left", w: side },
    { id: "diagLF", role: "flap", w: diag },
  ];
  let x = j;
  const rects = new Map<string, ReturnType<typeof rect>>();
  seq.forEach((p, i) => {
    const r = rect(x, 0, p.w, Hp);
    rects.set(p.id, r);
    const label = p.role === "flap" ? "Corner panel" : `${p.id[0].toUpperCase()}${p.id.slice(1)} panel`;
    // Corner panels are walls too: use the "inner" role so they never claim a face.
    const role = p.role === "flap" ? "inner" : p.role;
    if (i === 0) b.root(p.id, role, rectPolygon(r.x, r.y, r.width, r.height), label);
    else b.attach(p.id, role, seq[i - 1].id, rectEdges(rects.get(seq[i - 1].id)!).right, p.w, { kind: "rect" }, { fold: 45, stage: 0, label });
    x += p.w;
  });
  b.attach("glue", "glue", "front", rectEdges(rects.get("front")!).left, j, { kind: "trapezoid", taperA: j * 0.25, taperB: j * 0.25 }, { fold: 45, stage: 0, stack: -1, label: "Manufacturer's joint" });

  const majorD = (dims.W + 2 * t) / 2;
  const minorD = Math.min(majorD, (dims.L + 2 * t) / 2 - t, side * 0.9);
  for (const where of ["top", "bottom"] as const) {
    for (const p of seq) {
      const r = rects.get(p.id)!;
      const edge = where === "top" ? rectEdges(r).top : rectEdges(r).bottom;
      if (p.role === "flap") {
        const d = Math.min(c * 0.6, diag * 0.5);
        b.attach(`${where}Flap_${p.id}`, "flap", p.id, insetSeg(edge, slot / 2), d, { kind: "trapezoid", taperA: d * 0.7, taperB: d * 0.7 }, { stage: 1, stack: -2, label: "Corner flap" }); // under the minor flaps
        continue;
      }
      const major = p.role === "front" || p.role === "back";
      b.attach(`${where}Flap_${p.id}`, "flap", p.id, insetSeg(edge, slot / 2), major ? majorD : minorD, { kind: "rect" }, { stage: major ? 3 : 2, stack: major ? 0 : -1, label: major ? "Major flap" : "Minor flap" });
    }
  }
  if (f.handle) {
    for (const id of ["left", "right"]) {
      const p = b.byId(id);
      const r = p.bbox;
      const w = Math.min(110, r.width * 0.5);
      const h = Math.min(35, r.height * 0.1);
      if (w >= 50 && h >= 20) p.holes = [stadium(r.x + r.width / 2, r.y + Math.max(60, h) + h / 2, w, h)];
    }
  }
  return { builder: b, closedRotation: IDENTITY };
}
