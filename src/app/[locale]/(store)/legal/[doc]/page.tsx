import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDate } from "@/lib/format";
import { Banner, Breadcrumbs, Card, Layout, LayoutSection, Text } from "@/components/ui";
import { LEGAL_DOCS, LEGAL_DOC_IDS, LEGAL_UPDATED, isLegalDoc, paragraphs } from "@/components/store/legal";
import styles from "@/components/store/store.module.css";

type Props = { params: Promise<{ locale: string; doc: string }> };

export function generateStaticParams() {
  return LEGAL_DOC_IDS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const locale = toLocale(raw);
  const t = getT(locale);
  return {
    title: t(`legal.${doc}.title` as DictKey),
    description: t(`legal.${doc}.metaDescription` as DictKey),
    alternates: { canonical: `/${locale}/legal/${doc}`, languages: { ar: `/ar/legal/${doc}`, en: `/en/legal/${doc}` } },
  };
}

/**
 * Privacy policy, terms, returns policy for custom goods and cookie notice.
 * PLACEHOLDER DRAFTS: every page carries a "for lawyer review" banner until counsel signs off.
 */
export default async function LegalPage({ params }: Props) {
  const { locale: raw, doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const locale = toLocale(raw);
  const t = getT(locale);
  const title = t(`legal.${doc}.title` as DictKey);
  const sections = LEGAL_DOCS[doc];

  return (
    <div className={styles.page}>
      <div className={styles.stack}>
        <div className={styles.headerBlock}>
          <Breadcrumbs items={[{ content: t("nav.home"), url: `/${locale}` }, { content: title }]} />
          <h1 className={styles.pageTitle}>{title}</h1>
          <Text as="p" tone="subdued">
            {t("legal.updated", { date: formatDate(LEGAL_UPDATED, locale, "long") })}
          </Text>
        </div>
        <Banner tone="warning" title={t("legal.draftBanner")} />
        <Layout>
          <LayoutSection>
            <Card>
              <article className={styles.stack} data-testid="legal-body">
                <Text as="p" variant="bodyLg">
                  {t(`legal.${doc}.intro` as DictKey)}
                </Text>
                {sections.map((id) => (
                  <section key={id} id={id} className={styles.legalSection} aria-labelledby={`h-${id}`}>
                    <h2 id={`h-${id}`}>{t(`legal.${doc}.sections.${id}.title` as DictKey)}</h2>
                    {paragraphs(t(`legal.${doc}.sections.${id}.body` as DictKey)).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </section>
                ))}
              </article>
            </Card>
          </LayoutSection>
          <LayoutSection variant="oneThird" as="aside" aria-label={t("legal.contents")}>
            <div className={`${styles.stack} ${styles.sticky}`}>
              <Card title={t("legal.contents")}>
                <nav aria-label={t("legal.contents")}>
                  <ul className={styles.toc}>
                    {sections.map((id) => (
                      <li key={id}>
                        <a href={`#${id}`}>{t(`legal.${doc}.sections.${id}.title` as DictKey)}</a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </Card>
              <Card title={t("legal.otherDocs")}>
                <ul className={styles.toc}>
                  {LEGAL_DOC_IDS.filter((d) => d !== doc).map((d) => (
                    <li key={d}>
                      <Link href={`/${locale}/legal/${d}`}>{t(`legal.${d}.title` as DictKey)}</Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </LayoutSection>
        </Layout>
      </div>
    </div>
  );
}
