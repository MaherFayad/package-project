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
let interCache: string | null | undefined;

function cssFiles(): string[] {
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
    return [];
  }
  return files;
}

function scan(): Map<number, string> {
  const found = new Map<number, string>();
  const files = cssFiles();
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

/**
 * URL of the built Inter (Latin, variable) woff2. Inter is `preload: false` in ./fonts.ts and
 * preloaded here on English pages only: on Arabic pages it carries just digits and the odd Latin
 * word, and a 47 KB high-priority preload competed with the render-blocking CSS on Slow 4G
 * (Arabic phone LCP 2.69 -> 2.22 s on /ar/vendors without it; R4-MK-05).
 */
export function interPreloadUrl(): string | null {
  if (interCache === undefined || (interCache === null && process.env.NODE_ENV !== "production")) {
    interCache = null;
    for (const f of cssFiles()) {
      let css: string;
      try {
        css = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      if (!css.includes("Inter")) continue;
      for (const m of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
        const body = m[1];
        if (!/font-family:\s*['"]?Inter['"]?\s*;/.test(body)) continue;
        if (!/unicode-range:[^;]*u\+00(\?\?|00-00ff)/i.test(body)) continue; // Basic Latin file
        const u = /url\(([^)]+\.woff2)\)/.exec(body);
        if (u) interCache = u[1].replace(/^['"]|['"]$/g, "");
      }
      if (interCache) break;
    }
  }
  return interCache && interCache.startsWith("/_next/") ? interCache : null;
}
