import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { devPagesEnabled } from "@/lib/env";
import { toLocale } from "@/i18n";
import { I18nScope } from "@/i18n/I18nScope";

/** Developer tools area (3D engine owner). Not linked from the site; noindex; 404 in a deployment (R5-SEC-04). */
export default async function DevLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  if (!devPagesEnabled()) notFound();
  return (
    <I18nScope locale={toLocale((await params).locale)} scope="dev">
      <main id="main">{children}</main>
    </I18nScope>
  );
}
