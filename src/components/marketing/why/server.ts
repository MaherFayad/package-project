import "server-only";
import { cache } from "react";
import { loadPricingData } from "@/lib/pricing/server";
import { loadPricingConfig } from "@/components/admin/server/settings";
import { loadCheckoutSettings } from "@/lib/orders/checkout-settings";
import { CATALOGUE } from "@/data/catalogue";
import { computePricingFacts, type PricingFacts } from "./pricing-facts";

/**
 * Live inputs for /why-elba and /pricing: the SAME loaders checkout uses (src/lib/orders/service.ts
 * `pricingInputs` + `loadCheckoutSettings`), read per request and NOT from the 5-minute catalogue
 * cache, so a published price is always the price checkout would charge right now.
 * Returns null when the database is unavailable (the pages then render without prices).
 */
export const loadWhyFacts = cache(async (): Promise<{ pricing: PricingFacts | null; designerModels: number }> => {
  const designerModels = CATALOGUE.filter((e) => e.designer).length;
  try {
    const [data, config, settings] = await Promise.all([loadPricingData(), loadPricingConfig(), loadCheckoutSettings()]);
    const pricing = computePricingFacts(data, config, settings);
    return { pricing: pricing.tiers.length ? pricing : null, designerModels };
  } catch {
    return { pricing: null, designerModels };
  }
});
