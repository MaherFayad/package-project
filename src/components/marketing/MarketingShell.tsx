import "@/styles/motion.css";
import { Suspense, type ReactNode } from "react";
import type { Locale } from "@/types";
// Direct imports, not the "@/components/ui" barrel: keeps the Polaris kit CSS out of the
// marketing pages' render-blocking stylesheets (R2-MK-01).
import { CookieNotice } from "@/components/ui/CookieNotice";
import { MarketingProviders } from "./MarketingProviders";
import { AnnouncementBar } from "./AnnouncementBar";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { RevealScope } from "./useReveal";
import { RailFocus } from "./RailFocus";
import styles from "./marketing.module.css";

/**
 * The one buyer-facing chrome (CR-05): announcement bar, white header with menus (account menu
 * once signed in), <main id="main">, black footer and the shared cookie notice. Used by the
 * public pages, sign-in, account, orders, share links and the vendor application. Checkout has
 * its own minimal white header (CheckoutShell); the designer and the vendor and admin apps keep
 * their own frames.
 */
export function MarketingShell({ locale, boundary = true, children }: { locale: Locale; boundary?: boolean; children: ReactNode }) {
  return (
    <MarketingProviders locale={locale}>
      <div className={styles.site}>
        <AnnouncementBar />
        {/* No Suspense here: the header reads no request data (session is a client island), so it
            renders inline in the static HTML. Behind a 64 px fallback it streamed in late as a
            73 px header and pushed the page down (CLS 0.0055, CR-45). */}
        <MarketingHeader locale={locale} />
        <main id="main" className={styles.main} tabIndex={-1}>
          {/* R4-MK-09: a Suspense boundary directly inside <main>. Without it, a route segment
              payload that arrives after hydration starts made React retry <main> with a stale
              hydration cursor (#418), regenerate the whole document at ~4.7 s and re-report the
              H1 as LCP. Prerendered pages still ship their content in the static HTML (the
              boundary is already resolved); .main's min-height keeps the footer below the fold
              while a dynamic page streams.
              A notFound() thrown inside this boundary answers 200 (+ noindex), so a segment that can
              404 validates its params ABOVE the shell (a layout that renders the shell itself,
              dynamicParams = false, or boundary={false} for the catch-all 404 route). */}
          {boundary ? <Suspense fallback={null}>{children}</Suspense> : children}
        </main>
        <MarketingFooter locale={locale} />
        <CookieNotice />
        <RevealScope />
        <RailFocus />
      </div>
    </MarketingProviders>
  );
}
