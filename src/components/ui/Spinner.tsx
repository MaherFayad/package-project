"use client";

import { useUi } from "./AppProvider";
import { cx } from "./utils";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  size?: "small" | "large";
  accessibilityLabel?: string;
  /** Inside a button the button carries aria-busy, so the spinner is decorative. */
  decorative?: boolean;
  className?: string;
}

export function Spinner({ size = "large", accessibilityLabel, decorative, className }: SpinnerProps) {
  const { s } = useUi();
  const svg = (
    <svg viewBox="0 0 20 20" className={cx(styles.Svg, styles[size])} aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.5" className={styles.Track} />
      <path d="M10 2a8 8 0 0 1 8 8" fill="none" strokeWidth="2.5" strokeLinecap="round" className={styles.Arc} />
    </svg>
  );
  if (decorative) return <span className={cx(styles.Spinner, className)}>{svg}</span>;
  return (
    <span className={cx(styles.Spinner, className)} role="status">
      {svg}
      <span className="visually-hidden">{accessibilityLabel ?? s.loading}</span>
    </span>
  );
}
