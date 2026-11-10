import type { LocalizedText } from "@/types";
import type { CatalogueEntry } from "./types";
import { EGYPT_TABLE, ORDER_MODE_TABLE } from "./order-mode-table";

/**
 * How a model may be ordered (business audit B-16). Derived from the availability research, so a
 * buyer can never pay instantly for a pack no Egyptian SME printer can make:
 *
 * - "instant": priced by the rate cards of its base structure.
 * - "listed": needs special gluing (auto-bottom / crash-lock, corner-glued trays, multi-piece
 *   carriers). Instant only from printers that list the model code in `capabilities.models`;
 *   otherwise a quote.
 * - "quote": a stock no seeded printer prices (cupstock, moulded fibre, kraft paper, envelopes,
 *   bulk triple wall, blister foil).
 * - "preview": not made by Egyptian SME converters (availability "rare", or liquid cartons that
 *   ship on filling-line contracts at 100,000+ (docs/packaging-availability.md #2) packs). Design and preview free, request a quote.
 */
export type OrderMode = "instant" | "listed" | "quote" | "preview";

export type OrderModeReason = "STANDARD" | "SPECIAL_GLUING" | "QUOTE_ONLY_STOCK" | "RARE_IN_EGYPT" | "FILLING_LINE";

const SPECIAL_GLUING = /auto-bottom|ready-glued|crash|glued-tray/i;
const SPECIAL_GLUING_CODES = new Set([
  "ECMA_TUCK_CRASH_LOCK",
  "GABLE_CARRY_CLB",
  "ECMA_TRAY_4C",
  "ECMA_TRAY_BEERS",
  "ECMA_TRAY_BRIGHTWOOD",
  "ECMA_TRAY_6C_LID",
  "BOTTLE_BASKET_4",
  "BOTTLE_BASKET_6",
]);
// docs/packaging-availability.md "What I'd ship" #2: aseptic and gable-top liquid cartons and
// blister films are sold with filling-line contracts at 100,000+ units: preview only (R4-11).
// (Printed 2-piece cans are vessels priced as their label, #3, so they stay instant.)
const FILLING_LINE = new Set(["folding-carton/aseptic-liquid", "folding-carton/gable-top-liquid", "cosmetic-pharma/blister"]);
/**
 * Formats the availability table gives no price basis for at the wedge's 100 to 2,000 units
 * (price "n/a"): roll stock for the buyer's own form-fill-seal line (minimum 300 to 1,000 kg of
 * film), imported bag-in-box bladders and noodle pails, dry-offset aluminium tubes (10,000+). A
 * base-structure rate card must not price them instantly (R4-12).
 */
const NO_PRICE_BASIS = new Set(["flexible/flow-wrap", "flexible/pillow-bag", "flexible/stick-pack", "flexible/bag-in-box", "food-service/noodle-box", "cosmetic-pharma/aluminium-tube"]);

/**
 * Store bags no seeded printer prices instantly (src/lib/dieline/families/bags, `orderMode`):
 * die-cut handle bags need a patch and hand-hole die per size, bottle bags are rare among Egyptian
 * bag makers (docs/audit/bags.md). A unit test keeps this equal to the definitions.
 */
export const QUOTE_ONLY_BAGS = new Set(["BAG_DIECUT_PATCH", "BAG_BOTTLE"]);

export function orderModeForEntry(e: Pick<CatalogueEntry, "code" | "source" | "style" | "subFamily" | "availableInEgypt" | "quoteOnly">): { mode: OrderMode; reason: OrderModeReason } {
  // Not made by Egyptian SME converters at all: preview, even for quote-only stock (octabin, R4-13).
  if (FILLING_LINE.has(e.subFamily)) return { mode: "preview", reason: "FILLING_LINE" };
  if (e.availableInEgypt === "rare") return { mode: "preview", reason: "RARE_IN_EGYPT" };
  if (e.quoteOnly || NO_PRICE_BASIS.has(e.subFamily) || QUOTE_ONLY_BAGS.has(e.code)) return { mode: "quote", reason: "QUOTE_ONLY_STOCK" };
  // Core structures (ECMA_CLB …) are listed by printers through capabilities.structures already.
  if (e.source !== "core" && (SPECIAL_GLUING_CODES.has(e.code) || SPECIAL_GLUING.test(e.style))) return { mode: "listed", reason: "SPECIAL_GLUING" };
  return { mode: "instant", reason: "STANDARD" };
}

/**
 * Order mode of a model code (codes not in the table, i.e. instant models and plain core
 * structures, are instant). Reads the generated table so the designer and pricing do not load
 * the catalogue; a unit test keeps the table equal to `orderModeForEntry` over CATALOGUE.
 */
export function orderModeOf(code: string | null | undefined): { mode: OrderMode; reason: OrderModeReason } {
  const hit = code ? ORDER_MODE_TABLE[code] : undefined;
  return hit ? { mode: hit[0], reason: hit[1] } : { mode: "instant", reason: "STANDARD" };
}

/** Can this printer give an instant price for the model (beyond its base-structure rate card)? */
export function vendorListsModel(mode: OrderMode, code: string, models: readonly string[] | undefined): boolean {
  if (mode === "instant") return true;
  if (mode === "listed") return !!models?.includes(code);
  return false;
}

/** Buyer-facing reason, ar / en (MSA, no diacritics). */
export const ORDER_MODE_COPY: Record<OrderModeReason, LocalizedText> = {
  STANDARD: { ar: "سعر فوري من المطابع المصرية.", en: "Instant price from Egyptian printers." },
  SPECIAL_GLUING: {
    ar: "يحتاج هذا الطراز إلى ماكينة لصق خاصة لا تتوفر لدى كل المطابع، لذا نسعره بعرض سعر من مطبعة تصنعه.",
    en: "This style needs special gluing equipment not every printer has, so a printer that makes it prices it by quote.",
  },
  QUOTE_ONLY_STOCK: {
    ar: "لا توجد مطبعة على علبة تسعر هذه الخامة تلقائيا بعد، لذا نسعره بعرض سعر.",
    en: "No printer on Elba prices this stock automatically yet, so it is priced by quote.",
  },
  RARE_IN_EGYPT: {
    ar: "هذا النوع نادر في مصر. صممه وعاينه مجانا، وسنوجه طلبك إلى المستوردين والمصانع الإقليمية.",
    en: "This format is rare in Egypt. Design and preview it free; we route your request to importers and regional converters.",
  },
  FILLING_LINE: {
    ar: "تصنع هذه العبوة على خطوط تعبئة بعقود من 100,000 عبوة فأكثر. صممها وعاينها مجانا واطلب عرض سعر.",
    en: "This pack is made on filling lines under contracts of 100,000+ packs. Design and preview it free, then request a quote.",
  },
};

/** Availability in Egypt of a model code (light table; codes not listed are made locally). */
export function egyptOf(code: string | null | undefined): "local" | "imported" | "rare" {
  return (code && EGYPT_TABLE[code]) || "local";
}

/** The 13 core structures: the plan's launch formats (6 to 8 structures, 100 to 2,000 units). */
const CORE = new Set(["FEFCO_0427", "FEFCO_0201", "ECMA_RTE", "ECMA_STE", "PIZZA", "SLEEVE", "FEFCO_0320", "ECMA_CLB", "ECMA_SLB", "FEFCO_0422", "GABLE_BOX", "PAPER_TUBE", "RIGID_BOX"]);

/**
 * Default sort key (B-21): lead with what the go-to-market wedge buys at 100 to 2,000 units.
 * 0 core structures, 1 other instant models made locally, 2 instant but imported, 3 special
 * gluing (listed), 4 quote-only stock, 5 preview (rare / filling line). Stable within a rank.
 */
export function wedgeRank(code: string): number {
  if (CORE.has(code)) return 0;
  const m = orderModeOf(code).mode;
  if (m === "preview") return 5;
  if (m === "quote") return 4;
  if (m === "listed") return 3;
  return egyptOf(code) === "local" ? 1 : 2;
}

/** Stable sort by `wedgeRank`. */
export function byWedge<T extends { code: string }>(rows: readonly T[]): T[] {
  return rows.map((r, i) => ({ r, i, k: wedgeRank(r.code) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.r);
}

/** Badge copy for the three availability levels (B-20). */
export const EGYPT_BADGE: Record<"local" | "imported" | "rare", LocalizedText> = {
  local: { ar: "يصنع في مصر", en: "Made in Egypt" },
  imported: { ar: "مستورد", en: "Imported" },
  rare: { ar: "توفر محدود", en: "Limited in Egypt" },
};
