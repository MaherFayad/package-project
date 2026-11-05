import type { Mm } from "@/types";

/** Prepress for flexo / gravure film printing (mm). */
export const FLEX_BLEED_MM: Mm = 3;
export const FLEX_SAFE_MM: Mm = 3;
/** Extra clearance between live copy and the inner edge of a seal or fin. */
export const SEAL_CLEARANCE_MM: Mm = 2;

/** Press-to-close zipper track: band height and its centre below the top seal (tear-off zone). */
export const ZIPPER_BAND_MM: Mm = 10;
export const ZIPPER_BELOW_TOP_SEAL_MM: Mm = 20;

/** V tear notch cut into the edge of the top seal. */
export const TEAR_NOTCH_DEPTH_MM: Mm = 3;
export const TEAR_NOTCH_HEIGHT_MM: Mm = 4;

/** Hang holes punched in the header (top seal grows to fit). */
export const HANG_HOLE_ROUND_D_MM: Mm = 6;
export const HANG_HOLE_EURO = { w: 30, h: 8 } as const;
export const HANG_HOLE_MARGIN_MM: Mm = 4;

/** Default corner radius for round-corner pouches (clamped to the seal widths). */
export const ROUND_CORNER_R_MM: Mm = 6;

/** One-way degassing valve: base disc diameter and centre distance below the top edge. */
export const VALVE_D_MM: Mm = 21;
export const VALVE_HEIGHT_MM: Mm = 3;
export const VALVE_BELOW_TOP_MM: Mm = 45;

/** Pouch spout (10 mm bore) and bag-in-box gland (38 mm cap). */
export const SPOUT = { boreMm: 10, neckDMm: 14, capDMm: 22, heightMm: 24 } as const;
export const BIB_GLAND = { neckDMm: 32, capDMm: 38, heightMm: 30 } as const;

/** Tin tie: wire strip glued below the top seal, overhanging each side. */
export const TIN_TIE = { widthMm: 8, belowTopSealMm: 4, overhangMm: 15 } as const;

/** Mailer: adhesive flap height and its peel strip. */
export const MAILER_FLAP_MM: Mm = 40;
export const MAILER_ADHESIVE_MM: Mm = 15;

/** Sleeve: girth ease over the container, printed seam overlap, top shrink at full conform. */
export const SLEEVE_EASE = 0.03;
export const SLEEVE_SEAM_MM: Mm = 6;
export const SLEEVE_MAX_SHRINK = 0.45;

/** Film ply caliper used for seal fins (render only). */
export const FILM_THICKNESS_MM: Mm = 0.12;
