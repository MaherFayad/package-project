import { getT } from "@/i18n";
import type { Locale } from "@/types";
import styles from "./SiteChrome.module.css";

/** Store footer — FOUNDATION PLACEHOLDER. Owner: storefront agent. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getT(locale);
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <span>
          © {new Date().getFullYear()} {t("meta.siteName")}
        </span>
        <span>{t("common.vatNote")}</span>
      </div>
    </footer>
  );
}
