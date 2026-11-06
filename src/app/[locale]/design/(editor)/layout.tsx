import { Suspense, type ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { modelFromParam } from "@/lib/library";
import { toLocale } from "@/i18n";
import { AppProvider } from "@/components/ui/AppProvider";
import { DesignerTopBar } from "@/components/designer/DesignerTopBar";
import styles from "@/components/designer/designer.module.css";

/**
 * Designer editor (owner: designer): full-screen editor chrome — dark top bar, no store footer.
 * The start page lives in `(picker)` with the marketing chrome.
 * Renders the single <main id="main"> for the skip link.
 */
export default async function DesignLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  // Unknown model → real 404. This must run here, above the Suspense boundary below: a notFound()
  // inside it would be streamed with status 200 (x-elba-path is set by src/middleware.ts).
  const model = ((await headers()).get("x-elba-path") ?? "").split("/")[3];
  const libModel = model ? modelFromParam(model) : null;
  if (model && !libModel) notFound();
  // The model poster is the phone LCP (PERF-R4-02). Preloaded here, above the Suspense boundary,
  // so the hint is in <head>; from the page it streamed after the shell and started ~1.5 s late.
  if (libModel) preload(`/models/${libModel.slug}.svg`, { as: "image", fetchPriority: "high" });
  return (
    <AppProvider locale={locale}>
      <div className={styles.shell}>
        <DesignerTopBar locale={locale} />
        <main id="main" className={styles.main}>
          {/*
            R2-01 (intermittent React #418 on /design/<model>): the model segment reads its RSC
            payload with use(). Without a boundary between <main> and that read, a payload that
            resolves a tick late during hydration suspends up to the root; React retries <main>
            with its hydration cursor already inside it and reports a false "HTML" mismatch,
            then client-renders the whole document. This boundary keeps that suspension local:
            React keeps the server HTML and finishes hydrating when the data is there.
          */}
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </AppProvider>
  );
}
