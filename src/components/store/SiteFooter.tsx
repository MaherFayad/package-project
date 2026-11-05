import Link from "next/link";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { ElbaWordmark } from "@/components/ui";
import styles from "./SiteChrome.module.css";

/** Store footer (owner: storefront): product links, legal links, payment methods, VAT note. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const base = `/${locale}`;
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerAbout}>
          <ElbaWordmark tone="base" />
          <p>{t("store.footer.about")}</p>
        </div>
        <nav aria-labelledby="footer-product" className={styles.footerCol}>
          <h2 id="footer-product" className={styles.footerHeading}>
            {t("store.footer.product")}
          </h2>
          <ul>
            <li><Link href={`${base}/catalog`}>{t("nav.catalog")}</Link></li>
            <li><Link href={`${base}/design`}>{t("nav.design")}</Link></li>
            <li><Link href={`${base}/vendors`}>{t("nav.vendors")}</Link></li>
            <li><Link href={`${base}/account`}>{t("nav.account")}</Link></li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-legal" className={styles.footerCol}>
          <h2 id="footer-legal" className={styles.footerHeading}>
            {t("store.footer.legal")}
          </h2>
          <ul>
            <li><Link href={`${base}/legal/privacy`}>{t("store.footer.privacy")}</Link></li>
            <li><Link href={`${base}/legal/terms`}>{t("store.footer.terms")}</Link></li>
            <li><Link href={`${base}/legal/returns`}>{t("store.footer.returns")}</Link></li>
            <li><Link href={`${base}/legal/cookies`}>{t("store.footer.cookies")}</Link></li>
          </ul>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>
          © <bdi>{new Date().getFullYear()}</bdi> {t("meta.siteName")}. {t("store.footer.rights")}
        </span>
        <span>{t("store.footer.payments")}</span>
        <span>{t("common.vatNote")}</span>
      </div>
    </footer>
  );
}
