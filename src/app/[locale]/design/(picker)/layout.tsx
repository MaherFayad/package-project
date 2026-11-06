import { Suspense, type ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { toLocale } from "@/i18n";
import { ResumeCard } from "@/components/designer/ResumeCard";
import { DesignStart } from "@/components/designer/DesignStart";
import { startPageRedirect } from "@/components/designer/startRedirect";
import styles from "@/components/designer/designer.module.css";

/**
 * Design start page (owner: designer): the buyer-facing marketing chrome (CR-05), so a visitor
 * coming from the home page keeps the same white header and footer. Only the full-screen editor
 * (`(editor)`) keeps the dark designer bar.
 *
 * Order matters here:
 * 1. Deep links (`?structure=` / `?design=`) redirect first, before anything streams, so they
 *    answer a real 307 (R8-01; inside the boundary they became a 200 with a meta refresh).
 *    `x-elba-search` is set by src/middleware.ts.
 * 2. The hero (headline, start stage, poster: the phone LCP) renders in the shell, above the
 *    boundary, so its HTML is flushed before the page's 370-card payload (R8-02 / PERF R4-15:
 *    the poster was at byte 794 K of 1 MB).
 * 3. R4-01: a <Suspense> between <main> and the page segment. The page reads its RSC payload with
 *    use(); without a boundary there, a payload that resolves a tick late suspends up to the root,
 *    React retries <main> with its hydration cursor already inside it and reports a false #418.
 *    The fallback reserves the catalogue's space below the hero (no jump into view, CLS).
 */
export default async function DesignPickerLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  const locale = toLocale(l);
  const to = startPageRedirect(locale, new URLSearchParams((await headers()).get("x-elba-search") ?? ""));
  if (to) redirect(to);
  return (
    <MarketingShell locale={locale}>
      {/* R6-02: the hero poster (first product, T-shirt mailer) is the phone LCP element. */}
      <link rel="preload" href="/models/mailer-box.svg" as="image" fetchPriority="high" />
      <div className={styles.startPage}>
        <ResumeCard locale={locale} />
        <DesignStart locale={locale} />
        <Suspense fallback={<div className={styles.startFallback} aria-hidden="true" />}>{children}</Suspense>
      </div>
    </MarketingShell>
  );
}
