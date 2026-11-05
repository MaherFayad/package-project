import Link from "next/link";
import { Package, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import styles from "./SiteChrome.module.css";

/**
 * Store chrome header — FOUNDATION PLACEHOLDER. Owner: storefront agent (refine freely,
 * keep the export name). Used by (store), (checkout), orders and (auth) layouts.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const session = await getSession();
  const user = session?.user;
  const base = `/${locale}`;
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href={base} className={styles.brand}>
          <Package aria-hidden size={22} />
          <span>{t("meta.siteName")}</span>
        </Link>
        <nav aria-label={t("nav.mainMenu")} className={styles.nav}>
          <Link href={`${base}/catalog`}>{t("nav.catalog")}</Link>
          <Link href={`${base}/design`}>{t("nav.design")}</Link>
          <Link href={`${base}/vendors`}>{t("nav.vendors")}</Link>
          {user && <Link href={`${base}/orders`}>{t("nav.orders")}</Link>}
          {user?.role === "VENDOR" && <Link href={`${base}/vendor`}>{t("nav.vendorPortal")}</Link>}
          {user?.role === "ADMIN" && <Link href={`${base}/admin`}>{t("nav.admin")}</Link>}
        </nav>
        <div className={styles.actions}>
          <LanguageSwitcher />
          {user ? (
            <Link href={`${base}/orders`} className={styles.iconLink} aria-label={t("nav.account")}>
              <UserRound aria-hidden size={20} />
            </Link>
          ) : (
            <Link href={`${base}/login`} className={styles.signIn}>
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
