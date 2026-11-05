import type { ReactNode } from "react";
import { cx, type SpaceScale } from "./utils";
import styles from "./Card.module.css";

export interface CardProps {
  children?: ReactNode;
  /** Card title row (13px semibold heading) with optional actions on the inline end. */
  title?: ReactNode;
  /** Heading element for the title. Defaults to h2. */
  titleAs?: "h2" | "h3" | "h4";
  headerActions?: ReactNode;
  /** Footer row; actions are right-aligned (left in RTL). */
  footer?: ReactNode;
  /** 16px by default; 12px on phones. */
  padding?: SpaceScale;
  background?: "bg-surface" | "bg-surface-secondary" | "bg-surface-critical" | "bg-surface-info";
  /** Square corners on phones so the card reaches the screen edge (Polaris roundedAbove="sm"). */
  roundedAbove?: "sm" | "md";
  id?: string;
  className?: string;
  /** Labels the card region for screen readers when it has no visible title. */
  accessibilityLabel?: string;
  as?: "div" | "section" | "article";
}

/** White surface, radius 12, hairline outline + 1px drop shadow. */
export function Card({
  children,
  title,
  titleAs: H = "h2",
  headerActions,
  footer,
  padding,
  background = "bg-surface",
  roundedAbove,
  id,
  className,
  accessibilityLabel,
  as: Tag = "div",
}: CardProps) {
  const pad = padding ? { "--card-pad": `var(--p-space-${padding})` } : undefined;
  return (
    <Tag
      id={id}
      className={cx(styles.Card, roundedAbove && styles[`rounded-${roundedAbove}`], className)}
      style={{ background: `var(--p-color-${background})`, ...(pad as object) }}
      aria-label={accessibilityLabel}
    >
      {title || headerActions ? (
        <div className={styles.Header}>
          {title ? <H className={styles.Title}>{title}</H> : <span />}
          {headerActions ? <div className={styles.HeaderActions}>{headerActions}</div> : null}
        </div>
      ) : null}
      {children}
      {footer ? <div className={styles.Footer}>{footer}</div> : null}
    </Tag>
  );
}

/** A full-bleed section inside a Card, separated by a divider (e.g. totals, secondary info). */
export function CardSection({ children, tone, flush }: { children?: ReactNode; tone?: "subdued"; flush?: boolean }) {
  return <div className={cx(styles.Section, tone === "subdued" && styles.subdued, flush && styles.flush)}>{children}</div>;
}

/** Inset summary box inside a card (payment summary, totals): 1px border, radius 8, 12px padding. */
export function Inset({ children, tone }: { children?: ReactNode; tone?: "subdued" }) {
  return <div className={cx(styles.Inset, tone === "subdued" && styles.insetSubdued)}>{children}</div>;
}
