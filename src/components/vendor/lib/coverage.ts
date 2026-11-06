/**
 * Which library models (boxes, cartons, labels, pouches, tubes) each rate card prices.
 * The library has ~370 models but rate cards exist per core structure x board: a family model is
 * produced and priced as its base structure (`baseFor(material)`), vessels as roll labels,
 * printed pouches or printed tubes. Vendors need this to know what a box style tick or a rate card
 * actually commits them to. Server-only use (the library pulls every dieline generator).
 */
import { MODELS, modelByCode } from "@/lib/library";
import { BOARD_SPECS, STRUCTURE_LIST } from "@/lib/dieline";
import { MATERIAL_CODES, STRUCTURE_CODES, type LocalizedText, type MaterialCode, type StructureCode } from "@/types";
import { orderModeOf, type OrderMode } from "@/data/catalogue/order-mode";

export interface ModelRef {
  code: string;
  standard: string;
  name: LocalizedText;
  /**
   * R4: how buyers can order it (src/data/catalogue/order-mode.ts). "instant" models are priced by
   * the rate card; "listed" (special gluing) only when the printer lists the code in its profile;
   * "quote" / "preview" never get an instant price.
   */
  mode: OrderMode;
}

const VESSEL_BASE = { LABEL: "ROLL_LABEL", POUCH: "PRINTED_POUCH", TUBE: "PRINTED_TUBE" } as const satisfies Record<string, StructureCode>;

type Key = `${StructureCode}|${MaterialCode}`;

let cache: { byPair: Map<Key, ModelRef[]>; byStructure: Map<StructureCode, ModelRef[]> } | null = null;

function build() {
  const byPair = new Map<Key, ModelRef[]>();
  const byStructure = new Map<StructureCode, ModelRef[]>(STRUCTURE_CODES.map((c) => [c, []]));
  const add = (s: StructureCode, mat: MaterialCode, ref: ModelRef) => {
    const k: Key = `${s}|${mat}`;
    const list = byPair.get(k) ?? [];
    if (!list.some((r) => r.code === ref.code)) list.push(ref);
    byPair.set(k, list);
    const all = byStructure.get(s)!;
    if (!all.some((r) => r.code === ref.code)) all.push(ref);
  };
  for (const m of MODELS) {
    const ref: ModelRef = { code: m.code, standard: m.standard, name: m.name, mode: orderModeOf(m.code).mode };
    if (m.kind === "box") {
      for (const mat of m.materials) add(m.baseFor(mat), mat, ref);
    } else {
      const base = VESSEL_BASE[m.pricing];
      const family = m.pricing === "LABEL" ? "LABEL" : "FLEXIBLE";
      for (const mat of MATERIAL_CODES) {
        if (BOARD_SPECS[mat].family !== family) continue;
        // Pouch films print pouches, the PE tube body prints tubes.
        if (m.pricing === "POUCH" && mat === "TUBE_PE") continue;
        if (m.pricing === "TUBE" && mat !== "TUBE_PE") continue;
        add(base, mat, ref);
      }
    }
  }
  // The core structure itself first, then by industry reference.
  const order = (s: StructureCode) => (a: ModelRef, b: ModelRef) => (a.code === s ? -1 : b.code === s ? 1 : a.standard.localeCompare(b.standard, "en", { numeric: true }));
  for (const [k, list] of byPair) list.sort(order(k.split("|")[0] as StructureCode));
  for (const [s, list] of byStructure) list.sort(order(s));
  return { byPair, byStructure };
}

function data() {
  return (cache ??= build());
}

/** Models a rate card (structure x board) prices. */
export function modelsForCard(structure: StructureCode, material: MaterialCode): ModelRef[] {
  return data().byPair.get(`${structure}|${material}`) ?? [];
}

/** Models a box style tick covers, on any board. */
export function modelsForStructure(structure: StructureCode): ModelRef[] {
  return data().byStructure.get(structure) ?? [];
}

/**
 * Per box style: how many models a tick gives an instant price for, how many special-gluing models
 * the printer can add on top (by listing them), and a few instant examples (capability checklist).
 */
export type StructureCoverage = Record<StructureCode, { standard: string; count: number; listed: number; examples: string[] }>;

export function structureCoverage(locale: "ar" | "en", examples = 3): StructureCoverage {
  const out = {} as StructureCoverage;
  for (const def of STRUCTURE_LIST) {
    const s = def.code;
    const all = modelsForStructure(s);
    const instant = all.filter((r) => r.mode === "instant");
    const list = instant.filter((r) => r.code !== s);
    out[s] = {
      standard: def.standard,
      count: instant.length,
      listed: listedGroups().filter((g) => g.structure === s).reduce((n, g) => n + g.models.length, 0),
      examples: list.slice(0, examples).map((r) => r.name[locale]),
    };
  }
  return out;
}

/** Models a rate card gives an instant price for, given the printer's listed special-gluing codes. */
export function instantModelsForCard(structure: StructureCode, material: MaterialCode, listed: readonly string[] = []): ModelRef[] {
  return modelsForCard(structure, material).filter((m) => m.mode === "instant" || (m.mode === "listed" && listed.includes(m.code)));
}

/** A special-gluing model and every core structure that can produce it (one per board it runs on). */
export interface ListedModelRef extends ModelRef {
  bases: StructureCode[];
}

let listedCache: { structure: StructureCode; models: ListedModelRef[] }[] | null = null;

/**
 * R4: special-gluing models (order mode "listed") grouped by the box style they are produced and
 * priced as. A printer may list a model only when it runs one of its base styles; the engine then
 * prices it with that style's rate card.
 */
export function listedGroups(): { structure: StructureCode; models: ListedModelRef[] }[] {
  if (listedCache) return listedCache;
  const groups = new Map<StructureCode, ListedModelRef[]>();
  for (const m of MODELS) {
    if (m.kind !== "box" || orderModeOf(m.code).mode !== "listed") continue;
    const bases = [...new Set(m.materials.map((mat) => m.baseFor(mat)))] as StructureCode[];
    const list = groups.get(bases[0]!) ?? [];
    list.push({ code: m.code, standard: m.standard, name: m.name, mode: "listed", bases });
    groups.set(bases[0]!, list);
  }
  const order = STRUCTURE_CODES as readonly StructureCode[];
  listedCache = [...groups.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([structure, models]) => ({ structure, models: models.sort((a, b) => a.standard.localeCompare(b.standard, "en", { numeric: true })) }));
  return listedCache;
}

/** Every listable code with its base styles (server-side validation of a profile save). */
export function listedBases(): Map<string, StructureCode[]> {
  return new Map(listedGroups().flatMap((g) => g.models.map((m) => [m.code, m.bases] as const)));
}

/** The exact model a job item was designed on (null for legacy items without a model code). */
export function jobModel(modelCode: string | null | undefined): ModelRef | null {
  const m = modelByCode(modelCode);
  return m ? { code: m.code, standard: m.standard, name: m.name, mode: orderModeOf(m.code).mode } : null;
}
