import { IBM_Plex_Sans_Arabic, Inter, Noto_Sans_Arabic } from "next/font/google";

/**
 * Inter (variable, Latin) carries every Latin run and all digits, in both locales. It is
 * preloaded on English pages only: on Arabic pages it renders digits and the odd Latin word, and
 * its 47 KB preload competed with the render-blocking CSS on Slow 4G (R4-MK-05).
 *
 * IBM Plex Sans Arabic is loaded for the Arabic block only (Latin falls through to Inter in
 * the font stack). The UI uses three static cuts: 400 body, 600 medium / semibold, 700 bold.
 * 500 stays declared because the designer offers "Medium" for Plex text layers; @font-face
 * files download only when a glyph needs them, so an unused cut costs nothing.
 * It is NOT preloaded by next/font (that would preload it on English pages too);
 * `[locale]/layout.tsx` preloads 400 and 700 on Arabic pages only (see ./font-preload.ts).
 * Was: arabic + latin subsets, 4 weights, all preloaded on every page (PERF-05).
 */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  // Preloaded by `[locale]/layout.tsx` on English pages only (R4-MK-05, see ./font-preload.ts).
  preload: false,
  variable: "--font-inter",
  // R5-PL-21: our own Latin-only fallback (src/styles/font-fallbacks.css). next/font's generated one
  // has no unicode-range, so where Arial has Arabic glyphs it captured Arabic text ahead of Plex.
  adjustFontFallback: false,
  fallback: ["Elba Inter Fallback"],
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-plex-arabic",
  // R5-PL-16: metric-matched Arabic fallbacks (src/styles/font-fallbacks.css) instead of next/font's
  // Arial-based one, which neither has Arabic on Android nor matches Plex's Arabic widths.
  adjustFontFallback: false,
  fallback: ["Elba Plex Fallback Noto", "Elba Plex Fallback DejaVu"],
});

/**
 * Plex weights preloaded on Arabic pages: 400 body, 600 chips, buttons and sub-headings, 700
 * headings. 600 used to load on demand and swapped in ~450 ms late, widening the catalogue
 * chips (CLS 0.075 on /ar/catalog, R4-CR-05).
 */
export const PLEX_PRELOAD_WEIGHTS = [400, 600, 700] as const;

/**
 * Noto Sans Arabic (variable, wght 100 to 900, SIL OFL): the public marketing site's Arabic face
 * (docs/design-refs/shopify-2026-reference.md, light display weights 300/330). One variable file
 * carries every weight, so the light display cut and the 550 buttons cost a single request.
 * Not preloaded by next/font: MarketingShell preloads it on Arabic marketing pages only (see
 * ./font-preload.ts `notoArabicPreloadUrl`). `adjustFontFallback` (default) emits a size-adjusted
 * local fallback, so the swap does not shift the layout (CLS).
 */
export const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  preload: false,
  adjustFontFallback: true,
  variable: "--font-noto-arabic",
});
