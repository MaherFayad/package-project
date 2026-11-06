import type { ModelGroup } from "./types";

/**
 * Lightweight model cards and search (no generators): what pickers and catalogue pages ship to
 * the browser. Build cards on the server with `toCard` from "@/lib/library".
 */
export interface ModelCard {
  code: string;
  slug: string;
  kind: "box" | "vessel";
  group: ModelGroup;
  standard: string;
  name: { ar: string; en: string };
  search: string;
  simplified: boolean;
}

/** Normalise for search: lower case, Arabic letter variants folded, no diacritics/tatweel. */
export function normaliseSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/** Does a model match every word of a query (codes, both names, standard)? */
export function matchesQuery(m: { search: string }, query: string): boolean {
  const q = normaliseSearch(query);
  if (!q) return true;
  const hay = normaliseSearch(m.search);
  return q.split(/\s+/).every((w) => hay.includes(w));
}
