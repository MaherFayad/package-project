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

export interface ModelRef {
  code: string;
  standard: string;
  name: LocalizedText;
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
    const ref: ModelRef = { code: m.code, standard: m.standard, name: m.name };
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

/** Per box style: how many models it covers and a few examples (for the capability checklist). */
export type StructureCoverage = Record<StructureCode, { standard: string; count: number; examples: string[] }>;

export function structureCoverage(locale: "ar" | "en", examples = 3): StructureCoverage {
  const out = {} as StructureCoverage;
  for (const def of STRUCTURE_LIST) {
    const s = def.code;
    const list = modelsForStructure(s).filter((r) => r.code !== s);
    out[s] = { standard: def.standard, count: modelsForStructure(s).length, examples: list.slice(0, examples).map((r) => r.name[locale]) };
  }
  return out;
}

/** The exact model a job item was designed on (null for legacy items without a model code). */
export function jobModel(modelCode: string | null | undefined): ModelRef | null {
  const m = modelByCode(modelCode);
  return m ? { code: m.code, standard: m.standard, name: m.name } : null;
}
