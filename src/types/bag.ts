/**
 * Paper carrier bags (src/lib/dieline/families/bags). The handle is part of the design: it changes
 * the die (eyelet holes, die-cut hand hole, reinforcement patches), the 3D model and the price.
 * Stored in DesignDoc.features.bagHandle. Enum-like values are string unions (add values additively).
 */
export const BAG_HANDLE_KINDS = [
  "TWISTED_PAPER", // twisted kraft paper cord, glued under the turnover on a paper patch (machine bags)
  "FLAT_PAPER", //    flat paper tape loop, glued under the turnover (machine bags)
  "COTTON_ROPE", //   cotton cord through punched eyelet holes, knotted inside (boutique bags)
  "PP_ROPE", //       polypropylene cord through eyelet holes, knotted inside
  "SATIN_RIBBON", //  satin ribbon through eyelet holes, knotted inside
  "GROSGRAIN_RIBBON", // grosgrain ribbon, glued inside the turnover
  "DIE_CUT", //       hand hole die-cut (paper: through the turnover and a board patch; film: plain, no patch)
  "NONE", //          no handle (SOS and merchandise bags)
  // Added with plastic bags (film and non-woven):
  "TSHIRT", //        T-shirt (vest) handles: the film cut away in a U between two straps
  "DIE_CUT_PATCH", // die-cut hand hole reinforced by a welded film patch
  "KIDNEY", //        die-cut kidney (bean) shaped hand hole
  "SOFT_LOOP", //     soft film loop welded to the top of each face
  "RIGID_CLIP", //    rigid plastic clip handle snapped over the mouth
  "DRAWSTRING", //    cord drawn through a top hem
  "SEWN_STRAP", //    non-woven straps sewn inside the mouth (reusable bags)
] as const;
export type BagHandleKind = (typeof BAG_HANDLE_KINDS)[number];

/** Handle colours printers stock (sRGB for the 3D view; the printer matches the named colour). */
export const BAG_HANDLE_COLORS = {
  KRAFT: "#9c6b3f",
  WHITE: "#f3f1ec",
  BLACK: "#1d1d1f",
  NAVY: "#1f2b4a",
  RED: "#9e1f2b",
  BURGUNDY: "#5e1a26",
  GREEN: "#2f5d3a",
  BEIGE: "#d8c6a2",
  PINK: "#e7b3bf",
  GOLD: "#c3a05a",
  SILVER: "#b9bcc1",
} as const;
export type BagHandleColor = keyof typeof BAG_HANDLE_COLORS;
export const BAG_HANDLE_COLOR_CODES = Object.keys(BAG_HANDLE_COLORS) as BagHandleColor[];

/** Film colour of a plastic bag: opaque white, clear (transparent) or an opaque coloured film. */
export const BAG_FILM_TONES = ["WHITE", "CLEAR", "COLOUR"] as const;
export type BagFilmTone = (typeof BAG_FILM_TONES)[number];

/** Gusset of a film bag: side gussets, a bottom gusset or none (flat). */
export const BAG_GUSSETS = ["SIDE", "BOTTOM", "NONE"] as const;
export type BagGusset = (typeof BAG_GUSSETS)[number];

export interface BagFilmChoice {
  tone: BagFilmTone;
  /** COLOUR tone only: the film colour (named, from BAG_HANDLE_COLORS). */
  color?: BagHandleColor;
  gusset?: BagGusset;
}

export interface BagHandleChoice {
  kind: BagHandleKind;
  color: BagHandleColor;
}
