import "server-only";
import { db } from "@/lib/db";
import type { PricingConfig } from "@/lib/pricing";
import { PRICING_SETTING_KEY, parseStoredSettings, settingsToConfig, type AdminPricingSettings } from "../lib/pricingSettings";

/**
 * Admin pricing settings (PlatformSetting "pricing"). `loadPricingConfig()` is the config every
 * DB-backed quote should use: pass it as `quote(input, data, { config })`. Until the pricing and
 * checkout owners wire it into /api/quote and quoteDesign(), buyer quotes use the code defaults.
 */
export async function loadPricingSettings(): Promise<{ settings: AdminPricingSettings; updatedAt: Date | null; updatedById: string | null }> {
  const row = await db.platformSetting.findUnique({ where: { key: PRICING_SETTING_KEY } });
  return { settings: parseStoredSettings(row?.value ?? null), updatedAt: row?.updatedAt ?? null, updatedById: row?.updatedById ?? null };
}

export async function loadPricingConfig(): Promise<PricingConfig> {
  return settingsToConfig((await loadPricingSettings()).settings);
}
