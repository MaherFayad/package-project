import { NotFoundState } from "@/components/marketing/NotFoundState";
import styles from "@/components/marketing/marketing.module.css";

/**
 * Fallback 404 for areas that bring their own chrome (designer, vendor portal, admin, dev):
 * their layout is not rendered here, so this provides the one <main id="main">. Unknown URLs and
 * store pages use the not-found boundaries inside MarketingShell ([...missing], (store)).
 */
export default function LocaleNotFound() {
  return (
    <div className={styles.site}>
      <main id="main" className={styles.main} tabIndex={-1}>
        <NotFoundState />
      </main>
    </div>
  );
}
