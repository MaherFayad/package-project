import Link from "next/link";
import { Suspense } from "react";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { designHref } from "@/components/store/catalog";
import { AccountLink } from "./AccountLink";
import { HeaderNav, type NavModel } from "./HeaderNav";
import { LangLink } from "./LangLink";
import { Wordmark } from "./Wordmark";
import styles from "./marketing.module.css";

/**
 * White marketing header: wordmark, Products / Printers menus, Pricing, How it works, Log in +
 * black pill. It reads no cookies: the signed-in parts (account link, orders, portal links) are
 * client islands, so every page under the marketing layout can be prerendered.
 */
export function MarketingHeader({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const base = `/${locale}`;
  const start = designHref(locale, { structure: "FEFCO_0427" });
  const login = { href: `${base}/login`, label: t("marketing.nav.login") };
  const account = { href: `${base}/account`, label: t("marketing.nav.account") };

  const model: NavModel = {
    label: t("marketing.nav.label"),
    homeHref: base,
    brand: <Wordmark locale={locale} />,
    brandLabel: `${t("meta.siteName")}, ${t("nav.home")}`,
    menuLabel: t("marketing.nav.menu"),
    closeLabel: t("marketing.nav.close"),
    products: {
      label: t("marketing.nav.products"),
      items: [
        { href: `${base}/boxes`, title: t("marketing.nav.productsMenu.boxes"), body: t("marketing.nav.productsMenu.boxesBody"), icon: "boxes" },
        { href: `${base}/boxes#FOLDING_CARTON`, title: t("marketing.nav.productsMenu.cartons"), body: t("marketing.nav.productsMenu.cartonsBody"), icon: "cartons" },
        { href: `${base}/bottles`, title: t("marketing.nav.productsMenu.bottles"), body: t("marketing.nav.productsMenu.bottlesBody"), icon: "bottles" },
        { href: `${base}/design`, title: t("marketing.nav.productsMenu.designer"), body: t("marketing.nav.productsMenu.designerBody"), icon: "designer" },
      ],
    },
    printers: {
      label: t("marketing.nav.printers"),
      items: [
        { href: `${base}/vendors`, title: t("marketing.nav.printersMenu.directory"), body: t("marketing.nav.printersMenu.directoryBody"), icon: "directory" },
        { href: `${base}/vendor/apply`, title: t("marketing.nav.printersMenu.join"), body: t("marketing.nav.printersMenu.joinBody"), icon: "join" },
      ],
    },
    links: [
      { href: `${base}/catalog`, label: t("marketing.nav.pricing") },
      { href: `${base}#how`, label: t("marketing.nav.how") },
    ],
    signedInLinks: {
      orders: { href: `${base}/orders`, label: t("nav.orders") },
      vendor: { href: `${base}/vendor`, label: t("nav.vendorPortal") },
      admin: { href: `${base}/admin`, label: t("nav.admin") },
    },
    sheetActions: (
      <>
        <Link href={start} className={`${styles.pill} ${styles.pillLarge}`}>
          {t("marketing.nav.start")}
        </Link>
        <AccountLink login={login} account={account} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`} />
        <Suspense fallback={null}>
          <LangLink className={styles.langLink} />
        </Suspense>
      </>
    ),
  };

  return (
    <HeaderNav model={model}>
      <Suspense fallback={null}>
        <LangLink className={`${styles.langLink} ${styles.langDesktop}`} />
      </Suspense>
      <AccountLink login={login} account={account} className={`${styles.navLink} ${styles.loginLink}`} />
      <Link href={start} className={`${styles.pill} ${styles.pillSmall} ${styles.headerCta}`}>
        {t("marketing.nav.start")}
      </Link>
    </HeaderNav>
  );
}
