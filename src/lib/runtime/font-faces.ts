/**
 * Pure parsers for the @font-face rules next/font writes into the built CSS (no fs: shared by
 * src/app/font-preload.ts at runtime in Node and by scripts/cloudflare/write-build-facts.ts).
 */
const RULE = /@font-face\s*{([^}]*)}/g;
const unquote = (s: string) => s.replace(/^['"]|['"]$/g, "");

function family(body: string, name: string): boolean {
  return new RegExp(`font-family:\\s*['"]?${name}['"]?\\s*;`).test(body);
}

/** IBM Plex Sans Arabic, Arabic-block file per weight. */
export function plexArabicFaces(cssTexts: readonly string[]): Map<number, string> {
  const found = new Map<number, string>();
  for (const css of cssTexts) {
    if (!css.includes("IBM Plex Sans Arabic")) continue;
    for (const m of css.matchAll(RULE)) {
      const body = m[1];
      if (!family(body, "IBM Plex Sans Arabic")) continue;
      if (!/unicode-range:[^;]*u\+06/i.test(body)) continue; // the Arabic-block file
      const w = /font-weight:\s*(\d{3})\s*;/.exec(body);
      const u = /url\(([^)]+\.woff2)\)/.exec(body);
      if (w && u) found.set(Number(w[1]), unquote(u[1]));
    }
  }
  return found;
}

/** Inter, Basic Latin file. */
export function interFace(cssTexts: readonly string[]): string | null {
  for (const css of cssTexts) {
    if (!css.includes("Inter")) continue;
    let hit: string | null = null;
    for (const m of css.matchAll(RULE)) {
      const body = m[1];
      if (!family(body, "Inter")) continue;
      if (!/unicode-range:[^;]*u\+00(\?\?|00-00ff)/i.test(body)) continue; // Basic Latin file
      const u = /url\(([^)]+\.woff2)\)/.exec(body);
      if (u) hit = unquote(u[1]);
    }
    if (hit) return hit;
  }
  return null;
}

/** Noto Sans Arabic, Arabic-block file. */
export function notoArabicFace(cssTexts: readonly string[]): string | null {
  for (const css of cssTexts) {
    if (!css.includes("Noto Sans Arabic")) continue;
    let hit: string | null = null;
    for (const m of css.matchAll(RULE)) {
      const body = m[1];
      if (!family(body, "Noto Sans Arabic")) continue;
      if (!/unicode-range:[^;]*u\+06/i.test(body)) continue; // the Arabic-block file
      const u = /url\(([^)]+\.woff2)\)/.exec(body);
      if (u) hit = unquote(u[1]);
    }
    if (hit) return hit;
  }
  return null;
}
