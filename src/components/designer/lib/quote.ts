import type { DesignDoc, Dims, Piasters } from "@/types";
import { designPricedFinishes } from "@/types";

/** The live price badge quantity ("500 of these: from EGP X"). */
export const BADGE_QTY = 500;

/** The public offer fields the designer reads from POST /api/quote. */
export interface BadgeOffer {
  vendor: { id: string; name: { ar: string; en: string } };
  unitPiasters: Piasters;
  subtotalPiasters: Piasters;
  vatPiasters: Piasters;
  totalPiasters: Piasters;
  deliveryDays: number;
  validUntil: string;
}

export interface BadgeSuggestion {
  dims: Dims;
  savingsPct: number;
  leadTimeDaysSaved: number;
}

export type PriceState =
  | { status: "idle" }
  | { status: "locked" }
  | { status: "loading" }
  | { status: "ready"; quantity: number; best: BadgeOffer; vendorCount: number; suggestion: BadgeSuggestion | null; validUntil: string }
  | { status: "none" }
  /** Added by catalogue (B-16): the model is priced by quote (special gluing, quote-only stock, rare in Egypt, filling line). */
  | { status: "quote"; reason: "SPECIAL_GLUING" | "QUOTE_ONLY_STOCK" | "RARE_IN_EGYPT" | "FILLING_LINE" }
  | { status: "error" };

export function quoteBody(doc: DesignDoc, quantity: number) {
  return {
    structureCode: doc.structureCode,
    dims: doc.dims,
    materialCode: doc.materialCode,
    finishes: designPricedFinishes(doc),
    printSides: doc.printSides,
    quantity,
    // Added by 3D integration: library model (family style / container) priced with its own area.
    ...(doc.modelCode && doc.modelCode !== doc.structureCode
      ? { model: { code: doc.modelCode, ...(doc.features ? { features: doc.features } : {}), ...(doc.vessel ? { vessel: doc.vessel } : {}) } }
      : {}),
  };
}

/** Stable key for "has the priced spec changed?" (artwork does not change the price). */
export function quoteKey(doc: DesignDoc, quantity: number): string {
  const d = doc.dims;
  return [
    doc.modelCode ?? doc.structureCode,
    doc.structureCode,
    d.L,
    d.W,
    d.H,
    doc.materialCode,
    designPricedFinishes(doc).join(","),
    doc.printSides,
    quantity,
    JSON.stringify(doc.features ?? null),
    doc.vessel ? JSON.stringify([doc.vessel.dims, doc.vessel.surfaces, doc.vessel.presetId, doc.vessel.container]) : "",
  ].join("|");
}

/** Reduce an /api/quote response to what the badge shows: the cheapest offer. */
export function toPriceState(status: number, body: unknown): PriceState {
  if (status === 401) return { status: "locked" };
  if (status !== 200 || !body || typeof body !== "object") return { status: "error" };
  const b = body as {
    mode?: string;
    reason?: string;
    orderReason?: "SPECIAL_GLUING" | "QUOTE_ONLY_STOCK" | "RARE_IN_EGYPT" | "FILLING_LINE";
    quantity?: number;
    offers?: BadgeOffer[];
    suggestion?: BadgeSuggestion | null;
    validUntil?: string;
  };
  if (b.mode === "manual_quote" && b.reason === "MODEL_BY_QUOTE") return { status: "quote", reason: b.orderReason ?? "QUOTE_ONLY_STOCK" };
  if (b.mode !== "instant" || !Array.isArray(b.offers)) return { status: "error" };
  if (b.offers.length === 0) return { status: "none" };
  const best = [...b.offers].sort((x, y) => x.totalPiasters - y.totalPiasters || x.deliveryDays - y.deliveryDays)[0];
  return {
    status: "ready",
    quantity: b.quantity ?? BADGE_QTY,
    best,
    vendorCount: b.offers.length,
    suggestion: b.suggestion ?? null,
    validUntil: b.validUntil ?? best.validUntil,
  };
}

export async function fetchQuote(doc: DesignDoc, quantity: number, signal?: AbortSignal): Promise<PriceState> {
  try {
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quoteBody(doc, quantity)),
      signal,
    });
    const body = await res.json().catch(() => null);
    return toPriceState(res.status, body);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { status: "error" };
  }
}
