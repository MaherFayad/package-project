import type { ReactNode } from "react";
import "@/styles/globals.css";
// R5-PL-06: the font CSS belongs to the root segment, so the locale layout and the root 404 (both
// use the fonts) share one inlined @font-face copy instead of one per segment (~9 KB per page).
import "@/app/fonts";

/**
 * Root layout is a pass-through: <html>/<body> are rendered by src/app/[locale]/layout.tsx
 * so that `lang` and `dir` follow the locale segment.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
