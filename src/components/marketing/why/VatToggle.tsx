"use client";

import { useState, type ReactNode } from "react";
import styles from "./why.module.css";

/**
 * Switch every tier card between prices incl. and excl. 14% VAT (the reference's "Pay yearly"
 * toggle). Both figures are in the server HTML; this only flips data-vat on the wrapper and CSS
 * shows one of them, so there is no layout shift and no second price source. Starts VAT-inclusive:
 * consumer prices in Egypt are shown with taxes (Consumer Protection Law 181/2018); businesses that
 * reclaim input VAT can switch. A real toggle button (aria-pressed) with a 44px target (WCAG 2.5.8).
 */
export function VatToggle({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  const [incl, setIncl] = useState(true);
  return (
    <div className={styles.vatScope} data-vat={incl ? "incl" : "excl"}>
      <div className={styles.vatRow}>
        <button type="button" className={styles.switch} aria-pressed={incl} onClick={() => setIncl((v) => !v)}>
          <span className={styles.switchTrack} aria-hidden="true">
            <span className={styles.switchThumb} />
          </span>
          <span>{label}</span>
        </button>
        {aside}
      </div>
      {children}
    </div>
  );
}
