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

/** Plex weights preloaded on Arabic pages (body and headings; 600 loads on demand). */
export const PLEX_PRELOAD_WEIGHTS = [400, 700] as const;
