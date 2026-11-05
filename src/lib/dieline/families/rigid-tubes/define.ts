import { z } from "zod";
import type { Dims, DimsPreset, StructureFeatures } from "@/types";
import { assembleDieline } from "./assemble";
import { FAMILY_MATERIALS } from "./materials";
import type { CatalogueDefinition, ConstructionSpec, DimsCheck, FamilyFeatureSupport, FamilyGenerator, GenerateOptions } from "./types";

export class FamilyValidationError extends Error {
  constructor(
    readonly code: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(`${code}: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`);
    this.name = "FamilyValidationError";
  }
}

export interface Rule {
  /** Shown to buyers / stored in params.rules. */
  text: string;
  path: "L" | "W" | "H";
  test: (d: Dims) => boolean;
}

export const NO_FEATURES: FamilyFeatureSupport = { windowFaces: [], thumbNotch: false, lidHeight: false, partitions: false, tearStrip: false, handle: false };

export const preset = (id: string, ar: string, en: string, dims: Dims, standard?: boolean): DimsPreset => ({ id, name: { ar, en }, dims, ...(standard ? { standard } : {}) });

export const thicknessSchema = z.number().finite().positive().max(20);

/** zod schema of a model's dims: limits per axis plus cross-axis rules. */
export function dimsSchemaFor(params: CatalogueDefinition["params"], rules: Rule[]) {
  const axis = (k: "L" | "W" | "H") => z.number().finite().min(params[k].min).max(params[k].max);
  return z.object({ L: axis("L"), W: axis("W"), H: axis("H") }).superRefine((d, ctx) => {
    for (const r of rules) if (!r.test(d)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [r.path], message: r.text });
  });
}

/** Drop features the model cannot make and apply defaults. */
export function supported(def: Pick<CatalogueDefinition, "features" | "defaultFeatures">, requested: StructureFeatures | undefined): StructureFeatures {
  const f = { ...def.defaultFeatures, ...requested };
  const s = def.features;
  const out: StructureFeatures = {};
  if (f.window && (s.windowFaces as string[]).includes(f.window.face)) {
    out.window = { ...f.window, widthRatio: Math.min(0.8, Math.max(0.2, f.window.widthRatio ?? 0.55)), heightRatio: Math.min(0.8, Math.max(0.2, f.window.heightRatio ?? 0.45)) };
  }
  if (f.thumbNotch && s.thumbNotch) out.thumbNotch = true;
  if (f.handle && s.handle) out.handle = true;
  if (f.tearStrip && s.tearStrip) out.tearStrip = true;
  if (s.lidHeight && typeof f.lidHeightMm === "number" && Number.isFinite(f.lidHeightMm) && f.lidHeightMm > 0) out.lidHeightMm = f.lidHeightMm;
  return out;
}

type DefInput = Omit<CatalogueDefinition, "validate" | "generate" | "construction"> & {
  rules?: Rule[];
  generator: FamilyGenerator;
  /** Map requested dims to the generator's dims (e.g. padded mailer adds padding). */
  mapDims?: (d: Dims, t: number) => Dims;
  constructionOf?: (dims: Dims, t: number, f: StructureFeatures) => ConstructionSpec;
};

export function defineModel(input: DefInput): CatalogueDefinition {
  const { rules = [], generator, mapDims, constructionOf, ...meta } = input;
  const params = { ...meta.params, ...(rules.length ? { rules: rules.map((r) => r.text) } : {}) };
  const schema = dimsSchemaFor(params, rules);
  const validate = (dims: Dims): DimsCheck => {
    const r = schema.safeParse(dims);
    if (r.success) return { ok: true, dims: r.data };
    return { ok: false, issues: r.error.issues.map((i) => ({ path: i.path.join(".") || "dims", message: i.message })) };
  };
  const thickness = (o: GenerateOptions) => {
    const t = o.thicknessMm ?? FAMILY_MATERIALS[o.material ?? meta.defaultMaterial].thicknessMm;
    if (!thicknessSchema.safeParse(t).success) throw new FamilyValidationError(meta.code, [{ path: "thicknessMm", message: "invalid" }]);
    if (o.material && !meta.materials.includes(o.material)) throw new FamilyValidationError(meta.code, [{ path: "material", message: `not allowed for ${meta.code}` }]);
    return t;
  };
  const def: CatalogueDefinition = {
    ...meta,
    params,
    validate,
    generate(dims, options = {}) {
      const v = validate(dims);
      if (!v.ok) throw new FamilyValidationError(meta.code, v.issues);
      const t = thickness(options);
      const features = supported(meta, options.features);
      const gd = mapDims ? mapDims(v.dims, t) : v.dims;
      const draft = generator(gd, t, features);
      return assembleDieline(meta.code, meta.baseCode, v.dims, draft, {
        thicknessMm: t,
        bleedMm: options.bleedMm,
        safeMm: options.safeMm ?? (meta.family === "CORRUGATED" ? 5 : 3),
        features,
      });
    },
  };
  if (constructionOf) def.construction = (dims, options = {}) => constructionOf(dims, thickness(options), supported(meta, options.features));
  return def;
}
