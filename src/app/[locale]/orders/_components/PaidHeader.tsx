"use client";

import { useEffect, useRef } from "react";
import styles from "./orders.module.css";

/**
 * Payment success header (CR-23): a quiet card with a check drawn once (300 ms, ease-out; static
 * under reduced motion), the title, the delivery promise and the next steps. Focus moves to the
 * heading once, so keyboard and screen-reader users start at the confirmation (WCAG 2.4.3).
 */
export function PaidHeader({ title, body, nextTitle, steps }: { title: string; body: string; nextTitle: string; steps: string[] }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className={styles.paid} aria-labelledby="paid-title" data-testid="paid-header">
      <div className={styles.paidHead}>
        <span className={styles.paidIcon} aria-hidden="true">
          <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
            <circle cx="16" cy="16" r="16" className={styles.paidDisc} />
            <path d="M9.5 16.5l4.5 4.5 8.5-9" className={styles.paidCheck} />
          </svg>
        </span>
        <div className={styles.paidText}>
          <h2 id="paid-title" ref={ref} tabIndex={-1} className={styles.paidTitle}>
            {title}
          </h2>
          <p className={styles.paidBody}>{body}</p>
        </div>
      </div>
      <div className={styles.paidNext}>
        <h3 className={styles.nextTitle}>{nextTitle}</h3>
        <ol className={styles.nextList}>
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
