import type { Dims, FaceId, StructureCode } from "@/types";

/**
 * Dieline model types.
 *
 * Coordinate system ("dieline space" / "sheet space"):
 * - millimetres, x to the right, y DOWN (same as SVG and a 2D canvas),
 * - origin at the top-left corner of the printed sheet, which is the die outline's
 *   bounding box grown by `bleedMm` on every side,
 * - the sheet is drawn as seen from the OUTSIDE (printed) surface of the board.
 * Never mirrored in RTL.
 */
export interface Pt {
  x: number;
  y: number;
}

/** Convex polygon, vertices in order (no repeated closing vertex). */
export type Polygon = Pt[];

export interface Segment {
  a: Pt;
  b: Pt;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 2D affine transform in canvas `setTransform(a, b, c, d, e, f)` order:
 *   x' = a*u + c*v + e
 *   y' = b*u + d*v + f
 */
export type Affine = [number, number, number, number, number, number];

/**
 * What a panel is. The six FaceId roles mark the main wall panels; the others are
 * closure / construction panels. Which panels form each visible face of the closed box is
 * in `DielineModel.faces` (a face can be made of several panels, e.g. RSC top flaps).
 */
export type PanelRole =
  | FaceId
  | "tuck" //   tuck flap that slides inside a wall
  | "dust" //   dust flap / lid side flap
  | "flap" //   RSC major/minor flap
  | "glue" //   glue flap / manufacturer's joint (kept ink-free)
  | "inner" //  rolled-in inner wall (double wall)
  | "ear"; //   locking ear trapped inside a double wall

export interface DielinePanel {
  id: string;
  role: PanelRole;
  /** Short English description, for debugging and SVG labels. */
  label: string;
  /** Panel outline in sheet mm. Always convex. */
  polygon: Polygon;
  bbox: Rect;
  /** null for the root panel (stays still while the box folds around it). */
  parentId: string | null;
  /** Crease shared with the parent panel (the hinge). null for the root. */
  hinge: Segment | null;
  /**
   * Fold angle in degrees when the box is closed. Positive folds the panel toward the
   * INSIDE (away from the printed surface). 90 = wall, 180 = rolled back over the parent.
   */
  foldAngleClosed: number;
  /** Folding order. Lower stages fold first; panels in one stage fold together. */
  foldStage: number;
  /**
   * Visual offset of the panel's board (in board thicknesses, along its own normal).
   * Negative pushes the panel toward the inside so overlapping flaps never z-fight.
   * Mesh-only: it does not move the panel's children (only leaf panels use it).
   */
  stackOffset: number;
  /**
   * Depth of the hinge pivot below the printed surface, in board thicknesses.
   * 0 for 90° folds (sharp outer corner); >= 1 for 180° roll-ins so the rolled wall
   * lands inside its parent (1.5 leaves a gap that traps a locking ear).
   */
  pivotDepth: number;
  /** false for glue flaps (must stay ink-free); excluded from print regions. */
  printable: boolean;
}

/** One rigid panel's share of a face of the closed box. */
export interface FacePart {
  panelId: string;
  /** Region of the face (face-local mm) this panel covers. */
  rect: Rect;
  /** Face-local mm (outside view) → sheet mm. */
  transform: Affine;
}

/**
 * A visible face of the closed box, as seen from OUTSIDE:
 * - front/back/left/right: upright (top of the box at the top),
 * - top: seen from above with the front edge at the bottom,
 * - bottom: seen from below with the front edge at the top.
 * Face-local coordinates are mm from the face's top-left corner (x right, y down) —
 * the same frame as artwork layers in `DesignDoc`.
 */
export interface FaceInfo {
  face: FaceId;
  width: number;
  height: number;
  parts: FacePart[];
}

export interface DielineMetrics {
  /** Rectangular blank (die outline bounding box, no bleed): what the vendor cuts from. */
  blankWidthMm: number;
  blankHeightMm: number;
  blankAreaM2: number;
  /** Sum of panel areas (board actually in the box). */
  netAreaM2: number;
  /** Total knife length and crease length (die complexity). */
  cutLengthMm: number;
  creaseLengthMm: number;
}

export interface DielineModel {
  structureCode: StructureCode;
  /** Inner dimensions requested (mm). */
  dims: Dims;
  thicknessMm: number;
  bleedMm: number;
  safeMm: number;
  /** Printed sheet size (die bounds + bleed on all sides). Texture canvases cover this. */
  sheet: { width: number; height: number };
  /** Die outline bounding box inside the sheet. */
  dieBounds: Rect;
  panels: DielinePanel[];
  rootId: string;
  cutLines: Segment[];
  creaseLines: Segment[];
  /** Per printable panel: its outline grown by the bleed on cut edges. */
  bleedRegions: { panelId: string; polygon: Polygon }[];
  /** Per face panel: the safe zone (keep text and logos inside). */
  safeZones: { panelId: string; rect: Rect }[];
  /** Where ink may go, per printed surface (same sheet coordinates for both). */
  printRegions: { outside: Polygon[]; inside: Polygon[] };
  /** Faces of the closed box and the panels that form them. */
  faces: Partial<Record<FaceId, FaceInfo>>;
  /** Outer size of the closed box (mm): L along x, W along z (depth), H vertical. */
  closedOuter: Dims;
  /**
   * Rotation (quaternion x, y, z, w) applied to the root panel when closed, taking it
   * from "flat, printed side facing the viewer" to "box standing upright, front toward
   * the viewer". Interpolated during folding.
   */
  closedRotation: [number, number, number, number];
  metrics: DielineMetrics;
}

export interface DielineOptions {
  /** Board caliper in mm (MaterialInfo satisfies this). */
  thicknessMm: number;
  /** Default 3 mm. */
  bleedMm?: number;
  /** Default 3 mm for folding cartons, 5 mm for corrugated. */
  safeMm?: number;
}
