import type { ReactNode } from "react";
import { cx } from "./utils";
import styles from "./Misc.module.css";

export interface EmptyStateProps {
  heading: ReactNode;
  children?: ReactNode;
  /** Our own illustration (SVG/img element). Never third-party artwork. */
  image?: ReactNode;
  /** Usually a primary Button. */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  footerContent?: ReactNode;
  /** Smaller variant for use inside cards. */
  compact?: boolean;
  headingAs?: "h2" | "h3";
}

/** Centred illustration · heading · description · primary + plain action. */
export function EmptyState({ heading, children, image, action, secondaryAction, footerContent, compact, headingAs: H = "h2" }: EmptyStateProps) {
  return (
    <div className={cx(styles.EmptyState, compact && styles.emptyCompact)}>
      {image ? <div className={styles.EmptyImage} aria-hidden="true">{image}</div> : null}
      <H className={styles.EmptyHeading}>{heading}</H>
      {children ? <div className={styles.EmptyBody}>{children}</div> : null}
      {action || secondaryAction ? (
        <div className={styles.EmptyActions}>
          {action}
          {secondaryAction}
        </div>
      ) : null}
      {footerContent ? <div className={styles.EmptyFooter}>{footerContent}</div> : null}
    </div>
  );
}

/** Generic empty-box illustration in our kraft palette. */
export function EmptyBoxIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" focusable="false">
      <ellipse cx="60" cy="100" rx="40" ry="6" fill="#e3e3e3" />
      <path d="M22 42 60 26l38 16v42L60 100 22 84z" fill="#e2c08f" />
      <path d="M22 42l38 16 38-16" stroke="#8a5a1c" strokeWidth="2" strokeLinejoin="round" />
      <path d="M60 58v42" stroke="#8a5a1c" strokeWidth="2" />
      <path d="M22 42 10 56l38 16 12-14zM98 42l12 14-38 16-12-14z" fill="#c8964f" stroke="#8a5a1c" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
