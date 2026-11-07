import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { devPagesEnabled } from "@/lib/env";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";

/**
 * Developer area (not linked from the site; noindex; disallowed in robots.txt; never in the
 * sitemap; 404 in a deployment, R5-SEC-04). Tools under (tools)/ get a bare <main>; the
 * marketing kit gallery (kit/) renders inside the real marketing shell, which brings its own.
 */
export default async function DevLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  if (!devPagesEnabled()) notFound();
  return (
    <I18nScope locale={toLocale((await params).locale)} scope="dev">
      {children}
    </I18nScope>
  );
}
