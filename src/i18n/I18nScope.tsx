import type { ReactNode } from "react";
import type { Locale } from "@/types";
import { I18nProvider } from "./client";
import { scopedDictionary } from "./scope";
import type { I18nScopeName } from "./scopes.generated";

/**
 * Server wrapper for an area layout: adds the area's dictionary keys to the client dictionary
 * (R5-PL-08). Wrap the layout's WHOLE output, since the scope generator counts everything the
 * layout file imports as part of the area.
 */
export function I18nScope({ locale, scope, children }: { locale: Locale; scope: I18nScopeName; children: ReactNode }) {
  return (
    <I18nProvider locale={locale} dict={scopedDictionary(locale, scope)}>
      {children}
    </I18nProvider>
  );
}
