import type { DielinePanel, PanelRole, Polygon, Pt, Rect, Segment } from "./types";
import { add, bboxOf, centroid, clamp, dot, edgesOf, norm, pt, scale, sub } from "./geometry";

export type FlapShape =
  | { kind: "rect" }
  /** Far edge shortened by `taperA` at the a-end and `taperB` at the b-end (mm). */
  | { kind: "trapezoid"; taperA: number; taperB: number }
  /** Tuck flap: shoulders + rounded (chamfered) nose. */
  | { kind: "tuck"; shoulder?: number };

export interface PanelOpts {
  fold?: number;
  stage?: number;
  stack?: number;
  pivotDepth?: number;
  printable?: boolean;
  label?: string;
  holes?: Polygon[];
  hingeKind?: "crease" | "roll";
}

/** Orient a polygon clockwise on screen (positive signed area in y-down coordinates). */
export function orientCw(polygon: Polygon): Polygon {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    area += p.x * q.y - q.x * p.y;
  }
  return area < 0 ? polygon.slice().reverse() : polygon;
}

/** Edges of an axis-aligned rect panel, in dieline coordinates (y down). */
export function rectEdges(r: Rect): Record<"top" | "right" | "bottom" | "left", [Pt, Pt]> {
  const tl = pt(r.x, r.y);
  const tr = pt(r.x + r.width, r.y);
  const br = pt(r.x + r.width, r.y + r.height);
  const bl = pt(r.x, r.y + r.height);
  return { top: [tl, tr], right: [tr, br], bottom: [bl, br], left: [tl, bl] };
}

/** Points `a`/`b` moved toward each other along their segment by `ia` / `ib` mm. */
export function insetSeg([a, b]: [Pt, Pt], ia: number, ib = ia): [Pt, Pt] {
  const d = norm(sub(b, a));
  return [add(a, scale(d, ia)), sub(b, scale(d, ib))];
}

export class DielineBuilder {
  readonly panels: DielinePanel[] = [];
  rootId = "";
  /** Creases that are not hinges (crash-lock diagonals, gusset folds). Drawn, not folded. */
  readonly extraCreases: Segment[] = [];
  /** Perforations (tear strips). */
  readonly perfLines: Segment[] = [];
  /** Window film patches. */
  readonly films: { panelId: string; polygon: Polygon }[] = [];
  /** Piece labels by root id (multi-piece structures). */
  readonly pieceLabels = new Map<string, string>();

  byId(id: string): DielinePanel {
    const p = this.panels.find((x) => x.id === id);
    if (!p) throw new Error(`Unknown panel ${id}`);
    return p;
  }

  root(id: string, role: PanelRole, polygon: Polygon, label = id, opts: Pick<PanelOpts, "holes"> = {}): DielinePanel {
    const panel = this.addRoot(id, role, polygon, label, opts);
    this.rootId = id;
    this.pieceLabels.set(id, this.pieceLabels.get(id) ?? "Box");
    return panel;
  }

  /**
   * Root of an extra piece (lid, divider…). `matrix` is its closed pose in model space
   * (column-major 4×4); it moves there during fold stage `stage`.
   */
  piece(
    id: string,
    role: PanelRole,
    polygon: Polygon,
    pieceLabel: string,
    assembly: { matrix: number[]; stage: number; lift?: number },
    opts: Pick<PanelOpts, "holes" | "label"> = {},
  ): DielinePanel {
    const panel = this.addRoot(id, role, polygon, opts.label ?? pieceLabel, opts);
    panel.assembly = assembly;
    this.pieceLabels.set(id, pieceLabel);
    return panel;
  }

  private addRoot(id: string, role: PanelRole, polygon: Polygon, label: string, opts: Pick<PanelOpts, "holes">): DielinePanel {
    polygon = orientCw(polygon);
    const panel: DielinePanel = {
      id,
      role,
      label,
      polygon,
      bbox: bboxOf(polygon),
      parentId: null,
      hinge: null,
      foldAngleClosed: 0,
      foldStage: 0,
      stackOffset: 0,
      pivotDepth: 0,
      printable: true,
      ...(opts.holes?.length ? { holes: opts.holes } : {}),
    };
    this.panels.push(panel);
    return panel;
  }

  /** Attach a panel with an explicit outline (first two vertices need not be the hinge). */
  attachPoly(id: string, role: PanelRole, parentId: string, [a, b]: [Pt, Pt], polygon: Polygon, opts: PanelOpts = {}): DielinePanel {
    this.byId(parentId);
    return this.push(id, role, parentId, a, b, orientCw(polygon), opts);
  }

  private push(id: string, role: PanelRole, parentId: string, a: Pt, b: Pt, polygon: Polygon, opts: PanelOpts): DielinePanel {
    const panel: DielinePanel = {
      id,
      role,
      label: opts.label ?? id,
      polygon,
      bbox: bboxOf(polygon),
      parentId,
      hinge: { a, b },
      foldAngleClosed: opts.fold ?? 90,
      foldStage: opts.stage ?? 0,
      stackOffset: opts.stack ?? 0,
      pivotDepth: opts.pivotDepth ?? (Math.abs(opts.fold ?? 90) > 135 ? 1 : 0),
      printable: opts.printable ?? role !== "glue",
      ...(opts.holes?.length ? { holes: opts.holes } : {}),
      ...(opts.hingeKind === "roll" ? { hingeKind: "roll" as const } : {}),
    };
    this.panels.push(panel);
    return panel;
  }

  /** Move panels (and their hinges/holes) by (dx, dy) in sheet mm. */
  translate(ids: Iterable<string>, dx: number, dy: number) {
    const mv = (q: Pt) => ({ x: q.x + dx, y: q.y + dy });
    for (const id of ids) {
      const p = this.byId(id);
      p.polygon = p.polygon.map(mv);
      p.bbox = bboxOf(p.polygon);
      if (p.hinge) p.hinge = { a: mv(p.hinge.a), b: mv(p.hinge.b) };
      if (p.holes) p.holes = p.holes.map((h) => h.map(mv));
    }
  }

  /** Ids of a panel and all its descendants. */
  subtree(rootId: string): string[] {
    const out = [rootId];
    for (let i = 0; i < out.length; i++) for (const p of this.panels) if (p.parentId === out[i]) out.push(p.id);
    return out;
  }

  /**
   * Local frame of a hinge on a parent: `at(p, along, out)` moves from p by `along` mm
   * along a→b and `out` mm away from the parent. For custom flap outlines.
   */
  frame(parentId: string, [a, b]: [Pt, Pt]) {
    const parent = this.byId(parentId);
    const along = norm(sub(b, a));
    let out = pt(-along.y, along.x);
    const mid = scale(add(a, b), 0.5);
    if (dot(out, sub(mid, centroid(parent.polygon))) < 0) out = scale(out, -1);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const at = (p: Pt, al: number, o: number) => add(add(p, scale(along, al)), scale(out, o));
    return { a, b, along, out, length, at };
  }

  /**
   * Attach a panel to `parentId` along the hinge a→b (which must lie on the parent's
   * outline). The panel grows `depth` mm away from the parent.
   */
  attach(
    id: string,
    role: PanelRole,
    parentId: string,
    [a, b]: [Pt, Pt],
    depth: number,
    shape: FlapShape = { kind: "rect" },
    opts: PanelOpts = {},
  ): DielinePanel {
    const parent = this.byId(parentId);
    const along = norm(sub(b, a));
    let out = pt(-along.y, along.x);
    const c = centroid(parent.polygon);
    const mid = scale(add(a, b), 0.5);
    if (dot(out, sub(mid, c)) < 0) out = scale(out, -1);
    const hingeLen = Math.hypot(b.x - a.x, b.y - a.y);
    const far = (p: Pt, alongOff: number, outOff: number) => add(add(p, scale(along, alongOff)), scale(out, outOff));

    let polygon: Polygon;
    if (shape.kind === "rect") {
      polygon = [a, b, far(b, 0, depth), far(a, 0, depth)];
    } else if (shape.kind === "trapezoid") {
      const maxT = hingeLen * 0.49;
      const ta = clamp(shape.taperA, -depth, maxT);
      const tb = clamp(shape.taperB, -depth, maxT);
      polygon = [a, b, far(b, -tb, depth), far(a, ta, depth)];
    } else {
      const neck = depth * 0.4;
      const sh = clamp(shape.shoulder ?? 1, 0, Math.min(hingeLen * 0.1, neck * 0.1));
      const r = clamp(Math.min(depth * 0.45, hingeLen * 0.22), 0, hingeLen * 0.45);
      polygon = [a, b, far(b, -sh, neck), far(b, -sh - r * 0.3, depth - r * 0.35), far(b, -sh - r, depth), far(a, sh + r, depth), far(a, sh + r * 0.3, depth - r * 0.35), far(a, sh, neck)];
    }
    return this.push(id, role, parentId, a, b, orientCw(polygon), opts);
  }
}

/** All hinge segments (each child's crease). */
export function hingesOf(panels: DielinePanel[]): Segment[] {
  return panels.flatMap((p) => (p.hinge ? [p.hinge] : []));
}

/** Edges of a panel that are creases (shared with its parent or a child). */
export function panelCreases(panel: DielinePanel, panels: DielinePanel[]): Segment[] {
  const out: Segment[] = [];
  if (panel.hinge) out.push(panel.hinge);
  for (const c of panels) if (c.parentId === panel.id && c.hinge) out.push(c.hinge);
  return out;
}

export { edgesOf };
