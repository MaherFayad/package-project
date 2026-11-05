import { z } from "zod";
import { MATERIAL_CODES, type MaterialCode } from "@/types";
import { DEFAULT_PRICING_CONFIG, DELIVERY_ZONES, makeConfig, resolvePriceIndex, type DeliveryZone, type PriceIndexRow, type PricingConfig, type ZoneRate } from "@/lib/pricing";

/**
 * Admin-editable pricing settings, stored as PlatformSetting key "pricing" and merged onto
 * DEFAULT_PRICING_CONFIG (src/lib/pricing/config.ts). Pure: validation, merge and preview maths.
 */
export const PRICING_SETTING_KEY = "pricing";

export interface AdminPricingSettings {
  marginPct: number;
  marginOnShipping: boolean;
  quoteValidityHours: number;
  zones: Record<DeliveryZone, ZoneRate>;
  priceIndex: PriceIndexRow[];
}

export function defaultSettings(): AdminPricingSettings {
  const d = DEFAULT_PRICING_CONFIG;
  return {
    marginPct: d.marginPct,
    marginOnShipping: d.marginOnShipping,
    quoteValidityHours: d.quoteValidityHours,
    zones: structuredClone(d.shipping.zones),
    priceIndex: structuredClone(d.priceIndex),
  };
}

const piasters = z.number().int().min(0).max(100_000_000);
const zoneRateSchema = z.object({
  basePiasters: piasters,
  includedKg: z.number().min(0).max(1000),
  perExtraKgPiasters: piasters,
  freightPerLoadPiasters: piasters,
  transitDays: z.number().int().min(0).max(30),
});

const multiplier = z.number().min(0.5).max(3);
export const priceIndexRowSchema = z.object({
  id: z.string().min(1).max(40),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fx: multiplier,
  board: z.record(z.enum(MATERIAL_CODES), multiplier),
  note: z.string().max(200).optional(),
});

/** Settings form (margin, validity, delivery zones). Margin is a fraction: 0.25 = 25%. */
export const settingsFormSchema = z.object({
  marginPct: z.number().min(0).max(0.8),
  marginOnShipping: z.boolean(),
  quoteValidityHours: z.number().int().min(1).max(24 * 14),
  zones: z.object(Object.fromEntries(DELIVERY_ZONES.map((zn) => [zn, zoneRateSchema])) as Record<DeliveryZone, typeof zoneRateSchema>),
});
export type SettingsForm = z.infer<typeof settingsFormSchema>;

/** Bulk FX / board index update: a new dated row appended to the index table. */
export const indexUpdateSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fx: multiplier,
  board: z.record(z.enum(MATERIAL_CODES), multiplier),
  note: z.string().trim().max(200).default(""),
});
export type IndexUpdate = z.infer<typeof indexUpdateSchema>;

/** Parse stored JSON defensively: anything invalid falls back to the defaults field by field. */
export function parseStoredSettings(raw: unknown): AdminPricingSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const form = settingsFormSchema.safeParse({
    marginPct: r.marginPct ?? base.marginPct,
    marginOnShipping: r.marginOnShipping ?? base.marginOnShipping,
    quoteValidityHours: r.quoteValidityHours ?? base.quoteValidityHours,
    zones: r.zones ?? base.zones,
  });
  const index = z.array(priceIndexRowSchema).min(1).max(500).safeParse(r.priceIndex);
  return {
    ...(form.success ? form.data : { marginPct: base.marginPct, marginOnShipping: base.marginOnShipping, quoteValidityHours: base.quoteValidityHours, zones: base.zones }),
    priceIndex: index.success ? index.data : base.priceIndex,
  };
}

/** Full engine config from admin settings. */
export function settingsToConfig(s: AdminPricingSettings): PricingConfig {
  return makeConfig({
    marginPct: s.marginPct,
    marginOnShipping: s.marginOnShipping,
    quoteValidityHours: s.quoteValidityHours,
    shipping: { ...DEFAULT_PRICING_CONFIG.shipping, zones: s.zones },
    priceIndex: s.priceIndex,
  });
}

export function appendIndexRow(table: PriceIndexRow[], u: IndexUpdate, now: Date): PriceIndexRow[] {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const row: PriceIndexRow = { id: `ADM-${stamp}`, effectiveFrom: u.effectiveFrom, fx: u.fx, board: u.board, ...(u.note ? { note: u.note } : {}) };
  // Same effective date replaces the earlier row for that date (latest wins, no duplicates).
  return [...table.filter((r) => r.effectiveFrom !== u.effectiveFrom), row].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

/** The row in force now and the effective multiplier per material (fx × board). */
export function currentMultipliers(table: PriceIndexRow[], now: Date): { row: PriceIndexRow; byMaterial: Record<MaterialCode, number> } {
  const row = resolvePriceIndex(table, now);
  const byMaterial = Object.fromEntries(MATERIAL_CODES.map((m) => [m, round4(row.fx * (row.board[m] ?? 1))])) as Record<MaterialCode, number>;
  return { row, byMaterial };
}

/** Apply a uniform % change to every material's board index (bulk "+5%" helper). */
export function bumpBoard(board: Partial<Record<MaterialCode, number>>, pct: number): Record<MaterialCode, number> {
  return Object.fromEntries(MATERIAL_CODES.map((m) => [m, round4((board[m] ?? 1) * (1 + pct / 100))])) as Record<MaterialCode, number>;
}

/* ───────────────────────── Preview of affected prices ───────────────────────── */

export interface PreviewSample {
  id: string;
  structureCode: string;
  materialCode: string;
  quantity: number;
}

export interface PreviewRow extends PreviewSample {
  currentUnitPiasters: number | null;
  proposedUnitPiasters: number | null;
  /** % change (1 decimal), null when either side has no price. */
  changePct: number | null;
}

/**
 * Price every sample with the current and the proposed config. `priceFn` returns the best offer's
 * unit price ex-VAT (or null when no vendor can make it); it is injected so this stays pure.
 */
export function previewPriceChanges(
  samples: PreviewSample[],
  priceFn: (cfg: PricingConfig, s: PreviewSample, now: Date) => number | null,
  current: PricingConfig,
  proposed: PricingConfig,
  nowCurrent: Date,
  nowProposed: Date = nowCurrent,
): { rows: PreviewRow[]; affected: number; avgChangePct: number | null } {
  const rows = samples.map((s): PreviewRow => {
    const a = priceFn(current, s, nowCurrent);
    const b = priceFn(proposed, s, nowProposed);
    return { ...s, currentUnitPiasters: a, proposedUnitPiasters: b, changePct: a && b !== null ? Math.round(((b - a) / a) * 1000) / 10 : null };
  });
  const changed = rows.filter((r) => r.changePct !== null && r.changePct !== 0);
  const withChange = rows.filter((r) => r.changePct !== null);
  const avg = withChange.length ? Math.round((withChange.reduce((s, r) => s + (r.changePct ?? 0), 0) / withChange.length) * 10) / 10 : null;
  return { rows, affected: changed.length, avgChangePct: avg };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
