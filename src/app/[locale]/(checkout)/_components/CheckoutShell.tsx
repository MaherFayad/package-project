import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Lock } from "lucide-react";
import type { Locale } from "@/types";
import { getT } from "@/i18n";
import { AppProvider, CookieNotice } from "@/components/ui";
import { LangLink } from "@/components/marketing/LangLink";
import { Wordmark } from "@/components/marketing/Wordmark";
import styles from "./CheckoutShell.module.css";

/**
 * Focused checkout chrome (owner: checkout). At the moment of highest intent the buyer sees only
 * the wordmark, a "secure checkout" cue and the language switch: no store navigation or marketing
 * footer to leak attention (Polaris checkout pattern, screen 19). Legal links stay reachable.
 * The bar is white like the marketing header (CR-05), so the buyer never crosses into dark chrome.
 */
export function CheckoutShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getT(locale);
  const base = `/${locale}`;
  return (
    <AppProvider locale={locale}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.bar}>
            <Link href={base} className={styles.brand} aria-label={`${t("meta.siteName")}, ${t("nav.home")}`}>
              <Wordmark locale={locale} />
            </Link>
            <span className={styles.secure}>
              <Lock aria-hidden size={16} strokeWidth={1.75} />
              {t("buyer.secureCheckout")}
            </span>
            <div className={styles.actions}>
              <Suspense fallback={null}>
                <LangLink className={styles.lang} />
              </Suspense>
            </div>
          </div>
        </header>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <footer className={styles.footer}>
          <nav aria-label={t("store.footer.legal")}>
            <ul className={styles.links}>
              <li>
                <Link href={`${base}/legal/returns`}>{t("store.footer.returns")}</Link>
              </li>
              <li>
                <Link href={`${base}/legal/privacy`}>{t("store.footer.privacy")}</Link>
              </li>
              <li>
                <Link href={`${base}/legal/terms`}>{t("store.footer.terms")}</Link>
              </li>
            </ul>
          </nav>
          <p>{t("common.vatNote")}</p>
        </footer>
        {/* Lifted above the sticky checkout action bar on phones so it never covers the primary action. */}
        <div className={styles.cookieSlot}>
          <CookieNotice />
        </div>
      </div>
    </AppProvider>
  );
}
