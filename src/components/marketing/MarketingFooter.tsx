import Link from "next/link";
import { Suspense } from "react";
import { Globe } from "lucide-react";
import { getT } from "@/i18n";
import type { Locale } from "@/types";
import { LangLink } from "./LangLink";
import { Wordmark } from "./Wordmark";
import { SOCIAL } from "./social";
import styles from "./marketing.module.css";

/** Black marketing footer: brand, four link columns, region + language, legal links, social. */
export function MarketingFooter({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const base = `/${locale}`;
  const cols: { id: string; title: string; links: { href: string; label: string }[] }[] = [
    {
      id: "products",
      title: t("marketing.footer.products"),
      links: [
        { href: `${base}/boxes`, label: t("marketing.footer.boxes") },
        { href: `${base}/bottles`, label: t("marketing.footer.bottles") },
        { href: `${base}/design`, label: t("marketing.footer.designer") },
        { href: `${base}/catalog`, label: t("marketing.footer.styles") },
      ],
    },
    {
      id: "company",
      title: t("marketing.footer.company"),
      links: [
        { href: `${base}/vendors`, label: t("marketing.footer.printers") },
        { href: `${base}/vendor/apply`, label: t("marketing.footer.becomePrinter") },
        { href: `${base}#how`, label: t("marketing.footer.how") },
        { href: `${base}/catalog`, label: t("marketing.footer.pricing") },
      ],
    },
    {
      id: "support",
      title: t("marketing.footer.support"),
      links: [
        { href: `${base}#faq`, label: t("marketing.footer.faq") },
        { href: `${base}/orders`, label: t("marketing.footer.orders") },
        { href: `${base}/account`, label: t("marketing.footer.account") },
      ],
    },
    {
      id: "legal",
      title: t("marketing.footer.legal"),
      links: [
        { href: `${base}/legal/privacy`, label: t("store.footer.privacy") },
        { href: `${base}/legal/terms`, label: t("store.footer.terms") },
        { href: `${base}/legal/returns`, label: t("store.footer.returns") },
        { href: `${base}/legal/cookies`, label: t("store.footer.cookies") },
      ],
    },
  ];
  return (
    <footer className={styles.footer} aria-label={t("marketing.footer.label")}>
      <div className={styles.container}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <Link href={base} className={styles.brand} aria-label={`${t("meta.siteName")}, ${t("nav.home")}`}>
              <Wordmark locale={locale} />
            </Link>
            <p>{t("store.footer.about")}</p>
          </div>
          <div className={styles.footerCols}>
            {cols.map((c) => (
              <nav key={c.id} aria-labelledby={`ft-${c.id}`}>
                <h2 id={`ft-${c.id}`} className={styles.footerHeading}>
                  {c.title}
                </h2>
                <ul className={styles.footerList}>
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span className={styles.footerRegion}>
            <Globe size={16} aria-hidden />
            {t("marketing.footer.region")}
          </span>
          <Suspense fallback={null}>
            <LangLink showIcon={false} />
          </Suspense>
          <ul className={styles.footerLegal}>
            <li>
              <Link href={`${base}/legal/terms`}>{t("store.footer.terms")}</Link>
            </li>
            <li>
              <Link href={`${base}/legal/privacy`}>{t("store.footer.privacy")}</Link>
            </li>
            <li>
              <Link href={`${base}/legal/cookies`}>{t("store.footer.cookies")}</Link>
            </li>
          </ul>
          <ul className={styles.social}>
            {SOCIAL.map((s) => (
              <li key={s.id}>
                <a href={s.href} rel="noopener noreferrer" target="_blank" aria-label={t("marketing.footer.social", { network: s.name })}>
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
          <p className={styles.footerNote}>
            © <bdi>{new Date().getFullYear()}</bdi> {t("meta.siteName")}. {t("store.footer.rights")} · {t("marketing.footer.payments")} · {t("common.vatNote")}
          </p>
        </div>
      </div>
    </footer>
  );
}
