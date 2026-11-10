/**
 * Store (carrier) bags family: kraft machine bags, SOS bags, laminated art-paper boutique and gift
 * bags, die-cut handle bags and bottle bags. See README.md.
 */
import type { BagFilmChoice, Dims, StructureFeatures } from "@/types";
import { BAG_HANDLE_COLORS } from "@/types";
import type { DielineModel } from "../../types";
import { FamilyValidationError, filterFeatures, finalizeDraft, validateDielineDims } from "../foodservice/engine";
import type { FoodserviceCode } from "../foodservice/types";
import { ALL_BAG_DEFINITIONS, BAG_CODE_ALIASES, DEFINITIONS, PLASTIC_DEFINITIONS, bagDefinitionOf } from "./definitions";
import { filmBagDraft } from "./film";
import { bagStockOf } from "./types";
import { bagDraft, GUSSET_CREASE_DEG } from "./generator";
import { resolveHandle } from "./handles";
import type { BagCode, BagDefinition, BagSpec } from "./types";

export { DEFINITIONS, PLASTIC_DEFINITIONS, ALL_BAG_DEFINITIONS, BAG_CODE_ALIASES, bagDefinitionOf };
export { filmBagDraft, FILM_CREASE_DEG } from "./film";
export * from "./types";
export * from "./handles";
export { bagDraft, GUSSET_CREASE_DEG, glueSeamFor, bottomLapFor } from "./generator";

/** Paper calipers (mm): kraft 80 / 120 gsm, white kraft 120, laminated art 170 / 210 / 250 gsm. */
export const BAG_PAPER_CALIPER: Record<string, number> = {
  BAG_KRAFT_80: 0.11,
  BAG_KRAFT_120: 0.16,
  BAG_WHITE_KRAFT_120: 0.15,
  BAG_ART_170: 0.18,
  BAG_ART_210: 0.22,
  BAG_ART_250: 0.27,
  PE_HDPE_50: 0.05,
  PE_LDPE_50: 0.05,
  PE_LDPE_70: 0.07,
  PE_LDPE_100: 0.1,
  NONWOVEN_PP_80: 0.4,
  NONWOVEN_PP_100: 0.5,
};

/** Film tone and gusset a design gets: the requested ones when the model offers them, else its defaults. */
export function resolveFilm(def: BagDefinition, req?: Partial<BagFilmChoice> | null): BagFilmChoice | null {
  if (bagStockOf(def) === "paper") return null;
  const tones = def.tones ?? ["WHITE"];
  const tone = req?.tone && tones.includes(req.tone) ? req.tone : (def.defaultTone ?? tones[0]);
  const gussets = def.gussets ?? ["SIDE"];
  const gusset = req?.gusset && gussets.includes(req.gusset) ? req.gusset : gussets[0];
  return { tone, gusset, ...(tone === "COLOUR" ? { color: req?.color ?? def.defaultFilmColor ?? "RED" } : {}) };
}

export const bagDefinition = (code: string): BagDefinition | null => bagDefinitionOf(code);

export type BagModel = DielineModel & { bag: BagSpec };

/** Validate the size and build the die, the open-bag fold and the handles. Throws on invalid dims. */
export function buildBag(code: BagCode, dims: Dims, opts: { thicknessMm?: number; features?: StructureFeatures | null; bleedMm?: number } = {}): BagModel {
  const def = bagDefinition(code);
  if (!def) throw new Error(`Unknown bag code ${code}`);
  const v = validateDielineDims(def.params, dims);
  if (!v.ok) throw new FamilyValidationError(v.issues);
  const t = opts.thicknessMm ?? BAG_PAPER_CALIPER[def.materials[0]] ?? 0.15;
  if (!(t > 0 && t <= 2)) throw new FamilyValidationError([{ path: "thicknessMm", code: "INVALID" }]);
  const handle = resolveHandle(def, opts.features?.bagHandle);
  const stock = bagStockOf(def);
  const film = resolveFilm(def, opts.features?.bagFilm);
  const features: StructureFeatures = { ...filterFeatures(def.features, opts.features ?? undefined), bagHandle: handle, ...(film ? { bagFilm: film } : {}) };
  const draft =
    stock === "paper"
      ? bagDraft(v.value, t, features, { code: def.code, handle, baseInsert: def.baseInsert })
      : filmBagDraft(v.value, t, features, { code: def.code, handle, gusset: film!.gusset ?? "SIDE", stock });
  const model = finalizeDraft(def.code as unknown as FoodserviceCode, v.value, draft, { thicknessMm: t, bleedMm: opts.bleedMm, features, safeMm: 5 }) as unknown as DielineModel;
  const paperAreaM2 = (draft.paperBlank.width * draft.paperBlank.height) / 1e6;
  const out: BagModel = {
    ...model,
    structureCode: stock === "paper" ? "PAPER_BAG" : "PLASTIC_BAG",
    features,
    accessories: draft.accessories,
    // Pricing reads the printed paper blank; board inserts and patches are priced per handle kind.
    metrics: { ...model.metrics, blankAreaM2: paperAreaM2 },
    bag: {
      code: def.code,
      dims: v.value,
      turnoverMm: draft.turnoverMm,
      glueSeamMm: draft.glueSeamMm,
      bottomFlapMm: draft.bottomFlapMm,
      gussetCreaseDeg: GUSSET_CREASE_DEG,
      handle: {
        kind: handle.kind,
        color: handle.color,
        hex: BAG_HANDLE_COLORS[handle.color],
        spanMm: draft.handle.spanMm,
        loopHeightMm: draft.handle.loopHeightMm,
        sizeMm: draft.handle.sizeMm,
        holeDiameterMm: draft.handle.holeDiameterMm,
      },
      parts: draft.parts,
      paperAreaM2,
      ...(film ? { film } : {}),
    },
  };
  return out;
}
