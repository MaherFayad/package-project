import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg, rectEdges } from "../../builder";
import { notchPanel, stadium, tearBand } from "../../features";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { StructureDraft } from "../../structures";
import type { Polygon, Pt, Rect } from "../../types";
import {
  type Ctx,
  type End,
  type Walls,
  composeFaces,
  deepEnds,
  endHinge,
  flap,
  fullMajor,
  handHoles,
  jointWidth,
  meetMajor,
  meetMinor,
  rect,
  rscEnd,
  slit,
  slotWidth,
  slottedEnd,
  snapLockBottom,
  standardTube,
  stripFace,
  tuckLidEnd,
} from "./kit";
import type { Fefco02Code, Fefco02Generator, Fefco02Params } from "./types";

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

/** Crease-to-crease panel sizes for single walls + `top`/`bottom` board layers at the ends. */
const sizes = (d: Dims, t: number, top: number, bottom: number) => ({ Lp: d.L + 2 * t, Wp: d.W + 2 * t, Hp: d.H + (top + bottom) * t });

/** Board layers at each end of the closed box, per style (drives the H compensation). */
export const END_LAYERS: Record<Fefco02Code, { top: number; bottom: number }> = {
  FEFCO_0200: { top: 0, bottom: 2 },
  FEFCO_0201: { top: 2, bottom: 2 },
  FEFCO_0202: { top: 3, bottom: 3 },
  FEFCO_0203: { top: 3, bottom: 3 },
  FEFCO_0204: { top: 2, bottom: 2 },
  FEFCO_0205: { top: 3, bottom: 3 },
  FEFCO_0206: { top: 3, bottom: 3 },
  FEFCO_0207: { top: 2, bottom: 2 },
  FEFCO_0208: { top: 2, bottom: 2 },
  FEFCO_0209: { top: 2, bottom: 2 },
  FEFCO_0210: { top: 2, bottom: 2 },
  FEFCO_0211: { top: 2, bottom: 2 },
  FEFCO_0212: { top: 2, bottom: 2 },
  FEFCO_0214: { top: 2, bottom: 2 },
  FEFCO_0215: { top: 2, bottom: 3 },
  FEFCO_0216: { top: 2, bottom: 3 },
  FEFCO_0217: { top: 0, bottom: 3 },
  FEFCO_0218: { top: 3, bottom: 3 },
  FEFCO_0225: { top: 2, bottom: 1 },
  FEFCO_0226: { top: 2, bottom: 2 },
  FEFCO_0227: { top: 3, bottom: 3 },
  FEFCO_0228: { top: 2, bottom: 2 },
  FEFCO_0229: { top: 2, bottom: 2 },
  FEFCO_0230: { top: 2, bottom: 2 },
  FEFCO_0231: { top: 2, bottom: 2 },
};

const tube = (code: Fefco02Code, d: Dims, t: number): Ctx => {
  const l = END_LAYERS[code];
  const { Lp, Wp, Hp } = sizes(d, t, l.top, l.bottom);
  return standardTube(Lp, Wp, Hp, t);
};

const draft = (c: Ctx | DielineBuilder, extra: Partial<StructureDraft> = {}): StructureDraft => ({
  builder: c instanceof DielineBuilder ? c : c.b,
  closedRotation: IDENTITY,
  ...extra,
});

/** Common optional features of plain slotted boxes: hand holes and tear strip. */
function slottedFeatures(c: Ctx, d: Dims, f: StructureFeatures) {
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  if (f.tearStrip) tearBand(c.b, [c.wallIds.front, c.wallIds.right, c.wallIds.back, c.wallIds.left], Math.min(60, d.H * 0.3));
}

/* ───────────── default style parameters ───────────── */

export function defaultParams(code: Fefco02Code, d: Dims): Fefco02Params {
  switch (code) {
    case "FEFCO_0202":
      return { overlapMm: Math.round(clamp(d.W * 0.25, 20, 80)) };
    case "FEFCO_0228":
    case "FEFCO_0230":
      return { overlapMm: Math.round(clamp(d.L * 0.1, 30, 50)) };
    case "FEFCO_0231":
      return { overlapMm: Math.round(clamp(d.W * 0.15, 30, 50)) };
    case "FEFCO_0209":
      return { rimMm: Math.round(clamp(Math.min(d.L, d.W) * 0.2, 25, 60)) };
    case "FEFCO_0214":
      return { trayHeightMm: Math.round(clamp(d.H * 0.6, 20, d.H - 10)) };
    case "FEFCO_0225":
      return { linerHeightMm: Math.round(clamp(d.H * 0.5, 20, d.H)) };
    case "FEFCO_0226":
      return { bevelFoldDeg: 60 };
    default:
      return {};
  }
}

/* ───────────── 0200–0206: flap-closed slotted containers ───────────── */

/** 0200 half slotted container: bottom flaps as 0201, open top. */
const s0200: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0200", d, t);
  rscEnd(c, "bottom");
  slottedFeatures(c, d, f);
  return draft(c);
};

/** 0201 regular slotted container: all flaps ½B, outer flaps meet at the centre. */
const s0201: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0201", d, t);
  rscEnd(c, "top");
  rscEnd(c, "bottom");
  slottedFeatures(c, d, f);
  return draft(c);
};

/** 0202 overlap slotted container: all flaps ½(B + o); outer flaps overlap by o. */
const s0202: Fefco02Generator = (d, t, f, p = {}) => {
  const c = tube("FEFCO_0202", d, t);
  const o = p.overlapMm ?? defaultParams("FEFCO_0202", d).overlapMm!;
  const major = Math.min((c.Wp + o) / 2, fullMajor(c));
  const minor = Math.min(major, meetMinor(c));
  for (const end of ["top", "bottom"] as const) slottedEnd(c, end, major, minor, { overlap: true });
  slottedFeatures(c, d, f);
  // The inner major shows beside the outer one (overlap o): it carries the end-face artwork.
  return draft(c, { faces: deepEnds(c, ["top", "bottom"], 1) });
};

/** 0203 full overlap slotted container: all flaps B; outer flaps cover the whole opening. */
const s0203: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0203", d, t);
  const major = fullMajor(c);
  for (const end of ["top", "bottom"] as const) slottedEnd(c, end, major, Math.min(major, meetMinor(c)), { overlap: true });
  slottedFeatures(c, d, f);
  return draft(c, { faces: deepEnds(c, ["top", "bottom"], 1) });
};

/** 0204 centre special slotted container: outer flaps ½B and inner flaps ½L, both pairs meet. */
const s0204: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0204", d, t);
  for (const end of ["top", "bottom"] as const) slottedEnd(c, end, meetMajor(c), meetMinor(c));
  slottedFeatures(c, d, f);
  return draft(c);
};

/** 0205 centre special overlap slotted container: all flaps ½L; inner meet, outer overlap. */
const s0205: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0205", d, t);
  const major = Math.min(c.Lp / 2, fullMajor(c));
  for (const end of ["top", "bottom"] as const) slottedEnd(c, end, major, meetMinor(c), { overlap: true });
  slottedFeatures(c, d, f);
  return draft(c, { faces: deepEnds(c, ["top", "bottom"], 1) });
};

/** 0206 centre special full overlap slotted container: outer flaps B, inner flaps ½L. */
const s0206: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0206", d, t);
  for (const end of ["top", "bottom"] as const) slottedEnd(c, end, fullMajor(c), meetMinor(c), { overlap: true });
  slottedFeatures(c, d, f);
  return draft(c, { faces: deepEnds(c, ["top", "bottom"], 1) });
};

/* ───────────── 0207, 0208, 0229: integral divisions / double-folded flaps ───────────── */

/**
 * A flap with an intermediate crease: `shelf` mm folds over the end (90°), then `drop` mm
 * folds a further 90° into the box and stands as a division / inner wall.
 */
function shelfAndDrop(c: Ctx, wall: "front" | "right" | "back" | "left", end: End, shelf: number, drop: number, o: { id?: string; insetA?: number; insetB?: number; stage?: number; stack?: number; dropStage?: number } = {}) {
  const fl = flap(c, wall, end, shelf, { id: o.id, insetA: o.insetA, insetB: o.insetB, stage: o.stage, stack: o.stack });
  // `stack` only moves the shelf's own mesh, not its children: pivot the division as many
  // calipers deep so it hangs from the shelf as drawn instead of poking through it.
  const sink = Math.max(0, -(fl.panel.stackOffset ?? 0));
  // The division is pre-folded (stage 0) before its shelf closes, as on the packing line, so
  // two long shelf + division strips never swing through each other under the box.
  c.b.attach(`${fl.panel.id}_drop`, "inner", fl.panel.id, insetSeg(fl.far, 0.5), drop, { kind: "rect" }, { stage: o.dropStage ?? 0, label: "Integral division", ...(sink ? { pivotDepth: sink } : {}) });
}

/**
 * 0207: top flaps as 0201; bottom flaps carry integral divisions. The outer (L-panel)
 * bottom flaps meet at the centre and fold up back to back into a lengthwise division; the
 * inner (B-panel) flaps fold up at L/3 into two cross divisions: six cells.
 */
const s0207: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0207", d, t);
  rscEnd(c, "top");
  const dh = clamp(d.H * 0.8, 15, d.H - 2);
  const cross = Math.min(c.Lp / 3, meetMinor(c));
  // Each flap swings in with its division already square to it, one side at a time (left,
  // right, then the two lengthwise halves): the strips are longer than the box is wide, so
  // folded together or left flat they would cross each other or a wall on the way in.
  shelfAndDrop(c, "left", "bottom", cross, dh, { stage: 1, stack: -1, dropStage: 1 });
  shelfAndDrop(c, "right", "bottom", cross, dh, { stage: 2, stack: -1, dropStage: 2 });
  // Shelves meet on the centre line; each division board stands on its own side of it.
  shelfAndDrop(c, "front", "bottom", meetMajor(c), dh, { stage: 3, stack: 0, dropStage: 3 });
  shelfAndDrop(c, "back", "bottom", meetMajor(c), dh, { stage: 3, stack: 0, dropStage: 3 });
  // The back-to-back lengthwise division rises from the outer (L) flaps through the end
  // shelves: the die slots each end shelf along the box centre line for it.
  const sw = 2 * t + 1;
  for (const side of ["left", "right"] as const) {
    const shelf = c.b.byId(`bottomFlap_${side}`);
    const bb = shelf.bbox;
    const cx = bb.x + bb.width / 2;
    shelf.holes = [...(shelf.holes ?? []), rectPolygon(cx - sw / 2, bb.y + t + 2, sw, bb.height - t - 3)];
  }
  slottedFeatures(c, d, { ...f, tearStrip: false });
  return draft(c);
};

/**
 * 0208: every flap is ½B plus a division of at most ½H that folds into the box, top and
 * bottom. The L-panel divisions meet back to back along the length; each B panel has two
 * half-width flaps whose divisions stand across the box at ½B from the end walls.
 */
const s0208: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0208", d, t);
  const drop = Math.max(10, Math.min(d.H / 2 - 2, c.Wp / 2));
  const cross = Math.min(c.Wp / 2, meetMinor(c));
  for (const end of ["top", "bottom"] as const) {
    for (const side of ["left", "right"] as const) {
      const half = c.walls[side].width / 2;
      shelfAndDrop(c, side, end, cross, drop, { id: `${end}Flap_${side}A`, insetA: c.slot / 2, insetB: half + c.slot / 2, stage: 1, stack: -1 });
      shelfAndDrop(c, side, end, cross, drop, { id: `${end}Flap_${side}B`, insetA: half + c.slot / 2, insetB: c.slot / 2, stage: 1, stack: -1 });
    }
    shelfAndDrop(c, "front", end, meetMajor(c) - t, drop, { stage: 2, stack: 0 });
    shelfAndDrop(c, "back", end, meetMajor(c) - t, drop, { stage: 2, stack: 0 });
  }
  slottedFeatures(c, d, { ...f, tearStrip: false });
  return draft(c);
};

/**
 * 0229 multi-divisional box: the L-panel bottom flaps have an intermediate crease. Their first
 * part folds in over the end as a shelf, the rest stands up inside the box as a lengthwise
 * division, one at about a third of B from each long wall. The B-panel bottom flaps then
 * close the bottom under them (meeting at the centre); the top closes as a 0201.
 */
const s0229: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0229", d, t);
  rscEnd(c, "top");
  const shelf = clamp(c.Wp * 0.3, 15, c.Wp / 2 - t);
  const drop = clamp(d.H * 0.75, 10, d.H - 2 * t - 2);
  shelfAndDrop(c, "front", "bottom", shelf, drop, { stage: 1, stack: -1 });
  shelfAndDrop(c, "back", "bottom", shelf, drop, { stage: 1, stack: -1 });
  flap(c, "left", "bottom", meetMinor(c), { stage: 2, stack: 0, label: "Bottom flap" });
  flap(c, "right", "bottom", meetMinor(c), { stage: 2, stack: 0, label: "Bottom flap" });
  slottedFeatures(c, d, { ...f, tearStrip: false });
  return draft(c);
};

/* ───────────── 0209, 0214, 0226: open / frame / tear-off tops ───────────── */

/** 0209: bottom as 0201; short top flaps (depth h) fold in as a frame around an open top. */
const s0209: Fefco02Generator = (d, t, f, p = {}) => {
  const c = tube("FEFCO_0209", d, t);
  rscEnd(c, "bottom");
  const h = Math.min(p.rimMm ?? defaultParams("FEFCO_0209", d).rimMm!, meetMajor(c) - t, meetMinor(c));
  slottedEnd(c, "top", h, h);
  slottedFeatures(c, d, { ...f, tearStrip: false });
  // The frame's end (minor) flaps are as visible as the side ones.
  return draft(c, { faces: deepEnds(c, ["top"], 1) });
};

/**
 * 0214: an RSC with a perforated tear line round all four walls at the tray height h < H:
 * tearing the top off leaves an open display tray.
 */
const s0214: Fefco02Generator = (d, t, f, p = {}) => {
  const c = tube("FEFCO_0214", d, t);
  rscEnd(c, "top");
  rscEnd(c, "bottom");
  const h = clamp(p.trayHeightMm ?? defaultParams("FEFCO_0214", d).trayHeightMm!, 10, d.H - 5);
  const y = c.Hp - 2 * t - h; // sheet y of the tear line (bottom crease at y = Hp)
  for (const w of Object.values(c.walls)) c.b.perfLines.push({ a: pt(w.x + 1, y), b: pt(w.x + w.width - 1, y) });
  slottedFeatures(c, d, { ...f, tearStrip: false });
  return draft(c);
};

/**
 * 0226 pinch-folding top: all flaps on one row; the B-panel flaps carry reverse creases from
 * the flap corners to the centre of the free edge. At the top the L flaps lean in at the bevel
 * angle and meet in a ridge; each B flap's centre triangle leans in at the same angle and
 * closes the hip end while its two side triangles pinch in behind it. At the bottom the same
 * flaps fold flat and the box closes like a 0201.
 */
const s0226: Fefco02Generator = (d, t, f, p = {}) => {
  const c = tube("FEFCO_0226", d, t);
  const bevel = clamp(p.bevelFoldDeg ?? 60, 20, 90);
  for (const end of ["top", "bottom"] as const) {
    const fold = end === "top" ? bevel : 90;
    const lean = Math.sin((fold * Math.PI) / 180);
    // L flaps reach the ridge (centre line) at this lean; the hip triangles reach as far in.
    const major = Math.min((meetMajor(c) - t) / lean, c.Wp);
    const dep = Math.min(major, meetMinor(c) / lean);
    for (const side of ["left", "right"] as const) {
      const hinge = endHinge(c, c.walls[side], end);
      const fr = c.b.frame(side, hinge);
      const apex = fr.at(fr.a, fr.length / 2, dep);
      const centreId = `${end}Flap_${side}`;
      c.b.attachPoly(centreId, "flap", side, hinge, [fr.a, fr.b, apex], { fold, stage: 1, stack: -1, label: "Gusset flap" });
      // Folded back under the centre triangle: pivot below the stacked centre so the three
      // layers lie one caliper apart instead of inside each other.
      c.b.attachPoly(`${centreId}_ga`, "flap", centreId, [fr.a, apex], [fr.a, apex, fr.at(fr.a, 0, dep)], { fold: 180, pivotDepth: 1.5, stage: 2, label: "Gusset" });
      c.b.attachPoly(`${centreId}_gb`, "flap", centreId, [apex, fr.b], [apex, fr.b, fr.at(fr.a, fr.length, dep)], { fold: 180, pivotDepth: 2.5, stage: 2, label: "Gusset" });
    }
    flap(c, "front", end, end === "top" ? major : meetMajor(c), { fold, stage: 2 });
    flap(c, "back", end, end === "top" ? major : meetMajor(c), { fold, stage: 2 });
  }
  slottedFeatures(c, d, { ...f, tearStrip: false });
  return draft(c, {
    // The roof has no flat top: each wall face runs on over the flap leaning in above it.
    faces: (panels, computed) => {
      const { top: _top, ...rest } = computed;
      void _top;
      const out = { ...rest };
      for (const w of ["front", "back", "left", "right"] as const) {
        const face = stripFace(w, panels, [w, `topFlap_${w}`]);
        if (face) out[w] = face;
      }
      return out;
    },
  });
};

/* ───────────── 0210, 0211, 0212, 0215, 0216, 0227: tuck lids and snap-lock bottoms ───────────── */

/** 0210: tuck lids at both ends on the same L panel; dust flaps on the B panels. */
const s0210: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0210", d, t);
  tuckLidEnd(c, "top", "back");
  tuckLidEnd(c, "bottom", "back");
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  return draft(c);
};

/** 0211: tuck lids on opposite L panels (top on the back, bottom on the front). */
const s0211: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0211", d, t);
  tuckLidEnd(c, "top", "back");
  tuckLidEnd(c, "bottom", "front");
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  return draft(c);
};

/** 0212: tuck lid top with dust flaps, 0201 bottom. */
const s0212: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0212", d, t);
  tuckLidEnd(c, "top", "back");
  rscEnd(c, "bottom");
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  return draft(c);
};

/** 0215: tuck lid top with dust flaps, 1-2-3 snap-lock bottom. */
const s0215: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0215", d, t);
  tuckLidEnd(c, "top", "back");
  snapLockBottom(c);
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  return draft(c, { faces: deepEnds(c, ["bottom"], 2) });
};

/** 0216: top flaps as 0201, 1-2-3 snap-lock bottom (top can be closed automatically). */
const s0216: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0216", d, t);
  rscEnd(c, "top");
  snapLockBottom(c);
  slottedFeatures(c, d, f);
  // All three snap-lock flaps show on the underside.
  return draft(c, { faces: deepEnds(c, ["bottom"], 2) });
};

/**
 * 0227: tall box. At each end the front (L) flap is a full-width inner flap, the B panels
 * carry dust flaps, and the back (L) flap is the outer lid with chamfered corners and a
 * thumb notch.
 */
const s0227: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0227", d, t);
  for (const end of ["top", "bottom"] as const) {
    const dust = Math.min(c.Wp * 0.75, meetMinor(c));
    flap(c, "left", end, dust, { role: "dust", stage: 1, stack: -2, label: "Dust flap" });
    flap(c, "right", end, dust, { role: "dust", stage: 1, stack: -2, label: "Dust flap" });
    flap(c, "front", end, fullMajor(c), { stage: 2, stack: -1, label: "Inner flap" });
    const hinge = endHinge(c, c.walls.back, end);
    const fr = c.b.frame("back", hinge);
    const L = fr.length;
    const D = fullMajor(c);
    const ch = Math.min(15, D * 0.2, L * 0.1);
    const poly: Polygon = [fr.at(fr.a, 0, 0), fr.at(fr.a, L, 0), fr.at(fr.a, L, D - ch), fr.at(fr.a, L - ch, D), fr.at(fr.a, ch, D), fr.at(fr.a, 0, D - ch)];
    const lid = c.b.attachPoly(`${end}Lid`, end === "top" ? "top" : "bottom", "back", hinge, poly, { stage: 3, stack: 0, label: "Lid flap" });
    notchPanel(lid, [fr.at(fr.a, L - ch, D), fr.at(fr.a, ch, D)], Math.min(12, L * 0.08));
  }
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  // The inner flap shows at the lid's chamfered corners and through the thumb notch.
  return draft(c, { faces: deepEnds(c, ["top", "bottom"], 1) });
};

/* ───────────── 0217, 0218: carry and locking styles ───────────── */

/**
 * 0217: gable carry box. The L-panel top flaps are sloping roof panels topped by handle
 * panels with hand holes that meet back to back; the B-panel top flaps are gable triangles;
 * 1-2-3 snap-lock bottom.
 */
const s0217: Fefco02Generator = (d, t) => {
  const c = tube("FEFCO_0217", d, t);
  snapLockBottom(c);
  const run = c.Wp / 2 - t;
  const rise = clamp(c.Wp * 0.35, 15, 80);
  const roofLen = Math.hypot(run, rise);
  const roofAngle = (Math.atan2(run, rise) * 180) / Math.PI;
  const handleH = clamp(c.Wp * 0.3, 30, 70);
  for (const w of ["front", "back"] as const) {
    const roof = flap(c, w, "top", roofLen, { id: `roof_${w}`, role: "top", fold: roofAngle, stage: 2, stack: 0, label: "Roof", insetA: c.slot / 2, insetB: c.slot / 2 });
    const r = c.walls[w];
    const hr: Rect = rect(r.x + c.slot / 2, r.y - roofLen - handleH, r.width - c.slot, handleH);
    const holes = [stadium(hr.x + hr.width / 2, hr.y + handleH * 0.45, Math.min(100, hr.width * 0.5), Math.min(30, handleH * 0.4))];
    c.b.attach(`handle_${w}`, "top", roof.panel.id, roof.far, handleH, { kind: "rect" }, { fold: -roofAngle, stage: 2, label: "Handle", holes });
  }
  for (const w of ["left", "right"] as const) {
    const hinge = endHinge(c, c.walls[w], "top");
    const fr = c.b.frame(w, hinge);
    c.b.attachPoly(`gable_${w}`, "flap", w, hinge, [fr.a, fr.b, fr.at(fr.a, fr.length / 2, rise)], { fold: 0, stage: 1, label: "Gable end" });
  }
  return draft(c, {
    faces: composeFaces(deepEnds(c, ["bottom"], 2), (panels, computed) => {
      // No flat top: the front and back faces run on over the roof and the handle (the sheet
      // strip above each L wall), the end faces include the gable triangles.
      const { top: _top, ...rest } = computed;
      void _top;
      const front = stripFace("front", panels, ["front", "roof_front", "handle_front"]);
      const back = stripFace("back", panels, ["back", "roof_back", "handle_back"]);
      return { ...rest, ...(front ? { front } : {}), ...(back ? { back } : {}) };
    }),
  });
};

/**
 * 0218: all flaps B (full overlap). The outer top flap is a tapered locking tongue whose
 * corners enter two slits in the inner top flap.
 */
const s0218: Fefco02Generator = (d, t, f) => {
  const c = tube("FEFCO_0218", d, t);
  const major = fullMajor(c);
  const minor = Math.min(major, meetMinor(c));
  slottedEnd(c, "bottom", major, minor, { overlap: true });
  flap(c, "left", "top", minor, { stack: -2 });
  flap(c, "right", "top", minor, { stack: -2 });
  const L = c.Lp - c.slot;
  const taper = Math.min(L * 0.15, 60);
  const tongue = flap(c, "front", "top", major, { shape: { kind: "trapezoid", taperA: taper, taperB: taper }, stage: 3, stack: 0, label: "Locking tongue flap" });
  void tongue;
  const inner = flap(c, "back", "top", major, { stage: 2, stack: -1, label: "Inner flap with lock slits" });
  // Slits sit under the tongue's corners: tongue tip is at depth `major` from the front,
  // i.e. close to the back wall, on the inner flap near its hinge.
  const bb = inner.panel.bbox;
  const y = bb.y + bb.height - Math.min(20, bb.height * 0.15);
  const sw = Math.min(30, bb.width * 0.1);
  inner.panel.holes = [slit(bb.x + taper + sw / 2, y, sw), slit(bb.x + bb.width - taper - sw / 2, y, sw)];
  slottedFeatures(c, d, { ...f, tearStrip: false });
  // The inner flap shows beside the tapered tongue.
  return draft(c, { faces: deepEnds(c, ["top", "bottom"], 1) });
};

/* ───────────── 0225, 0228, 0230, 0231: special layouts ───────────── */

/**
 * 0225: B | L | B | L | joint. Top flaps as 0201. Bottom: the back L-panel flap (B deep,
 * thumb notch) is the base; the front L-panel flap (h ≤ H) folds up inside the front wall
 * as a liner and its wings line the end walls.
 */
const s0225: Fefco02Generator = (d, t, f, p = {}) => {
  const l = END_LAYERS.FEFCO_0225;
  const Lp = d.L + 4 * t; // end walls + liner wings
  const Wp = d.W + 3 * t; // front, back + liner
  const Hp = d.H + (l.top + l.bottom) * t;
  const b = new DielineBuilder();
  const j = jointWidth(Hp);
  const walls: Walls = {
    left: rect(0, 0, Wp, Hp),
    front: rect(Wp, 0, Lp, Hp),
    right: rect(Wp + Lp, 0, Wp, Hp),
    back: rect(2 * Wp + Lp, 0, Lp, Hp),
  };
  b.root("front", "front", rectPolygon(walls.front.x, 0, Lp, Hp), "Front");
  b.attach("left", "left", "front", rectEdges(walls.front).left, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
  b.attach("right", "right", "front", rectEdges(walls.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach("back", "back", "right", rectEdges(walls.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("glue", "glue", "back", insetSeg(rectEdges(walls.back).right, 2 * t + 1), j, { kind: "trapezoid", taperA: Math.max(j * 0.25, 3 * t), taperB: Math.max(j * 0.25, 3 * t) }, { stage: 0, stack: -1, label: "Manufacturer's joint" });
  const c: Ctx = { b, t, Lp, Wp, Hp, slot: slotWidth(t), walls, wallIds: { front: "front", right: "right", back: "back", left: "left" } };
  rscEnd(c, "top");

  // Erection order: the wings are pre-folded square to the liner (stage 1), the liner swings
  // up inside the front (stage 2), then the base closes under them (stage 3): nothing sweeps
  // through a wall or the base.
  const base = flap(c, "back", "bottom", Wp - 2 * t, { id: "base", role: "bottom", stage: 3, stack: 0, label: "Base" });
  notchPanel(base.panel, base.far, Math.min(12, Lp * 0.06));
  const h = clamp(p.linerHeightMm ?? defaultParams("FEFCO_0225", d).linerHeightMm!, 15, d.H);
  // The left wing lines the left wall over the manufacturer's joint (glued inside that wall),
  // so the liner stops one more caliper short on that side: wing, joint and wall never share space.
  const insetL = 3 * t;
  const insetR = 2 * t;
  flap(c, "front", "bottom", h, { id: "liner", role: "inner", fold: 180, pivotDepth: 1, stage: 2, stack: 0, insetA: insetL, insetB: insetR, label: "Inner front liner" });
  const lr = rect(walls.front.x + insetL, Hp, Lp - insetL - insetR, h);
  const wing = Wp - 3 * t - 1;
  b.attach("wingL", "inner", "liner", insetSeg(rectEdges(lr).left, 0.5), wing, { kind: "rect" }, { fold: -90, stage: 1, label: "End liner wing" });
  b.attach("wingR", "inner", "liner", insetSeg(rectEdges(lr).right, 0.5), wing, { kind: "rect" }, { fold: -90, stage: 1, label: "End liner wing" });
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  return draft(c);
};

/**
 * Split wall layouts (0228, 0230, 0231): the joint is made by overlapping two half panels
 * by `o` instead of a separate joint flap. The outer half is drawn one board layer out; the
 * inner half's flaps are shortened by `o` at the seam so the flaps never double up.
 */
interface SplitOut {
  c: Ctx;
  outerId: string;
  innerId: string;
}

/** 0230 (split L wall) / 0228 (split L wall + centre partition): l1 | B | L | B | l2. */
function splitLength(code: "FEFCO_0228" | "FEFCO_0230", d: Dims, t: number, o: number): SplitOut {
  const l = END_LAYERS[code];
  const { Lp, Wp, Hp } = sizes(d, t, l.top, l.bottom);
  const l1 = Lp / 2;
  const l2 = Lp / 2 + o;
  const b = new DielineBuilder();
  const walls: Walls = {
    back: rect(0, 0, l1, Hp), // inner half (l1); outer half recorded separately
    left: rect(l1, 0, Wp, Hp),
    front: rect(l1 + Wp, 0, Lp, Hp),
    right: rect(l1 + Wp + Lp, 0, Wp, Hp),
  };
  const outer = rect(l1 + 2 * Wp + Lp, 0, l2, Hp);
  b.root("front", "front", rectPolygon(walls.front.x, 0, Lp, Hp), "Front");
  b.attach("left", "left", "front", rectEdges(walls.front).left, Wp, { kind: "rect" }, { stage: 0, label: "Left side" });
  b.attach("right", "right", "front", rectEdges(walls.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach("backA", "back", "left", rectEdges(walls.left).left, l1, { kind: "rect" }, { stage: 0, label: "Back (inner half)" });
  b.attach("backB", "back", "right", rectEdges(walls.right).right, l2, { kind: "rect" }, { stage: 0, stack: 1, label: "Back (outer half, overlaps by o)" });
  const c: Ctx = { b, t, Lp, Wp, Hp, slot: slotWidth(t), walls, wallIds: { front: "front", right: "right", back: "backA", left: "left" } };
  for (const end of ["top", "bottom"] as const) {
    const major = meetMajor(c);
    const minor = Math.min(major, meetMinor(c));
    flap(c, "left", end, minor);
    flap(c, "right", end, minor);
    flap(c, "front", end, major);
    // Inner half: seam at its left edge (a-end of top/bottom edges).
    flap(c, "back", end, major, { id: `${end}Flap_backA`, parentId: "backA", wallRect: walls.back });
    // Outer half: seam at its right edge (b-end); flap shortened by o there.
    flap(c, "back", end, major, { id: `${end}Flap_backB`, parentId: "backB", wallRect: outer, insetA: c.slot / 2, insetB: o + c.slot / 2 });
  }
  return { c, outerId: "backB", innerId: "backA" };
}

/** 0230: joint in the length panel, made by overlapping l1 + l2 = L + o. */
const s0230: Fefco02Generator = (d, t, f, p = {}) => {
  const o = p.overlapMm ?? defaultParams("FEFCO_0230", d).overlapMm!;
  const { c } = splitLength("FEFCO_0230", d, t, o);
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  return draft(c, { faceDepthTol: t + 0.5 });
};

/**
 * 0228: as 0230 (½L + ½L + o) with a B × H panel on the free edge of the inner half that
 * folds into the box as an integral centre partition.
 */
const s0228: Fefco02Generator = (d, t, f, p = {}) => {
  const o = p.overlapMm ?? defaultParams("FEFCO_0228", d).overlapMm!;
  const { c } = splitLength("FEFCO_0228", d, t, o);
  const edge = rectEdges(c.walls.back).left;
  c.b.attach("partition", "inner", "backA", insetSeg(edge, 2 * t + 1), c.Wp - 2 * t - 1, { kind: "rect" }, { stage: 1, label: "Centre partition" });
  if (f.handle) handHoles(c, Math.max(25, d.H * 0.1));
  return draft(c, { faceDepthTol: t + 0.5 });
};

/** 0231: joint in the breadth panel, b1 | L | B | L | b2 with b1 + b2 = B + o. */
const s0231: Fefco02Generator = (d, t, f, p = {}) => {
  const o = p.overlapMm ?? defaultParams("FEFCO_0231", d).overlapMm!;
  const l = END_LAYERS.FEFCO_0231;
  const { Lp, Wp, Hp } = sizes(d, t, l.top, l.bottom);
  const b1 = Wp / 2;
  const b2 = Wp / 2 + o;
  const b = new DielineBuilder();
  const walls: Walls = {
    left: rect(0, 0, b1, Hp), // inner half
    front: rect(b1, 0, Lp, Hp),
    right: rect(b1 + Lp, 0, Wp, Hp),
    back: rect(b1 + Lp + Wp, 0, Lp, Hp),
  };
  const outer = rect(b1 + 2 * Lp + Wp, 0, b2, Hp);
  b.root("front", "front", rectPolygon(walls.front.x, 0, Lp, Hp), "Front");
  b.attach("leftA", "left", "front", rectEdges(walls.front).left, b1, { kind: "rect" }, { stage: 0, label: "Left side (inner half)" });
  b.attach("right", "right", "front", rectEdges(walls.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side" });
  b.attach("back", "back", "right", rectEdges(walls.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back" });
  b.attach("leftB", "left", "back", rectEdges(walls.back).right, b2, { kind: "rect" }, { stage: 0, stack: 1, label: "Left side (outer half, overlaps by o)" });
  const c: Ctx = { b, t, Lp, Wp, Hp, slot: slotWidth(t), walls, wallIds: { front: "front", right: "right", back: "back", left: "leftA" } };
  for (const end of ["top", "bottom"] as const) {
    const major = meetMajor(c);
    const minor = Math.min(major, meetMinor(c));
    flap(c, "left", end, minor, { id: `${end}Flap_leftA`, wallRect: walls.left });
    flap(c, "left", end, minor, { id: `${end}Flap_leftB`, parentId: "leftB", wallRect: outer, insetA: c.slot / 2, insetB: o + c.slot / 2 });
    flap(c, "right", end, minor);
    flap(c, "front", end, major);
    flap(c, "back", end, major);
  }
  if (f.handle) {
    // Hand hole only in the full B wall and the outer half (the seam would cut the inner one).
    handHoles({ ...c, walls: { ...c.walls, left: outer }, wallIds: { ...c.wallIds, left: "leftB" } }, Math.max(25, d.H * 0.1));
  }
  return draft(c, { faceDepthTol: t + 0.5 });
};

export const GENERATORS: Record<Fefco02Code, Fefco02Generator> = {
  FEFCO_0200: s0200,
  FEFCO_0201: s0201,
  FEFCO_0202: s0202,
  FEFCO_0203: s0203,
  FEFCO_0204: s0204,
  FEFCO_0205: s0205,
  FEFCO_0206: s0206,
  FEFCO_0207: s0207,
  FEFCO_0208: s0208,
  FEFCO_0209: s0209,
  FEFCO_0210: s0210,
  FEFCO_0211: s0211,
  FEFCO_0212: s0212,
  FEFCO_0214: s0214,
  FEFCO_0215: s0215,
  FEFCO_0216: s0216,
  FEFCO_0217: s0217,
  FEFCO_0218: s0218,
  FEFCO_0225: s0225,
  FEFCO_0226: s0226,
  FEFCO_0227: s0227,
  FEFCO_0228: s0228,
  FEFCO_0229: s0229,
  FEFCO_0230: s0230,
  FEFCO_0231: s0231,
};

export type { Pt };
