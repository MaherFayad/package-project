import Link from "next/link";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { AccountLink } from "./AccountLink";
import { HeaderNav, type NavSlots } from "./HeaderNav";
import { startHref } from "./navModel";
import { LangLink } from "./LangLink";
import { Wordmark } from "./Wordmark";
import styles from "./kit/chrome.module.css";

export { startHref };

/**
 * Marketing header (shopify.com 2026 language): wordmark, Products and Why Elba mega-menus,
 * Pricing and Box styles links; language, Log in and a white "Get your box price" pill at the end.
 * The pill has one label and one destination (the /boxes chooser) for visitors and signed-in
 * people alike (R1-19). Transparent over a <Sheet hero> and solid once the page scrolls (see
 * HeaderNav). It reads no cookies: the signed-in parts are client islands, so every page under
 * the shell prerenders.
 */
export function MarketingHeader({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const base = `/${locale}`;
  const start = startHref(locale);
  const startLabel = t("mk.nav.start");
  const login = { href: `${base}/login`, label: t("mk.nav.login") };
  const account = { href: `${base}/account`, label: t("mk.nav.account") };
  const signOut = t("nav.signOut");
  const roleLinks = {
    orders: { href: `${base}/orders`, label: t("nav.orders") },
    vendor: { href: `${base}/vendor`, label: t("nav.vendorPortal") },
    admin: { href: `${base}/admin`, label: t("nav.admin") },
  };

  const slots: NavSlots = {
    brand: <Wordmark locale={locale} />,
    mobileActions: (
      <Link href={start} className={`${styles.textLink} ${styles.ctaMobile} ${styles.mobileOnly}`}>
        {startLabel}
      </Link>
    ),
    sheetActions: (
      <>
        <Link href={start} className={styles.ctaPill}>
          {startLabel}
        </Link>
        <AccountLink variant="sheet" login={login} account={account} signOutLabel={signOut} home={base} className={styles.outlinePill} />
        <LangLink className={`${styles.textLink} ${styles.mobileLang}`} />
      </>
    ),
  };

  return (
    <HeaderNav slots={slots}>
      <LangLink className={`${styles.textLink} ${styles.desktopOnly}`} />
      <span className={styles.desktopOnly}>
        <AccountLink login={login} account={account} signOutLabel={signOut} home={base} className={styles.textLink} roleLinks={roleLinks} />
      </span>
      <Link href={start} className={`${styles.ctaPill} ${styles.desktopOnly}`}>
        {startLabel}
      </Link>
    </HeaderNav>
  );
}
