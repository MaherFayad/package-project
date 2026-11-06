import type { LocalizedText, MaterialCode, StructureCode } from "@/types";
import { modelByCode, type BoxModelDef, type VesselModelDef } from "@/lib/library";
import type { VesselKind } from "@/lib/vessels";
import { catalogueEntry, type CatalogueEntry, type CatalogueRender } from "@/data/catalogue";
import {
  ADD_ON_KEYS,
  BOX_BOARDS,
  BOX_BOARD_CODES,
  CONFIG_FINISH_CODES,
  VESSEL_STOCK_CODES,
  type AddOnKey,
  type BoxBoardCode,
  type ConfigFinishCode,
  type VesselStockCode,
} from "./catalog";
import { defaultBoxConfig, defaultVesselConfig } from "./defaults";
import { boxMaterialRule, colourModeRule, finishRule, vesselMaterialRule, type Verdict } from "./rules";
import type { BoxConfig, ModelConfig, VesselConfigInput } from "./schema";
import { matchVendors, type VendorForMatch } from "./pricing";

/**
 * Catalogue bridge (owner: catalogue integrator). Every catalogue model gets the ModelConfig
 * rules of the printer construction it is made as:
 *
 * - Library boxes are configured as their BASE core structure for the chosen board
 *   (`BoxModelDef.baseFor`: the rate card, rules and dies the printer uses), with the
 *   model's own feature support for add-ons (a FEFCO 0215 has a tear strip, an 0201 not).
 * - Library containers are configured as their core kind (label stock, surfaces, finishes).
 * - Family models outside the library (cups, lids, moulded pulp, paper bags, envelopes, bulk
 *   bins, unprinted fittings, blister cards) have a per-family list of what converters offer;
 *   they are always priced by quote.
 *
 * `quoteMode` decides the commerce path: an INSTANT price when at least one active Egyptian
 * printer has the capability and a rate card for the base structure and board, otherwise a
 * free design plus a request for a quote.
 */

export interface OptionVerdict<T extends string> {
  value: T;
  ok: boolean;
  reason?: LocalizedText;
  warning?: LocalizedText;
}

export interface CatalogueOptions {
  code: string;
  /** Core structure / container kind the config is built on (null: quote-only family model). */
  base: { type: "box"; code: StructureCode } | { type: "vessel"; code: VesselKind } | null;
  materials: OptionVerdict<string>[];
  finishes: OptionVerdict<ConfigFinishCode>[];
  addOns: OptionVerdict<AddOnKey>[];
}

const v = <T extends string>(value: T, r: Verdict): OptionVerdict<T> => ({ value, ok: r.ok, ...(r.reason ? { reason: r.reason } : {}), ...(r.warning ? { warning: r.warning } : {}) });
const no = (en: string, ar: string): Verdict => ({ ok: false, code: "CATALOGUE", reason: { ar, en } });

/** Boards a box model can be made from: its priced boards plus same-family quote boards. */
export function boardsFor(m: BoxModelDef): BoxBoardCode[] {
  const fam = m.family;
  const priced = new Set<MaterialCode>(m.materials);
  return BOX_BOARD_CODES.filter((b) => {
    const board = BOX_BOARDS[b];
    if (board.family !== fam) return false;
    return board.pricingMaterial ? priced.has(board.pricingMaterial) : fam === "CORRUGATED";
  });
}

/** Core structure the model is produced as on a board. */
export function baseStructureFor(m: BoxModelDef, board: BoxBoardCode): StructureCode {
  return m.baseFor(BOX_BOARDS[board].pricingMaterial ?? m.materials[0]);
}

function boxMaterialVerdict(m: BoxModelDef, board: BoxBoardCode): Verdict {
  const base = baseStructureFor(m, board);
  const r = boxMaterialRule(base, board, m.defaultDims);
  // BC double wall is a shipping board: allowed on the model when its BASE is a shipping case.
  return r;
}

/** A valid starting ModelConfig for any library model (null for quote-only family models). */
export function catalogueModelConfig(code: string, opts: { board?: BoxBoardCode; quantity?: number } = {}): ModelConfig | null {
  const m = modelByCode(code);
  if (!m) return null;
  if (m.kind === "box") {
    const boards = boardsFor(m);
    const board = opts.board && boards.includes(opts.board) ? opts.board : (boards.find((b) => boxMaterialVerdict(m, b).ok && BOX_BOARDS[b].pricingMaterial) ?? boards[0]);
    if (!board) return null;
    const base = baseStructureFor(m, board);
    const cfg: BoxConfig = { ...defaultBoxConfig(base, opts.quantity ?? 250), material: board };
    // Direct flexo on kraft B / BC flute prints spot colours only: start with one black.
    if (!colourModeRule(cfg, "CMYK").ok) cfg.colour = { mode: "SPOT", inks: ["Black C"] };
    return cfg;
  }
  return defaultVesselConfig(m.coreKind, opts.quantity ?? 1000) as VesselConfigInput as ModelConfig;
}

/** Finishes converters offer on family models outside the library (quote only). */
const QUOTE_FINISHES: Record<CatalogueRender, ConfigFinishCode[]> = {
  box: [],
  vessel: [],
  // Paper bags, belly bands, tags, envelopes: aqueous varnish, hot foil; lamination on art-paper bags.
  dieline: ["GLOSS_VARNISH", "MATTE_VARNISH", "MATTE_LAMINATION", "FOIL_GOLD", "FOIL_SILVER", "EMBOSS"],
  // PE-coated cupstock: flexo / offset with water-based varnish only (food contact).
  cup: ["GLOSS_VARNISH", "MATTE_VARNISH"],
  lid: [],
  // Moulded fibre is not printed; only the paper slip label of egg cartons.
  pulp: [],
  // Partition sets and cushions are plain board.
  fitting: [],
  // Lidding foil: 1 to 2 colours, no finishes.
  blister: [],
};

const QUOTE_REASON: LocalizedText = { ar: "يحدد المصنع هذا الخيار في عرض السعر.", en: "The converter sets this in the quote." };

function libraryBoxOptions(m: BoxModelDef): CatalogueOptions {
  const boards = boardsFor(m);
  const cfg = catalogueModelConfig(m.code) as BoxConfig | null;
  const base = cfg ? cfg.model.code : (m.baseFor(m.materials[0]) as StructureCode);
  const materials = boards.map((b) => v(b, boxMaterialVerdict(m, b)));
  const finishes = CONFIG_FINISH_CODES.map((f) => v(f, cfg ? finishRule(cfg, f) : no("Choose a board first.", "اختر الخامة أولا.")));
  const f = m.features;
  const addOns = ADD_ON_KEYS.map((k) => {
    switch (k) {
      case "windowFilm":
        return v(k, f.windowFaces.length ? { ok: true } : no("This style has no window option.", "هذا النوع لا يدعم النافذة."));
      case "handle":
        return v(k, f.handle ? { ok: true } : no("This style has no handle option.", "هذا النوع لا يدعم المقبض."));
      case "tearStrip":
        return v(k, f.tearStrip ? { ok: true } : no("This style has no tear strip option.", "هذا النوع لا يدعم شريط الفتح."));
      case "insert":
        return v(k, m.shape === "flat" || m.shape === "cylinder" ? no("This style has no room for an insert.", "هذا النوع لا يتسع لحشوة داخلية.") : { ok: true });
    }
  });
  return { code: m.code, base: { type: "box", code: base }, materials, finishes, addOns };
}

function libraryVesselOptions(m: VesselModelDef): CatalogueOptions {
  const cfg = defaultVesselConfig(m.coreKind) as unknown as ModelConfig;
  const surfaces = (cfg as VesselConfigInput).surfaces;
  const materials = VESSEL_STOCK_CODES.map((s: VesselStockCode) => v(s, vesselMaterialRule(m.coreKind, s, surfaces, (cfg as VesselConfigInput).container)));
  const finishes = CONFIG_FINISH_CODES.map((f) => v(f, finishRule(cfg, f)));
  const addOns = ADD_ON_KEYS.map((k) => v(k, no("Not available for containers.", "غير متاح للعبوات.")));
  return { code: m.code, base: { type: "vessel", code: m.coreKind }, materials, finishes, addOns };
}

function quoteOnlyOptions(e: CatalogueEntry, familyMaterials: readonly string[]): CatalogueOptions {
  const allowed = new Set(QUOTE_FINISHES[e.render]);
  return {
    code: e.code,
    base: null,
    materials: familyMaterials.map((mat) => ({ value: mat, ok: true, warning: QUOTE_REASON })),
    finishes: CONFIG_FINISH_CODES.map((f) => (allowed.has(f) ? { value: f, ok: true, warning: QUOTE_REASON } : { value: f, ok: false, reason: { ar: "غير متاح لهذا النوع.", en: "Not offered on this format." } })),
    addOns: ADD_ON_KEYS.map((k) => ({ value: k, ok: false, reason: { ar: "غير متاح لهذا النوع.", en: "Not offered on this format." } })),
  };
}

/**
 * Materials, finishes and add-ons valid for a catalogue model. `familyMaterials` lists the
 * family's own stock codes for quote-only models (cupstock, moulded fibre …).
 */
export function catalogueOptions(code: string, familyMaterials: readonly string[] = []): CatalogueOptions | null {
  const e = catalogueEntry(code);
  if (!e) return null;
  const m = modelByCode(code);
  if (m?.kind === "box") return libraryBoxOptions(m);
  if (m?.kind === "vessel") return libraryVesselOptions(m);
  return quoteOnlyOptions(e, familyMaterials);
}

export type QuoteMode =
  | { mode: "instant"; vendorIds: string[] }
  | { mode: "quote"; reason: "QUOTE_ONLY_STOCK" | "LABELS_BY_QUOTE" | "NO_VENDOR" };

/**
 * Commerce path of a model against the live printer list: instant price when some active
 * printer can make it on one of its boards (capability + rate card for the base structure),
 * else a free design routed to "request a quote".
 */
export function quoteMode(code: string, vendors: readonly VendorForMatch[]): QuoteMode {
  const e = catalogueEntry(code);
  const m = modelByCode(code);
  if (!e || e.quoteOnly || !m) return { mode: "quote", reason: "QUOTE_ONLY_STOCK" };
  if (m.kind === "vessel") return { mode: "quote", reason: "LABELS_BY_QUOTE" };
  const ids = new Set<string>();
  for (const board of boardsFor(m)) {
    if (!BOX_BOARDS[board].pricingMaterial || !boxMaterialVerdict(m, board).ok) continue;
    const cfg = catalogueModelConfig(code, { board, quantity: 1000 });
    if (!cfg) continue;
    for (const r of matchVendors(cfg, vendors)) if (r.ok) ids.add(r.vendorId);
  }
  return ids.size ? { mode: "instant", vendorIds: [...ids] } : { mode: "quote", reason: "NO_VENDOR" };
}

/** Bilingual copy for the two commerce paths (catalogue cards, detail page, picker). */
export const QUOTE_COPY = {
  instantBadge: { ar: "سعر فوري", en: "Instant price" },
  quoteBadge: { ar: "بعرض سعر", en: "By quote" },
  instantBody: {
    ar: "صمم مجانا واحصل على سعر فوري من مطابع مصرية معتمدة.",
    en: "Design free and get an instant price from vetted Egyptian printers.",
  },
  quoteBody: {
    ar: "التصميم مجاني. لا توجد مطبعة على علبة تسعر هذا النوع تلقائيا بعد، لذا أرسل طلب عرض سعر وسيرد عليك مصنع مناسب خلال يومي عمل.",
    en: "Designing is free. No printer on Elba prices this format automatically yet, so send a quote request and a suitable converter replies within 2 working days.",
  },
} satisfies Record<string, LocalizedText>;
