import styles from "./why.module.css";

/**
 * FAQ in the reference's style: big round plus icons, hairline rows, smooth height where the
 * browser supports ::details-content (off under reduced motion). Native <details>/<summary>, so
 * keyboard and screen readers work without JS. Page-local: the kit has no FAQ yet, and the
 * older MarketingFaq is styled for the retired light site.
 */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className={styles.faq}>
      {items.map((it) => (
        <details key={it.q} className={styles.faqItem}>
          <summary>
            <span className={styles.faqPlus} aria-hidden="true" />
            <span>{it.q}</span>
          </summary>
          <p className={styles.faqAnswer}>{it.a}</p>
        </details>
      ))}
    </div>
  );
}
