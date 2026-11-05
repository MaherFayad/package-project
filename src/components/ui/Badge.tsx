import type { ReactNode } from "react";
import { renderIcon, type IconSource } from "./Icon";
import { cx } from "./utils";
import styles from "./Badge.module.css";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "attention"
  | "warning"
  | "critical"
  | "new"
  | "readOnly"
  | "enabled"
  | "magic";

export interface BadgeProps {
  children?: ReactNode;
  tone?: BadgeTone;
  /** Progress pip before the label: incomplete (ring), partiallyComplete (half), complete (filled dot). */
  progress?: "incomplete" | "partiallyComplete" | "complete";
  icon?: IconSource;
  size?: "small" | "medium" | "large";
  /** Extra screen-reader text, e.g. "Payment status:". Rendered visually hidden before the label. */
  toneAndProgressLabel?: string;
}

/** Pill status badge: 12px text, 20px tall. Text always carries the meaning; colour is secondary (1.4.1). */
export function Badge({ children, tone = "neutral", progress, icon, size = "medium", toneAndProgressLabel }: BadgeProps) {
  return (
    <span className={cx(styles.Badge, styles[`tone-${tone}`], styles[`size-${size}`])}>
      {toneAndProgressLabel ? <span className="visually-hidden">{toneAndProgressLabel} </span> : null}
      {progress ? (
        <span className={styles.Pip} aria-hidden="true">
          <svg viewBox="0 0 10 10" width="10" height="10">
            {progress === "complete" ? <circle cx="5" cy="5" r="4" fill="currentColor" /> : null}
            {progress === "incomplete" ? <circle cx="5" cy="5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" /> : null}
            {progress === "partiallyComplete" ? (
              <>
                <circle cx="5" cy="5" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 1.75a3.25 3.25 0 0 1 0 6.5z" fill="currentColor" />
              </>
            ) : null}
          </svg>
        </span>
      ) : icon ? (
        <span className={styles.Icon}>{renderIcon(icon, { size: "small" })}</span>
      ) : null}
      <span className={styles.Label}>{children}</span>
    </span>
  );
}

/** Small numeric pill (nav counts, tab counts). */
export function CountBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "critical" | "inverse" }) {
  return <span className={cx(styles.Count, styles[`count-${tone}`])}>{children}</span>;
}
