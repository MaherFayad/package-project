import { ANON_DESIGN_TTL_DAYS, STRUCTURE_CODES, type StructureCode } from "@/types";

/**
 * Dependency-free designer URLs (PERF-03): no three.js, no dieline engine, no model library, so
 * light pages (the /design start page, checkout links, the resume card) stay small.
 * `catalog.ts` re-exports these and adds the library-aware `designerPath` for any model code.
 */

/** Core structure slugs. Must equal `STRUCTURES[code].slug` (a unit test checks it). */
export const STRUCTURE_SLUGS: Record<StructureCode, string> = {
  FEFCO_0427: "mailer-box",
  FEFCO_0201: "shipping-box",
  ECMA_RTE: "reverse-tuck-end",
  ECMA_STE: "straight-tuck-end",
  PIZZA: "pizza-box",
  SLEEVE: "sleeve",
  FEFCO_0320: "telescope-box",
  ECMA_CLB: "crash-lock-carton",
  ECMA_SLB: "snap-lock-carton",
  FEFCO_0422: "display-tray",
  GABLE_BOX: "gable-box",
  PAPER_TUBE: "paper-tube",
  RIGID_BOX: "rigid-box",
  ROLL_LABEL: "roll-labels",
  PRINTED_POUCH: "printed-pouches",
  PRINTED_TUBE: "printed-tubes",
  PAPER_BAG: "paper-bags",
};

/** Accepts a slug ("mailer-box") or a code in any case ("fefco_0427"). */
export function structureFromParam(param: string): StructureCode | null {
  const p = decodeURIComponent(param).trim();
  const bySlug = (Object.entries(STRUCTURE_SLUGS) as [StructureCode, string][]).find(([, s]) => s === p.toLowerCase());
  if (bySlug) return bySlug[0];
  const upper = p.toUpperCase().replace(/-/g, "_");
  return (STRUCTURE_CODES as readonly string[]).includes(upper) ? (upper as StructureCode) : null;
}

/**
 * Editor URL from a core structure code, a model slug, or any library model code. Without the
 * library a family / container code is sent as-is (the route accepts a code in any case).
 */
export function designerPathLite(locale: string, codeOrSlug: string, query?: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v) q.set(k, v);
  const qs = q.toString();
  const slug = STRUCTURE_SLUGS[codeOrSlug as StructureCode] ?? codeOrSlug.toLowerCase();
  return `/${locale}/design/${slug}${qs ? `?${qs}` : ""}`;
}

/** Product shortcuts on the start page ("Mailer for a T-shirt"…). */
export const PRODUCT_PRESETS = [
  { key: "tshirt", structureCode: "FEFCO_0427", presetId: "tshirt" },
  { key: "shoe", structureCode: "FEFCO_0427", presetId: "shoe" },
  { key: "perfume50", structureCode: "ECMA_RTE", presetId: "perfume-50ml" },
  { key: "pizza30", structureCode: "PIZZA", presetId: "pizza-30" },
] as const satisfies readonly { key: string; structureCode: StructureCode; presetId: string }[];

export type ProductPresetKey = (typeof PRODUCT_PRESETS)[number]["key"];

/** localStorage key of this device's autosaved draft (written by `storage.ts`). */
export const LOCAL_DRAFT_KEY = "elba.designer.last.v1";

/** What the start page needs to offer "Continue your last design", without parsing the doc. */
export interface DraftSummary {
  name: string;
  /** Library model code (family style / container) or the core structure code. */
  modelCode: string;
  structureCode: string;
  designId: string | null;
}

/** Same expiry as `loadLocalDraft` (anonymous designs live 30 days). */
const DRAFT_TTL_MS = ANON_DESIGN_TTL_DAYS * 86_400_000;

export function readDraftSummary(now = Date.now()): DraftSummary | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_DRAFT_KEY) : null;
    if (!raw) return null;
    const j = JSON.parse(raw) as { doc?: { name?: unknown; modelCode?: unknown; structureCode?: unknown }; designId?: unknown; savedAt?: unknown };
    if (typeof j.savedAt !== "number" || now - j.savedAt > DRAFT_TTL_MS) return null;
    const sc = j.doc?.structureCode;
    if (typeof sc !== "string" || !/^[A-Z0-9_]+$/.test(sc)) return null;
    const mc = typeof j.doc?.modelCode === "string" && /^[A-Za-z0-9_-]+$/.test(j.doc.modelCode) ? j.doc.modelCode : sc;
    return {
      name: typeof j.doc?.name === "string" ? j.doc.name.slice(0, 120) : "",
      modelCode: mc,
      structureCode: sc,
      designId: typeof j.designId === "string" && /^[\w-]{1,64}$/.test(j.designId) ? j.designId : null,
    };
  } catch {
    return null;
  }
}
