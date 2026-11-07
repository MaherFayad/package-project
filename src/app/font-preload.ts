import "server-only";
import fs from "node:fs";
import path from "node:path";
import { preload } from "react-dom";
import { workersBuildFacts } from "@/lib/runtime/build-facts";
import { interFace, notoArabicFace, plexArabicFaces } from "@/lib/runtime/font-faces";

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
let notoCache: string | null | undefined;

/** Text of every built CSS file (Node). Empty under a missing build or off-disk runtimes. */
function builtCss(): string[] {
  const dist = process.env.NEXT_DIST_DIR || ".next";
  const root = path.join(process.cwd(), dist, "static", "css");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".css")) {
        try {
          out.push(fs.readFileSync(p, "utf8"));
        } catch {
          /* unreadable file: skip */
        }
      }
    }
  };
  try {
    walk(root);
  } catch {
    return [];
  }
  return out;
}

const dev = () => process.env.NODE_ENV !== "production";

export function plexArabicPreloadUrls(weights: readonly number[]): string[] {
  // Cloudflare Workers: no build directory; the worker entry loaded the same facts (build-facts.ts).
  const facts = workersBuildFacts();
  if (facts) return weights.map((w) => facts.fonts.plexArabic[String(w)]).filter((u): u is string => !!u && u.startsWith("/_next/"));
  if (!cache || (cache.size === 0 && dev())) cache = plexArabicFaces(builtCss());
  return weights.map((w) => cache!.get(w)).filter((u): u is string => !!u && u.startsWith("/_next/"));
}

/**
 * URL of the built Inter (Latin, variable) woff2. Inter is `preload: false` in ./fonts.ts and
 * preloaded here on English pages only: on Arabic pages it carries just digits and the odd Latin
 * word, and a 47 KB high-priority preload competed with the render-blocking CSS on Slow 4G
 * (Arabic phone LCP 2.69 -> 2.22 s on /ar/vendors without it; R4-MK-05).
 */
export function interPreloadUrl(): string | null {
  const facts = workersBuildFacts();
  const url = facts ? facts.fonts.inter : (interCache === undefined || (interCache === null && dev()) ? (interCache = interFace(builtCss())) : interCache);
  return url && url.startsWith("/_next/") ? url : null;
}

/**
 * URL of the built Noto Sans Arabic (variable) woff2, Arabic block. Preloaded by MarketingShell on
 * Arabic marketing pages, where it carries the LCP headline (it replaces Plex there).
 */
export function notoArabicPreloadUrl(): string | null {
  const facts = workersBuildFacts();
  const url = facts ? facts.fonts.noto : (notoCache === undefined || (notoCache === null && dev()) ? (notoCache = notoArabicFace(builtCss())) : notoCache);
  return url && url.startsWith("/_next/") ? url : null;
}

/**
 * Preloads the Plex Arabic cuts used above the fold of the app frames (designer, checkout, vendor
 * and admin), Arabic pages only. Was in `[locale]/layout.tsx` for every page; the marketing pages
 * now use Noto Sans Arabic, so each app frame calls this itself (R6 foundation).
 */
export function preloadPlexArabic(locale: string, weights: readonly number[] = [400, 600, 700]): void {
  if (locale !== "ar") return;
  for (const href of plexArabicPreloadUrls(weights)) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
}
