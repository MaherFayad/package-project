"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { LostState } from "@/components/marketing/restyle/LostState";

/** 404 for /s/<token> (unknown, revoked or never shared), inside the store chrome (R6: the 404 language). */
export default function ShareNotFound() {
  const { t, locale } = useI18n();
  const title = `${t("designer.shared.notFoundTitle")} · ${t("meta.siteName")}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <LostState
      code="404"
      titleId="not-found-title"
      title={t("designer.shared.notFoundTitle")}
      body={t("designer.shared.notFoundBody")}
      links={[
        { label: t("designer.shared.copyDesign"), href: `/${locale}/design` },
        { label: t("common.goHome"), href: `/${locale}` },
        { label: t("nav.catalog"), href: `/${locale}/catalog` },
      ]}
    />
  );
}
