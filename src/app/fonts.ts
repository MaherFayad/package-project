import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

/**
 * Inter (variable, Latin) carries every Latin run and all digits, in both locales, and is
 * preloaded everywhere.
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
  variable: "--font-inter",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-plex-arabic",
});

/**
 * Plex weights preloaded on Arabic pages: 400 body, 600 chips, buttons and sub-headings, 700
 * headings. 600 used to load on demand and swapped in ~450 ms late, widening the catalogue
 * chips (CLS 0.075 on /ar/catalog, R4-CR-05).
 */
export const PLEX_PRELOAD_WEIGHTS = [400, 600, 700] as const;
