import type { ReactNode } from "react";
import styles from "./charts.module.css";

/**
 * Minimal, dependency-free charts for the admin overview (server-safe). Each chart is decorative
 * (aria-hidden) and is always paired with a DataTable that carries the same numbers, so screen
 * reader and keyboard users get the data as a real table (WCAG 1.1.1, 1.3.1).
 */

export function ColumnChart({ points, startLabel, endLabel }: { points: { key: string; value: number }[]; startLabel: ReactNode; endLabel: ReactNode }) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <div aria-hidden="true">
      <div className={styles.Columns}>
        {points.map((p) => (
          <div key={p.key} className={styles.Column}>
            <div className={`${styles.ColumnBar} ${p.value < 0 ? styles.ColumnBarNegative : ""}`} style={{ blockSize: `${(Math.abs(p.value) / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className={styles.Axis}>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

export function FunnelBars({ rows }: { rows: { key: string; label: ReactNode; value: number; display: ReactNode }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={styles.Funnel} aria-hidden="true">
      {rows.map((r) => (
        <div key={r.key} className={styles.FunnelRow}>
          <span>{r.label}</span>
          <div className={styles.FunnelTrack}>
            <div className={styles.FunnelBar} style={{ inlineSize: `${(r.value / max) * 100}%` }} />
          </div>
          <span className={styles.Value}>{r.display}</span>
        </div>
      ))}
    </div>
  );
}

export { styles as adminStyles };
