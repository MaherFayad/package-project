import type { ReactNode } from "react";
import styles from "./Misc.module.css";

export interface Metric {
  /** Label (wrap in <Tooltip dotted> for a definition). */
  label: ReactNode;
  value: ReactNode;
  /** Small trend text or sparkline element. */
  trend?: ReactNode;
}

/** One card split into equal cells: 12px label, 14–16px semibold value, optional trend.
 *  First cell can hold a period selector. Scrolls inside itself on phones. */
export function MetricsStrip({ metrics, leading, accessibilityLabel }: { metrics: Metric[]; leading?: ReactNode; accessibilityLabel?: string }) {
  return (
    <section className={styles.Metrics} aria-label={accessibilityLabel}>
      {leading ? <div className={styles.MetricLeading}>{leading}</div> : null}
      <dl className={styles.MetricList}>
        {metrics.map((m, i) => (
          <div key={i} className={styles.Metric}>
            <dt className={styles.MetricLabel}>{m.label}</dt>
            <dd className={styles.MetricValue}>
              <span>{m.value}</span>
              {m.trend ? <span className={styles.MetricTrend}>{m.trend}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
