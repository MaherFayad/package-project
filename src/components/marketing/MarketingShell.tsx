import "@/styles/motion.css";
import { Suspense, type ReactNode } from "react";
import type { Locale } from "@/types";
import { MarketingProviders } from "./MarketingProviders";
import { AnnouncementBar } from "./AnnouncementBar";
import { CookieBar } from "./CookieBar";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { RevealScope } from "./useReveal";
import styles from "./marketing.module.css";

/**
 * Public marketing chrome (home, product and category pages, printers, legal): announcement
 * bar, white header with menus, <main id="main">, black footer and the cookie bottom bar.
 * Checkout, orders and sign-in keep the compact StoreShell.
 */
export function MarketingShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <MarketingProviders locale={locale}>
      <div className={styles.site}>
        <AnnouncementBar />
        <Suspense fallback={<div style={{ blockSize: 64 }} aria-hidden="true" />}>
          <MarketingHeader locale={locale} />
        </Suspense>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <MarketingFooter locale={locale} />
        <CookieBar />
        <RevealScope />
      </div>
    </MarketingProviders>
  );
}
