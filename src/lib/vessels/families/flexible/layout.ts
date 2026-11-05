import type { LocalizedText, Mm } from "@/types";
import {
  FLEX_BLEED_MM,
  FLEX_SAFE_MM,
  HANG_HOLE_EURO,
  HANG_HOLE_ROUND_D_MM,
  MAILER_FLAP_MM,
  SEAL_CLEARANCE_MM,
  SLEEVE_MAX_SHRINK,
  SLEEVE_SEAM_MM,
  TIN_TIE,
  VALVE_BELOW_TOP_MM,
  VALVE_D_MM,
  ZIPPER_BAND_MM,
  ZIPPER_BELOW_TOP_SEAL_MM,
} from "./constants";
import { definitionFor } from "./definitions";
import { headerHeight, type FlexConfig } from "./schema";
import type { FlatRect, FlexPanelId, FlexPrintLayout, FlexPrintPanel } from "./types";

export const PANEL_NAMES: Record<FlexPanelId, LocalizedText> = {
  front: { ar: "الوجه الأمامي", en: "Front" },
  back: { ar: "الوجه الخلفي", en: "Back" },
  gussetLeft: { ar: "الطية اليسرى", en: "Left gusset" },
  gussetRight: { ar: "الطية اليمنى", en: "Right gusset" },
  bottom: { ar: "القاعدة", en: "Bottom" },
  sleeve: { ar: "الغلاف", en: "Sleeve" },
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Window rectangle on the front face (face coordinates, mm). */
export function windowRect(cfg: FlexConfig): FlatRect {
  const { W, H } = cfg.dims;
  const w = Math.round(W * 0.4);
  const h = Math.round(H * 0.28);
  return { x: (W - w) / 2, y: Math.round(H * 0.58 - h / 2), w, h };
}

/** Is this style a centre-seal tube (no side seals, folded side edges)? */
export function isTube(cfg: FlexConfig) {
  const c = definitionFor(cfg.code).construction;
  return c.model === "pillow" && c.seals.side === 0;
}

/** Height of the visible face that folds into the base (side-gusset block bottom). */
export function baseFoldMm(cfg: FlexConfig): Mm {
  const c = definitionFor(cfg.code).construction;
  return c.model === "box" && c.backFin > 0 && c.cornerFins === 0 ? (cfg.dims.G ?? 0) / 2 : 0;
}

/** Print layout for every face of a configured pack (bleed 3 mm, safe 3 mm + seal clearance). */
export function printLayout(cfg: FlexConfig): FlexPrintLayout {
  const def = definitionFor(cfg.code);
  const c = def.construction;
  const { W, H } = cfg.dims;
  const G = cfg.dims.G ?? 0;
  const o = cfg.options;
  const bleed = FLEX_BLEED_MM;
  const safe = FLEX_SAFE_MM;
  const top = headerHeight(cfg.code, o);
  const bottom = c.bottomFold ? 0 : c.seals.bottom;
  const side = c.seals.side;
  const warnings: string[] = [];
  const mailerFlap = o.adhesiveFlap ? MAILER_FLAP_MM : 0;

  const at = (r: FlatRect): FlatRect => ({ x: r1(r.x + bleed), y: r1(r.y + bleed), w: r1(r.w), h: r1(r.h) });

  const panel = (id: FlexPanelId, trimW: Mm, trimH: Mm, margins: { l: Mm; r: Mm; t: Mm; b: Mm }, seals: FlatRect[], origin = { x: 0, y: 0 }): FlexPrintPanel => {
    const ml = Math.max(safe, margins.l);
    const mr = Math.max(safe, margins.r);
    const mt = Math.max(safe, margins.t);
    const mb = Math.max(safe, margins.b);
    const safeRect = at({ x: ml, y: mt, w: Math.max(0, trimW - ml - mr), h: Math.max(0, trimH - mt - mb) });
    if (safeRect.w < 15 || safeRect.h < 15) warnings.push(`safe.tight:${id}`);
    return {
      id,
      name: PANEL_NAMES[id],
      trimWidthMm: r1(trimW),
      trimHeightMm: r1(trimH),
      bleedMm: bleed,
      safeMm: safe,
      printWidthMm: r1(trimW + 2 * bleed),
      printHeightMm: r1(trimH + 2 * bleed),
      safeRect,
      seals: seals.filter((s) => s.w > 0 && s.h > 0).map(at),
      keepOut: [],
      trimAreaM2: (trimW * trimH) / 1e6,
      faceOrigin: origin,
    };
  };

  const panels: FlexPrintPanel[] = [];
  const clr = SEAL_CLEARANCE_MM;

  if (c.model === "sleeve") {
    const C = 2 * W;
    const p = panel("sleeve", C + SLEEVE_SEAM_MM, H, { l: safe, r: SLEEVE_SEAM_MM + safe, t: safe + 2, b: safe + 2 }, []);
    p.keepOut.push({ kind: "seam", rect: at({ x: C, y: 0, w: SLEEVE_SEAM_MM, h: H }) });
    panels.push(p);
    const shrink = cfg.fill * SLEEVE_MAX_SHRINK;
    if (shrink > 0.3) warnings.push(`sleeve.distortion:${Math.round(shrink * 100)}%`);
  } else {
    const fold = baseFoldMm(cfg);
    for (const id of def.panels) {
      if (id === "front" || id === "back") {
        // the mailer flap is the unprinted inner side of the back ply folded over the front: no extra print area
        const extra = 0;
        const seals: FlatRect[] = [
          { x: 0, y: extra, w: W, h: top },
          { x: 0, y: extra + H - bottom, w: W, h: bottom },
          { x: 0, y: extra + top, w: side, h: H - top - bottom },
          { x: W - side, y: extra + top, w: side, h: H - top - bottom },
        ];
        if (extra) seals.push({ x: 0, y: 0, w: W, h: extra });
        const m = { l: side + clr, r: side + clr, t: extra + top + clr, b: bottom + clr + fold };
        if (c.model === "standup") m.b = Math.max(m.b, safe + 2);
        const p = panel(id, W, H + extra, m, seals, { x: 0, y: extra });
        const face = (r: FlatRect) => at({ ...r, y: r.y + extra });
        if (o.zipper) p.keepOut.push({ kind: "zipper", rect: face({ x: 0, y: top + ZIPPER_BELOW_TOP_SEAL_MM - ZIPPER_BAND_MM / 2, w: W, h: ZIPPER_BAND_MM }) });
        if (c.backFin > 0 && id === "back") p.keepOut.push({ kind: "fin", rect: face({ x: W / 2 - c.backFin, y: 0, w: c.backFin, h: H }) });
        if (o.hangHole !== "none") {
          const hw = o.hangHole === "round" ? HANG_HOLE_ROUND_D_MM : HANG_HOLE_EURO.w;
          const hh = o.hangHole === "round" ? HANG_HOLE_ROUND_D_MM : HANG_HOLE_EURO.h;
          p.keepOut.push({ kind: "hangHole", rect: face({ x: W / 2 - hw / 2 - 2, y: top / 2 - hh / 2 - 2, w: hw + 4, h: hh + 4 }) });
        }
        if (id === "front") {
          if (o.valve) p.keepOut.push({ kind: "valve", rect: face({ x: W / 2 - VALVE_D_MM / 2 - 2, y: VALVE_BELOW_TOP_MM - VALVE_D_MM / 2 - 2, w: VALVE_D_MM + 4, h: VALVE_D_MM + 4 }) });
          if (o.tinTie) p.keepOut.push({ kind: "tinTie", rect: face({ x: 0, y: top + TIN_TIE.belowTopSealMm, w: W, h: TIN_TIE.widthMm }) });
          if (o.spout === "corner") p.keepOut.push({ kind: "spout", rect: face({ x: W - 35, y: 0, w: 35, h: 35 }) });
          if (o.spout === "top") p.keepOut.push({ kind: "spout", rect: face({ x: W / 2 - 15, y: 0, w: 30, h: top + 10 }) });
          if (o.spout === "front") p.keepOut.push({ kind: "spout", rect: face({ x: W / 2 - 25, y: top + 15, w: 50, h: 50 }) });
          if (o.adhesiveFlap) p.keepOut.push({ kind: "flap", rect: face({ x: 0, y: 0, w: W, h: MAILER_FLAP_MM }) });
          if (o.window) {
            const w = windowRect(cfg);
            p.window = at(w);
            p.keepOut.push({ kind: "window", rect: at(w) });
            if (cfg.material === "FILM_KRAFT_LAMINATE") warnings.push("window.kraftCutOut");
          }
        }
        panels.push(p);
      } else if (id === "gussetLeft" || id === "gussetRight") {
        const p = panel(id, G, H, { l: clr + 1, r: clr + 1, t: top + clr, b: clr + fold }, [{ x: 0, y: 0, w: G, h: top }]);
        if (G < 50) warnings.push(`gusset.narrow:${id}`);
        panels.push(p);
      } else if (id === "bottom") {
        panels.push(panel(id, W, G, { l: side + clr, r: side + clr, t: clr + 2, b: clr + 2 }, []));
      }
    }
  }

  // Flat film blank (one pack)
  let blank: FlexPrintLayout["blank"];
  if (c.model === "sleeve") {
    const w = 2 * W + SLEEVE_SEAM_MM;
    blank = { widthMm: w, lengthMm: H, areaM2: (w * H) / 1e6, note: "lay-flat tube: circumference 2W + seam overlap" };
  } else if (c.model === "standup") {
    blank = { widthMm: W, lengthMm: 2 * H + G, areaM2: (W * (2 * H + G)) / 1e6, note: "front + back + W-folded bottom gusset" };
  } else if (c.model === "box") {
    const fins = c.backFin > 0 ? 2 * c.backFin : 8 * c.cornerFins;
    const w = 2 * W + 2 * G + fins;
    const bottomArea = def.panels.includes("bottom") ? W * G : 0;
    blank = { widthMm: w, lengthMm: H, areaM2: (w * H + bottomArea) / 1e6, note: c.backFin > 0 ? "one web: 2W + 2G + 2 x fin" : "faces + gussets + 4 corner seals, plus bottom panel" };
  } else if (isTube(cfg)) {
    const w = 2 * W + 2 * c.backFin;
    blank = { widthMm: w, lengthMm: H, areaM2: (w * H) / 1e6, note: "one web formed into a tube: 2W + 2 x fin" };
  } else if (c.bottomFold) {
    const L = 2 * H + mailerFlap;
    blank = { widthMm: W, lengthMm: L, areaM2: (W * L) / 1e6, note: mailerFlap ? "one web folded at the bottom + adhesive flap" : "one web folded at the bottom" };
  } else {
    blank = { widthMm: W, lengthMm: 2 * H, areaM2: (2 * W * H) / 1e6, note: "two webs W x H sealed on four edges" };
  }

  return {
    code: cfg.code,
    panels,
    blank: { ...blank, widthMm: r1(blank.widthMm), lengthMm: r1(blank.lengthMm) },
    totalTrimAreaM2: panels.reduce((a, p) => a + p.trimAreaM2, 0),
    warnings,
  };
}

/** UV (0..1, v up) on a panel's print area for flat face coordinates (s across, t down from the face top). */
export function panelUv(panel: FlexPrintPanel, s: Mm, t: Mm): [number, number] {
  const x = panel.bleedMm + panel.faceOrigin.x + s;
  const y = panel.bleedMm + panel.faceOrigin.y + t;
  return [x / panel.printWidthMm, 1 - y / panel.printHeightMm];
}

/** A rectangle in print coordinates as a UV box (u0, v0 bottom-left; u1, v1 top-right). */
export function rectUv(panel: FlexPrintPanel, r: FlatRect): { u0: number; v0: number; u1: number; v1: number } {
  return { u0: r.x / panel.printWidthMm, u1: (r.x + r.w) / panel.printWidthMm, v0: 1 - (r.y + r.h) / panel.printHeightMm, v1: 1 - r.y / panel.printHeightMm };
}
