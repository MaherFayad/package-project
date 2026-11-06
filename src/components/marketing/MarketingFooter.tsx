import Link from "next/link";
import { Globe } from "lucide-react";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { LangLink } from "./LangLink";
import { Wordmark } from "./Wordmark";
import { SOCIAL } from "./social";
import styles from "./kit/chrome.module.css";

/**
 * Black marketing footer (shopify.com 2026 language): brand line, four link columns, region and
 * language row, social icons, legal row. Server component.
 */
export function MarketingFooter({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const base = `/${locale}`;
  const cols: { id: string; title: string; links: { href: string; label: string }[] }[] = [
    {
      id: "products",
      title: t("mk.footer.colProducts"),
      links: [
        { href: `${base}/boxes`, label: t("marketing.footer.boxes") },
        { href: `${base}/bottles`, label: t("marketing.footer.bottles") },
        { href: `${base}/designer`, label: t("marketing.footer.designer") },
        { href: `${base}/catalog`, label: t("marketing.footer.styles") },
      ],
    },
    {
      id: "company",
      title: t("mk.footer.colCompany"),
      links: [
        { href: `${base}/why-elba`, label: t("mk.nav.items.whyElba") },
        { href: `${base}/start`, label: t("marketing.footer.how") },
        { href: `${base}/pricing`, label: t("marketing.footer.pricing") },
      ],
    },
    {
      id: "printers",
      title: t("mk.footer.colPrinters"),
      links: [
        { href: `${base}/vendors`, label: t("mk.nav.items.directory") },
        { href: `${base}/vendor/apply`, label: t("marketing.footer.becomePrinter") },
      ],
    },
    {
      id: "support",
      title: t("mk.footer.colSupport"),
      links: [
        { href: `${base}/why-elba#faq`, label: t("marketing.footer.faq") },
        { href: `${base}/orders`, label: t("marketing.footer.orders") },
        { href: `${base}/account`, label: t("marketing.footer.account") },
        { href: `${base}/legal/returns`, label: t("store.footer.returns") },
      ],
    },
  ];
  return (
    <footer className={styles.footer} aria-label={t("mk.footer.label")}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <Link href={base} className={styles.brand} aria-label={`${t("meta.siteName")}, ${t("nav.home")}`}>
              <Wordmark locale={locale} />
            </Link>
            <p>{t("mk.footer.brandLine")}</p>
          </div>
          <div className={styles.footerCols}>
            {cols.map((c) => (
              <nav key={c.id} aria-labelledby={`ft-${c.id}`}>
                <h2 id={`ft-${c.id}`} className={styles.footerHeading}>
                  {c.title}
                </h2>
                <ul className={styles.footerList}>
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className={styles.footerMid}>
          <div className={styles.footerRegion} role="group" aria-label={t("mk.footer.regionTitle")}>
            <span>
              <Globe size={18} strokeWidth={1.5} aria-hidden />
              {t("mk.footer.region")}
            </span>
            <LangLink className={styles.langLink} showIcon={false} />
          </div>
          <ul className={styles.social} aria-label={t("mk.footer.socialTitle")}>
            {SOCIAL.map((s) => (
              <li key={s.id}>
                <a href={s.href} rel="noopener noreferrer" target="_blank" aria-label={t("marketing.footer.social", { network: s.name })}>
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.footerBottom}>
          <ul className={styles.footerLegal}>
            <li>
              <Link href={`${base}/legal/terms`}>{t("store.footer.terms")}</Link>
            </li>
            <li>
              <Link href={`${base}/legal/privacy`}>{t("store.footer.privacy")}</Link>
            </li>
            <li>
              <Link href={`${base}/legal/returns`}>{t("store.footer.returns")}</Link>
            </li>
            <li>
              <Link href={`${base}/legal/cookies`}>{t("store.footer.cookies")}</Link>
            </li>
          </ul>
          <p className={styles.footerNote}>
            © <bdi>{new Date().getFullYear()}</bdi> {t("meta.siteName")}. {t("store.footer.rights")} · {t("marketing.footer.payments")} · {t("common.vatNote")}
          </p>
        </div>
      </div>
    </footer>
  );
}
