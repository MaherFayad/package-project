import { z } from "zod";
import type { Dims, StructureCode, StructureParamLimits } from "@/types";
import { STRUCTURE_CODES } from "@/types";

/**
 * Size limits per structure (inner mm). Mirrors Structure.params in prisma/seed.ts so the
 * engine can validate on the client without a DB round trip. If the DB row differs,
 * pass its params to `validateDims(code, dims, limits)`.
 */
export const STRUCTURE_LIMITS: Record<StructureCode, StructureParamLimits> = {
  FEFCO_0427: { L: { min: 80, max: 600 }, W: { min: 60, max: 450 }, H: { min: 25, max: 250 }, rules: ["H <= W"] },
  FEFCO_0201: { L: { min: 100, max: 800 }, W: { min: 80, max: 600 }, H: { min: 60, max: 800 } },
  ECMA_RTE: { L: { min: 30, max: 200 }, W: { min: 20, max: 150 }, H: { min: 40, max: 300 } },
  ECMA_STE: { L: { min: 30, max: 220 }, W: { min: 20, max: 160 }, H: { min: 40, max: 300 } },
  PIZZA: { L: { min: 200, max: 500 }, W: { min: 200, max: 500 }, H: { min: 30, max: 60 }, rules: ["L == W"] },
  SLEEVE: { L: { min: 60, max: 450 }, W: { min: 40, max: 350 }, H: { min: 20, max: 200 } },
  FEFCO_0320: { L: { min: 100, max: 800 }, W: { min: 80, max: 600 }, H: { min: 40, max: 600 } },
  ECMA_CLB: { L: { min: 40, max: 250 }, W: { min: 30, max: 200 }, H: { min: 50, max: 350 } },
  ECMA_SLB: { L: { min: 40, max: 250 }, W: { min: 30, max: 200 }, H: { min: 50, max: 350 } },
  FEFCO_0422: { L: { min: 120, max: 600 }, W: { min: 80, max: 400 }, H: { min: 30, max: 200 } },
  GABLE_BOX: { L: { min: 60, max: 300 }, W: { min: 50, max: 200 }, H: { min: 60, max: 300 } },
  // L = W = inner diameter of the tube.
  PAPER_TUBE: { L: { min: 40, max: 150 }, W: { min: 40, max: 150 }, H: { min: 60, max: 350 }, rules: ["L == W"] },
  RIGID_BOX: { L: { min: 60, max: 450 }, W: { min: 50, max: 350 }, H: { min: 20, max: 200 } },
  // Container print parts: L = label / web width, H = label / web height, W = 1 (flat).
  ROLL_LABEL: { L: { min: 10, max: 700 }, W: { min: 1, max: 1 }, H: { min: 10, max: 400 } },
  PRINTED_POUCH: { L: { min: 60, max: 900 }, W: { min: 1, max: 1 }, H: { min: 80, max: 600 } },
  PRINTED_TUBE: { L: { min: 40, max: 200 }, W: { min: 1, max: 1 }, H: { min: 50, max: 250 } },
  // Added by bags: L = face width, W = gusset, H = finished height (carrier bags, families/bags).
  PAPER_BAG: { L: { min: 90, max: 550 }, W: { min: 50, max: 220 }, H: { min: 120, max: 600 }, rules: ["W <= L"] },
};

/** Default inner dims per structure (mirrors Structure.defaultDims in the seed). */
export const DEFAULT_DIMS: Record<StructureCode, Dims> = {
  FEFCO_0427: { L: 250, W: 180, H: 80 },
  FEFCO_0201: { L: 300, W: 200, H: 150 },
  ECMA_RTE: { L: 60, W: 60, H: 140 },
  ECMA_STE: { L: 90, W: 50, H: 150 },
  PIZZA: { L: 300, W: 300, H: 40 },
  SLEEVE: { L: 220, W: 150, H: 60 },
  FEFCO_0320: { L: 330, W: 250, H: 100 },
  ECMA_CLB: { L: 80, W: 80, H: 200 },
  ECMA_SLB: { L: 70, W: 70, H: 120 },
  FEFCO_0422: { L: 380, W: 280, H: 100 },
  GABLE_BOX: { L: 160, W: 100, H: 120 },
  PAPER_TUBE: { L: 75, W: 75, H: 150 },
  RIGID_BOX: { L: 250, W: 180, H: 80 },
  ROLL_LABEL: { L: 220, W: 1, H: 80 },
  PRINTED_POUCH: { L: 320, W: 1, H: 230 },
  PRINTED_TUBE: { L: 120, W: 1, H: 120 },
  PAPER_BAG: { L: 260, W: 120, H: 350 },
};

export type DimsIssueCode = "TOO_SMALL" | "TOO_LARGE" | "RULE" | "INVALID";

export interface DimsIssue {
  /** "L" | "W" | "H" | "thicknessMm" | "structureCode" */
  path: string;
  code: DimsIssueCode;
  /** The limit that was crossed (TOO_SMALL / TOO_LARGE). */
  limit?: number;
  /** The rule text from StructureParamLimits.rules (RULE). */
  rule?: string;
}

export type DimsValidation = { ok: true; dims: Dims } | { ok: false; issues: DimsIssue[] };

/** Parse simple rule strings like "H <= W", "L == W", "W < L". */
function checkRule(rule: string, dims: Dims): boolean | null {
  const m = /^\s*([LWH])\s*(<=|>=|==|<|>)\s*([LWH])\s*$/.exec(rule);
  if (!m) return null;
  const a = dims[m[1] as keyof Dims];
  const b = dims[m[3] as keyof Dims];
  switch (m[2]) {
    case "<=":
      return a <= b + 1e-9;
    case ">=":
      return a + 1e-9 >= b;
    case "==":
      return Math.abs(a - b) < 0.5;
    case "<":
      return a < b;
    case ">":
      return a > b;
  }
  return null;
}

/** Build the zod schema for one structure's dims. Issues carry `params` with our codes. */
export function dimsSchema(code: StructureCode, limits: StructureParamLimits = STRUCTURE_LIMITS[code]) {
  const axis = (k: "L" | "W" | "H") =>
    z
      .number({ invalid_type_error: "INVALID", required_error: "INVALID" })
      .finite()
      .superRefine((v, ctx) => {
        const r = limits[k];
        if (v < r.min)
          ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_SMALL", limit: r.min } });
        else if (v > r.max)
          ctx.addIssue({ code: z.ZodIssueCode.custom, params: { code: "TOO_LARGE", limit: r.max } });
      });
  return z
    .object({ L: axis("L"), W: axis("W"), H: axis("H") })
    .superRefine((dims, ctx) => {
      for (const rule of limits.rules ?? []) {
        const ok = checkRule(rule, dims);
        if (ok === false) {
          const field = /^\s*([LWH])/.exec(rule)?.[1] ?? "L";
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], params: { code: "RULE", rule } });
        }
      }
    });
}

export function validateDims(
  code: StructureCode,
  dims: unknown,
  limits?: StructureParamLimits,
): DimsValidation {
  if (!(STRUCTURE_CODES as readonly string[]).includes(code)) {
    return { ok: false, issues: [{ path: "structureCode", code: "INVALID" }] };
  }
  const parsed = dimsSchema(code, limits).safeParse(dims);
  if (parsed.success) return { ok: true, dims: parsed.data };
  const issues: DimsIssue[] = parsed.error.issues.map((i) => {
    const params = (i as { params?: { code?: DimsIssueCode; limit?: number; rule?: string } }).params;
    return {
      path: String(i.path[0] ?? ""),
      code: params?.code ?? "INVALID",
      ...(params?.limit !== undefined ? { limit: params.limit } : {}),
      ...(params?.rule ? { rule: params.rule } : {}),
    };
  });
  return { ok: false, issues };
}

/** Clamp dims into the structure limits and apply its rules (for sliders / presets). */
export function clampDims(code: StructureCode, dims: Dims, limits: StructureParamLimits = STRUCTURE_LIMITS[code]): Dims {
  const c = (v: number, k: "L" | "W" | "H") =>
    Math.min(limits[k].max, Math.max(limits[k].min, Number.isFinite(v) ? v : limits[k].min));
  const out: Dims = { L: c(dims.L, "L"), W: c(dims.W, "W"), H: c(dims.H, "H") };
  for (const rule of limits.rules ?? []) {
    if (rule.replace(/\s/g, "") === "H<=W" && out.H > out.W) out.H = Math.max(limits.H.min, out.W);
    if (rule.replace(/\s/g, "") === "L==W") out.W = c(out.L, "W");
  }
  return out;
}

export const thicknessSchema = z.number().finite().positive().max(10);

export class DielineValidationError extends Error {
  readonly issues: DimsIssue[];
  constructor(issues: DimsIssue[]) {
    super(`Invalid dieline input: ${issues.map((i) => `${i.path} ${i.code}${i.limit !== undefined ? ` (${i.limit})` : ""}${i.rule ? ` (${i.rule})` : ""}`).join(", ")}`);
    this.name = "DielineValidationError";
    this.issues = issues;
  }
}
