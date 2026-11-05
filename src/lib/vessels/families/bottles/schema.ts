import { z } from "zod";
import { BOTTLE_CLOSURES } from "./closures";
import { FINISHES } from "./finishes";
import { BOTTLE_CLOSURE_CODES, BOTTLE_MATERIAL_CODES, type BottleDefinition, type VesselDims } from "./types";
import { PRINT_SURFACE_KINDS } from "../../index";

const rangeOf = (r: { min: number; max: number }) => z.number().finite().min(r.min).max(r.max);

/** Zod schema for the dims of one model (mm). Limits + aspect ratio + section rules. */
export function dimsSchemaFor(def: BottleDefinition) {
  const l = def.limits;
  return z
    .object({
      D: rangeOf(l.D),
      H: rangeOf(l.H),
      G: l.G ? rangeOf(l.G).optional() : z.undefined().optional(),
      taper: l.taper ? rangeOf(l.taper).optional() : z.undefined().optional(),
    })
    .strict()
    .superRefine((d, ctx) => {
      const ratio = d.H / d.D;
      if (ratio < def.aspect.min || ratio > def.aspect.max)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["H"], message: `dims.aspect:${def.aspect.min}-${def.aspect.max}` });
      if (d.G !== undefined && d.G > d.D) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["G"], message: "dims.depthOverWidth" });
      if (d.taper !== undefined && d.taper > d.D * 0.3) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["taper"], message: "dims.taperTooLarge" });
    });
}

export type DimsResult = { ok: true; dims: VesselDims } | { ok: false; errors: string[] };

export function validateBottleDims(def: BottleDefinition, dims: unknown): DimsResult {
  const r = dimsSchemaFor(def).safeParse(dims);
  if (r.success) return { ok: true, dims: r.data as VesselDims };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

const localized = z.object({ ar: z.string().min(2), en: z.string().min(2) });
/** Arabic copy: no diacritics (tashkeel U+064B-U+0652, U+0670) and no Latin-only strings. */
const arabic = z
  .string()
  .min(2)
  .refine((s) => !/[ً-ْٰ]/.test(s), "ar.diacritics")
  .refine((s) => /[؀-ۿ]/.test(s), "ar.notArabic");
const localizedAr = z.object({ ar: arabic, en: z.string().min(2) });
const finishId = z.string().refine((s) => s in FINISHES, "finish.unknown");

/** Structural schema every definition must satisfy (run in tests). */
export const definitionSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: localizedAr,
    description: localizedAr,
    standard: z.string().min(4),
    materials: z.array(z.enum(BOTTLE_MATERIAL_CODES)).min(1),
    defaultMaterial: z.enum(BOTTLE_MATERIAL_CODES),
    finishes: z.array(finishId).min(1),
    closures: z.array(z.enum(BOTTLE_CLOSURE_CODES)).min(1),
    defaultClosure: z.enum(BOTTLE_CLOSURE_CODES),
    presets: z
      .array(z.object({ id: z.string().min(2), name: localizedAr, capacityMl: z.number().positive(), finish: finishId, egypt: z.boolean(), source: z.string().min(8), dims: z.any() }))
      .min(2)
      .max(4),
    defaultPresetId: z.string(),
    surfaces: z.array(z.enum(PRINT_SURFACE_KINDS)).min(1),
    defaultSurfaces: z.array(z.enum(PRINT_SURFACE_KINDS)).min(1),
    typicalUses: z.array(localized).min(2),
  })
  .passthrough()
  .superRefine((d, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (!d.materials.includes(d.defaultMaterial)) issue("defaultMaterial not offered");
    if (!d.closures.includes(d.defaultClosure)) issue("defaultClosure not offered");
    if (!d.presets.some((p) => p.id === d.defaultPresetId)) issue("defaultPresetId missing");
    for (const s of d.defaultSurfaces) if (!d.surfaces.includes(s)) issue(`default surface ${s} not offered`);
    for (const p of d.presets) if (!d.finishes.includes(p.finish)) issue(`preset ${p.id} finish ${p.finish} not offered`);
    for (const f of d.finishes) {
      const kind = FINISHES[f as keyof typeof FINISHES].kind;
      if (!d.closures.some((c) => BOTTLE_CLOSURES[c].fits.includes(kind))) issue(`no closure fits finish ${f}`);
    }
  });
