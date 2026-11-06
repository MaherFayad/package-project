import "@/styles/motion.css";
import { Suspense, type ReactNode } from "react";
import type { Locale } from "@/types";
import { AppProvider, CookieNotice } from "@/components/ui";
import { AnnouncementBar } from "./AnnouncementBar";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { RevealScope } from "./useReveal";
import styles from "./marketing.module.css";

/**
 * The one buyer-facing chrome (CR-05): announcement bar, white header with menus (account menu
 * once signed in), <main id="main">, black footer and the shared cookie notice. Used by the
 * public pages, sign-in, account, orders, share links and the vendor application. Checkout has
 * its own minimal white header (CheckoutShell); the designer and the vendor and admin apps keep
 * their own frames.
 */
export function MarketingShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <AppProvider locale={locale}>
      <div className={styles.site}>
        <AnnouncementBar />
        <Suspense fallback={<div className={styles.headerFallback} aria-hidden="true" />}>
          <MarketingHeader locale={locale} />
        </Suspense>
        <main id="main" className={styles.main} tabIndex={-1}>
          {children}
        </main>
        <MarketingFooter locale={locale} />
        <CookieNotice />
        <RevealScope />
      </div>
    </AppProvider>
  );
}
