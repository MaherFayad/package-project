import type { ReactNode } from "react";
import type { Locale } from "@/types";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header + <main id="main"> + footer. Use in any buyer-facing route-group layout. */
export function StoreShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <>
      <SiteHeader locale={locale} />
      <main id="main">{children}</main>
      <SiteFooter locale={locale} />
    </>
  );
}
