import type { Mm } from "@/types";
import type { LidDims, MeshData, PrintArea } from "./types";

/**
 * Cup and bowl lids as revolved (lathe) parts, like src/lib/vessels profiles: outer profile
 * points (r, y) from the skirt bottom to the top centre. y = 0 is the bottom of the skirt,
 * which sits on the cup rim (rim curl). Generic shapes only.
 */
export interface LidProfilePoint {
  r: Mm;
  y: Mm;
}

export interface LidModel {
  dims: LidDims;
  role: "cup-lid" | "bowl-lid";
  profile: LidProfilePoint[];
  /** Flat printable disc on top (paper lids); null for clear/plastic lids (emboss only). */
  topDisc: { y: Mm; radius: Mm } | null;
  print: PrintArea | null;
  /** Drink-through opening (cup lids), centred at the front. */
  sipHole?: { r: Mm; widthMm: Mm; heightMm: Mm };
}

const SKIRT_MM = 7;
const LIP_MM = 2.5;

export function lidProfile(role: "cup-lid" | "bowl-lid", d: LidDims): LidProfilePoint[] {
  const R = d.rimD / 2 + LIP_MM; // skirt grips over the rim curl
  const H = d.H;
  if (role === "bowl-lid") {
    return [
      { r: R, y: 0 },
      { r: R, y: Math.min(SKIRT_MM, H * 0.7) },
      { r: R - 1.5, y: H },
      { r: 0, y: H },
    ];
  }
  // Cup lid: skirt, inner seal ledge, raised dome with recessed sip deck.
  return [
    { r: R, y: 0 },
    { r: R + 0.5, y: SKIRT_MM * 0.5 },
    { r: R, y: SKIRT_MM },
    { r: R - LIP_MM - 1, y: SKIRT_MM + 1 },
    { r: R - LIP_MM - 3, y: H * 0.85 },
    { r: R - LIP_MM - 6, y: H },
    { r: (R - LIP_MM) * 0.55, y: H },
    { r: (R - LIP_MM) * 0.5, y: H - 2 },
    { r: 0, y: H - 2 },
  ];
}

function discPrint(radius: Mm, bleed = 3, safe = 3): PrintArea {
  const circle = (r: number, c: number) => Array.from({ length: 64 }, (_, i) => ({ x: c + r * Math.cos((i / 64) * 2 * Math.PI), y: c + r * Math.sin((i / 64) * 2 * Math.PI) }));
  const c = radius + bleed;
  return {
    trim: circle(radius, c),
    bleed: circle(radius + bleed, c),
    safe: circle(Math.max(0, radius - safe), c),
    widthMm: 2 * c,
    heightMm: 2 * c,
    bleedMm: bleed,
    safeMm: safe,
    trimAreaM2: (Math.PI * radius * radius) / 1e6,
  };
}

export function buildLid(role: "cup-lid" | "bowl-lid", d: LidDims, printable: boolean): LidModel {
  const profile = lidProfile(role, d);
  const top = role === "bowl-lid" ? { y: d.H, radius: d.rimD / 2 - 1 } : { y: d.H - 2, radius: profile[7].r };
  return {
    dims: { ...d },
    role,
    profile,
    topDisc: printable ? top : null,
    print: printable ? discPrint(top.radius) : null,
    ...(role === "cup-lid" ? { sipHole: { r: d.rimD / 2 - 7, widthMm: Math.min(12, d.rimD * 0.14), heightMm: 4 } } : {}),
  };
}

/** Revolve a lid profile (Y axis). UVs are a planar top projection, so a disc print maps 1:1. */
export function latheMesh(profile: LidProfilePoint[], segments = 64): MeshData {
  const rMax = Math.max(...profile.map((p) => p.r));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j < profile.length; j++) {
    for (let i = 0; i <= segments; i++) {
      const phi = (i / segments) * 2 * Math.PI;
      const x = profile[j].r * Math.sin(phi);
      const z = profile[j].r * Math.cos(phi);
      positions.push(x, profile[j].y, z);
      uvs.push(0.5 + x / (2 * rMax), 0.5 - z / (2 * rMax));
    }
  }
  const row = segments + 1;
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * row + i;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}
