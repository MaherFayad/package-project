import type { ReactNode } from "react";
import "@/styles/globals.css";

/**
 * Root layout is a pass-through: <html>/<body> are rendered by src/app/[locale]/layout.tsx
 * so that `lang` and `dir` follow the locale segment.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
