import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { ElbaWordmark } from "@/components/ui";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavLinks } from "./NavLinks";
import styles from "./SiteChrome.module.css";

/**
 * Store top bar (owner: storefront). Near-black bar like the admin frame, with our own
 * wordmark, the main links, language switch and sign-in / account. Used by (store),
 * (checkout), orders and (auth) layouts through StoreShell.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const session = await getSession();
  const user = session?.user;
  const base = `/${locale}`;
  const links = [
    { href: `${base}/catalog`, label: t("nav.catalog"), match: [`${base}/catalog`, `${base}/boxes`] },
    { href: `${base}/design`, label: t("nav.design"), match: [`${base}/design`] },
    { href: `${base}/vendors`, label: t("nav.vendors"), match: [`${base}/vendors`] },
  ];
  if (user) links.push({ href: `${base}/orders`, label: t("nav.orders"), match: [`${base}/orders`] });
  if (user?.role === "VENDOR") links.push({ href: `${base}/vendor`, label: t("nav.vendorPortal"), match: [`${base}/vendor`] });
  if (user?.role === "ADMIN") links.push({ href: `${base}/admin`, label: t("nav.admin"), match: [`${base}/admin`] });

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href={base} className={styles.brand} aria-label={`${t("meta.siteName")}, ${t("nav.home")}`}>
          <ElbaWordmark tone="inverse" />
        </Link>
        <nav aria-label={t("nav.mainMenu")} className={styles.nav}>
          <NavLinks links={links} />
        </nav>
        <div className={styles.actions}>
          <LanguageSwitcher />
          {user ? (
            <Link href={`${base}/account`} className={styles.accountLink}>
              <span className={styles.avatar} aria-hidden="true">
                {(user.name ?? user.phone).trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className={styles.accountLabel}>{t("store.header.account")}</span>
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
