import type { ReactNode } from "react";
import { toLocale } from "@/i18n";
import { AppProvider } from "@/components/ui";
import { DesignerTopBar } from "@/components/designer/DesignerTopBar";
import styles from "@/components/designer/designer.module.css";

/**
 * Designer area (owner: designer): full-screen editor chrome — dark top bar, no store footer.
 * Renders the single <main id="main"> for the skip link.
 */
export default async function DesignLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  return (
    <AppProvider locale={locale}>
      <div className={styles.shell}>
        <DesignerTopBar locale={locale} />
        <main id="main" className={styles.main}>
          {children}
        </main>
      </div>
    </AppProvider>
  );
}
