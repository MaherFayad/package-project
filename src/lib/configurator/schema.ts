import { z } from "zod";
import { FACE_IDS, STRUCTURE_CODES } from "@/types";
import { PRINT_SURFACE_KINDS, VESSEL_KINDS, VESSEL_MATERIAL_CODES } from "@/lib/vessels";
import {
  BOX_BOARD_CODES,
  CONFIG_FINISH_CODES,
  INSERT_KINDS,
  MAX_EXTRA_SPOTS_WITH_CMYK,
  MAX_QUANTITY,
  MAX_SPOT_INKS,
  MIN_QUANTITY,
  SPOT_INK_PATTERN,
  VESSEL_STOCK_CODES,
} from "./catalog";

/**
 * ModelConfig: ONE serialisable, zod-validated description of a configured pack, shared by
 * boxes (dieline structures) and vessels (bottles, jars, cans, tins, pouches, tubes).
 * The designer edits it, the rules engine checks it (`evaluateConfig`), the pricing mapping
 * turns it into a QuoteInput (`toPricingRequest`), the vendor mapping checks it against
 * printer capabilities (`vendorCanMake`), and the 3D finishes read its finish masks.
 *
 * The schema checks SHAPE (types, ranges that never depend on the model). What is valid for a
 * given model and material is the rules engine's job, so a half-edited config still parses and
 * the UI can explain what is wrong in Arabic and English.
 */

const mm = z.number().finite().positive().max(5000);

export const boxDimsSchema = z.object({ L: mm, W: mm, H: mm });
export const vesselDimsSchema = z.object({ D: mm, H: mm, G: mm.optional(), taper: z.number().finite().min(0).max(100).optional() });

export const boxModelSchema = z.object({ type: z.literal("box"), code: z.enum(STRUCTURE_CODES) });
export const vesselModelSchema = z.object({ type: z.literal("vessel"), code: z.enum(VESSEL_KINDS) });

const presetSize = z.object({ mode: z.literal("preset"), presetId: z.string().min(1).max(64) });

/** Size: a catalogue preset, or custom mm checked live against the model limits. */
export const boxSizeSchema = z.discriminatedUnion("mode", [presetSize, z.object({ mode: z.literal("custom"), dims: boxDimsSchema })]);
export const vesselSizeSchema = z.discriminatedUnion("mode", [presetSize, z.object({ mode: z.literal("custom"), dims: vesselDimsSchema })]);

export const printSidesSchema = z.enum(["OUTSIDE", "INSIDE", "BOTH"]);

const spotInk = z.string().trim().regex(SPOT_INK_PATTERN, "SPOT_INK_FORMAT");

/** SPOT = 1 to 4 spot inks (black counts as one). CMYK = process, plus up to 2 Pantone spots. */
export const colourSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("SPOT"), inks: z.array(spotInk).min(1).max(MAX_SPOT_INKS) }),
  z.object({ mode: z.literal("CMYK"), spots: z.array(spotInk).max(MAX_EXTRA_SPOTS_WITH_CMYK).default([]) }),
]);

/** Which artwork layers carry a finish (foil, spot UV, emboss). Ignored for coatings. */
export const finishMaskSchema = z.object({
  surface: z.enum(["outside", "inside"]).default("outside"),
  layerIds: z.array(z.string().min(1).max(128)).max(200).default([]),
});

export const finishSchema = z.object({
  code: z.enum(CONFIG_FINISH_CODES),
  mask: finishMaskSchema.optional(),
});

export const addOnsSchema = z
  .object({
    windowFilm: z
      .object({
        face: z.enum(FACE_IDS),
        film: z.boolean().default(true),
        widthRatio: z.number().min(0.15).max(0.8).optional(),
        heightRatio: z.number().min(0.15).max(0.8).optional(),
      })
      .nullable()
      .default(null),
    insert: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal(INSERT_KINDS[0]), rows: z.number().int().min(1).max(6), cols: z.number().int().min(1).max(6) }),
        z.object({ kind: z.literal(INSERT_KINDS[1]) }),
        z.object({ kind: z.literal(INSERT_KINDS[2]) }),
      ])
      .nullable()
      .default(null),
    handle: z.boolean().default(false),
    tearStrip: z.boolean().default(false),
  })
  .default({});

const common = {
  v: z.literal(1).default(1),
  printSides: printSidesSchema.default("OUTSIDE"),
  colour: colourSchema.default({ mode: "CMYK", spots: [] }),
  finishes: z.array(finishSchema).max(12).default([]),
  addOns: addOnsSchema,
  quantity: z.number().int().min(MIN_QUANTITY).max(MAX_QUANTITY),
};

export const boxConfigSchema = z.object({
  ...common,
  model: boxModelSchema,
  size: boxSizeSchema,
  material: z.enum(BOX_BOARD_CODES),
  /** Extra structure options passed to the dieline (thumb notch, lid depth, display front). */
  structure: z
    .object({ thumbNotch: z.boolean().optional(), lidHeightMm: mm.optional(), displayFront: z.boolean().optional() })
    .default({}),
});

export const vesselConfigSchema = z.object({
  ...common,
  model: vesselModelSchema,
  size: vesselSizeSchema,
  /** Label stock, or DIRECT_PRINT for packs printed on themselves (pouch, tube). */
  material: z.enum(VESSEL_STOCK_CODES),
  /** What the container is made of (glass, PET, aluminium…), for the 3D view. */
  container: z.enum(VESSEL_MATERIAL_CODES).optional(),
  /** Which print surfaces (wrap label, front, back, sleeve, neck, lid). */
  surfaces: z.array(z.enum(PRINT_SURFACE_KINDS)).min(1).max(6),
});

export const modelConfigSchema = z.union([boxConfigSchema, vesselConfigSchema]);

export type BoxDimsInput = z.infer<typeof boxDimsSchema>;
export type VesselDimsInput = z.infer<typeof vesselDimsSchema>;
export type ConfigPrintSides = z.infer<typeof printSidesSchema>;
export type ColourConfig = z.infer<typeof colourSchema>;
export type FinishMask = z.infer<typeof finishMaskSchema>;
export type FinishChoice = z.infer<typeof finishSchema>;
export type AddOns = z.infer<typeof addOnsSchema>;
export type BoxConfig = z.infer<typeof boxConfigSchema>;
export type VesselConfigInput = z.infer<typeof vesselConfigSchema>;
export type ModelConfig = BoxConfig | VesselConfigInput;
/** What callers may pass before defaults are applied. */
export type ModelConfigInput = z.input<typeof modelConfigSchema>;

export function isBoxConfig(c: ModelConfig): c is BoxConfig {
  return c.model.type === "box";
}

/** Parse untrusted input (API body, saved JSON). Throws a ZodError on bad shape. */
export function parseModelConfig(input: unknown): ModelConfig {
  const raw = input as { model?: { type?: string } } | null;
  // Pick the branch by model.type so errors point at the right fields.
  if (raw?.model?.type === "vessel") return vesselConfigSchema.parse(input);
  return boxConfigSchema.parse(input);
}

export function safeParseModelConfig(input: unknown): { success: true; data: ModelConfig } | { success: false; error: z.ZodError } {
  const raw = input as { model?: { type?: string } } | null;
  const r = raw?.model?.type === "vessel" ? vesselConfigSchema.safeParse(input) : boxConfigSchema.safeParse(input);
  return r.success ? { success: true, data: r.data } : { success: false, error: r.error };
}
