"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { LostState } from "@/components/marketing/restyle/LostState";

/** Store-wide error boundary: friendly message + retry in the marketing language, never a stack trace. */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <LostState
      role="alert"
      titleId="store-error-title"
      title={t("store.states.errorTitle")}
      body={t("store.states.errorBody")}
      links={[
        { label: t("store.states.retry"), onClick: () => reset() },
        { label: t("common.goHome"), href: `/${locale}` },
        { label: t("nav.catalog"), href: `/${locale}/catalog` },
      ]}
    />
  );
}
