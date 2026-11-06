import "@/styles/motion.css";
import type { ReactNode } from "react";
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
        {/* No Suspense here: the header reads no request data (session is a client island), so it
            renders inline in the static HTML. Behind a 64 px fallback it streamed in late as a
            73 px header and pushed the page down (CLS 0.0055, CR-45). */}
        <MarketingHeader locale={locale} />
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
