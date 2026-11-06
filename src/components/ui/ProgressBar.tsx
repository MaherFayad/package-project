import { cx } from "./utils";
import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  /** 0–100 */
  progress: number;
  size?: "small" | "medium" | "large";
  tone?: "highlight" | "primary" | "success" | "critical";
  /** Required accessible name, e.g. "Upload progress". */
  accessibilityLabel: string;
  /** Animate width changes (disabled automatically under reduced motion). */
  animated?: boolean;
}

export function ProgressBar({ progress, size = "medium", tone = "highlight", accessibilityLabel, animated = true }: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      className={cx(styles.Progress, styles[`progress-${size}`])}
      role="progressbar"
      aria-label={accessibilityLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
    >
      <div className={cx(styles.ProgressIndicator, styles[`progressTone-${tone}`], animated && styles.progressAnimated)} style={{ inlineSize: `${v}%` }} />
    </div>
  );
}
