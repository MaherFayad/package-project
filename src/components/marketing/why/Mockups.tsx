import { Check, CircleCheck, Package, Printer, Star, Truck } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./why.module.css";

/**
 * Floating product-UI mockups (server components, plain DOM, no client JS). They are drawn
 * from our own UI patterns and fed only real values passed in by the page (prices and days from
 * the pricing engine). Decorative: each mockup is aria-hidden and the same facts are in the text
 * next to it, so screen readers do not hear numbers twice.
 */

export function MockFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.mock} ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}

/** Price badge as the designer shows it: quantity rows, per-box price, total. */
export function MockPrice({ title, rows, totalLabel, total }: { title: string; rows: { qty: string; unit: string; active?: boolean }[]; totalLabel: string; total: string }) {
  return (
    <MockFrame className={styles.mockPrice}>
      <p className={styles.mockTitle}>{title}</p>
      <ul className={styles.mockRows}>
        {rows.map((r) => (
          <li key={r.qty} data-active={r.active ? "true" : undefined}>
            <span>{r.qty}</span>
            <span className={styles.num}>{r.unit}</span>
          </li>
        ))}
      </ul>
      <div className={styles.mockTotal}>
        <span>{totalLabel}</span>
        <strong className={styles.num}>{total}</strong>
      </div>
    </MockFrame>
  );
}

/** Checkout summary: lines, prepay discount, VAT, total, pay button. */
export function MockCheckout({ lines, discount, total, cta }: { lines: { label: string; value: string }[]; discount: { label: string; value: string } | null; total: { label: string; value: string }; cta: string }) {
  return (
    <MockFrame className={styles.mockCheckout}>
      <ul className={styles.mockLines}>
        {lines.map((l) => (
          <li key={l.label}>
            <span>{l.label}</span>
            <span className={styles.num}>{l.value}</span>
          </li>
        ))}
        {discount ? (
          <li className={styles.mockDiscount}>
            <span>{discount.label}</span>
            <span className={styles.num}>{discount.value}</span>
          </li>
        ) : null}
      </ul>
      <div className={styles.mockTotal}>
        <span>{total.label}</span>
        <strong className={styles.num}>{total.value}</strong>
      </div>
      <span className={styles.mockButton}>{cta}</span>
    </MockFrame>
  );
}

/** Order tracking timeline. */
export function MockTracking({ steps, current }: { steps: { label: string; meta: string }[]; current: number }) {
  return (
    <MockFrame className={styles.mockTracking}>
      <ol className={styles.mockSteps}>
        {steps.map((s, i) => (
          <li key={s.label} data-state={i < current ? "done" : i === current ? "now" : "next"}>
            <span className={styles.mockStepIcon}>{i < current ? <Check size={14} /> : i === current ? <Truck size={14} /> : <Package size={14} />}</span>
            <span className={styles.mockStepText}>
              <span>{s.label}</span>
              <span className={styles.mockMeta}>{s.meta}</span>
            </span>
          </li>
        ))}
      </ol>
    </MockFrame>
  );
}

/** Printer match card (a printer row as the checkout lists it), with real counts only. */
export function MockPrinters({ rows }: { rows: { name: string; meta: string; badge?: string }[] }) {
  return (
    <MockFrame className={styles.mockPrinters}>
      <ul className={styles.mockPrinterList}>
        {rows.map((r, i) => (
          <li key={i} data-first={i === 0 ? "true" : undefined}>
            <span className={styles.mockAvatar}>
              <Printer size={16} />
            </span>
            <span className={styles.mockStepText}>
              <span>{r.name}</span>
              <span className={styles.mockMeta}>{r.meta}</span>
            </span>
            {r.badge ? (
              <span className={styles.mockBadge}>
                {i === 0 ? <CircleCheck size={12} /> : <Star size={12} />}
                {r.badge}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}
