import type { Mm } from "@/types";
import type { FrustumDims, MeshData, PrintArea } from "./types";

/**
 * Paper cups, bowls and cup sleeves: a conical (frustum) wall made from a flat annular
 * sector ("fan") blank. The development is exact: a frustum with bottom radius rb, top
 * radius rt and slant S unrolls to a sector of apex radii Rb = S·rb/(rt−rb), Rt = Rb + S and
 * angle θ = 2π·rt/Rt. Artwork drawn on the flat fan lands on the cup without distortion
 * because the mesh UVs come from the same mapping (`fanPoint`).
 *
 * Coordinates: 3D in mm, Y up, the cup stands on y = 0, front faces +Z, φ measured from +Z
 * towards +X (same as src/lib/vessels). Flat: mm, y down, apex BELOW the fan so the rim
 * (outer arc) is at the top of the artwork and the artwork reads upright.
 */

/**
 * Converting allowances on the sidewall blank. Typical values for cup-forming machines;
 * they are machine specific (confirm with the converter's tooling drawing).
 */
export const CUP_ALLOWANCES = {
  /** Paper rolled into the top curl, beyond the rim height (slant mm). */
  topCurlMm: 6,
  /** Visible height of the formed curl (not printable for fine detail). */
  curlVisibleMm: 3,
  /** Sidewall folded under the bottom disc (knurled bottom), slant mm. */
  bottomFoldMm: 8,
  /** Side seam overlap (mm at mid height). */
  seamMm: 8,
  /** Cup bottom recess: base disc sits this far above the table. */
  bottomRecessMm: 6,
  /** Double wall: insulating gap between inner cup and outer wall (radius). */
  doubleWallGapMm: 1.5,
  /** Double wall: outer wall stops this far below the rim (under the curl). */
  doubleWallTopMm: 5,
  /** Sleeve glue overlap. */
  sleeveSeamMm: 12,
} as const;

export const FAN_BLEED_MM = 3;
export const FAN_SAFE_MM = 3;

export interface Fan {
  /** Frustum radii and height of the surface the fan wraps (3D). */
  r0: Mm; //  bottom radius
  r1: Mm; //  top radius
  y0: Mm; //  bottom height on the cup
  y1: Mm; //  top height on the cup
  slant: Mm;
  /** Apex radius of the visible band's bottom and top arcs (flat). */
  R0: Mm;
  R1: Mm;
  /** Flat angle of one full turn (radians). */
  turnAngle: number;
  /** Blank (die) radii and total angle incl. seam overlap and converting allowances. */
  blankR0: Mm;
  blankR1: Mm;
  blankAngle: number;
  seamAngle: number;
  /** Apex in flat print coordinates (origin top-left of the print area incl. bleed). */
  apexX: Mm;
  apexY: Mm;
  print: PrintArea;
  /** Printable visible band (trim of the artwork that shows), for the designer. */
  visible: { x: number; y: number }[];
}

export interface FanOptions {
  /** Extra slant below the band (folded under), mm. */
  belowMm?: Mm;
  /** Extra slant above the band (curl), mm. */
  aboveMm?: Mm;
  seamMm?: Mm;
  /** Height of the band that is not printable at the top (curl), mm. */
  topNoPrintMm?: Mm;
  bleedMm?: Mm;
  safeMm?: Mm;
}

const arc = (cx: number, cy: number, R: number, a0: number, a1: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: cx + R * Math.sin(a), y: cy - R * Math.cos(a) };
  });

/** Annular sector outline (centre apex, radii R0 < R1, symmetric about the vertical). */
function sectorPoly(cx: number, cy: number, R0: number, R1: number, angle: number, n = 48) {
  return [...arc(cx, cy, R1, -angle / 2, angle / 2, n), ...arc(cx, cy, R0, angle / 2, -angle / 2, n)];
}

/**
 * Fan for the band of a frustum between heights y0 and y1 (radii r0 at y0, r1 at y1).
 * Requires r1 > r0 (wider at the top: cups, bowls, sleeves).
 */
export function frustumFan(r0: Mm, r1: Mm, y0: Mm, y1: Mm, o: FanOptions = {}): Fan {
  if (!(r1 > r0 + 1e-6)) throw new Error("frustumFan: top radius must exceed bottom radius");
  const bleed = o.bleedMm ?? FAN_BLEED_MM;
  const safe = o.safeMm ?? FAN_SAFE_MM;
  const below = o.belowMm ?? 0;
  const above = o.aboveMm ?? 0;
  const seam = o.seamMm ?? 0;
  const h = y1 - y0;
  const slant = Math.hypot(h, r1 - r0);
  const R0 = (slant * r0) / (r1 - r0);
  const R1 = R0 + slant;
  const turnAngle = (2 * Math.PI * r1) / R1;
  const seamAngle = seam / ((R0 + R1) / 2);
  const blankAngle = turnAngle + seamAngle;
  const blankR0 = Math.max(0, R0 - below);
  const blankR1 = R1 + above;

  // Bleed: radial grow by `bleed`, angular grow so the offset is >= bleed at every radius.
  const bR0 = Math.max(0, blankR0 - bleed);
  const bleedAngle = blankAngle + 2 * Math.asin(Math.min(1, bleed / Math.max(bleed * 2, bR0 || blankR1)));
  // Bounding box of the bleed outline in apex-local coords (x right, y down, apex at 0,0, fan above).
  const local = sectorPoly(0, 0, bR0, blankR1 + bleed, bleedAngle, 96);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of local) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const apexX = -minX;
  const apexY = -minY;
  const trim = sectorPoly(apexX, apexY, blankR0, blankR1, blankAngle);
  const bleedPoly = sectorPoly(apexX, apexY, bR0, blankR1 + bleed, bleedAngle);
  const noPrintTop = o.topNoPrintMm ?? 0;
  const sAng = turnAngle - (2 * safe) / ((R0 + R1) / 2);
  const safePoly = sectorPoly(apexX, apexY, R0 + safe, R1 - noPrintTop - safe, Math.max(0, sAng));
  const visible = sectorPoly(apexX, apexY, R0, R1 - noPrintTop, turnAngle);
  const widthMm = maxX - minX;
  const heightMm = maxY - minY;
  return {
    r0, r1, y0, y1, slant, R0, R1, turnAngle, blankR0, blankR1, blankAngle, seamAngle, apexX, apexY, visible,
    print: {
      trim,
      bleed: bleedPoly,
      safe: safePoly,
      widthMm,
      heightMm,
      bleedMm: bleed,
      safeMm: safe,
      trimAreaM2: (0.5 * blankAngle * (blankR1 * blankR1 - blankR0 * blankR0)) / 1e6,
    },
  };
}

/**
 * Flat point of a surface point: s = 0..1 around the cup (0 and 1 at the seam at the back,
 * 0.5 at the front, +Z), t = 0..1 from y0 to y1. The seam overlap sits at s > 1 side.
 */
export function fanPoint(fan: Fan, s: number, t: number): { x: Mm; y: Mm } {
  const a = -fan.blankAngle / 2 + s * fan.turnAngle;
  const R = fan.R0 + t * fan.slant;
  return { x: fan.apexX + R * Math.sin(a), y: fan.apexY - R * Math.cos(a) };
}

/** UV (0..1, v up) for a texture covering the print area. */
export function fanUv(fan: Fan, s: number, t: number): [number, number] {
  const p = fanPoint(fan, s, t);
  return [p.x / fan.print.widthMm, 1 - p.y / fan.print.heightMm];
}

/** Lateral frustum mesh of the fan's band, UV-mapped to the fan's print area. */
export function fanMesh(fan: Fan, segments = 64, rings = 6): MeshData {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    const y = fan.y0 + t * (fan.y1 - fan.y0);
    const r = fan.r0 + t * (fan.r1 - fan.r0);
    for (let i = 0; i <= segments; i++) {
      const s = i / segments;
      const phi = Math.PI + s * 2 * Math.PI; // seam at the back (φ = π), front at s = 0.5
      positions.push(r * Math.sin(phi), y, r * Math.cos(phi));
      uvs.push(...fanUv(fan, s, t));
    }
  }
  const row = segments + 1;
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * row + i;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}

/* ───────────────────────── cups / bowls ───────────────────────── */

export interface CupModel {
  dims: FrustumDims;
  wall: "single" | "double";
  /** Sidewall fan of the (inner) cup: die blank incl. curl, bottom fold, seam. */
  sidewall: Fan;
  /** Double wall: printed outer wall fan. */
  outerWall?: Fan;
  /** Bottom disc blank (cupstock), incl. the downturned flange. */
  bottomDiscDiameterMm: Mm;
  /** The fan the buyer's artwork goes on (outer wall for double wall). */
  printFan: Fan;
  /** Brimful volume (inner, from the base disc to the rim), ml. */
  brimfulMl: number;
  /** 3D: the printed lateral mesh and the closed parts (rim curl torus params, base). */
  rim: { y: Mm; radius: Mm; tube: Mm };
  base: { y: Mm; radius: Mm };
}

export function frustumVolumeMl(rBottom: Mm, rTop: Mm, h: Mm): number {
  return (Math.PI * h * (rBottom * rBottom + rBottom * rTop + rTop * rTop)) / 3 / 1000;
}

/** Cup or bowl (same geometry family: bowls are wide, low frusta). */
export function buildCup(dims: FrustumDims, wall: "single" | "double", thicknessMm = 0.38): CupModel {
  const A = CUP_ALLOWANCES;
  const rb = dims.bottomD / 2;
  const rt = dims.topD / 2;
  const sidewall = frustumFan(rb, rt, 0, dims.H, { belowMm: A.bottomFoldMm, aboveMm: A.topCurlMm, seamMm: A.seamMm, topNoPrintMm: A.curlVisibleMm });
  let outerWall: Fan | undefined;
  if (wall === "double") {
    const g = A.doubleWallGapMm + thicknessMm;
    const yTop = dims.H - A.doubleWallTopMm;
    const rTopOuter = rb + ((rt - rb) * yTop) / dims.H + g;
    outerWall = frustumFan(rb + g, rTopOuter, 0, yTop, { seamMm: A.seamMm });
  }
  const tw = thicknessMm;
  const h = dims.H - A.bottomRecessMm;
  const rBase = rb + ((rt - rb) * A.bottomRecessMm) / dims.H - tw;
  return {
    dims: { ...dims },
    wall,
    sidewall,
    outerWall,
    bottomDiscDiameterMm: 2 * (rBase + A.bottomRecessMm + 2),
    printFan: outerWall ?? sidewall,
    brimfulMl: frustumVolumeMl(rBase, rt - tw, h),
    rim: { y: dims.H, radius: rt, tube: 2 },
    base: { y: A.bottomRecessMm, radius: rBase },
  };
}

/* ───────────────────────── hot cup sleeve ───────────────────────── */

export interface SleeveModel {
  cup: FrustumDims;
  heightMm: Mm;
  bottomYMm: Mm;
  fan: Fan;
}

/**
 * Corrugated / board sleeve (clutch) that slides down a cup until it grips: band of
 * `heightMm` starting `bottomYMm` above the table, radius = cup radius + board caliper.
 */
export function buildCupSleeve(cup: FrustumDims, thicknessMm = 0.6, heightMm?: Mm, bottomYMm?: Mm): SleeveModel {
  const h = heightMm ?? Math.min(75, Math.max(40, cup.H * 0.5));
  const y0 = bottomYMm ?? Math.max(10, cup.H * 0.18);
  const y1 = Math.min(cup.H - 8, y0 + h);
  const rb = cup.bottomD / 2;
  const rt = cup.topD / 2;
  const r = (y: number) => rb + ((rt - rb) * y) / cup.H + thicknessMm / 2;
  const fan = frustumFan(r(y0), r(y1), y0, y1, { seamMm: CUP_ALLOWANCES.sleeveSeamMm });
  return { cup: { ...cup }, heightMm: y1 - y0, bottomYMm: y0, fan };
}
