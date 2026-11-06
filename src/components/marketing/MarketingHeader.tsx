import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { designHref } from "@/components/store/catalog";
import { AccountLink } from "./AccountLink";
import { HeaderNav, type NavModel } from "./HeaderNav";
import { LangLink } from "./LangLink";
import { StartLink } from "./StartLink";
import { Wordmark } from "./Wordmark";
import { renderSrc } from "./assets";
import styles from "./kit/chrome.module.css";

/**
 * Where every visitor "Start free" CTA points: the /start landing (R6), whose own CTAs open the
 * designer. Signed-in people's "New design" opens the designer directly (newDesignHref).
 */
export function startHref(locale: Locale): string {
  return `/${locale}/start`;
}
export function newDesignHref(locale: Locale): string {
  return designHref(locale, { structure: "FEFCO_0427" });
}

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
  const i = (k: Parameters<typeof t>[0]) => t(k);

  const model: NavModel = {
    label: t("mk.nav.label"),
    homeHref: base,
    brand: <Wordmark locale={locale} />,
    brandLabel: `${t("meta.siteName")}, ${t("nav.home")}`,
    menuLabel: t("mk.nav.menu"),
    closeLabel: t("mk.nav.close"),
    backLabel: t("mk.nav.back"),
    menus: [
      {
        id: "products",
        label: t("mk.nav.products"),
        groups: [
          {
            title: t("mk.nav.groups.packaging"),
            links: [
              { href: `${base}/boxes`, label: i("mk.nav.items.boxes"), icon: "boxes" },
              { href: `${base}/boxes#FOLDING_CARTON`, label: i("mk.nav.items.cartons"), icon: "cartons" },
              { href: `${base}/bottles`, label: i("mk.nav.items.bottles"), icon: "bottles" },
              { href: `${base}/catalog`, label: i("mk.nav.items.styles"), icon: "styles" },
            ],
          },
          {
            title: t("mk.nav.groups.design"),
            links: [
              { href: `${base}/designer`, label: i("mk.nav.items.designer"), icon: "designer" },
              { href: `${base}/design`, label: i("mk.nav.items.newDesign"), icon: "newDesign" },
              { href: `${base}/designer#finishes`, label: i("mk.nav.items.finishes"), icon: "finishes" },
            ],
          },
          {
            title: t("mk.nav.groups.order"),
            links: [
              { href: `${base}/pricing`, label: i("mk.nav.items.pricing"), icon: "pricing" },
              { href: `${base}/vendors`, label: i("mk.nav.items.directory"), icon: "directory" },
              { href: `${base}/orders`, label: i("mk.nav.items.track"), icon: "track" },
            ],
          },
        ],
        featured: {
          eyebrow: t("mk.nav.featured.eyebrow"),
          title: t("mk.nav.featured.title"),
          body: t("mk.nav.featured.body"),
          href: start,
          image: renderSrc("FEFCO_0427"),
          latestTitle: t("mk.nav.featured.latest"),
          latest: [t("mk.nav.featured.latest1"), t("mk.nav.featured.latest2"), t("mk.nav.featured.latest3")],
        },
        foot: [
          { href: `${base}/vendor/apply`, label: t("mk.nav.foot.printers"), body: t("mk.nav.foot.printersBody") },
          { href: `${base}/why-elba#faq`, label: t("mk.nav.foot.help"), body: t("mk.nav.foot.helpBody") },
        ],
      },
      {
        id: "why",
        label: t("mk.nav.why"),
        groups: [
          {
            title: t("mk.nav.groups.business"),
            links: [
              { href: `${base}/why-elba#cafes`, label: i("mk.nav.items.cafes"), icon: "cafes" },
              { href: `${base}/why-elba#beauty`, label: i("mk.nav.items.beauty"), icon: "beauty" },
              { href: `${base}/why-elba#ecommerce`, label: i("mk.nav.items.ecommerce"), icon: "ecommerce" },
              { href: `${base}/why-elba`, label: i("mk.nav.items.whyElba"), icon: "how" },
            ],
          },
          {
            title: t("mk.nav.groups.printers"),
            links: [
              { href: `${base}/vendors`, label: i("mk.nav.items.directory"), icon: "directory" },
              { href: `${base}/vendor/apply`, label: i("mk.nav.items.join"), icon: "join" },
              { href: `${base}/start`, label: i("mk.nav.items.how"), icon: "how" },
            ],
          },
        ],
      },
    ],
    links: [
      { href: `${base}/pricing`, label: t("mk.nav.pricing") },
      { href: `${base}/catalog`, label: t("mk.nav.catalogue") },
    ],
    signedInLinks: {
      orders: { href: `${base}/orders`, label: t("nav.orders") },
      vendor: { href: `${base}/vendor`, label: t("nav.vendorPortal") },
      admin: { href: `${base}/admin`, label: t("nav.admin") },
    },
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
    <HeaderNav model={model}>
      <LangLink className={`${styles.textLink} ${styles.desktopOnly}`} />
      <span className={styles.desktopOnly}>
        <AccountLink login={login} account={account} signOutLabel={signOut} home={base} className={styles.textLink} />
      </span>
      <StartLink href={start} signedInHref={newDesign} label={t("mk.nav.start")} signedInLabel={t("marketing.nav.newDesign")} className={`${styles.ctaPill} ${styles.desktopOnly}`} />
    </HeaderNav>
  );
}
