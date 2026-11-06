import "server-only";
import { CATALOGUE, catalogueCounts, taxonomy, toCatalogueCard, type CatalogueCard, type TaxonomyNode } from "@/data/catalogue";
import { quoteMode, type QuoteMode } from "@/lib/configurator/catalogue";
import { loadVendorsForMatch } from "@/lib/configurator/server";

export interface CatalogueData {
  cards: CatalogueCard[];
  taxonomy: TaxonomyNode[];
  counts: ReturnType<typeof catalogueCounts> & { instant: number; egypt: number; designer: number };
  modes: Map<string, QuoteMode>;
  vendorCount: number;
}

let cache: { at: number; data: CatalogueData } | null = null;
const TTL_MS = 5 * 60_000;

/**
 * Catalogue rows plus the live commerce path of each model (instant price when an active
 * printer can make it, else quote), cached for 5 minutes per server process.
 */
export async function getCatalogueData(): Promise<CatalogueData> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  let vendors: Awaited<ReturnType<typeof loadVendorsForMatch>> = [];
  try {
    vendors = await loadVendorsForMatch();
  } catch {
    // DB down: everything still browses and designs; prices fall back to quotes.
    vendors = [];
  }
  const modes = new Map(CATALOGUE.map((e) => [e.code, quoteMode(e.code, vendors)] as const));
  const cards = CATALOGUE.map((e) => toCatalogueCard(e, modes.get(e.code)?.mode === "instant"));
  const counts = {
    ...catalogueCounts(),
    instant: cards.filter((c) => c.instantPrice).length,
    egypt: cards.filter((c) => c.availableInEgypt !== "rare").length,
    // R4-CR-06: the models that open in the 3D designer (the /design library and picker total).
    designer: CATALOGUE.filter((e) => e.designer).length,
  };
  const data: CatalogueData = { cards, taxonomy: taxonomy(CATALOGUE.map((e) => e.subFamily)), counts, modes, vendorCount: vendors.length };
  cache = { at: Date.now(), data };
  return data;
}
