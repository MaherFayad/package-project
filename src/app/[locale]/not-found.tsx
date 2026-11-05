"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";

export default function LocaleNotFound() {
  const { t, locale } = useI18n();
  return (
    <main id="main" style={{ padding: "var(--p-space-1600) var(--p-page-gutter)", textAlign: "center" }}>
      <h1 style={{ fontSize: "var(--p-font-size-600)", fontWeight: "var(--p-font-weight-bold)" }}>
        {t("common.notFoundTitle")}
      </h1>
      <p style={{ marginTop: "var(--p-space-300)", color: "var(--p-color-text-secondary)" }}>
        {t("common.notFoundBody")}
      </p>
      <p style={{ marginTop: "var(--p-space-600)" }}>
        <Link href={`/${locale}`}>{t("common.goHome")}</Link>
      </p>
    </main>
  );
}
