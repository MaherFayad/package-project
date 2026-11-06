import { Mat4 as Matrix4 } from "@/lib/dieline/math";
import type { Dims, StructureCode, StructureFeatures } from "@/types";
import { edgeBleed, panelCreases } from "../../builder";
import { computeFaces } from "../../fold";
import { bboxOf, edgesOf, insetRect, offsetConvex, polygonArea, segLength, subtractSegments } from "../../geometry";
import type { DielinePanel, DielinePiece, FilmPatch, Polygon, Pt, Segment } from "../../types";
import type { FamilyDielineModel, FamilyDraft } from "./types";

export const DEFAULT_BLEED_MM = 3;

/**
 * Keep a bleed region on its own side of every crease / roll hinge it borders (R6-3Q-E-01).
 * `offsetConvex` meets the neighbours of a short zero-bleed edge far out along that edge's
 * line when they turn by a small angle (a tube cap disc: 32 sides, 11° per side): the region
 * folded back across the hinge and painted the TOP art 1.5 mm into the top of six cap strips,
 * a red wedge down the cap side next to the lid. Each edge with less than the full bleed clips
 * the region to the half-plane its own bleed allows, when the whole panel lies on one side.
 */
export function clipToCreases(region: Polygon, outline: Polygon, edges: Segment[], distances: number[], bleed: number): Polygon {
  let out = region;
  edges.forEach((e, i) => {
    const d = distances[i];
    if (d >= bleed - 1e-9 || out.length < 3) return;
    const dx = e.b.x - e.a.x;
    const dy = e.b.y - e.a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return;
    // Signed distance from the edge line, positive on the panel side.
    const raw = (q: Pt) => (dx * (q.y - e.a.y) - dy * (q.x - e.a.x)) / len;
    const sides = outline.map(raw);
    const sign = sides.reduce((s, v) => s + v, 0) >= 0 ? 1 : -1;
    if (sides.some((v) => v * sign < -1e-6)) return; // panel on both sides: not a clean hinge line
    const f = (q: Pt) => raw(q) * sign + d + 1e-7; // on the line counts as inside
    const next: Pt[] = [];
    for (let k = 0; k < out.length; k++) {
      const a = out[k];
      const b = out[(k + 1) % out.length];
      const fa = f(a);
      const fb = f(b);
      if (fa >= 0) next.push(a);
      if ((fa >= 0) !== (fb >= 0)) {
        const u = fa / (fa - fb);
        next.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
      }
    }
    out = next;
  });
  return out;
}

/**
 * Turn a generator draft into a DielineModel. Mirrors the engine's private `buildDieline`
 * (src/lib/dieline/generate.ts) step for step so the fold engine, faces, texture painter and
 * pricing read these models exactly like the core ones. Differences:
 *  - `virtualEdges` (tube turn-ins, window strip seams) are neither cut nor crease,
 *  - the model carries `catalogCode`; `structureCode` is the closest shared code.
 */
export function assembleDieline(
  catalogCode: string,
  baseCode: StructureCode,
  dims: Dims,
  draft: FamilyDraft,
  o: { thicknessMm: number; bleedMm?: number; safeMm: number; features: StructureFeatures },
): FamilyDielineModel {
  const t = o.thicknessMm;
  const bleed = o.bleedMm ?? DEFAULT_BLEED_MM;
  const safe = o.safeMm;
  const raw = draft.builder.panels;

  const all = bboxOf(raw.flatMap((p) => p.polygon));
  const dx = bleed - all.x;
  const dy = bleed - all.y;
  const mv = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  const mvSeg = (s: Segment) => ({ a: mv(s.a), b: mv(s.b) });
  const unshift = new Matrix4().makeTranslation(-dx, dy, 0);
  const panels: DielinePanel[] = raw.map((p) => {
    const polygon = p.polygon.map(mv);
    const out: DielinePanel = { ...p, polygon, bbox: bboxOf(polygon), hinge: p.hinge ? mvSeg(p.hinge) : null };
    if (p.holes) out.holes = p.holes.map((h) => h.map(mv));
    if (p.assembly) out.assembly = { ...p.assembly, matrix: new Matrix4().fromArray(p.assembly.matrix).multiply(unshift).toArray() };
    return out;
  });
  const byId = new Map(panels.map((p) => [p.id, p]));
  const pieceOf = (p: DielinePanel): string => (p.parentId ? pieceOf(byId.get(p.parentId)!) : p.id);
  for (const p of panels) p.pieceId = pieceOf(p);

  const hinges: Segment[] = panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
  const virtual = (draft.virtualEdges ?? []).map(mvSeg);
  const creaseLines: Segment[] = [
    ...panels.flatMap((p) => (p.hinge && p.hingeKind !== "roll" ? [p.hinge] : [])),
    ...draft.builder.extraCreases.map(mvSeg),
  ];
  const cutLines: Segment[] = [];
  for (const p of panels) {
    for (const e of edgesOf(p.polygon)) {
      for (const piece of subtractSegments(e, [...hinges, ...virtual, ...cutLines])) if (segLength(piece) > 1e-3) cutLines.push(piece);
    }
    for (const h of p.holes ?? []) cutLines.push(...edgesOf(h));
  }
  const perfLines = draft.builder.perfLines.map(mvSeg);
  const films: FilmPatch[] = draft.builder.films.map((f) => ({ panelId: f.panelId, polygon: f.polygon.map(mv) }));

  const bleedRegions = panels
    .filter((p) => p.printable)
    .map((p) => {
      const creases = [...panelCreases(p, panels), ...virtual];
      const edges = edgesOf(p.polygon);
      const distances = edges.map((e) => edgeBleed(e, creases, panels, bleed));
      return { panelId: p.id, polygon: clipToCreases(offsetConvex(p.polygon, distances) as Polygon, p.polygon, edges, distances, bleed) };
    });

  const draftModel = { panels, rootId: draft.builder.rootId, thicknessMm: t, closedRotation: draft.closedRotation };
  const computed = computeFaces(draftModel, draft.faceDepthTol);
  const rawFaces = draft.faces ? draft.faces(panels, computed.faces) : computed.faces;
  // Glue flaps / unprinted parts never carry artwork, even when they lie on a face plane.
  const faces: typeof rawFaces = {};
  for (const [k, info] of Object.entries(rawFaces) as [keyof typeof rawFaces, NonNullable<(typeof rawFaces)[keyof typeof rawFaces]>][]) {
    const parts = info.parts.filter((x) => byId.get(x.panelId)?.printable);
    if (parts.length) faces[k] = { ...info, parts };
  }
  const facePanelIds = new Set(Object.values(faces).flatMap((f) => f!.parts.map((x) => x.panelId)));
  const safeZones = draft.safeZones
    ? draft.safeZones(panels, safe)
    : panels.filter((p) => facePanelIds.has(p.id)).map((p) => ({ panelId: p.id, rect: insetRect(p.bbox, safe) }));

  const printPolys = bleedRegions.map((r) => r.polygon);
  const pieces: DielinePiece[] = panels
    .filter((p) => p.parentId === null)
    .sort((a, b) => (a.id === draftModel.rootId ? -1 : b.id === draftModel.rootId ? 1 : 0))
    .map((root) => ({
      rootId: root.id,
      label: draft.builder.pieceLabels.get(root.id) ?? root.label,
      bounds: bboxOf(panels.filter((p) => p.pieceId === root.id).flatMap((p) => p.polygon)),
    }));
  const blankArea = pieces.length > 1 ? pieces.reduce((s, p) => s + p.bounds.width * p.bounds.height, 0) : all.width * all.height;
  const holeArea = (p: DielinePanel) => (p.holes ?? []).reduce((s, h) => s + polygonArea(h), 0);

  return {
    catalogCode,
    structureCode: baseCode,
    dims: { ...dims },
    thicknessMm: t,
    bleedMm: bleed,
    safeMm: safe,
    sheet: { width: all.width + 2 * bleed, height: all.height + 2 * bleed },
    dieBounds: { x: bleed, y: bleed, width: all.width, height: all.height },
    panels,
    rootId: draft.builder.rootId,
    cutLines,
    creaseLines,
    perfLines,
    pieces,
    films,
    features: o.features,
    bleedRegions,
    safeZones,
    printRegions: { outside: printPolys, inside: printPolys },
    faces,
    closedOuter: computed.closedOuter,
    closedRotation: draft.closedRotation,
    ...(draft.accessories?.length ? { accessories: draft.accessories } : {}),
    metrics: {
      blankWidthMm: all.width,
      blankHeightMm: all.height,
      blankAreaM2: blankArea / 1e6,
      netAreaM2: panels.reduce((s, p) => s + polygonArea(p.polygon) - holeArea(p), 0) / 1e6,
      cutLengthMm: cutLines.reduce((s, l) => s + segLength(l), 0),
      creaseLengthMm: creaseLines.reduce((s, l) => s + segLength(l), 0),
      perfLengthMm: perfLines.reduce((s, l) => s + segLength(l), 0),
      pieceCount: pieces.length,
      filmAreaM2: films.reduce((s, f) => s + polygonArea(f.polygon), 0) / 1e6,
    },
  };
}
