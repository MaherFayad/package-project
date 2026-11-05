import { z } from "zod";
import { HANG_HOLE_EURO, HANG_HOLE_MARGIN_MM, ZIPPER_BAND_MM, ZIPPER_BELOW_TOP_SEAL_MM } from "./constants";
import { definitionFor, resolveOptions } from "./definitions";
import { FILM_MATERIAL_CODES, FLEXIBLE_CODES, type FilmMaterialCode, type FlexDims, type FlexOptions, type FlexibleCode } from "./types";

/** Fully resolved configuration of one flexible pack. */
export interface FlexConfig {
  code: FlexibleCode;
  dims: FlexDims;
  /** 0 = empty (flat), 1 = fully filled / inflated. Sleeves: 0 = loose tube, 1 = fully shrunk. */
  fill: number;
  material: FilmMaterialCode;
  options: FlexOptions;
}

const optionsSchema = z
  .object({
    zipper: z.boolean(),
    spout: z.enum(["none", "corner", "top", "front"]),
    window: z.boolean(),
    tearNotch: z.boolean(),
    hangHole: z.enum(["none", "round", "euro"]),
    roundCorners: z.boolean(),
    valve: z.boolean(),
    tinTie: z.boolean(),
    adhesiveFlap: z.boolean(),
  })
  .partial();

/** Effective top seal (header) height: grows to fit a hang hole. */
export function headerHeight(code: FlexibleCode, options: Pick<FlexOptions, "hangHole">): number {
  const top = definitionFor(code).construction.seals.top;
  if (options.hangHole === "none") return top;
  const h = options.hangHole === "round" ? 6 : HANG_HOLE_EURO.h;
  return Math.max(top, h + 2 * HANG_HOLE_MARGIN_MM + 2);
}

/** zod schema for one style: limits in mm and construction rules. */
export function flexConfigSchema(code: FlexibleCode) {
  const def = definitionFor(code);
  const L = def.limits;
  const range = (r: { min: number; max: number }, label: string) =>
    z.number().finite().min(r.min, `${label} >= ${r.min} mm`).max(r.max, `${label} <= ${r.max} mm`);
  const dims = z.object({
    W: range(L.W, "W"),
    H: range(L.H, "H"),
    G: L.G ? range(L.G, "G") : z.number().optional(),
  });
  return z
    .object({
      code: z.literal(code),
      dims,
      fill: z.number().finite().min(0).max(1).default(def.defaultFill),
      material: z.enum(FILM_MATERIAL_CODES).default(def.defaultMaterial),
      options: optionsSchema.default({}),
    })
    .superRefine((v, ctx) => {
      const c = def.construction;
      const opts = resolveOptions(code, v.options);
      const { W, H } = v.dims;
      const G = v.dims.G ?? 0;
      const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      if (!def.materials.includes(v.material)) issue(["material"], `material ${v.material} not offered for ${code}`);
      for (const [k, val] of Object.entries(v.options)) {
        const on = typeof val === "boolean" ? val : val !== "none";
        if (on && !def.allowedOptions.includes(k as keyof FlexOptions)) issue(["options", k], `option ${k} not available for ${code}`);
      }
      const top = headerHeight(code, opts);
      if (W - 2 * c.seals.side - 2 * c.cornerFins < 10) issue(["dims", "W"], "inner width under 10 mm");
      if (H - top - c.seals.bottom < 20) issue(["dims", "H"], "inner height under 20 mm");
      if (c.model === "standup") {
        if (G > 0.75 * W) issue(["dims", "G"], "bottom gusset must be <= 75% of the width");
        if (G / 2 + top + 30 > H) issue(["dims", "G"], "bottom gusset leaves no room above it");
      }
      if (c.model === "box") {
        if (G > W) issue(["dims", "G"], "side gusset must not exceed the face width (it folds inside the top seal)");
        if (G / 2 + top + 30 > H) issue(["dims", "H"], "bag too short for its gusset");
      }
      if (opts.zipper && top + ZIPPER_BELOW_TOP_SEAL_MM + ZIPPER_BAND_MM + 30 > H) issue(["options", "zipper"], "pouch too short for a zipper");
      if (opts.spout === "corner" && W < 90) issue(["options", "spout"], "corner spout needs W >= 90 mm");
      if (opts.valve && (W < 60 || H < 140)) issue(["options", "valve"], "valve needs W >= 60 and H >= 140 mm");
      if (opts.hangHole === "euro" && W < HANG_HOLE_EURO.w + 30) issue(["options", "hangHole"], "euro slot needs W >= 60 mm");
      if (opts.window && v.material === "FILM_METALLISED") issue(["options", "window"], "a window needs a non-metallised film (or a de-metallised area)");
      if (opts.tearNotch && top < 6) issue(["options", "tearNotch"], "tear notch needs a seal of at least 6 mm");
    });
}

/** Validate any input into a resolved FlexConfig (throws ZodError on bad input). */
export function parseFlexConfig(input: unknown): FlexConfig {
  const codeOnly = z.object({ code: z.enum(FLEXIBLE_CODES) }).passthrough().parse(input);
  const parsed = flexConfigSchema(codeOnly.code).parse(input);
  const def = definitionFor(codeOnly.code);
  const G = def.limits.G ? parsed.dims.G ?? def.defaultDims.G : undefined;
  return {
    code: codeOnly.code,
    dims: { W: parsed.dims.W, H: parsed.dims.H, ...(G !== undefined ? { G } : {}) },
    fill: parsed.fill,
    material: parsed.material,
    options: resolveOptions(codeOnly.code, parsed.options as Partial<FlexOptions>),
  };
}

export function safeParseFlexConfig(input: unknown): { success: true; data: FlexConfig } | { success: false; error: z.ZodError } {
  try {
    return { success: true, data: parseFlexConfig(input) };
  } catch (e) {
    if (e instanceof z.ZodError) return { success: false, error: e };
    throw e;
  }
}

/** Default config of a style (default size, fill, material and options). */
export function defaultFlexConfig(code: FlexibleCode, presetId?: string): FlexConfig {
  const def = definitionFor(code);
  const preset = def.presets.find((p) => p.id === presetId);
  return parseFlexConfig({ code, dims: preset?.dims ?? def.defaultDims, fill: def.defaultFill, material: def.defaultMaterial, options: {} });
}
