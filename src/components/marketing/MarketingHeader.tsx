import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { AccountLink } from "./AccountLink";
import { HeaderNav, type NavSlots } from "./HeaderNav";
import { newDesignHref, startHref } from "./navModel";
import { LangLink } from "./LangLink";
import { StartLink } from "./StartLink";
import { Wordmark } from "./Wordmark";
import styles from "./kit/chrome.module.css";

export { startHref };

/**
 * Marketing header (shopify.com 2026 language): wordmark, Products and Why Elba mega-menus,
 * Pricing and Box styles links; language, Log in and a white "Start free" pill at the end.
 * Transparent over a <Sheet hero> and solid once the page scrolls (see HeaderNav). It reads no
 * cookies: the signed-in parts are client islands, so every page under the shell prerenders.
 */
export function MarketingHeader({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const base = `/${locale}`;
  const start = startHref(locale);
  const newDesign = newDesignHref(locale);
  const login = { href: `${base}/login`, label: t("mk.nav.login") };
  const account = { href: `${base}/account`, label: t("marketing.nav.account") };
  const signOut = t("nav.signOut");

  const slots: NavSlots = {
    brand: <Wordmark locale={locale} />,
    mobileActions: <StartLink href={start} signedInHref={newDesign} label={t("mk.nav.start")} signedInLabel={t("marketing.nav.newDesign")} className={`${styles.textLink} ${styles.ctaMobile} ${styles.mobileOnly}`} />,
    sheetActions: (
      <>
        <StartLink href={start} signedInHref={newDesign} label={t("mk.nav.start")} signedInLabel={t("marketing.nav.newDesign")} className={styles.ctaPill} />
        <AccountLink variant="sheet" login={login} account={account} signOutLabel={signOut} home={base} className={styles.outlinePill} />
        <LangLink className={`${styles.textLink} ${styles.mobileLang}`} />
      </>
    ),
  };

  return (
    <HeaderNav slots={slots}>
      <LangLink className={`${styles.textLink} ${styles.desktopOnly}`} />
      <span className={styles.desktopOnly}>
        <AccountLink login={login} account={account} signOutLabel={signOut} home={base} className={styles.textLink} />
      </span>
      <StartLink href={start} signedInHref={newDesign} label={t("mk.nav.start")} signedInLabel={t("marketing.nav.newDesign")} className={`${styles.ctaPill} ${styles.desktopOnly}`} />
    </HeaderNav>
  );
}
