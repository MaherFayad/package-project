"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { LostState } from "./restyle/LostState";

/**
 * 404 content in the marketing language (CR-04, R6 restyle). Rendered by the not-found
 * boundaries that sit inside MarketingShell ([...missing], (store) and the detail segments), so an
 * unknown URL keeps the header, footer and the page language. The not-found render keeps the
 * layout's default <title>, so this sets the document title to "Page not found" (WCAG 2.4.2).
 */
export function NotFoundState() {
  const { t, locale } = useI18n();
  const base = `/${locale}`;
  const title = `${t("common.notFoundTitle")} · ${t("meta.siteName")}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <LostState
      code="404"
      titleId="not-found-title"
      title={t("common.notFoundTitle")}
      body={t("common.notFoundBody")}
      links={[
        { label: t("common.goHome"), href: base },
        { label: t("nav.catalog"), href: `${base}/catalog` },
        { label: t("nav.design"), href: `${base}/design` },
      ]}
    />
  );
}
