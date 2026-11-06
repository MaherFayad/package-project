import { Suspense, type ReactNode } from "react";
import type { Locale } from "@/types";
import { AppProvider } from "@/components/ui/AppProvider";
import { CookieNotice } from "./CookieNotice";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import styles from "./SiteChrome.module.css";

/**
 * Header + <main id="main"> + footer, inside the UI kit's AppProvider (toasts, kit strings).
 * Use in any buyer-facing route-group layout: (store), (checkout), orders, (auth).
 */
export function StoreShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <AppProvider locale={locale}>
      <div className={styles.shell}>
        <Suspense fallback={<div className={styles.headerFallback} aria-hidden="true" />}>
          <SiteHeader locale={locale} />
        </Suspense>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <SiteFooter locale={locale} />
        <CookieNotice />
      </div>
    </AppProvider>
  );
}
