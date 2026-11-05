"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/types";
import type { DictKey, Dictionary, TFunction } from "./types";
import { interpolate, lookup } from "./core";

interface I18nValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  dict: Dictionary;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Mounted once in src/app/[locale]/layout.tsx. */
export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      dict,
      t: (key: DictKey, vars) => interpolate(lookup(dict, key), vars),
    }),
    [locale, dict],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client components: const { t, locale, dir } = useI18n(); */
export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}

/** Like useI18n, but returns null outside <I18nProvider> instead of throwing (used by the UI kit). */
export function useOptionalI18n(): I18nValue | null {
  return useContext(I18nContext);
}
