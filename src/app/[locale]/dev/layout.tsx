import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { devPagesEnabled } from "@/lib/env";

/**
 * Developer area (not linked from the site; noindex; disallowed in robots.txt; never in the
 * sitemap; 404 in a deployment, R5-SEC-04). Tools under (tools)/ get a bare <main>; the
 * marketing kit gallery (kit/) renders inside the real marketing shell.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (!devPagesEnabled()) notFound();
  return children;
}
