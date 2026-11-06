import { NotFoundBody } from "./NotFoundBody";
import styles from "./not-found.module.css";

/**
 * Fallback 404 for areas that bring their own chrome (designer, vendor portal, admin, dev):
 * their layout is not rendered here, so this provides the one <main id="main">. Unknown URLs and
 * store pages use the not-found boundaries inside MarketingShell ([...missing], (store)).
 *
 * R4-09: uses its own ~2 KB stylesheet, not marketing.module.css. Next embeds every layout's
 * not-found element, with its CSS, into each page under that layout, so the marketing sheet
 * (64 KB raw) was shipped to every admin, vendor, checkout and editor page.
 */
export default function LocaleNotFound() {
  return (
    <div className={styles.site}>
      <main id="main" className={styles.main} tabIndex={-1}>
        <NotFoundBody />
      </main>
    </div>
  );
}
