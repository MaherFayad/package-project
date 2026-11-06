"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { LostLinks } from "./LostLinks";
import styles from "./not-found.module.css";

/**
 * Locale-level error boundary (R5-PL-01). Areas with their own boundary (store, orders, admin,
 * vendor, checkout, designer) never reach it; sign-in, unsubscribe, share, legal and dev pages
 * did, and got Next's unstyled English "Application error" instead. Reuses the locale 404's
 * small sheet, which every page under this layout already carries (R4-09), so it adds no CSS.
 */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className={styles.site}>
      <main id="main" className={styles.main} tabIndex={-1}>
        <section className={styles.hero} role="alert" aria-labelledby="locale-error-title">
          <div className={styles.inner}>
            <div>
              <h1 id="locale-error-title" className={styles.title}>
                {t("store.states.errorTitle")}
              </h1>
              <p className={styles.lead}>{t("store.states.errorBody")}</p>
            </div>
            <LostLinks
              links={[
                { label: t("store.states.retry"), onClick: () => reset() },
                { label: t("common.goHome"), href: `/${locale}` },
              ]}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
