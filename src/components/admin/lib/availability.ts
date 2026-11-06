/**
 * Model availability in Egypt (pure). A library model can be priced instantly when at least one
 * ACTIVE vendor has an ACTIVE rate card for the production style the model is made as (its base
 * structure for that board) and that board. Otherwise it is quote-only: buyers can still design it
 * for free, but every order needs a hand-agreed price (research report §4.2, "Price: manual" vs
 * "instant from rate cards").
 */

export interface ModelRouteInput {
  code: string;
  /** Each board the model can be made from, with the style it is produced and priced as. */
  routes: { structureCode: string; materialCode: string }[];
}

export interface RateCardRef {
  vendorId: string;
  structureCode: string;
  materialCode: string;
}

export interface ModelAvailability {
  code: string;
  /** Distinct vendors that can price at least one board of the model. */
  vendorIds: string[];
  /** Boards with at least one vendor, out of `boardsTotal`. */
  boardsPriced: number;
  boardsTotal: number;
  instant: boolean;
}

export const pairKey = (structureCode: string, materialCode: string) => `${structureCode}|${materialCode}`;

/** Vendor ids per style|board from active rate cards of active vendors. */
export function vendorsByPair(cards: RateCardRef[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const c of cards) {
    const k = pairKey(c.structureCode, c.materialCode);
    if (!out.has(k)) out.set(k, new Set());
    out.get(k)!.add(c.vendorId);
  }
  return out;
}

export function modelAvailability(model: ModelRouteInput, pairs: Map<string, Set<string>>): ModelAvailability {
  const vendors = new Set<string>();
  const boards = new Set<string>();
  const priced = new Set<string>();
  for (const r of model.routes) {
    boards.add(r.materialCode);
    const v = pairs.get(pairKey(r.structureCode, r.materialCode));
    if (v && v.size) {
      priced.add(r.materialCode);
      for (const id of v) vendors.add(id);
    }
  }
  return { code: model.code, vendorIds: [...vendors].sort(), boardsPriced: priced.size, boardsTotal: boards.size, instant: vendors.size > 0 };
}

export const AVAILABILITY_VIEWS = ["all", "instant", "quoteOnly"] as const;
export type AvailabilityView = (typeof AVAILABILITY_VIEWS)[number];

export function inAvailabilityView(a: { instant: boolean }, view: AvailabilityView): boolean {
  return view === "all" || (view === "instant" ? a.instant : !a.instant);
}
