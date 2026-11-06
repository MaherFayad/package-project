import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * URLs of the built IBM Plex Sans Arabic woff2 files (Arabic block) for the given weights.
 *
 * next/font cannot preload a font for one locale only (preload follows the module graph, and
 * ar and en share `[locale]/layout.tsx`), so we read the @font-face rules next/font wrote into
 * the built CSS once per process and preload the matching files ourselves on Arabic pages.
 * Anything unexpected (dev server, renamed family, missing build) -> [] and the fonts simply
 * load on demand with `font-display: swap`.
 */
let cache: Map<number, string> | null = null;

function scan(): Map<number, string> {
  const found = new Map<number, string>();
  const dist = process.env.NEXT_DIST_DIR || ".next";
  const root = path.join(process.cwd(), dist, "static", "css");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css")) files.push(p);
    }
  };
  try {
    walk(root);
  } catch {
    return found;
  }
  const rule = /@font-face\s*{([^}]*)}/g;
  for (const f of files) {
    let css: string;
    try {
      css = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (!css.includes("IBM Plex Sans Arabic")) continue;
    for (const m of css.matchAll(rule)) {
      const body = m[1];
      if (!/font-family:\s*['"]?IBM Plex Sans Arabic['"]?\s*;/.test(body)) continue;
      if (!/unicode-range:[^;]*u\+06/i.test(body)) continue; // the Arabic-block file
      const w = /font-weight:\s*(\d{3})\s*;/.exec(body);
      const u = /url\(([^)]+\.woff2)\)/.exec(body);
      if (w && u) found.set(Number(w[1]), u[1].replace(/^['"]|['"]$/g, ""));
    }
  }
  return found;
}

export function plexArabicPreloadUrls(weights: readonly number[]): string[] {
  if (!cache || (cache.size === 0 && process.env.NODE_ENV !== "production")) cache = scan();
  return weights.map((w) => cache!.get(w)).filter((u): u is string => !!u && u.startsWith("/_next/"));
}
