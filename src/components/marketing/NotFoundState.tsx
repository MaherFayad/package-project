"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import styles from "./marketing.module.css";

/**
 * 404 content in the marketing language (CR-04). Rendered by the not-found boundaries that sit
 * inside MarketingShell ([...missing] and (store)), so an unknown URL keeps the header,
 * footer and the page language. The not-found render keeps the layout's default <title>, so
 * this sets the document title to "Page not found" (WCAG 2.4.2).
 */
export function NotFoundState() {
  const { t, locale } = useI18n();
  const base = `/${locale}`;
  const title = `${t("common.notFoundTitle")} · ${t("meta.siteName")}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <section className={`${styles.centerHero} ${styles.bandMint} ${styles.stateHero}`} aria-labelledby="not-found-title">
      <div className={`${styles.container} ${styles.narrow}`}>
        <h1 id="not-found-title" className={styles.h2}>
          {t("common.notFoundTitle")}
        </h1>
        <p className={styles.lead}>{t("common.notFoundBody")}</p>
        <div className={`${styles.actions} ${styles.center}`}>
          <Link href={base} className={`${styles.pill} ${styles.pillLarge}`}>
            {t("common.goHome")}
          </Link>
          <Link href={`${base}/catalog`} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`}>
            {t("nav.catalog")}
          </Link>
        </div>
      </div>
    </section>
  );
}
