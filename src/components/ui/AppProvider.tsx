"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useOptionalI18n } from "@/i18n/client";
import { uiStrings, type UiLocale, type UiStrings } from "./strings";
import { ToastProvider } from "./Toast";
import { useFocusReveal } from "./useFocusReveal";

interface UiContextValue {
  locale: UiLocale;
  dir: "rtl" | "ltr";
  s: UiStrings;
}

const UiContext = createContext<UiContextValue | null>(null);

/**
 * Root provider for the UI kit: locale/direction for built-in strings and the toast queue.
 * Mount once per area layout (Frame-based layouts, MarketingShell, CheckoutShell, designer). If omitted, the
 * kit falls back to the app's <I18nProvider> locale, then English.
 */
export function AppProvider({ locale, children }: { locale?: UiLocale; children: ReactNode }) {
  const i18n = useOptionalI18n();
  const resolved: UiLocale = locale ?? i18n?.locale ?? "en";
  useFocusReveal();
  const value = useMemo<UiContextValue>(
    () => ({ locale: resolved, dir: resolved === "ar" ? "rtl" : "ltr", s: uiStrings[resolved] }),
    [resolved],
  );
  return (
    <UiContext.Provider value={value}>
      <ToastProvider>{children}</ToastProvider>
    </UiContext.Provider>
  );
}

/** Locale, direction and built-in strings for UI kit components. Never throws. */
export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  const i18n = useOptionalI18n();
  if (ctx) return ctx;
  const locale: UiLocale = i18n?.locale ?? "en";
  return { locale, dir: locale === "ar" ? "rtl" : "ltr", s: uiStrings[locale] };
}
