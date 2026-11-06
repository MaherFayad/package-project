import { CylinderGeometry, ExtrudeGeometry, Shape, ShapeGeometry, type BufferGeometry } from "three";
import { roundCorners, tubeDims, tinLidHeight, type ClosureKind, type ControlPoint, type VesselDims, type VesselKind, type VesselProfile } from "@/lib/vessels";
import { revolve, ringsFromPoints, type Ring } from "./geometry";

/** What a part is made of (the model maps roles to materials). */
export type PartRole = "cap" | "capMetal" | "rubber" | "pipette" | "dark" | "body";

export interface ClosurePart {
  geometry: BufferGeometry;
  role: PartRole;
  /** "moving" parts follow the open animation; "static" stay on the container. */
  group: "moving" | "static" | "tab";
  position?: [number, number, number];
}

export interface ClosureModel {
  parts: ClosurePart[];
  /** How the closure opens in the "open" animation. */
  motion: "unscrew" | "lift" | "tab" | "none";
  /** Unscrew: turns and thread rise (mm). */
  turns: number;
  rise: number;
  /** Lift: how far the moving group travels up after unscrewing (mm). */
  lift: number;
  /** Tab pivot (can end) in mm. */
  pivot?: [number, number, number];
  /** Top of the closed closure (for framing). */
  topY: number;
}

const lathe = (pts: ControlPoint[], opts: { segments?: number; ribs?: { count: number; depth: number; where: (r: Ring) => boolean }; section?: VesselProfile["section"] } = {}) =>
  revolve(ringsFromPoints(roundCorners(pts, 5)), { segments: opts.segments ?? 96, ribs: opts.ribs, section: opts.section });

/** Ribbed screw cap over a finish. */
function screwCap(p: VesselProfile, extraTop: ControlPoint[] = []): { geometry: BufferGeometry; yt: number } {
  const top = p.finishTopY;
  const r = p.finishR + 1.5;
  const yb = top - p.finishH - 0.6;
  const yt = top + 2.8;
  const pts: ControlPoint[] = [
    { r: r - 1.1, y: yb + 6 },
    { r: r - 1.1, y: yb, round: 0.3 },
    { r: r - 0.2, y: yb, round: 0.3 },
    { r, y: yb + 0.7, round: 0.3 },
    { r, y: yb + 2.2 },
    { r: r - 0.45, y: yb + 2.6 },
    { r, y: yb + 3.0 },
    { r, y: yt - 1.2, round: 1.2 },
    { r: r - 0.9, y: yt, round: 0.8 },
    ...(extraTop.length ? extraTop : [{ r: 0, y: yt }]),
  ];
  const ribTop = yt - 1.6;
  const geometry = lathe(pts, { segments: 240, ribs: { count: 72, depth: 0.32, where: (ring) => ring.y > yb + 3.4 && ring.y < ribTop && ring.r > r - 0.05 } });
  return { geometry, yt };
}

/** Closure (and its open motion) for a container. Geometry in mm, container coordinates. */
export function buildClosure(kind: VesselKind, closure: ClosureKind, dims: VesselDims, p: VesselProfile): ClosureModel {
  const top = p.finishTopY;
  switch (closure) {
    case "SCREW_CAP": {
      const { geometry, yt } = screwCap(p);
      return { parts: [{ geometry, role: "cap", group: "moving" }], motion: "unscrew", turns: 2, rise: Math.min(6, p.finishH * 0.45), lift: 26, topY: yt };
    }
    case "SPORTS_CAP": {
      const r = p.finishR + 1.5;
      const yt0 = top + 2.8;
      const { geometry, yt } = screwCap(p, [
        { r: r - 1.6, y: yt0, round: 0.6 },
        { r: 9, y: yt0, round: 0.8 },
        { r: 9, y: yt0 + 5, round: 1.2 },
        { r: 6.4, y: yt0 + 7, round: 1 },
        { r: 6.4, y: yt0 + 13.6, round: 1.2 },
        { r: 2.6, y: yt0 + 14.2, round: 0.5 },
        { r: 0, y: yt0 + 14.2 },
      ]);
      return { parts: [{ geometry, role: "cap", group: "moving" }], motion: "unscrew", turns: 2, rise: Math.min(6, p.finishH * 0.45), lift: 26, topY: yt + 14.2 };
    }
    case "DROPPER": {
      const r = p.finishR + 1.7;
      const yb = top - p.finishH - 0.6;
      const yt = top + 2.4;
      const collar = lathe(
        [
          { r: r - 1, y: yb + 5 },
          { r: r - 1, y: yb, round: 0.3 },
          { r, y: yb + 0.4, round: 0.5 },
          { r, y: yt - 0.8, round: 0.8 },
          { r: r - 1.2, y: yt, round: 0.5 },
          { r: 0, y: yt },
        ],
        { segments: 180, ribs: { count: 40, depth: 0.45, where: (ring) => ring.y > yb + 1 && ring.y < yt - 1.2 && ring.r > r - 0.05 } },
      );
      const rb = p.finishR * 0.62;
      const bulb = lathe([
        { r: rb + 0.8, y: yt - 0.2 },
        { r: rb + 0.8, y: yt + 1.6, round: 0.6 },
        { r: rb, y: yt + 2.6, round: 1 },
        { r: rb * 1.14, y: yt + 10, round: 4 },
        { r: rb * 1.08, y: yt + 18, round: 4 },
        { r: rb * 0.6, y: yt + 25, round: 3 },
        { r: 0, y: yt + 26 },
      ]);
      const tipY = p.baseMm + 5;
      const pipette = lathe(
        [
          { r: 0, y: tipY },
          { r: 0.7, y: tipY, round: 0.3 },
          { r: 2.5, y: tipY + 9, round: 1 },
          { r: 2.9, y: tipY + 12 },
          { r: 2.9, y: top - 1 },
          { r: 0, y: top - 1 },
        ],
        { segments: 32 },
      );
      return {
        parts: [
          { geometry: collar, role: "capMetal", group: "moving" },
          { geometry: bulb, role: "rubber", group: "moving" },
          { geometry: pipette, role: "pipette", group: "moving" },
        ],
        motion: "unscrew",
        turns: 1.5,
        rise: 4,
        lift: Math.max(30, top - tipY + 6),
        topY: yt + 26,
      };
    }
    case "LOTION_PUMP": {
      const r = p.finishR + 1.9;
      const yb = top - p.finishH - 0.4;
      const yt = top + 1.5;
      const collar = lathe(
        [
          { r: r - 1, y: yb + 5 },
          { r: r - 1, y: yb, round: 0.3 },
          { r, y: yb + 0.4, round: 0.5 },
          { r, y: yt - 0.8, round: 0.8 },
          { r: 5, y: yt, round: 0.6 },
          { r: 3.6, y: yt + 0.8, round: 0.4 },
          { r: 3.6, y: yt + 14 },
          { r: 0, y: yt + 14 },
        ],
        { segments: 180, ribs: { count: 44, depth: 0.45, where: (ring) => ring.y > yb + 1 && ring.y < yt - 1.2 && ring.r > r - 0.05 } },
      );
      const head = lathe([
        { r: 0, y: yt + 13 },
        { r: 10.5, y: yt + 13, round: 1.6 },
        { r: 11.2, y: yt + 20, round: 2.5 },
        { r: 9.5, y: yt + 25.5, round: 3 },
        { r: 0, y: yt + 26 },
      ]);
      const nozzle = new CylinderGeometry(2.3, 2.5, 18, 24, 1, false);
      nozzle.rotateX(Math.PI / 2);
      nozzle.translate(0, yt + 21.5, 17);
      const orifice = new CylinderGeometry(1.1, 1.1, 0.4, 16);
      orifice.rotateX(Math.PI / 2);
      orifice.translate(0, yt + 21.5, 26.1);
      return {
        parts: [
          { geometry: collar, role: "cap", group: "moving" },
          { geometry: head, role: "cap", group: "moving" },
          { geometry: nozzle, role: "cap", group: "moving" },
          { geometry: orifice, role: "dark", group: "moving" },
        ],
        motion: "unscrew",
        turns: 1.5,
        rise: 4,
        lift: 30,
        topY: yt + 26,
      };
    }
    case "MIST_PUMP": {
      const r = p.finishR + 0.8;
      const yb = top - 5.2;
      const yt = top + 2.2;
      const ferrule = lathe([
        { r: r + 0.6, y: yb },
        { r, y: yb + 1.2, round: 0.6 },
        { r, y: yt - 0.6, round: 0.6 },
        { r: 3.2, y: yt, round: 0.4 },
        { r: 2.4, y: yt },
        { r: 2.4, y: yt + 3 },
        { r: 6.2, y: yt + 3, round: 0.5 },
        { r: 6.2, y: yt + 12, round: 1.2 },
        { r: 0, y: yt + 12.4 },
      ]);
      const orifice = new CylinderGeometry(0.75, 0.75, 0.3, 16);
      orifice.rotateX(Math.PI / 2);
      orifice.translate(0, yt + 9, 6.25);
      const capR = Math.min((dims.D / 2) * 0.66, 15);
      const cb = top - p.finishH - 2.4;
      const ct = yt + 16;
      const overcap = lathe([
        { r: capR - 1.2, y: cb + 6 },
        { r: capR - 1.2, y: cb, round: 0.4 },
        { r: capR, y: cb + 0.6, round: 0.6 },
        { r: capR, y: ct - 2.5, round: 2.5 },
        { r: capR - 2.5, y: ct, round: 2 },
        { r: 0, y: ct },
      ]);
      return {
        parts: [
          { geometry: ferrule, role: "capMetal", group: "static" },
          { geometry: orifice, role: "dark", group: "static" },
          { geometry: overcap, role: "cap", group: "moving" },
        ],
        motion: "lift",
        turns: 0,
        rise: 0,
        lift: 34,
        topY: ct,
      };
    }
    case "LUG_LID": {
      const r = p.finishR + 1.6;
      const yb = top - p.finishH + 0.5;
      const yt = top + 1.6;
      const lid = lathe([
        { r: r - 1, y: yb + 3 },
        { r: r - 1, y: yb, round: 0.3 },
        { r: r + 0.5, y: yb + 0.4, round: 0.6 },
        { r: r + 0.5, y: yb + 1.3, round: 0.4 },
        { r, y: yb + 1.8, round: 0.4 },
        { r, y: yt - 1.4, round: 1.4 },
        { r: r - 1.6, y: yt, round: 1 },
        { r: 0, y: yt },
      ], { section: p.section });
      // a square / rectangular rim cannot be unscrewed: its lid lifts straight off
      const round = p.section.kind === "round";
      return { parts: [{ geometry: lid, role: "capMetal", group: "moving" }], motion: round ? "unscrew" : "lift", turns: round ? 0.3 : 0, rise: round ? 2.5 : 0, lift: 24, topY: yt };
    }
    case "SLIP_LID": {
      const R = dims.D / 2;
      const rl = R + 0.6;
      const yt = dims.H + 0.6;
      const yb = dims.H - tinLidHeight(dims);
      const lid = lathe([
        { r: rl - 0.4, y: yb + 4 },
        { r: rl - 0.4, y: yb, round: 0.3 },
        { r: rl + 0.3, y: yb + 0.4, round: 0.5 },
        { r: rl, y: yb + 1, round: 0.4 },
        { r: rl, y: yt - 1.2, round: 1.2 },
        { r: rl - 1.4, y: yt, round: 0.8 },
        { r: 0, y: yt },
      ], { section: p.section });
      return { parts: [{ geometry: lid, role: "capMetal", group: "moving" }], motion: "lift", turns: 0, rise: 0, lift: Math.max(24, tinLidHeight(dims) + 14), topY: yt };
    }
    case "CAN_END": {
      const panelY = top - 5.3 + 0.35;
      const tab = new Shape();
      const w = 6.2;
      const back = -8.5;
      const front = 13.5;
      const cr = 4.6;
      tab.moveTo(-w + cr, back);
      tab.lineTo(w - cr, back);
      tab.quadraticCurveTo(w, back, w, back + cr);
      tab.lineTo(w * 0.86, front - cr);
      tab.quadraticCurveTo(w * 0.8, front, 0, front);
      tab.quadraticCurveTo(-w * 0.8, front, -w * 0.86, front - cr);
      tab.lineTo(-w, back + cr);
      tab.quadraticCurveTo(-w, back, -w + cr, back);
      const hole = new Shape();
      hole.absellipse(0, back + 4.2, 3.6, 2.6, 0, Math.PI * 2, false, 0);
      tab.holes.push(hole);
      const tabGeo = new ExtrudeGeometry(tab, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.22, bevelSegments: 2, curveSegments: 24 });
      tabGeo.rotateX(-Math.PI / 2);
      tabGeo.translate(0, panelY, 0);
      const rivet = new CylinderGeometry(1.5, 1.7, 0.7, 24);
      rivet.translate(0, panelY + 0.35, 0);
      const opening = new Shape();
      opening.moveTo(-7, 4);
      opening.quadraticCurveTo(0, 2, 7, 4);
      opening.quadraticCurveTo(9.5, 14, 0, 18.5);
      opening.quadraticCurveTo(-9.5, 14, -7, 4);
      const openGeo = new ShapeGeometry(opening, 24);
      openGeo.rotateX(-Math.PI / 2);
      openGeo.translate(0, top - 5.3 + 0.03, 0);
      return {
        parts: [
          { geometry: tabGeo, role: "capMetal", group: "tab" },
          { geometry: rivet, role: "body", group: "static" },
          { geometry: openGeo, role: "dark", group: "static" },
        ],
        motion: "tab",
        turns: 0,
        rise: 0,
        lift: 0,
        pivot: [0, panelY + 0.4, 1.5],
        topY: top,
      };
    }
    case "FLIP_TOP":
    case "SCREW_TUBE_CAP": {
      const t = tubeDims(dims);
      const flip = closure === "FLIP_TOP";
      const cr = flip ? t.capR : t.capR * 0.74;
      const seam = t.capH * 0.32;
      const pts: ControlPoint[] = [
        { r: 0, y: 0 },
        { r: cr - 1.6, y: 0, round: 1 },
        { r: cr, y: 1.4, round: 1 },
        ...(flip
          ? [
              { r: cr, y: seam - 0.5 },
              { r: cr - 0.4, y: seam },
              { r: cr, y: seam + 0.5 },
            ]
          : []),
        { r: cr, y: t.capH - 0.8, round: 0.8 },
        { r: t.nozzleR + 0.5, y: t.capH, round: 0.5 },
        { r: 0, y: t.capH },
      ];
      const cap = lathe(pts, flip ? {} : { segments: 180, ribs: { count: 48, depth: 0.4, where: (ring) => ring.y > 2 && ring.y < t.capH - 1.5 } });
      const parts: ClosurePart[] = [{ geometry: cap, role: "cap", group: "static" }];
      if (!flip) {
        // shoulder disc between the slim screw cap and the round tube
        const disc = lathe([
          { r: 0, y: t.capH - 0.01 },
          { r: t.R, y: t.capH - 0.01 },
        ]);
        parts.push({ geometry: disc, role: "body", group: "static" });
      }
      return { parts, motion: "none", turns: 0, rise: 0, lift: 0, topY: t.totalH };
    }
    case "ZIP_SEAL":
    default:
      return { parts: [], motion: "none", turns: 0, rise: 0, lift: 0, topY: kind === "STAND_UP_POUCH" ? dims.H : top };
  }
}
