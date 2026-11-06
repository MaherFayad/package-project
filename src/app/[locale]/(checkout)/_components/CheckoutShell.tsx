import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Lock } from "lucide-react";
import type { Locale } from "@/types";
import { getT } from "@/i18n";
import { AppProvider, ElbaWordmark } from "@/components/ui";
import { CookieNotice } from "@/components/store/CookieNotice";
import { LanguageSwitcher } from "@/components/store/LanguageSwitcher";
import chrome from "@/components/store/SiteChrome.module.css";
import styles from "./CheckoutShell.module.css";

/**
 * Focused checkout chrome (owner: checkout). At the moment of highest intent the buyer sees only
 * the wordmark, a "secure checkout" cue and the language switch: no store navigation or marketing
 * footer to leak attention (Polaris checkout pattern, screen 19). Legal links stay reachable.
 */
export function CheckoutShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getT(locale);
  const base = `/${locale}`;
  return (
    <AppProvider locale={locale}>
      <div className={chrome.shell}>
        <header className={chrome.header}>
          <div className={styles.bar}>
            <Link href={base} className={chrome.brand} aria-label={`${t("meta.siteName")}, ${t("nav.home")}`}>
              <ElbaWordmark tone="inverse" />
            </Link>
            <span className={styles.secure}>
              <Lock aria-hidden size={14} />
              {t("buyer.secureCheckout")}
            </span>
            <div className={styles.actions}>
              <Suspense fallback={null}>
                <LanguageSwitcher />
              </Suspense>
            </div>
          </div>
        </header>
        <main id="main" className={chrome.main} tabIndex={-1}>
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
        <CookieNotice />
      </div>
    </AppProvider>
  );
}
