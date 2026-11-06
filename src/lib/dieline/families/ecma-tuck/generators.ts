import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import type { Dims, StructureFeatures } from "@/types";
import { DielineBuilder, rectEdges } from "../../builder";
import { computeFaces, panelPivot } from "../../fold";
import { cutWindow, notchPanel, tearBand } from "../../features";
import { bboxOf, clamp, pt, rectPolygon } from "../../geometry";
import type { Rect } from "../../types";
import {
  crashLockBottom,
  glueWidth,
  hangHoleHeight,
  hangHolePolygon,
  hangHoleWidth,
  rect,
  sealEnd,
  snapLockBottom,
  tube,
  tuckClosure,
  type Walls,
} from "./closures";
import type { EcmaTuckDraft, EcmaTuckOptions, ReservedZone } from "./types";

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

/** Window + thumb notch shared by the tube cartons. `notchWall` = wall the top tuck enters. */
function applyFeatures(b: DielineBuilder, w: Walls, f: StructureFeatures, notchWall: "front" | "back" | null) {
  if (f.window) cutWindow(b, f.window.face === "back" ? "back" : "front", f.window);
  if (f.thumbNotch && notchWall) notchPanel(b.byId(notchWall), rectEdges(w[notchWall]).top, Math.min(12, w[notchWall].width * 0.18));
}

/* ───────────────────────── A20.20: tuck both ends ───────────────────────── */

export type TuckOwners = { top: "front" | "back"; bottom: "front" | "back" };

/**
 * Tuck end carton (ECMA A20.20.xx.yy). `owners` says which wall carries each closure panel:
 *   STE  A20.20.03.03  top back,  bottom back   (clean front, tucks enter at the front)
 *   RTE  A20.20.03.01  top back,  bottom front
 *   AIR  A20.20.01.01  top front, bottom front  (tucks enter at the back)
 *   FRTE A20.20.01.03  top front, bottom back   (inverted / French reverse tuck)
 * Two layers at each end, so the height panel is H + 4t.
 */
export function tuckEnd(owners: TuckOwners, extra: { innerW?: number } = {}) {
  return (dims: Dims, t: number, f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft => {
    const inner: Dims = { L: dims.L, W: dims.W + (extra.innerW ?? 0), H: dims.H };
    const Lp = inner.L + 2 * t;
    const Wp = inner.W + 2 * t;
    const Hp = inner.H + 4 * t;
    const b = new DielineBuilder();
    const w = tube(b, Lp, Wp, Hp, glueWidth(inner.W, o.glueFlapMm));
    tuckClosure(b, w, "top", owners.top, t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock });
    tuckClosure(b, w, "bottom", owners.bottom, t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock });
    applyFeatures(b, w, f, owners.top === "back" ? "front" : "back");
    return { builder: b, closedRotation: IDENTITY, inner };
  };
}

export const straightTuck = tuckEnd({ top: "back", bottom: "back" });
export const reverseTuck = tuckEnd({ top: "back", bottom: "front" });
export const airplaneTuck = tuckEnd({ top: "front", bottom: "front" });
export const frenchReverseTuck = tuckEnd({ top: "front", bottom: "back" });

/* ───────────────────────── Tuck top, lock bottoms ───────────────────────── */

/** Tuck top on the back + 1-2-3 snap-lock bottom (ECMA A55.20.01.03). 2 + 3 layers. */
export function snapLockTuck(dims: Dims, t: number, f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 5 * t;
  const b = new DielineBuilder();
  const w = tube(b, Lp, Wp, Hp, glueWidth(dims.W, o.glueFlapMm));
  tuckClosure(b, w, "top", "back", t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock });
  snapLockBottom(b, w, t, Wp, Lp);
  applyFeatures(b, w, f, "front");
  return {
    builder: b,
    closedRotation: IDENTITY,
    inner: { ...dims },
    // The slot flap (2) lies one caliper inside the lock flap (3) but most of it shows on the
    // underside around the lock flap; the automatic face skips inner-stacked panels, which
    // left half the bottom unprinted (R5-3Q-D-03). Map it with the same face frame: the
    // stack offset only moves it along the face normal, so its u / v mapping is unchanged.
    faces: (panels, computed) => {
      const lifted = panels.map((p) => (p.id === "bottom_front" ? { ...p, stackOffset: 0 } : p));
      const part = computeFaces({ panels: lifted, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY }).faces.bottom?.parts.find((x) => x.panelId === "bottom_front");
      if (!computed.bottom || !part) return computed;
      return { ...computed, bottom: { ...computed.bottom, parts: [part, ...computed.bottom.parts] } };
    },
  };
}

/** Tuck top on the back + crash-lock (auto) bottom (ECMA A60.20.00.03). 2 + 3 layers. */
export function crashLockTuck(dims: Dims, t: number, f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 5 * t;
  const b = new DielineBuilder();
  const w = tube(b, Lp, Wp, Hp, glueWidth(dims.W, o.glueFlapMm));
  tuckClosure(b, w, "top", "back", t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock });
  crashLockBottom(b, w, t, Wp, Lp);
  applyFeatures(b, w, f, "front");
  return { builder: b, closedRotation: IDENTITY, inner: { ...dims } };
}

/* ───────────────────────── A10.10: seal end (glued both ends) ───────────────────────── */

/**
 * Seal end carton, ECMA A10.10.01.01 (full overlapping closure both ends, glued on the
 * packing line). Three layers at each end (minor + inner major + outer major): H + 6t.
 * With `tear`, a perforated tear band runs round the four walls below the top end.
 */
export function sealEndCarton(tear: boolean) {
  return (dims: Dims, t: number, f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft => {
    const Lp = dims.L + 2 * t;
    const Wp = dims.W + 2 * t;
    const Hp = dims.H + 6 * t;
    const b = new DielineBuilder();
    const w = tube(b, Lp, Wp, Hp, glueWidth(dims.W, o.glueFlapMm));
    sealEnd(b, w, "top", t, Lp, Wp);
    sealEnd(b, w, "bottom", t, Lp, Wp);
    if (f.window) cutWindow(b, f.window.face === "back" ? "back" : "front", f.window);
    if (tear || f.tearStrip) {
      const fromTop = clamp(dims.H * 0.15, 10, 30);
      tearBand(b, ["front", "right", "back", "left"], fromTop, 6);
      // The strip also runs over the glue flap so it tears through the seam.
      const g = b.byId("glue").bbox;
      const y = w.front.y + Math.min(fromTop, Hp * 0.6);
      for (const yy of [y, y + 6]) b.perfLines.push({ a: { x: g.x + 1, y: yy }, b: { x: g.x + g.width, y: yy } });
    }
    return { builder: b, closedRotation: IDENTITY, inner: { ...dims } };
  };
}

/* ───────────────────────── A20.21: hanger tab ───────────────────────── */

/**
 * Tuck end with an extended back panel (hang tab), ECMA A20.21.03.03. The back wall runs on
 * past the top crease as a header; a tag tuck folds 180° behind it so the hang tab is two
 * layers thick, and the hang hole is cut through both layers in register. The top closure is
 * hinged on the front (its tuck enters the back below the header); the bottom tuck is on the back.
 */
export function hangerTuck(defaultHole: "euro" | "round") {
  return (dims: Dims, t: number, f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft => {
    const Lp = dims.L + 2 * t;
    const Wp = dims.W + 2 * t;
    const Hp = dims.H + 4 * t;
    const kind = o.hangHole ?? defaultHole;
    const holeH = hangHoleHeight(kind);
    const headerH = clamp(o.headerHeightMm ?? 30, holeH + 12, 80);
    const b = new DielineBuilder();
    const w = tube(b, Lp, Wp, Hp, glueWidth(dims.W, o.glueFlapMm));
    tuckClosure(b, w, "top", "front", t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock });
    tuckClosure(b, w, "bottom", "back", t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock });

    const back = w.back;
    // Header: continuous board above the back panel (virtual "roll" hinge: no crease, no cut).
    b.attach("header", "back", "back", rectEdges(back).top, headerH, { kind: "rect" }, { fold: 0, stage: 0, label: "Hang tab", hingeKind: "roll" });
    const header: Rect = rect(back.x, back.y - headerH, Lp, headerH);
    const tagH = headerH - 1; // stops 1 mm short of the lid
    b.attach("headerTag", "inner", "header", rectEdges(header).top, tagH, { kind: "rect" }, { fold: 180, stage: 1, label: "Hang tab doubler" });
    const scale = Math.min(1, (Lp - 8) / hangHoleWidth(kind));
    const cx = back.x + Lp / 2;
    const margin = clamp((headerH - holeH * scale) * 0.35, 4, 10);
    const hp = b.byId("header");
    hp.holes = [...(hp.holes ?? []), hangHolePolygon(kind, cx, header.y + margin, scale)];
    const tp = b.byId("headerTag");
    tp.holes = [...(tp.holes ?? []), hangHolePolygon(kind, cx, header.y - margin, scale, true)];
    applyFeatures(b, w, f, null);
    return {
      builder: b,
      closedRotation: IDENTITY,
      inner: { ...dims },
      // The hang tab is the highest point, so the automatic top face would be empty: detect
      // the top (closure panel) on the box without the tab.
      faces: (panels, computed) => {
        const body = panels.filter((p) => p.id !== "header" && p.id !== "headerTag");
        const top = computeFaces({ panels: body, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY }).faces.top;
        // The doubler is the FRONT of the hang tab (seen above the lid on the shelf), but it
        // sits a box depth behind the front plane: pick its part up with a deep face search
        // (same face frame and origin) so the front artwork runs up onto the tab.
        const deep = computeFaces({ panels, rootId: b.rootId, thicknessMm: t, closedRotation: IDENTITY }, Wp + 4 * t).faces.front;
        const tab = deep?.parts.find((x) => x.panelId === "headerTag");
        const front = computed.front && tab ? { ...computed.front, parts: [...computed.front.parts, tab] } : computed.front;
        return { ...computed, ...(front ? { front } : {}), ...(top ? { top } : {}) };
      },
    };
  };
}

/* ───────────────────────── Pharma ───────────────────────── */

/**
 * Pharma reverse tuck (A20.20.03.01) with a patient-leaflet allowance on the depth, slit-lock
 * tucks by default and an ink-free variable-data zone (batch, mfg / expiry, price) on the
 * right side panel for inkjet or embossing on the packing line.
 */
export function pharmaTuck(dims: Dims, t: number, f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft {
  const leaflet = clamp(o.leafletThicknessMm ?? 3, 0, 15);
  const draft = tuckEnd({ top: "back", bottom: "front" }, { innerW: leaflet })(dims, t, f, { ...o, tuckLock: o.tuckLock ?? "slit" });
  return {
    ...draft,
    reserved: (panels) => {
      const right = panels.find((p) => p.id === "right");
      if (!right) return [];
      const r = right.bbox;
      const width = Math.min(r.width - 6, 40);
      const height = Math.min(18, r.height * 0.2);
      const zone: ReservedZone = {
        panelId: "right",
        rect: { x: r.x + (r.width - width) / 2, y: r.y + r.height - height - 6, width, height },
        purpose: "variable-data",
        label: { ar: "منطقة بيانات التشغيلة وتاريخ الانتهاء", en: "Batch and expiry coding area" },
      };
      return width > 10 && height > 5 ? [zone] : [];
    },
  };
}

/* ───────────────────────── Double wall ───────────────────────── */

/**
 * Reverse tuck with doubled front and back walls: an inner wall folds 180° from the free
 * (non-closure) edge of each long wall. Top closure on the back, bottom closure on the front;
 * the front's inner wall hangs from its top edge, the back's rises from its bottom edge.
 * Each long wall is two layers (the back's inner wall also clears the glue flap), so the side
 * panels are W + 5t deep.
 */
export function doubleWallTuck(dims: Dims, t: number, f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft {
  const Lp = dims.L + 2 * t;
  // Front = 2 layers, back = 3 (wall, glue flap gap, inner wall): W + 5t crease to crease.
  const Wp = dims.W + 5 * t;
  const Hp = dims.H + 4 * t;
  const b = new DielineBuilder();
  const w = tube(b, Lp, Wp, Hp, glueWidth(dims.W, o.glueFlapMm));
  // Layers inside each long wall, outside → in: front = wall | inner wall | top tuck;
  // back = wall | glue flap | inner wall | bottom tuck.
  tuckClosure(b, w, "top", "back", t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock, tuckStack: -2 });
  tuckClosure(b, w, "bottom", "front", t, Lp, Wp, Hp, { tuckDepthMm: o.tuckDepthMm, lock: o.tuckLock, tuckStack: -3 });
  const innerH = Hp - 2 * t - 1; // clears the closure + dust layers at the far end
  const innerL = Lp - 2 * t - 0.5; // fits between the side walls
  const inset = (Lp - innerL) / 2;
  for (const [id, edge] of [["front", rectEdges(w.front).top], ["back", rectEdges(w.back).bottom]] as const) {
    const fr = b.frame(id, edge);
    const poly = [fr.at(fr.a, 0, 0), fr.at(fr.a, fr.length, 0), fr.at(fr.a, fr.length - inset, innerH), fr.at(fr.a, inset, innerH)];
    // 180° roll about a pivot p·t deep leaves a (2p − 2)·t gap: the back's inner wall clears the glue flap.
    b.attachPoly(`${id}Inner`, "inner", id, [fr.a, fr.b], poly, { fold: 180, pivotDepth: id === "back" ? 1.5 : 1, stage: 0, label: "Inner wall" });
  }
  return { builder: b, closedRotation: IDENTITY, inner: { ...dims } };
}

/* ───────────────────────── Hinged lid (flip-top) ───────────────────────── */

/**
 * Hinged-lid (flip-top) pack, generic: a glued shell whose lid is cut free of the body on the
 * front and sides and stays hinged on a crease across the back, plus a separate inner frame
 * (collar) glued inside the body front that stands above the body edge and holds the lid shut
 * by friction. Ends are glued (top panel + lip, bottom panel + lip, dust flaps).
 *
 * Shell layout: glue | left | front | right | back, each column split into a lid row (height
 * `lidH`) above a body row. Front body = root.
 */
export function flipTop(dims: Dims, t: number, _f: StructureFeatures, o: EcmaTuckOptions): EcmaTuckDraft {
  const Lp = dims.L + 2 * t;
  const Wp = dims.W + 2 * t;
  const Hp = dims.H + 4 * t;
  const lidH = clamp(o.lidHeightMm ?? clamp(dims.H * 0.25, 15, 40), 10, Hp * 0.45);
  const bodyH = Hp - lidH;
  const g = glueWidth(dims.W, o.glueFlapMm);
  const b = new DielineBuilder();
  const xL = g;
  const xF = xL + Wp;
  const xR = xF + Lp;
  const xB = xR + Wp;
  const body: Walls = { left: rect(xL, lidH, Wp, bodyH), front: rect(xF, lidH, Lp, bodyH), right: rect(xR, lidH, Wp, bodyH), back: rect(xB, lidH, Lp, bodyH) };
  // The lid is cut free of the body on the front and sides with a hairline clearance (the
  // knife's kerf plus the opening allowance), so the closed pack shows the lid line.
  const cut = 0.4;
  const lid: Walls = { left: rect(xL, 0, Wp, lidH - cut), front: rect(xF, 0, Lp, lidH - cut), right: rect(xR, 0, Wp, lidH - cut), back: rect(xB, 0, Lp, lidH) };
  const taper = (d: number) => Math.min(d * 0.6, 4);

  b.root("front", "front", rectPolygon(body.front.x, body.front.y, Lp, bodyH), "Front (body)");
  b.attach("left", "left", "front", rectEdges(body.front).left, Wp, { kind: "rect" }, { stage: 0, label: "Left side (body)" });
  b.attach("right", "right", "front", rectEdges(body.front).right, Wp, { kind: "rect" }, { stage: 0, label: "Right side (body)" });
  b.attach("back", "back", "right", rectEdges(body.right).right, Lp, { kind: "rect" }, { stage: 0, label: "Back (body)" });
  b.attach("glue", "glue", "left", rectEdges(body.left).left, g, { kind: "trapezoid", taperA: taper(g), taperB: taper(g) }, { stage: 0, stack: -1, label: "Glue flap" });

  // Lid: hinged on a crease across the back; front and sides are cut free of the body.
  b.attach("lidBack", "back", "back", rectEdges(body.back).top, lidH, { kind: "rect" }, { fold: 0, stage: 0, label: "Lid back (hinge)" });
  b.attach("lidRight", "right", "lidBack", [pt(xB, 0), pt(xB, lidH - cut)], Wp, { kind: "rect" }, { stage: 0, label: "Lid right" });
  b.attach("lidFront", "front", "lidRight", rectEdges(lid.right).left, Lp, { kind: "rect" }, { stage: 0, label: "Lid front" });
  b.attach("lidLeft", "left", "lidFront", rectEdges(lid.front).left, Wp, { kind: "rect" }, { stage: 0, label: "Lid left" });
  const lg = Math.min(g, lidH * 0.8);
  b.attach("lidGlue", "glue", "lidLeft", rectEdges(lid.left).left, lg, { kind: "trapezoid", taperA: taper(lg), taperB: taper(lg) }, { stage: 0, stack: -1, label: "Lid glue flap" });

  // Glued ends: top on the lid back, bottom on the body back, each with a glue lip and dust flaps.
  // The lid's glue lip must stay above the inner frame (collar) that rises into the closed lid.
  const topLip = Math.min(8, lidH * 0.35);
  const lip = (d: number, where: "top" | "bottom") => (where === "top" ? topLip : Math.min(12, d * 0.6));
  const end = (where: "top" | "bottom", owner: string, ownerRect: Rect, sides: [string, Rect][], depthAvail: number) => {
    const edge = where === "top" ? rectEdges(ownerRect).top : rectEdges(ownerRect).bottom;
    b.attach(where, where, owner, edge, Wp, { kind: "rect" }, { stage: 2, label: where === "top" ? "Lid top" : "Bottom" });
    const endR = rect(ownerRect.x, where === "top" ? ownerRect.y - Wp : ownerRect.y + ownerRect.height, Lp, Wp);
    const far = where === "top" ? rectEdges(endR).top : rectEdges(endR).bottom;
    const fr = b.frame(where, far);
    const ld = lip(depthAvail, where);
    const inset = t + 0.5;
    b.attachPoly(`${where}Lip`, "glue", where, [fr.at(fr.a, inset, 0), fr.at(fr.a, fr.length - inset, 0)], [fr.at(fr.a, inset, 0), fr.at(fr.a, fr.length - inset, 0), fr.at(fr.a, fr.length - inset - 2, ld), fr.at(fr.a, inset + 2, ld)], {
      stage: 2,
      stack: -1,
      label: "Glue lip",
    });
    for (const [id, r] of sides) {
      const d = Math.min(Wp * 0.8, Lp * 0.45);
      b.attach(`${where}Dust_${id}`, "dust", id, where === "top" ? rectEdges(r).top : rectEdges(r).bottom, d, { kind: "trapezoid", taperA: d * 0.3, taperB: d * 0.3 }, { stage: 1, stack: -1, label: "Dust flap" });
    }
  };
  end("top", "lidBack", lid.back, [["lidLeft", lid.left], ["lidRight", lid.right]], lidH);
  end("bottom", "back", body.back, [["left", body.left], ["right", body.right]], bodyH);

  // Inner frame (collar): separate blank, U-shaped (front + two part sides), glued inside the
  // body front, standing `rise` mm above the body edge into the lid.
  const rise = Math.max(4, lidH - topLip - 2 * t - 1);
  const overlap = clamp(bodyH * 0.35, 12, 30);
  const cH = rise + overlap;
  const cL = Lp - 2 * t - 0.5;
  const cW = Math.min(Wp * 0.6, Wp - 3 * t);
  const sheet = bboxOf(b.panels.flatMap((p) => p.polygon));
  const cx0 = xF + (Lp - cL) / 2;
  const cy0 = sheet.y + sheet.height + 12;
  const collarFront = rect(cx0, cy0, cL, cH);
  // Closed: collar front against the inside of the body front (z = -t), centred, its top
  // `rise` mm above the body top edge (sheet y = lidH).
  const targetTop = lidH - rise;
  const dxs = xF + Lp / 2 - (cx0 + cL / 2);
  const dys = targetTop - cy0;
  const cb = panelPivot(b.byId("front"), t);
  const matrix = new Matrix4().makeTranslation(dxs - cb.x, -dys - cb.y, -t - cb.z).toArray();
  b.piece("collar", "inner", rectPolygon(collarFront.x, collarFront.y, cL, cH), "Inner frame", { matrix, stage: 3, lift: dims.H * 0.6 }, { label: "Inner frame front" });
  b.attach("collarLeft", "inner", "collar", rectEdges(collarFront).left, cW, { kind: "rect" }, { stage: 3, label: "Inner frame side" });
  b.attach("collarRight", "inner", "collar", rectEdges(collarFront).right, cW, { kind: "rect" }, { stage: 3, label: "Inner frame side" });
  notchPanel(b.byId("collar"), rectEdges(collarFront).top, Math.min(10, cL * 0.15));

  return { builder: b, closedRotation: IDENTITY, inner: { ...dims } };
}
