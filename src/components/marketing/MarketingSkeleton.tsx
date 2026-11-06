"use client";

import { useI18n } from "@/i18n/client";
import styles from "./marketing.module.css";

/**
 * Route fallback for the marketing list pages (/boxes, /vendors) on client navigation: a hero band
 * and a card grid in the marketing shapes. Styled only from marketing.module.css, which every
 * marketing page already loads. The admin `GridPageSkeleton` it replaces put ~15 Polaris kit
 * stylesheets (Page, Card, Frame, Popover, Modal, IndexTable…) in front of first paint on these
 * prerendered pages (R4-MK-02). The shimmer stops under prefers-reduced-motion.
 */
export function MarketingSkeleton({ cards = 6 }: { cards?: number }) {
  const { t } = useI18n();
  return (
    <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t("common.loading")}>
      <div className={styles.skelHero} aria-hidden="true">
        <div className={`${styles.container} ${styles.skelHeroInner}`}>
          <span className={`${styles.skelBar} ${styles.skelEyebrow}`} />
          <span className={`${styles.skelBar} ${styles.skelTitle}`} />
          <span className={`${styles.skelBar} ${styles.skelLead}`} />
          <span className={`${styles.skelBar} ${styles.skelPill}`} />
        </div>
      </div>
      <div className={`${styles.container} ${styles.skelGrid}`} aria-hidden="true">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className={styles.skelCard}>
            <span className={styles.skelMedia} />
            <span className={`${styles.skelBar} ${styles.skelLine}`} />
            <span className={`${styles.skelBar} ${styles.skelLineShort}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
