"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { LostLinks } from "./LostLinks";
import styles from "./not-found.module.css";

/** Locale 404 content with its own small stylesheet (R4-09). Same copy, title and look as NotFoundState. */
export function NotFoundBody() {
  const { t, locale } = useI18n();
  const base = `/${locale}`;
  const title = `${t("common.notFoundTitle")} · ${t("meta.siteName")}`;
  useEffect(() => {
    document.title = title; // WCAG 2.4.2: the not-found render keeps the layout's default title
  }, [title]);
  return (
    <section className={styles.hero} aria-labelledby="not-found-title">
      <div className={styles.inner}>
        <div>
          <span className={styles.code} aria-hidden="true">
            404
          </span>
          <h1 id="not-found-title" className={styles.title}>
            {t("common.notFoundTitle")}
          </h1>
          <p className={styles.lead}>{t("common.notFoundBody")}</p>
        </div>
        <LostLinks
          links={[
            { label: t("common.goHome"), href: base },
            { label: t("nav.catalog"), href: `${base}/catalog` },
            { label: t("nav.design"), href: `${base}/design` },
          ]}
        />
      </div>
    </section>
  );
}
