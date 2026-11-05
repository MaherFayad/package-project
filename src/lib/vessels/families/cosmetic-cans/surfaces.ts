import type { LocalizedText, Mm } from "@/types";
import { LABEL_BLEED_MM, LABEL_SAFE_MM, WRAP_OVERLAP_MM, bandSpec, discSpec, faceSpec, sectorFor, sleeveSpec } from "../../labels";
import { radiusAt, sectionPerimeter, squarenessAt, type SectionPoint } from "../../profile";
import { finishesForStock, stocksForSurface } from "../../stocks";
import type { LabelSpec, LabelStockCode, PrintSurfaceKind } from "../../types";
import type { CatalogueDims, CatalogueGeometry, CataloguePlacement, CataloguePrintSurface, CatalogueSurfaceKind, PrintProcess } from "./types";

/**
 * Print areas for the catalogue. Labels and sleeves reuse the core builders (bandSpec,
 * sleeveSpec, discSpec, faceSpec) so pricing and SVG export treat them exactly like core
 * labels. Direct print, IML, foils and blister cards use 3 mm bleed / 3 mm safe zone.
 */
export const DIRECT_BLEED_MM = 3;
export const DIRECT_SAFE_MM = 3;
/** Pull tab added to die-cut lidding foils, mm. */
export const FOIL_TAB_MM = 10;

const NAMES: Record<CatalogueSurfaceKind, LocalizedText> = {
  WRAP: { ar: "ملصق دائري كامل", en: "Wrap-around label" },
  FRONT: { ar: "ملصق أمامي", en: "Front label" },
  BACK: { ar: "ملصق خلفي", en: "Back label" },
  SHRINK_SLEEVE: { ar: "غلاف انكماش كامل", en: "Full shrink sleeve" },
  NECK: { ar: "ملصق العنق", en: "Neck label" },
  LID: { ar: "ملصق الغطاء", en: "Lid label" },
  DIRECT_PRINT: { ar: "طباعة مباشرة على العبوة", en: "Direct print (body)" },
  IML: { ar: "ملصق داخل القالب", en: "In-mould label" },
  LID_TOP: { ar: "طباعة سطح الغطاء", en: "Lid top print" },
  LID_FOIL: { ar: "رقاقة غلق حراري", en: "Heat-seal lidding foil" },
  CARD_FRONT: { ar: "وجه الشريط", en: "Blister face" },
  CARD_BACK: { ar: "ظهر الشريط", en: "Blister back" },
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Wrap a core LabelSpec into the catalogue shape. */
export function fromCore(spec: LabelSpec, process: PrintProcess = spec.kind === "SHRINK_SLEEVE" ? "sleeve" : "label"): CataloguePrintSurface {
  const safe = spec.safeMm;
  return {
    ...spec,
    process,
    placement: spec.placement,
    safeWidthMm: round1(Math.max(0, spec.trimWidthMm - (spec.overlapMm ?? 0) - 2 * safe)),
    safeHeightMm: round1(Math.max(0, spec.trimHeightMm - 2 * safe)),
  };
}

interface RawOpts {
  kind: CatalogueSurfaceKind;
  process: PrintProcess;
  placement: CataloguePlacement;
  shape: CataloguePrintSurface["shape"];
  trimW: Mm;
  trimH: Mm;
  areaMm2: number;
  bleed?: Mm;
  safe?: Mm;
  stocks?: LabelStockCode[];
  extra?: Partial<CataloguePrintSurface>;
  warnings?: string[];
}

function raw(o: RawOpts): CataloguePrintSurface {
  const bleed = o.bleed ?? DIRECT_BLEED_MM;
  const safe = o.safe ?? DIRECT_SAFE_MM;
  const stocks = o.stocks ?? [];
  const defaultStock = stocks[0] ?? null;
  return {
    id: o.kind.toLowerCase(),
    kind: o.kind,
    process: o.process,
    name: NAMES[o.kind],
    shape: o.shape,
    placement: o.placement,
    trimWidthMm: round1(o.trimW),
    trimHeightMm: round1(o.trimH),
    bleedMm: bleed,
    safeMm: safe,
    printWidthMm: round1(o.trimW + 2 * bleed),
    printHeightMm: round1(o.trimH + 2 * bleed),
    safeWidthMm: round1(Math.max(0, o.trimW - (o.extra?.overlapMm ?? 0) - 2 * safe)),
    safeHeightMm: round1(Math.max(0, o.trimH - 2 * safe)),
    trimAreaM2: o.areaMm2 / 1e6,
    stocks,
    defaultStock,
    finishes: defaultStock ? finishesForStock(defaultStock) : [],
    warnings: o.warnings ?? [],
    ...o.extra,
  };
}

/** Girth of the profile section at y (round or rounded rectangle). */
export function girthAt(g: CatalogueGeometry, y: Mm): Mm {
  const p = g.profile!;
  const outer = p.outer as SectionPoint[];
  const s = p.section.kind === "round" ? 1 : squarenessAt(outer, y);
  return sectionPerimeter(p.section, radiusAt(outer, y), s);
}

/** Seamless 360 degree print (can body, tube, tin litho, case). */
export function directPrint(g: CatalogueGeometry, y0: Mm, y1: Mm, process: PrintProcess = "direct", kind: CatalogueSurfaceKind = "DIRECT_PRINT"): CataloguePrintSurface {
  const p = g.profile!;
  const b = p.body;
  const rAt = (y: number) => b.r0 + ((b.r1 - b.r0) * (y - b.y0)) / Math.max(1e-6, b.y1 - b.y0);
  const r0 = rAt(y0);
  const r1 = rAt(y1);
  const stocks: LabelStockCode[] = process === "iml" ? ["WHITE_BOPP", "CLEAR_BOPP"] : [];
  if (p.section.kind === "round" && Math.abs(r0 - r1) >= 0.25) {
    const { sector, trimW, trimH, areaMm2 } = sectorFor(r0, r1, y1 - y0, 2 * Math.PI, DIRECT_BLEED_MM);
    return raw({ kind, process, shape: "sector", placement: { type: "band", y0, y1, r0, r1, phiStart: -Math.PI, phiLength: 2 * Math.PI }, trimW, trimH, areaMm2, stocks, extra: { sector } });
  }
  const warnings: string[] = [];
  if (p.section.kind === "round") {
    const r = (r0 + r1) / 2;
    const w = 2 * Math.PI * r;
    const h = y1 - y0;
    return raw({ kind, process, shape: "rect", placement: { type: "band", y0, y1, r0, r1, phiStart: -Math.PI, phiLength: 2 * Math.PI }, trimW: w, trimH: h, areaMm2: w * h, stocks, extra: { overlapMm: 0 } });
  }
  const gw0 = girthAt(g, y0);
  const gw1 = girthAt(g, y1);
  if (Math.abs(gw0 - gw1) > 1) warnings.push(`direct.taperedRectApprox:${Math.round(Math.abs(gw0 - gw1))}`);
  const w = Math.max(gw0, gw1);
  const h = y1 - y0;
  return raw({ kind, process, shape: "rect", placement: { type: "girth", y0, y1, perimeterStart: 0.5 }, trimW: w, trimH: h, areaMm2: w * h, stocks, warnings, extra: { overlapMm: 0 } });
}

/** Round lid / foil disc; foils get a pull tab. */
export function lidDisc(kind: "LID" | "LID_FOIL", y: Mm, radius: Mm): CataloguePrintSurface {
  if (kind === "LID") return fromCore(discSpec(y, radius));
  const d = 2 * radius;
  return raw({
    kind,
    process: "foil",
    shape: "circle",
    placement: { type: "disc", y, radius },
    trimW: d,
    trimH: d + FOIL_TAB_MM,
    areaMm2: Math.PI * radius * radius + FOIL_TAB_MM * Math.min(20, d * 0.25),
    warnings: [`foil.pullTab:${FOIL_TAB_MM}`],
  });
}

/** Rectangular lid top (tub, sardine end, square tin, clamshell lid). */
export function lidRect(kind: "LID_TOP" | "LID_FOIL", y: Mm, halfW: Mm, halfD: Mm, cornerR: Mm): CataloguePrintSurface {
  const w = 2 * halfW;
  const h = 2 * halfD + (kind === "LID_FOIL" ? FOIL_TAB_MM : 0);
  return raw({
    kind,
    process: kind === "LID_FOIL" ? "foil" : "direct",
    shape: "rect",
    placement: { type: "top", y, x0: -halfW, x1: halfW, z0: -halfD, z1: halfD },
    trimW: w,
    trimH: h,
    areaMm2: w * 2 * halfD - (4 - Math.PI) * cornerR * cornerR,
    stocks: kind === "LID_TOP" ? ["WHITE_BOPP", "CLEAR_BOPP", "PAPER_SEMIGLOSS"] : [],
    extra: { cornerRadiusMm: round1(cornerR) },
  });
}

export function card(face: "front" | "back", g: CatalogueGeometry): CataloguePrintSurface {
  const bl = g.blister!;
  const kind = face === "front" ? "CARD_FRONT" : "CARD_BACK";
  const keepOut = face === "front" ? bl.cavities.map((c) => ({ x: c.x + DIRECT_BLEED_MM, y: c.y + DIRECT_BLEED_MM, d: c.d + 2 })) : undefined;
  return raw({
    kind,
    process: "card",
    shape: "rect",
    placement: { type: "card", face, widthMm: bl.widthMm, heightMm: bl.heightMm },
    trimW: bl.widthMm,
    trimH: bl.heightMm,
    areaMm2: bl.widthMm * bl.heightMm,
    extra: { keepOut, cornerRadiusMm: 2 },
  });
}

/** Every requested surface for a built geometry. Unsupported combinations are skipped. */
export function surfacesFor(g: CatalogueGeometry, d: CatalogueDims, wanted: CatalogueSurfaceKind[]): CataloguePrintSurface[] {
  const out: CataloguePrintSurface[] = [];
  if (g.kind === "blister") {
    for (const s of wanted) if (s === "CARD_FRONT" || s === "CARD_BACK") out.push(card(s === "CARD_FRONT" ? "front" : "back", g));
    return out;
  }
  const p = g.profile!;
  const b = p.body;
  const margin = Math.min(3, (b.y1 - b.y0) * 0.06);
  const y0 = b.y0 + margin;
  const y1 = b.y1 - margin;
  const rAt = (y: number) => b.r0 + ((b.r1 - b.r0) * (y - b.y0)) / Math.max(1e-6, b.y1 - b.y0);
  const round = p.section.kind === "round";
  const lid = g.lid;
  for (const s of wanted) {
    switch (s) {
      case "WRAP":
        if (round && y1 - y0 > 4) out.push(fromCore(bandSpec("WRAP", y0, y1, rAt(y0), rAt(y1), -Math.PI, 2 * Math.PI)));
        break;
      case "FRONT":
      case "BACK": {
        if (y1 - y0 <= 4) break;
        const cy = (y0 + y1) / 2;
        const h = (y1 - y0) * 0.86;
        if (round) {
          const span = (2 * Math.PI) / 2.3;
          const c = s === "FRONT" ? 0 : Math.PI;
          out.push(fromCore(bandSpec(s as PrintSurfaceKind, cy - h / 2, cy + h / 2, rAt(cy - h / 2), rAt(cy + h / 2), c - span / 2, span)));
        } else if (p.section.kind === "roundedRect") {
          const half = d.D / 2;
          const corner = Math.min(half * p.section.cornerRatio, half * p.section.depthRatio);
          const w = Math.max(4, Math.round((2 * half - 2 * corner) * 0.9));
          out.push(fromCore(faceSpec(s, -w / 2, w / 2, cy - h / 2, cy + h / 2)));
        }
        break;
      }
      case "SHRINK_SLEEVE":
        if (g.sleeveY1 - g.sleeveY0 > 4) out.push(fromCore(sleeveSpec(p, g.sleeveY0, g.sleeveY1), "sleeve"));
        break;
      case "NECK":
        if (round && p.shoulder && p.shoulder.y1 - p.shoulder.y0 > 3) {
          const sh = p.shoulder;
          out.push(fromCore(bandSpec("NECK", sh.y0, sh.y1, sh.r0, sh.r1, -Math.PI, 2 * Math.PI)));
        }
        break;
      case "DIRECT_PRINT":
        out.push(directPrint(g, g.printY0, g.printY1));
        break;
      case "IML":
        out.push(directPrint(g, g.printY0, g.printY1, "iml", "IML"));
        break;
      case "LID":
        if (lid && lid.section === "round" && lid.topR > 2) out.push(lidDisc("LID", lid.y1, lid.topR));
        break;
      case "LID_FOIL":
        if (lid) {
          if (lid.section === "round") out.push(lidDisc("LID_FOIL", lid.y1, lid.r - 0.5));
          else out.push(lidRect("LID_FOIL", lid.y1, lid.r - 0.5, (lid.r - 0.5) * lid.depthRatio, (lid.r - 0.5) * 0.18));
        }
        break;
      case "LID_TOP":
        if (lid && lid.section !== "round" && lid.topR > 2) {
          const sec = p.section.kind === "roundedRect" ? p.section : { cornerRatio: 0.16 };
          const hw = lid.topR;
          const hd = lid.topR * lid.depthRatio;
          out.push(lidRect("LID_TOP", lid.y1, hw, hd, Math.min(hw * sec.cornerRatio, hd)));
        }
        break;
      default:
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Flat <-> surface mapping (same contract as core flatPoint / surfaceUv, wider types)
// ---------------------------------------------------------------------------------------------

/** Flat print coordinates of surface point s (0..1 across, from the seam) t (0..1 bottom to top). */
export function printFlatPoint(spec: CataloguePrintSurface, s: number, t: number): { x: Mm; y: Mm } {
  const bleed = spec.bleedMm;
  if (spec.shape === "sector" && spec.sector) {
    const g = spec.sector;
    const a = (s - 0.5) * g.angle;
    const R = g.apexAbove ? g.outerRadiusMm - t * g.slantMm : g.innerRadiusMm + t * g.slantMm;
    return g.apexAbove ? { x: g.apexX + R * Math.sin(a), y: g.apexY + R * Math.cos(a) } : { x: g.apexX + R * Math.sin(a), y: g.apexY - R * Math.cos(a) };
  }
  const usableW = spec.trimWidthMm - (spec.overlapMm ?? 0);
  // foils: the tab hangs below the disc; the disc occupies the top of the trim box
  const usableH = spec.kind === "LID_FOIL" ? spec.trimHeightMm - FOIL_TAB_MM : spec.trimHeightMm;
  return { x: bleed + s * usableW, y: bleed + (1 - t) * usableH };
}

/** WebGL UV (v up) for a texture that covers the whole print area. */
export function printUv(spec: CataloguePrintSurface, s: number, t: number): [number, number] {
  const p = printFlatPoint(spec, s, t);
  return [p.x / spec.printWidthMm, 1 - p.y / spec.printHeightMm];
}

export { LABEL_BLEED_MM, LABEL_SAFE_MM, WRAP_OVERLAP_MM, stocksForSurface };
