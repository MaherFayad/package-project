import type { ReactNode } from "react";
import styles from "./kit.module.css";

/**
 * FAQ on native <details>/<summary> (keyboard and screen readers for free) with big plus icons
 * that turn into minus and a smooth height animation (::details-content + interpolate-size where
 * supported; off under reduced motion). Pass `name` to make it an exclusive accordion.
 */
export function Faq({ items, name, className }: { items: { q: ReactNode; a: ReactNode }[]; name?: string; className?: string }) {
  return (
    <div className={[styles.faq, className].filter(Boolean).join(" ")}>
      {items.map((it, i) => (
        <details key={i} className={styles.faqItem} name={name}>
          <summary>
            <span>{it.q}</span>
            <span className={styles.faqPlus} aria-hidden="true" />
          </summary>
          <div className={styles.faqAnswer}>{it.a}</div>
        </details>
      ))}
    </div>
  );
}
