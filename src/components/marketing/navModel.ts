import type { Locale } from "@/types";
import type { TFunction } from "@/i18n/types";
import { renderSrc } from "./assets";
import type { MegaMenu } from "./HeaderNav";

/**
 * Where every "Get your box price" CTA points, for visitors and signed-in people alike: the short
 * box chooser /boxes (box types grouped by use, each with its price at 500 boxes and an "Order
 * this box" button that opens the designer, where the price for the exact box shows). One label,
 * one destination across the site (R1-04, R1-19). /start stays as a secondary page.
 */
export function startHref(locale: Locale): string {
  return `/${locale}/boxes`;
}

/**
 * Header menus and links, built from the dictionary. Pure: HeaderNav builds it on the client from
 * the dictionary the page already ships, so the nav is not serialised a second time as props
 * (about 10 KB of HTML on every marketing page).
 */
export function buildNav(locale: Locale, t: TFunction) {
  const base = `/${locale}`;
  const start = startHref(locale);
  const menus: MegaMenu[] = [
    {
      id: "products",
      label: t("mk.nav.products"),
      groups: [
        {
          title: t("mk.nav.groups.packaging"),
          links: [
            { href: `${base}/boxes`, label: t("mk.nav.items.boxes"), icon: "boxes" },
            { href: `${base}/boxes#shelf`, label: t("mk.nav.items.cartons"), icon: "cartons" },
            { href: `${base}/bottles`, label: t("mk.nav.items.bottles"), icon: "bottles" },
            { href: `${base}/catalog`, label: t("mk.nav.items.styles"), icon: "styles" },
          ],
        },
        // Printing first (docs/audit/simplicity-2026-11/printing-first.md): ordering before the designer.
        {
          title: t("mk.nav.groups.order"),
          links: [
            { href: `${base}/pricing`, label: t("mk.nav.items.pricing"), icon: "pricing" },
            { href: `${base}/vendors`, label: t("mk.nav.items.directory"), icon: "directory" },
            { href: `${base}/orders`, label: t("mk.nav.items.track"), icon: "track" },
          ],
        },
        {
          title: t("mk.nav.groups.design"),
          links: [
            { href: `${base}/designer`, label: t("mk.nav.items.designer"), icon: "designer" },
            { href: start, label: t("mk.nav.items.newDesign"), icon: "newDesign" },
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
            { href: `${base}/why-elba#cafes`, label: t("mk.nav.items.cafes"), icon: "cafes" },
            { href: `${base}/why-elba#beauty`, label: t("mk.nav.items.beauty"), icon: "beauty" },
            { href: `${base}/why-elba#ecommerce`, label: t("mk.nav.items.ecommerce"), icon: "ecommerce" },
            { href: `${base}/why-elba`, label: t("mk.nav.items.whyElba"), icon: "how" },
          ],
        },
        {
          title: t("mk.nav.groups.printers"),
          links: [
            { href: `${base}/vendors`, label: t("mk.nav.items.directory"), icon: "directory" },
            { href: `${base}/vendor/apply`, label: t("mk.nav.items.join"), icon: "join" },
            { href: `${base}/start`, label: t("mk.nav.items.how"), icon: "how" },
          ],
        },
      ],
    },
  ];
  return {
    label: t("mk.nav.label"),
    homeHref: base,
    brandLabel: `${t("meta.siteName")}, ${t("nav.home")}`,
    menuLabel: t("mk.nav.menu"),
    closeLabel: t("mk.nav.close"),
    backLabel: t("mk.nav.back"),
    menus,
    links: [
      { href: `${base}/pricing`, label: t("mk.nav.pricing") },
      // The full catalogue stays in the products menu and the footer, not the top bar (R2-13).
    ],
    signedInLinks: {
      orders: { href: `${base}/orders`, label: t("nav.orders") },
      vendor: { href: `${base}/vendor`, label: t("nav.vendorPortal") },
      admin: { href: `${base}/admin`, label: t("nav.admin") },
    },
  };
}
