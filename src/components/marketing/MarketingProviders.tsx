"use client";

import type { ReactNode } from "react";
import type { Locale } from "@/types";
import { AppProvider } from "@/components/ui/AppProvider";

/**
 * Marketing-only client boundary around the UI kit provider (toasts for /account, kit strings).
 *
 * Why a wrapper and not <AppProvider> straight from the server layout: a client reference shared
 * by several route-group layouts is resolved to ONE entry's chunk group. AppProvider is also
 * rendered by the (auth) and (checkout) layouts, so on /ar, /ar/boxes and /ar/vendors Next linked
 * the (auth) layout's 17 Polaris stylesheets as render-blocking CSS (21 files, ~2 s of phone FCP
 * on Slow 4G). This module is referenced only by MarketingShell, so it resolves to the store
 * layout's own chunks (R2-MK-01).
 */
export function MarketingProviders({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <AppProvider locale={locale}>{children}</AppProvider>;
}
