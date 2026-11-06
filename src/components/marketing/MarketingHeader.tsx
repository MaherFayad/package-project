import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { designHref } from "@/components/store/catalog";
import { HeaderNav, type NavModel } from "./HeaderNav";
import { LangLink } from "./LangLink";
import { Wordmark } from "./Wordmark";
import styles from "./marketing.module.css";

/** White marketing header: wordmark, Products / Printers menus, Pricing, How it works, Log in + black pill. */
export async function MarketingHeader({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const user = (await getSession())?.user;
  const base = `/${locale}`;
  const start = designHref(locale, { structure: "FEFCO_0427" });
  const account = user ? { href: `${base}/account`, label: t("marketing.nav.account") } : { href: `${base}/login`, label: t("marketing.nav.login") };
  const extra = user?.role === "VENDOR" ? { href: `${base}/vendor`, label: t("nav.vendorPortal") } : user?.role === "ADMIN" ? { href: `${base}/admin`, label: t("nav.admin") } : null;

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
      ...(user ? [{ href: `${base}/orders`, label: t("nav.orders") }] : []),
      ...(extra ? [extra] : []),
    ],
    sheetActions: (
      <>
        <Link href={start} className={`${styles.pill} ${styles.pillLarge}`}>
          {t("marketing.nav.start")}
        </Link>
        <Link href={account.href} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`}>
          {account.label}
        </Link>
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
      <Link href={account.href} className={`${styles.navLink} ${styles.loginLink}`}>
        {account.label}
      </Link>
      <Link href={start} className={`${styles.pill} ${styles.pillSmall} ${styles.headerCta}`}>
        {t("marketing.nav.start")}
      </Link>
    </HeaderNav>
  );
}
