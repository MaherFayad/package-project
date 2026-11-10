import { Mat4 as Matrix4, Vec3 as Vector3 } from "@/lib/dieline/math";
import type { BagHandleChoice, Dims, FaceId, StructureFeatures } from "@/types";
import { BAG_HANDLE_COLORS } from "@/types";
import { DielineBuilder, insetSeg } from "../../builder";
import { notchPanel } from "../../features";
import { FACE_FRAMES, computePoses, panelLocalPoint, panelPivot } from "../../fold";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { StructureDraft } from "../../structures";
import type { Affine, DielineAccessory, DielinePanel, FaceInfo, Polygon } from "../../types";
import { obliqueFace } from "../foodservice/engine";
import { handleAccessories, handleGeometry, isThreaded, turnoverFor, type HandleGeometry } from "./handles";
import type { BagCode, BagPart } from "./types";

/**
 * Paper carrier bag die (sheet mm, printed side up, mouth at the top of the sheet).
 *
 * Columns, left to right: glue seam | gusset half B | gusset half A | FRONT | gusset half A |
 * gusset half B | BACK. Each gusset is two panels hinged on its centre fold, so the closed pose
 * (the OPEN standing bag) creases the gusset slightly inward (`GUSSET_CREASE_DEG`), the way a
 * real bag stands. Above the body: the top turnover (folds 180° inside, holds the handles).
 * Below: the pasted block bottom (gusset triangles, back extension, front extension).
 * Base insert, handle patches and board strips are separate pieces next to the blank.
 *
 * Dims: L = face width, W = gusset, H = finished height (base to mouth), crease to crease.
 */

/** Inward crease of the standing gusset (each half turns by this much). */
export const GUSSET_CREASE_DEG = 8;
/** Glue seam width: 12 to 25 mm on bag machines (scaled with the gusset). */
export const glueSeamFor = (dims: Dims) => clamp(dims.W * 0.18, 12, 22);
/** Bottom extension overlap (block bottom, pasted). */
export const bottomLapFor = (dims: Dims) => clamp(dims.W * 0.15, 10, 20);

export interface BagDraftOptions {
  code: BagCode;
  handle: BagHandleChoice;
  baseInsert: boolean;
}

export interface BagDraft extends StructureDraft {
  accessories: DielineAccessory[];
  turnoverMm: number;
  glueSeamMm: number;
  bottomFlapMm: number;
  handle: HandleGeometry;
  parts: BagPart[];
  /** Sheet bounds of the printed paper blank (without the board / patch pieces). */
  paperBlank: { width: number; height: number };
}

const circle = (cx: number, cy: number, r: number, n = 16): Polygon => Array.from({ length: n }, (_, i) => pt(cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)));

/** Stadium (rounded slot) hole, the die-cut hand hole. */
function stadium(cx: number, cy: number, w: number, h: number, n = 8): Polygon {
  const r = h / 2;
  const out: Polygon = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    out.push(pt(cx + w / 2 - r + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n;
    out.push(pt(cx - w / 2 + r + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return out;
}

export function bagDraft(dims: Dims, t: number, features: StructureFeatures, o: BagDraftOptions): BagDraft {
  const L = dims.L;
  const G = dims.W;
  const H = dims.H;
  const G2 = G / 2;
  const th = (GUSSET_CREASE_DEG * Math.PI) / 180;
  const Gc = G * Math.cos(th);
  const g = glueSeamFor(dims);
  const lap = bottomLapFor(dims);
  const T = turnoverFor(o.handle.kind, dims);
  const hg = handleGeometry(o.handle.kind, dims, T);
  const b = new DielineBuilder();

  const xF = g + G;
  const xR = xF + L;
  const xB = xR + G;
  b.root("front", "front", rectPolygon(xF, 0, L, H), "Front");
  const wall = (id: string, role: "left" | "right" | "back" | "glue", parent: string, x: number, depth: number, fold: number, extra: { stack?: number; label: string }) =>
    b.attach(id, role, parent, [pt(x, 0), pt(x, H)], depth, { kind: "rect" }, { fold, stage: 0, ...extra });
  const A = 90 + GUSSET_CREASE_DEG;
  wall("leftA", "left", "front", xF, G2, A, { label: "Gusset (front half)" });
  wall("leftB", "left", "leftA", xF - G2, G2, -2 * GUSSET_CREASE_DEG, { label: "Gusset (back half)" });
  b.attach("glue", "glue", "leftB", [pt(g, 0), pt(g, H)], g, { kind: "trapezoid", taperA: 2, taperB: 2 }, { fold: A, stage: 0, stack: -1, label: "Side seam" });
  wall("rightA", "right", "front", xR, G2, A, { label: "Gusset (front half)" });
  wall("rightB", "right", "rightA", xR + G2, G2, -2 * GUSSET_CREASE_DEG, { label: "Gusset (back half)" });
  wall("back", "back", "rightB", xB, L, A, { label: "Back" });

  // Block bottom: gusset triangles fold in first, then the back extension, the front one on top.
  const halves: [string, number, "a" | "b"][] = [
    ["leftB", g, "b"],
    ["leftA", xF - G2, "a"],
    ["rightA", xR, "b"],
    ["rightB", xR + G2, "a"],
  ];
  // The halves stand GUSSET_CREASE_DEG off square, so a square flap would poke out past the face:
  // the corner end is tapered by more than tan(crease) of the depth.
  const d = G2 * 0.9;
  const crease = G2;
  const corner = d * 0.22;
  for (const [id, x0, creaseEnd] of halves) {
    b.attach(`${id}Bottom`, "dust", id, [pt(x0, H), pt(x0 + G2, H)], d, { kind: "trapezoid", taperA: creaseEnd === "a" ? crease : corner, taperB: creaseEnd === "b" ? crease : corner }, { stage: 1, stack: -3, label: "Bottom gusset fold" });
  }
  const flapDepth = G2 + lap;
  b.attach("bottomBack", "flap", "back", [pt(xB, H), pt(xB + L, H)], flapDepth, { kind: "trapezoid", taperA: 3, taperB: 3 }, { stage: 2, stack: -2, label: "Bottom (back extension)" });
  b.attach("bottomFront", "bottom", "front", [pt(xF, H), pt(xF + L, H)], flapDepth, { kind: "trapezoid", taperA: 2, taperB: 2 }, { stage: 3, label: "Bottom (front extension, pasted)" });

  // Holes through the faces (eyelets / hand hole), mirrored on the turnover that folds over them.
  const faceHoles = (x0: number, mirror: boolean): Polygon[] => {
    const y = mirror ? -hg.anchorDepthMm : hg.anchorDepthMm;
    const cx = x0 + L / 2;
    if (hg.hole) return [stadium(cx, y, hg.hole.width, hg.hole.height)];
    if (isThreaded(hg.kind) && hg.holeDiameterMm) return [-1, 1].map((k) => circle(cx + (k * hg.spanMm) / 2, y, hg.holeDiameterMm! / 2));
    return [];
  };
  for (const [id, x0] of [["front", xF], ["back", xB]] as const) {
    const holes = faceHoles(x0, false);
    if (holes.length) b.byId(id).holes = holes;
  }
  if (T > 0) {
    const cols: [string, number, number][] = [
      ["leftB", g, G2],
      ["leftA", xF - G2, G2],
      ["front", xF, L],
      ["rightA", xR, G2],
      ["rightB", xR + G2, G2],
      ["back", xB, L],
    ];
    for (const [id, x0, w] of cols) {
      const holes = id === "front" || id === "back" ? faceHoles(x0, true) : [];
      b.attach(`${id}Turn`, "inner", id, insetSeg([pt(x0, 0), pt(x0 + w, 0)], 0.5), T, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 4, label: "Top turnover", ...(holes.length ? { holes } : {}) });
    }
  } else if (features.thumbNotch) {
    notchPanel(b.byId("front"), [pt(xF, 0), pt(xF + L, 0)], Math.min(15, L * 0.1));
  }

  // Separate pieces (board base, handle patches, board strips): cut on their own dies, laid out
  // under the blank, placed inside in the last stage.
  const mainPivot = new Vector3(xF + L / 2, -H / 2, 0);
  const parts: BagPart[] = [];
  let px = xF;
  const py = H + flapDepth + 15;
  const stage = 5;
  const place = (id: string, label: string, w: number, h: number, basis: [Vector3, Vector3, Vector3], origin: Vector3, holes?: Polygon[]) => {
    // Flat-frame point (x, -y) of the piece maps to origin + basis · (x - px, -y - (-py), 0).
    const m = new Matrix4()
      .makeTranslation(-mainPivot.x, -mainPivot.y, -mainPivot.z)
      .multiply(new Matrix4().makeTranslation(origin.x, origin.y, origin.z))
      .multiply(new Matrix4().makeBasis(basis[0], basis[1], basis[2]))
      .multiply(new Matrix4().makeTranslation(-px, py, 0));
    const panel = b.piece(id, "inner", rectPolygon(px, py, w, h), label, { matrix: m.toArray(), stage, lift: H * 0.6 }, { label, ...(holes ? { holes: holes.map((q) => q.map((v) => pt(v.x + px, v.y + py))) } : {}) });
    panel.printable = false;
    px += w + 12;
    return panel;
  };
  const X = new Vector3(1, 0, 0);
  const Y = new Vector3(0, 1, 0);
  const Z = new Vector3(0, 0, 1);
  if (o.baseInsert) {
    const w = L - 3;
    const dd = Gc - 3;
    // Lies flat on the bottom: piece y (down the sheet) runs toward the back (-z).
    place("baseInsert", "Base insert (board)", w, dd, [X, new Vector3(0, 0, 1), new Vector3(0, -1, 0)], new Vector3(xF + 1.5, -H + 3.5 * t + 0.4, -1.5), undefined);
    parts.push({ id: "baseInsert", label: "Base insert", stock: "board", widthMm: Math.round(w), heightMm: Math.round(dd), count: 1 });
  }
  // Inside the front wall (behind the turnover) and the back wall, centred, top 3 mm below the mouth.
  const behind = 2 * t + (hg.sizeMm > 0 && hg.kind !== "DIE_CUT" ? Math.min(hg.sizeMm, 6) : 0) + 1;
  const strip = (id: string, label: string, stock: BagPart["stock"], w: number, h: number, holesFor?: (w: number, h: number) => Polygon[]) => {
    const top = -2;
    // front: printed (flat +z) side toward the wall
    place(`${id}Front`, label, w, h, [X, Y, Z], new Vector3(xF + L / 2 - w / 2, top, -behind - t), holesFor?.(w, h));
    // back: turned 180° about y
    place(`${id}Back`, label, w, h, [new Vector3(-1, 0, 0), Y, new Vector3(0, 0, -1)], new Vector3(xF + L / 2 + w / 2, top, -Gc + behind + t), holesFor?.(w, h));
    parts.push({ id, label, stock, widthMm: Math.round(w), heightMm: Math.round(h), count: 2 });
  };
  const k = o.handle.kind;
  if (k === "TWISTED_PAPER") strip("patch", "Handle patch", "paper", Math.min(L - 10, hg.spanMm + 80), Math.min(50, T + 8));
  else if (isThreaded(k) || k === "GROSGRAIN_RIBBON") {
    const w = L - 8;
    const h = T - 4;
    strip(
      "topBoard",
      "Top board strip",
      "board",
      w,
      h,
      hg.holeDiameterMm ? (sw, sh) => [-1, 1].map((s) => circle(sw / 2 + (s * hg.spanMm) / 2, hg.anchorDepthMm - 2, hg.holeDiameterMm! / 2)).map((c) => (sh > 0 ? c : c)) : undefined,
    );
  } else if (k === "DIE_CUT" && hg.hole) {
    const w = hg.hole.width + 50;
    const h = T - 4;
    strip("handlePatch", "Hand-hole board patch", "board", w, h, (sw) => [stadium(sw / 2, hg.anchorDepthMm - 2, hg.hole!.width, hg.hole!.height)]);
  }

  const accessories = handleAccessories(hg, o.handle.color, { H, zFace: Gc / 2, t });

  return {
    builder: b,
    closedRotation: [0, 0, 0, 1],
    faces: (panels, computed) => sideFaces(panels, t, computed),
    accessories,
    turnoverMm: T,
    glueSeamMm: g,
    bottomFlapMm: flapDepth,
    handle: hg,
    parts,
    paperBlank: { width: xB + L, height: H + T + flapDepth },
  };
}

/** Left and right faces: the two gusset halves of each side, side by side (they are not axis aligned). */
function sideFaces(panels: DielinePanel[], t: number, computed: Partial<Record<FaceId, FaceInfo>>): Partial<Record<FaceId, FaceInfo>> {
  const out = { ...computed };
  for (const [face, ids] of [["left", ["leftA", "leftB"]], ["right", ["rightA", "rightB"]]] as const) {
    const f = sideBySide(face, panels, t, [...ids]);
    if (f) out[face] = f;
  }
  return out;
}

function sideBySide(face: FaceId, panels: DielinePanel[], t: number, ids: string[]): FaceInfo | null {
  const rot: [number, number, number, number] = [0, 0, 0, 1];
  const poses = computePoses({ panels, rootId: "front", thicknessMm: t, closedRotation: rot }, 1);
  const r = FACE_FRAMES[face].r;
  const each = ids
    .map((id) => {
      const f = obliqueFace(face, panels, "front", t, rot, id);
      const p = panels.find((x) => x.id === id)!;
      const c = panelLocalPoint(p, { x: p.bbox.x + p.bbox.width / 2, y: p.bbox.y + p.bbox.height / 2 }, 0, panelPivot(p, t), t).applyMatrix4(poses.get(id)!.world);
      return f ? { f, u: c.dot(r) } : null;
    })
    .filter((x): x is { f: FaceInfo; u: number } => !!x)
    .sort((a, b) => a.u - b.u);
  if (each.length !== ids.length) return null;
  const height = Math.max(...each.map((e) => e.f.height));
  let x = 0;
  const parts = each.map(({ f }) => {
    const [a, b1, c, d, e, g] = f.parts[0].transform;
    const dx = x;
    const dy = (height - f.height) / 2;
    x += f.width;
    const transform: Affine = [a, b1, c, d, e - a * dx - c * dy, g - b1 * dx - d * dy];
    return { panelId: f.parts[0].panelId, rect: { x: dx, y: dy, width: f.width, height: f.height }, transform };
  });
  return { face, width: x, height, parts };
}

export const handleHex = (c: BagHandleChoice["color"]) => BAG_HANDLE_COLORS[c];
