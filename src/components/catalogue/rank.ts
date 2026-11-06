import { matchesQuery, normaliseSearch } from "@/lib/library/search";

interface Rankable {
  search: string;
  code: string;
  name: { ar: string; en: string };
  standard: { code: string | null };
}

/**
 * Search with relevance: every query word must occur in the haystack (codes, both names,
 * standard, family names); rows whose CODE or NAME words start with the query come first, so
 * "كوب" lists cups before "تلسكوبية" (telescope) boxes. Stable within a rank (catalogue order).
 */
export function searchRanked<T extends Rankable>(rows: readonly T[], query: string): T[] {
  const q = normaliseSearch(query);
  if (!q) return [...rows];
  const words = q.split(/\s+/).filter(Boolean);
  const scored: { row: T; score: number; i: number }[] = [];
  rows.forEach((row, i) => {
    if (!matchesQuery(row, q)) return;
    const code = normaliseSearch(`${row.code.replace(/[_-]/g, " ")} ${row.standard.code ?? ""}`);
    const nameWords = normaliseSearch(`${row.name.ar} ${row.name.en}`).split(/[\s,()/،-]+/);
    const codeHit = words.some((w) => /\d/.test(w) && code.split(/\s+/).some((c) => c === w || c.startsWith(w)));
    const nameHit = words.every((w) => nameWords.some((n) => n.startsWith(w)));
    scored.push({ row, score: codeHit ? 0 : nameHit ? 1 : 2, i });
  });
  return scored.sort((a, b) => a.score - b.score || a.i - b.i).map((s) => s.row);
}
