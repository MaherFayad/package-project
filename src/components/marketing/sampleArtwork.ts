import type { ArtworkSurface, FaceId, StructureCode } from "@/types";
import type { DielineModel } from "@/lib/dieline";

/**
 * Sample "printed" artwork for marketing renders (fictional Egyptian brands). Used by the live
 * hero box and by scripts/marketing/CapturePage.tsx, so the static poster and the live 3D view
 * match. Brand names are invented; latin wordmarks are never mirrored in RTL.
 */
export interface SampleTheme {
  bg: string | null;
  ink: string;
  brand: string;
  tag: string;
}

const T = {
  nour: { bg: "#1f3d2b", ink: "#f3ead8", brand: "NOUR", tag: "atelier · cairo" },
  sabra: { bg: "#0f5c5a", ink: "#f4ecd9", brand: "Sabra", tag: "handmade in egypt" },
  nile: { bg: "#0e2a47", ink: "#ffffff", brand: "NILE", tag: "coffee roasters" },
  fatira: { bg: "#c0392b", ink: "#fff6e9", brand: "Fatira", tag: "pizza & bakery" },
  lamsa: { bg: "#5b2a4a", ink: "#f1d9a6", brand: "Lamsa", tag: "skin care" },
  khan: { bg: "#111111", ink: "#d4f36b", brand: "KHAN", tag: "streetwear" },
  bayt: { bg: "#b5532f", ink: "#fbefe3", brand: "BAYT", tag: "home goods" },
  souq: { bg: "#e0a526", ink: "#2a1a00", brand: "Souq", tag: "fresh market" },
  kraft: { bg: null, ink: "#1a1a1a", brand: "ELBA", tag: "" },
} satisfies Record<string, SampleTheme>;

export const STRUCTURE_THEME: Record<StructureCode, SampleTheme> = {
  FEFCO_0427: T.nour,
  FEFCO_0201: T.kraft,
  ECMA_RTE: T.lamsa,
  ECMA_STE: T.sabra,
  PIZZA: T.fatira,
  SLEEVE: T.souq,
  FEFCO_0320: T.bayt,
  ECMA_CLB: T.lamsa,
  ECMA_SLB: T.sabra,
  FEFCO_0422: T.souq,
  GABLE_BOX: T.nile,
  PAPER_TUBE: T.khan,
  RIGID_BOX: T.khan,
  ROLL_LABEL: T.sabra,
  PRINTED_POUCH: T.souq,
  PRINTED_TUBE: T.lamsa,
  PAPER_BAG: T.kraft,
};

export function sampleArtwork(model: DielineModel, th: SampleTheme): ArtworkSurface {
  const font = "Inter" as const;
  const layers: ArtworkSurface["layers"] = [];
  for (const [id, f] of Object.entries(model.faces) as [FaceId, { width: number; height: number }][]) {
    const big = id === "top" || id === "front";
    const size = Math.max(10, Math.min(f.width / 5, f.height / 2.2) * (big ? 1.6 : 1));
    layers.push({
      id: `t-${id}`, kind: "text", face: id, surface: "outside", x: f.width / 2, y: f.height * (big && th.tag ? 0.46 : 0.5),
      width: f.width * 0.9, height: f.height * 0.5, rotation: 0, text: th.brand, fontFamily: font,
      fontSizePt: size * 2.2, fontWeight: 700, color: th.ink, align: "center", direction: "ltr",
    });
    if (big && th.tag) {
      layers.push({
        id: `s-${id}`, kind: "text", face: id, surface: "outside", x: f.width / 2, y: f.height * 0.72,
        width: f.width * 0.9, height: f.height * 0.2, rotation: 0, text: th.tag, fontFamily: font,
        fontSizePt: size * 0.55, fontWeight: 500, color: th.ink, align: "center", direction: "ltr",
      });
    }
  }
  return { background: th.bg, layers };
}
