"use client";

import { useUi } from "./AppProvider";
import { cx } from "./utils";
import styles from "./Misc.module.css";

/** Grey lines standing in for text while loading. Decorative; wrap regions in SkeletonPage or aria-busy. */
export function SkeletonBodyText({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.SkeletonBody} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cx(styles.Shimmer, styles.SkeletonLine)} />
      ))}
    </div>
  );
}

export function SkeletonDisplayText({ size = "medium" }: { size?: "small" | "medium" | "large" }) {
  return <div className={cx(styles.Shimmer, styles.SkeletonDisplay, styles[`display-${size}`])} aria-hidden="true" />;
}

export function SkeletonThumbnail({ size = "medium" }: { size?: "small" | "medium" | "large" }) {
  return <div className={cx(styles.Shimmer, styles.SkeletonThumb, styles[`thumb-${size}`])} aria-hidden="true" />;
}

export function SkeletonTabs({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.SkeletonTabs} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cx(styles.Shimmer, styles.SkeletonTab)} />
      ))}
    </div>
  );
}

/** Page-shaped placeholder: title bar, optional primary action, then children (skeleton cards).
 *  Announces "Loading" once via role=status. */
export function SkeletonPage({ title, primaryAction, children, fullWidth }: { title?: string; primaryAction?: boolean; children?: React.ReactNode; fullWidth?: boolean }) {
  const { s } = useUi();
  return (
    <div className={cx(styles.SkeletonPage, fullWidth && styles.skeletonFull)} aria-busy="true">
      <span role="status" className="visually-hidden">
        {s.loading}
      </span>
      <div className={styles.SkeletonHeader}>
        {title ? <h1 className={styles.SkeletonTitleText}>{title}</h1> : <div className={cx(styles.Shimmer, styles.SkeletonTitle)} aria-hidden="true" />}
        {primaryAction ? <div className={cx(styles.Shimmer, styles.SkeletonButton)} aria-hidden="true" /> : null}
      </div>
      <div className={styles.SkeletonContent}>{children}</div>
    </div>
  );
}
