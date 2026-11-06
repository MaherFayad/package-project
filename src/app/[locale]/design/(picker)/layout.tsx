import { Suspense, type ReactNode } from "react";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";
import styles from "@/components/designer/designer.module.css";

/**
 * Design start page (owner: designer): the buyer-facing marketing chrome (CR-05), so a visitor
 * coming from the home page keeps the same white header and footer. Only the full-screen editor
 * (`(editor)`) keeps the dark designer bar.
 */
export default async function DesignPickerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <MarketingShell locale={toLocale(locale)}>
      {/* R6-02: the hero poster (first product, T-shirt mailer) is the phone LCP element. A real
          <link> in the shell (React hoists it), because the page streams in after the shell
          (R4-01 boundary) and preload() there only reached the RSC payload. */}
      <link rel="preload" href="/models/mailer-box.svg" as="image" fetchPriority="high" />
      {/*
        R4-01: the same intermittent React #418 ("HTML") as R2-01 in the editor, here on the start
        page: a probe in React's hydration-mismatch path named the shell's <main> as the failing
        fiber while the hydration cursor was already inside it (on .startPage). The page segment
        reads its RSC payload with use(); without a boundary between <main> and that read, a
        payload that resolves a tick late suspends up to the root and the retry claims <main>
        again. This boundary keeps that suspension local. The page now streams into it (same
        response), so the fallback reserves a full viewport: the footer never paints above the fold
        and then jumps (CLS).
      */}
      <Suspense fallback={<div className={styles.startFallback} aria-hidden="true" />}>{children}</Suspense>
    </MarketingShell>
  );
}
