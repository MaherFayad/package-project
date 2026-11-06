"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import styles from "./not-found.module.css";

/** Locale 404 content with its own small stylesheet (R4-09). Same copy and title as NotFoundState. */
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
        <h1 id="not-found-title" className={styles.title}>
          {t("common.notFoundTitle")}
        </h1>
        <p className={styles.lead}>{t("common.notFoundBody")}</p>
        <div className={styles.actions}>
          <Link href={base} className={styles.pill}>
            {t("common.goHome")}
          </Link>
          <Link href={`${base}/catalog`} className={`${styles.pill} ${styles.outline}`}>
            {t("nav.catalog")}
          </Link>
        </div>
      </div>
    </section>
  );
}
