import { Mat4 as Matrix4, Quat as Quaternion, Euler, Vec3 as Vector3 } from "@/lib/dieline/math";
import { BAG_HANDLE_COLORS, type BagGusset, type BagHandleChoice, type Dims, type StructureFeatures } from "@/types";
import { DielineBuilder, insetSeg } from "../../builder";
import { clamp, pt, rectPolygon } from "../../geometry";
import type { DielineAccessory, Polygon } from "../../types";
import { obliqueFace } from "../foodservice/engine";
import { sideFaces, stadium, GUSSET_CREASE_DEG, type BagDraft } from "./generator";
import { catmullRom, handleGeometry, turnoverFor, twistedStrands } from "./handles";
import type { BagCode, BagPart } from "./types";

/**
 * Film (PE) and non-woven PP carrier bags (sheet mm, printed side up, mouth at the top).
 *
 * A film bag is cut from a blown, printed tube: front and back faces with the gussets folded in
 * between, bottom welded, handles punched or welded on. The layout is the same column order as the
 * paper bag (gusset halves | FRONT | gusset halves | BACK) but with no glue seam (the tube is
 * seamless; non-woven bags have a sewn side seam). The closed pose is the bag standing open.
 *
 * Gussets:
 * - SIDE: two halves per side creased inward like the paper bag (film is soft: 10°).
 * - BOTTOM: a bottom-gusset bag is welded flat at the sides and opens W deep at the base only.
 *   With rigid panels it is drawn as tapered side strips (W at the base, a few mm at the mouth):
 *   front and back lean toward each other by half the taper each, the base is W deep.
 * - NONE: a flat bag (2 mm "gusset" so the faces do not coincide).
 *
 * Handles: T-shirt straps are part of the die (U-cut between two straps); die-cut, patch and kidney
 * holes are cut through both faces (the patch is a welded film piece); soft loops, rigid clips,
 * drawstrings and sewn straps are 3D accessories.
 */

export const FILM_CREASE_DEG = 10;
const FLAT_MM = 2;

/** Kidney (bean) hole: a stadium with a gentle dent on its top edge. */
function kidney(cx: number, cy: number, w: number, h: number, n = 14): Polygon {
  const out: Polygon = [];
  const r = h / 2;
  // bottom arc left → right (convex), then the top edge with a dent, right → left
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (Math.PI * i) / n;
    const x = cx - w / 2 + r + (w - 2 * r) * (i / n);
    out.push(pt(x + Math.cos(a) * 0, cy + r * Math.sin(Math.PI * (i / n)) * 0.35 + r * 0.6));
  }
  out.push(pt(cx + w / 2, cy));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = cx + w / 2 - r - (w - 2 * r) * u;
    const dent = Math.sin(Math.PI * u) * h * 0.22;
    out.push(pt(x, cy - r + dent));
  }
  out.push(pt(cx - w / 2, cy));
  return out;
}

export interface FilmDraftOptions {
  code: BagCode;
  handle: BagHandleChoice;
  gusset: BagGusset;
  stock: "film" | "nonwoven";
}

export function filmBagDraft(dims: Dims, t: number, _features: StructureFeatures, o: FilmDraftOptions): BagDraft {
  const L = dims.L;
  const H = dims.H;
  const gusset = o.gusset;
  const G = gusset === "NONE" ? FLAT_MM : dims.W;
  const G2 = G / 2;
  const sewn = o.stock === "nonwoven";
  const g = sewn ? clamp(G * 0.12, 8, 12) : 0;
  // Film bags have no turnover: only the drawstring hem (the paper die-cut turnover does not apply).
  const T = o.handle.kind === "DIE_CUT" ? 0 : turnoverFor(o.handle.kind, dims);
  const hg = handleGeometry(o.handle.kind, dims, T);
  const b = new DielineBuilder();
  const deg = sewn ? GUSSET_CREASE_DEG : FILM_CREASE_DEG;
  const th = (deg * Math.PI) / 180;

  // Bottom gusset: side strips taper from W at the base to wTop at the mouth (lean ≤ 7° per face).
  const maxLean = (7 * Math.PI) / 180;
  const wTop = gusset === "BOTTOM" ? Math.max(6, G - 2 * H * Math.tan(maxLean)) : G;
  const lean = gusset === "BOTTOM" ? Math.atan((G - wTop) / (2 * H)) : 0;

  const xF = g + G;
  const xR = xF + L;
  const xB = xR + G;
  b.root("front", "front", rectPolygon(xF, 0, L, H), "Front");
  const ids = { left: [] as string[], right: [] as string[] };
  if (gusset === "SIDE" || gusset === "NONE") {
    const A = 90 + deg;
    const wall = (id: string, role: "left" | "right" | "back", parent: string, x: number, depth: number, fold: number, label: string) =>
      b.attach(id, role, parent, [pt(x, 0), pt(x, H)], depth, { kind: "rect" }, { fold, stage: 0, label });
    wall("leftA", "left", "front", xF, G2, gusset === "NONE" ? 90 : A, "Gusset (front half)");
    wall("leftB", "left", "leftA", xF - G2, G2, gusset === "NONE" ? 0 : -2 * deg, "Gusset (back half)");
    wall("rightA", "right", "front", xR, G2, gusset === "NONE" ? 90 : A, "Gusset (front half)");
    wall("rightB", "right", "rightA", xR + G2, G2, gusset === "NONE" ? 0 : -2 * deg, "Gusset (back half)");
    wall("back", "back", "rightB", xB, L, gusset === "NONE" ? 90 : A, "Back");
    ids.left = ["leftA", "leftB"];
    ids.right = ["rightA", "rightB"];
    if (sewn) b.attach("glue", "glue", "leftB", [pt(g, 0), pt(g, H)], g, { kind: "rect" }, { fold: A, stage: 0, stack: -1, label: "Side seam (sewn)" });
  } else {
    // Tapered single strips: W at the base (sheet y = H), wTop at the mouth (y = 0).
    b.attachPoly("left", "left", "front", [pt(xF, 0), pt(xF, H)], [pt(xF, 0), pt(xF, H), pt(xF - G, H), pt(xF - wTop, 0)], { fold: 90, stage: 0, label: "Side (bottom gusset, welded)" });
    b.attachPoly("right", "right", "front", [pt(xR, 0), pt(xR, H)], [pt(xR, 0), pt(xR, H), pt(xR + G, H), pt(xR + wTop, 0)], { fold: 90, stage: 0, label: "Side (bottom gusset, welded)" });
    // The back hangs on the slanted far edge of the right strip.
    const a = pt(xR + wTop, 0);
    const c = pt(xR + G, H);
    b.attach("back", "back", "right", [a, c], L, { kind: "rect" }, { fold: 90, stage: 0, label: "Back" });
    ids.left = ["left"];
    ids.right = ["right"];
  }

  // Bottom: shown opened (a film bag is welded flat; it squares up when filled).
  if (gusset !== "NONE") b.attach("bottomFront", "bottom", "front", [pt(xF, H), pt(xF + L, H)], G * (gusset === "SIDE" ? Math.cos(th) : 1) - 0.5, { kind: "rect" }, { stage: 1, label: gusset === "BOTTOM" ? "Bottom gusset" : "Bottom (shown opened, welded seal)" });

  // Handles cut from the film.
  const faceX = [["front", xF], ["back", xB]] as const;
  const holeFor = (x0: number, y: number): Polygon[] => {
    const cx = x0 + L / 2;
    if (o.handle.kind === "KIDNEY" && hg.hole) return [kidney(cx, y, hg.hole.width, hg.hole.height)];
    if (hg.hole) return [stadium(cx, y, hg.hole.width, hg.hole.height)];
    return [];
  };
  if (hg.hole && o.handle.kind !== "TSHIRT") {
    for (const [id, x0] of faceX) b.byId(id).holes = holeFor(x0, hg.anchorDepthMm);
  }
  if (o.handle.kind === "TSHIRT") {
    // Straps continue the outer strips of each face and the whole gusset up to the strap top.
    const s = Math.min(hg.spanMm, L * 0.3);
    const hh = hg.loopHeightMm;
    const strap = (id: string, parent: string, x0: number, w: number) => b.attach(id, parentRole(parent), parent, [pt(x0, 0), pt(x0 + w, 0)], hh, { kind: "rect" }, { fold: 0, stage: 0, label: "T-shirt strap" });
    strap("strapFL", "front", xF, s);
    strap("strapFR", "front", xF + L - s, s);
    strap("strapBR", "back", xB, s);
    strap("strapBL", "back", xB + L - s, s);
    if (gusset === "SIDE") for (const [id, x0] of [["leftA", xF - G2], ["leftB", xF - G], ["rightA", xR], ["rightB", xR + G2]] as const) strap(`strap_${id}`, id, x0, G2);
  }
  // Drawstring hem.
  if (T > 0) {
    const cols: [string, number, number][] = gusset === "BOTTOM" ? [["front", xF, L]] : [["leftB", xF - G, G2], ["leftA", xF - G2, G2], ["front", xF, L], ["rightA", xR, G2], ["rightB", xR + G2, G2], ["back", xB, L]];
    for (const [id, x0, w] of cols) b.attach(`${id}Hem`, "inner", id, insetSeg([pt(x0, 0), pt(x0 + w, 0)], 0.5), T, { kind: "rect" }, { fold: 180, pivotDepth: 1, stage: 2, label: "Drawstring hem" });
  }

  // Patch piece (welded film ring round the die-cut hole), inside each face.
  const parts: BagPart[] = [];
  const mainPivot = new Vector3(xF + L / 2, -H / 2, 0);
  const rot = new Quaternion().setFromEuler(new Euler(-lean, 0, 0, "YXZ"));
  const closedRotation: [number, number, number, number] = [rot.x, rot.y, rot.z, rot.w];
  if (o.handle.kind === "DIE_CUT_PATCH" && hg.hole) {
    const w = hg.hole.width + 60;
    const h = hg.hole.height + 40;
    let px = xF;
    const py = H + G + 15;
    const zBack = -(gusset === "SIDE" ? G * Math.cos(th) : G);
    for (const [side, x0] of [["Front", xF], ["Back", xB]] as const) {
      void x0;
      const back = side === "Back";
      // With a bottom gusset the back leans (its plane meets the mouth wTop deep): follow it.
      const zAtTop = back ? (gusset === "BOTTOM" ? -wTop : zBack) + 2 * t : -2 * t;
      const basis = back ? [new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, -1)] : [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
      const ox = back ? xF + L / 2 + w / 2 : xF + L / 2 - w / 2;
      const top = -(hg.anchorDepthMm - h / 2);
      const m = new Matrix4()
        .makeTranslation(-mainPivot.x, -mainPivot.y, -mainPivot.z)
        .multiply(new Matrix4().makeTranslation(ox, top, zAtTop))
        .multiply(new Matrix4().makeBasis(basis[0], basis[1], basis[2]))
        .multiply(new Matrix4().makeTranslation(-px, py, 0));
      const panel = b.piece(`patch${side}`, "inner", rectPolygon(px, py, w, h), "Handle patch", { matrix: m.toArray(), stage: 3, lift: H * 0.4 }, { label: "Handle patch (film)", holes: [stadium(px + w / 2, py + h / 2, hg.hole.width, hg.hole.height)] });
      panel.printable = false;
      px += w + 12;
    }
    parts.push({ id: "patch", label: "Handle patch (film)", stock: "paper", widthMm: Math.round(w), heightMm: Math.round(h), count: 2 });
  }

  const zTop = (gusset === "BOTTOM" ? wTop : gusset === "SIDE" ? G * Math.cos(th) : G) / 2;
  const accessories = filmAccessories(hg, o.handle, { H: H * Math.cos(lean), zFace: zTop, t, L, faceTop: H });

  const blankH = H + (o.handle.kind === "TSHIRT" ? hg.loopHeightMm : 0) + T + (gusset !== "NONE" ? G : 0);
  return {
    builder: b,
    closedRotation,
    // Bottom gusset: front, back and base lean a few degrees, so map them as oblique faces.
    faces:
      gusset === "BOTTOM"
        ? (panels, computed) => {
            const out = { ...computed };
            for (const [face, id] of [["front", "front"], ["back", "back"], ["bottom", "bottomFront"]] as const) {
              const f = obliqueFace(face, panels, "front", t, closedRotation, id);
              if (f) out[face] = f;
            }
            return out;
          }
        : (panels, computed) => sideFaces(panels, t, computed),
    accessories,
    turnoverMm: T,
    glueSeamMm: g,
    bottomFlapMm: gusset !== "NONE" ? G : 0,
    handle: hg,
    parts,
    paperBlank: { width: xB + L, height: blankH },
  };
}

const parentRole = (parent: string) => (parent === "front" ? "front" : parent === "back" ? "back" : parent.startsWith("left") ? "left" : "right") as "front" | "back" | "left" | "right";

type V3 = [number, number, number];
const r2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (p: V3): V3 => [r2(p[0]), r2(p[1]), r2(p[2])];

/** Welded soft loops, clip handles, drawstring cords and sewn straps (accessory frame, mm). */
function filmAccessories(g: ReturnType<typeof handleGeometry>, h: BagHandleChoice, f: { H: number; zFace: number; t: number; L: number; faceTop: number }): DielineAccessory[] {
  const hex = BAG_HANDLE_COLORS[h.color];
  const out: DielineAccessory[] = [];
  const { H, zFace } = f;
  const s = g.spanMm / 2;
  const hh = g.loopHeightMm;
  for (const side of [1, -1] as const) {
    const zf = zFace * side;
    const out1 = side * 1.2;
    const norm: V3 = [0, 0, side];
    const label = side === 1 ? "Front handle" : "Back handle";
    if (h.kind === "SOFT_LOOP") {
      // A flat film loop welded on a tab just under the mouth.
      const ctrl: V3[] = [
        [-s, H - g.anchorDepthMm, zf + out1],
        [-s, H - 2, zf + out1],
        [-s * 1.02, H + hh * 0.55, zf + out1 * 2],
        [-s * 0.5, H + hh, zf + out1 * 3],
        [s * 0.5, H + hh, zf + out1 * 3],
        [s * 1.02, H + hh * 0.55, zf + out1 * 2],
        [s, H - 2, zf + out1],
        [s, H - g.anchorDepthMm, zf + out1],
      ];
      out.push({ kind: "ribbon", path: catmullRom(ctrl, 8).map(round3), widthMm: g.sizeMm, normal: norm, color: hex, finish: "plastic", label });
    } else if (h.kind === "RIGID_CLIP") {
      // Clip bar over the mouth (both faces clamped) and a moulded grip arch above it.
      const bar: V3[] = [-s, -s * 0.5, 0, s * 0.5, s].map((x) => [x, H - g.anchorDepthMm / 2, zf + side * 3] as V3);
      out.push({ kind: "cord", path: bar.map(round3), radiusMm: 3.5, color: hex, finish: "plastic", label: `${label} clip` });
      if (side === 1) {
        const arch: V3[] = [
          [-s * 0.55, H + 2, 0],
          [-s * 0.6, H + hh * 0.6, 0],
          [-s * 0.3, H + hh, 0],
          [s * 0.3, H + hh, 0],
          [s * 0.6, H + hh * 0.6, 0],
          [s * 0.55, H + 2, 0],
        ];
        out.push({ kind: "ribbon", path: catmullRom(arch, 8).map(round3), widthMm: 14, normal: [0, 0, 1], color: hex, finish: "plastic", label: "Clip grip" });
      }
    } else if (h.kind === "SEWN_STRAP") {
      const ctrl: V3[] = [
        [-s, H - g.anchorDepthMm, zf - side * (f.t + 0.8)],
        [-s, H - 2, zf - side * (f.t + 0.8)],
        [-s * 1.05, H + hh * 0.4, zf + side * 2],
        [-s * 0.6, H + hh * 0.9, zf + side * 4],
        [0, H + hh, zf + side * 5],
        [s * 0.6, H + hh * 0.9, zf + side * 4],
        [s * 1.05, H + hh * 0.4, zf + side * 2],
        [s, H - 2, zf - side * (f.t + 0.8)],
        [s, H - g.anchorDepthMm, zf - side * (f.t + 0.8)],
      ];
      out.push({ kind: "ribbon", path: catmullRom(ctrl, 10).map(round3), widthMm: g.sizeMm, normal: norm, color: hex, finish: "grosgrain", label });
    }
  }
  if (h.kind === "DRAWSTRING") {
    // Cord round the mouth inside the hem, two tails out of the front at the centre.
    const y = H - g.anchorDepthMm;
    const x = f.L / 2 - 4;
    const z = Math.max(0.5, zFace - 1.5);
    const ring: V3[] = [
      [-8, y, z],
      [-x, y, z],
      [-x, y, -z],
      [x, y, -z],
      [x, y, z],
      [8, y, z],
    ];
    out.push({ kind: "cord", path: ring.map(round3), radiusMm: g.sizeMm / 2, color: hex, finish: "plastic", samples: 64, label: "Drawstring" });
    for (const k of [-1, 1]) {
      const tail = catmullRom([[k * 8, y, z], [k * 6, y - 6, z + 6], [k * 10, y - 40, z + 9], [k * 12, y - 80, z + 8]], 8).map(round3);
      for (const strand of twistedStrands(tail, g.sizeMm * 0.2, 2, 10, [0, 0, 1])) out.push({ kind: "cord", path: strand.map(round3), radiusMm: g.sizeMm * 0.3, color: hex, finish: "plastic", label: "Drawstring tail" });
    }
  }
  return out;
}
