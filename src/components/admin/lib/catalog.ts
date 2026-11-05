import { z } from "zod";
import type { StructureParamLimits } from "@/types";

/**
 * Catalogue admin (pure): structure size limits, materials and finishes. Limits are inner mm and
 * must stay within what the dieline engine can generate (src/lib/dieline STRUCTURE_LIMITS hard
 * bounds are checked by the server action as a second line).
 */

const mm = z.number().int().min(10).max(2000);
const range = z.object({ min: mm, max: mm }).refine((r) => r.min < r.max, { message: "MIN_LT_MAX" });

export const structureUpdateSchema = z.object({
  id: z.string().min(1).max(40),
  L: range,
  W: range,
  H: range,
  active: z.boolean(),
});
export type StructureUpdate = z.infer<typeof structureUpdateSchema>;

export const materialUpdateSchema = z.object({
  id: z.string().min(1).max(40),
  gsm: z.number().int().min(100).max(2000),
  thicknessMm: z.number().min(0.2).max(10),
  foodSafe: z.boolean(),
  active: z.boolean(),
});
export type MaterialUpdate = z.infer<typeof materialUpdateSchema>;

export const finishUpdateSchema = z.object({
  id: z.string().min(1).max(40),
  unitSurchargePiasters: z.number().int().min(0).max(100_000),
  setupPiasters: z.number().int().min(0).max(10_000_000),
  active: z.boolean(),
});
export type FinishUpdate = z.infer<typeof finishUpdateSchema>;

/** Merge new L/W/H ranges into stored params, keeping rules and any extra keys. */
export function mergeLimits(stored: StructureParamLimits, u: Pick<StructureUpdate, "L" | "W" | "H">): StructureParamLimits {
  return { ...stored, L: { ...stored.L, ...u.L }, W: { ...stored.W, ...u.W }, H: { ...stored.H, ...u.H } };
}

/** Does the default size still fit inside the new limits? (Otherwise the designer would open invalid.) */
export function defaultFits(dims: { L: number; W: number; H: number }, u: Pick<StructureUpdate, "L" | "W" | "H">): boolean {
  return (["L", "W", "H"] as const).every((k) => dims[k] >= u[k].min && dims[k] <= u[k].max);
}

/** Keep limits inside hard engine bounds. Returns the axes that fall outside. */
export function outsideHardBounds(u: Pick<StructureUpdate, "L" | "W" | "H">, hard: { L: { min: number; max: number }; W: { min: number; max: number }; H: { min: number; max: number } }): ("L" | "W" | "H")[] {
  return (["L", "W", "H"] as const).filter((k) => u[k].min < hard[k].min || u[k].max > hard[k].max);
}

/** Shallow list of changed top-level fields for the audit log. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}
