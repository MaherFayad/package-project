import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui";
import styles from "./store.module.css";

/** Accessible FAQ built on native <details>/<summary> (keyboard and screen reader support for free). */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className={styles.faq}>
      {items.map((it, i) => (
        <details key={i} className={styles.faqItem}>
          <summary className={styles.faqQ}>
            <span>{it.q}</span>
            <span className={styles.faqChevron}>
              <Icon source={ChevronDown} />
            </span>
          </summary>
          <p className={styles.faqA}>{it.a}</p>
        </details>
      ))}
    </div>
  );
}
