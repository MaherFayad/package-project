"use client";

import { useI18n } from "@/i18n/client";
import { SkeletonBodyText, SkeletonDisplayText } from "@/components/ui";
import styles from "./ListSkeleton.module.css";

/**
 * Route-level loading state for the public list pages (catalogue, boxes, printers): a hero band
 * and a card grid in the same rhythm as the real page, so navigation shows structure at once and
 * nothing shifts when the content streams in (CLS). Announced once as a busy status region.
 */
export function GridPageSkeleton({ cards = 6 }: { cards?: number }) {
  const label = useI18n().t("common.loading");
  return (
    <div className={styles.root} role="status" aria-busy="true" aria-label={label}>
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.heroInner}>
          <div className={styles.eyebrow} />
          <SkeletonDisplayText size="large" />
          <SkeletonBodyText lines={2} />
        </div>
      </div>
      <div className={styles.container} aria-hidden="true">
        <div className={styles.grid}>
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.media} />
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Orders list: title, then rows shaped like the order cards. */
export function RowsPageSkeleton({ rows = 4 }: { rows?: number }) {
  const label = useI18n().t("common.loading");
  return (
    <div className={styles.root} role="status" aria-busy="true" aria-label={label}>
      <div className={styles.container} aria-hidden="true">
        <div className={styles.title}>
          <SkeletonDisplayText size="medium" />
        </div>
        <div className={styles.rows}>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className={styles.row}>
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
