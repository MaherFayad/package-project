import styles from "./marketing.module.css";

/**
 * FAQ accordion on native <details>/<summary> (keyboard + screen readers for free). The open /
 * close height transition uses ::details-content + interpolate-size where supported, and is
 * off under prefers-reduced-motion.
 */
export function MarketingFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className={styles.faq}>
      {items.map((it, i) => (
        <details key={i} className={styles.faqItem}>
          <summary>
            <span>{it.q}</span>
            <span className={styles.faqPlus} aria-hidden="true" />
          </summary>
          <p className={styles.faqAnswer}>{it.a}</p>
        </details>
      ))}
    </div>
  );
}
