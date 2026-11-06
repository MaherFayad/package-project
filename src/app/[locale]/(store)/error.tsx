"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import styles from "@/components/marketing/marketing.module.css";

/** Store-wide error boundary: friendly message + retry in the marketing language, never a stack trace. */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className={`${styles.centerHero} ${styles.bandMint} ${styles.stateHero}`} role="alert" aria-labelledby="store-error-title">
      <div className={`${styles.container} ${styles.narrow}`}>
        <h1 id="store-error-title" className={styles.h2}>
          {t("store.states.errorTitle")}
        </h1>
        <p className={styles.lead}>{t("store.states.errorBody")}</p>
        <div className={`${styles.actions} ${styles.center}`}>
          <button type="button" className={`${styles.pill} ${styles.pillLarge}`} onClick={() => reset()}>
            {t("store.states.retry")}
          </button>
          <Link href={`/${locale}`} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`}>
            {t("common.goHome")}
          </Link>
        </div>
      </div>
    </section>
  );
}
