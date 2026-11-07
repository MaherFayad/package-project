"use client";

import { useState, type ReactNode } from "react";
import styles from "./why.module.css";

/**
 * Switch every tier card between prices excl. and incl. 14% VAT. Both figures are in the server
 * HTML; this only flips data-vat on the wrapper and CSS shows one of them, so there is no layout
 * shift and no second price source. R2-08: starts ex-VAT, the per-box basis of every other page
 * (home, box pages, designer, checkout cards); each card keeps its VAT-inclusive total in view
 * either way (Consumer Protection Law 181/2018).
 *
 * R3-09: two named segments («بدون الضريبة | شاملة الضريبة 14%»), the pressed one matching the big
 * number below. The old single switch was labelled "Prices include VAT" while it was off, so the
 * label read as a fact that contradicted the "excl. VAT" price under it. Each segment is a toggle
 * button (aria-pressed) with a 44px target (WCAG 2.5.8).
 */
export function VatToggle({ label, excl, incl, aside, children }: { label: string; excl: string; incl: string; aside?: ReactNode; children: ReactNode }) {
  const [withVat, setWithVat] = useState(false);
  return (
    <div className={styles.vatScope} data-vat={withVat ? "incl" : "excl"}>
      <div className={styles.vatRow}>
        <div role="group" aria-label={label} className={styles.segments}>
          <button type="button" className={styles.segment} aria-pressed={!withVat} onClick={() => setWithVat(false)}>
            {excl}
          </button>
          <button type="button" className={styles.segment} aria-pressed={withVat} onClick={() => setWithVat(true)}>
            {incl}
          </button>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}
