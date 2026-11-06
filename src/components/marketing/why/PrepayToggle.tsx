"use client";

import { useState, type ReactNode } from "react";
import styles from "./why.module.css";

/**
 * Switch between pay-on-delivery and prepaid totals on every tier card. Both totals are in the
 * server HTML; this only flips data-prepaid on the wrapper (CSS shows one of them), so there is
 * no layout shift and no second price source. A real toggle button (aria-pressed), 44px target.
 */
export function PrepayToggle({ label, children }: { label: string; children: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <div className={styles.prepayScope} data-prepaid={on ? "true" : "false"}>
      <div className={styles.prepayRow}>
        <button type="button" className={styles.switch} aria-pressed={on} onClick={() => setOn((v) => !v)}>
          <span className={styles.switchTrack} aria-hidden="true">
            <span className={styles.switchThumb} />
          </span>
          <span>{label}</span>
        </button>
      </div>
      {children}
    </div>
  );
}
