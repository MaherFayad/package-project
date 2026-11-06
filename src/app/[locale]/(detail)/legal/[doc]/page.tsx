import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDate } from "@/lib/format";
import { TriangleAlert } from "lucide-react";
import { LEGAL_DOCS, LEGAL_DOC_IDS, LEGAL_UPDATED, isLegalDoc, paragraphs } from "@/components/store/legal";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { TocSpy } from "@/components/marketing/restyle/TocSpy";
import rs from "@/components/marketing/restyle/restyle.module.css";
import lg from "@/components/marketing/restyle/legal.module.css";

type Props = { params: Promise<{ locale: string; doc: string }> };

/** Unknown slugs 404 in the segment layout, above the hydration boundary (R4-MK-09, R8-01). */
export const dynamicParams = true;

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
    alternates: {
      canonical: `/${locale}/legal/${doc}`,
      languages: { ar: `/ar/legal/${doc}`, en: `/en/legal/${doc}` },
    },
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
    <div className={rs.page}>
      <Sheet tone="dark" hero container="narrow" className={`${rs.heroCompact} ${rs.heroCenter}`} aria-labelledby="legal-title">
        <Eyebrow className="m-enter">{t("legal.updated", { date: formatDate(LEGAL_UPDATED, locale, "long") })}</Eyebrow>
        <HeroTitle size="64" align="center" id="legal-title" text={title} />
        <Lead align="center" className="m-enter-lcp">
          {t(`legal.${doc}.metaDescription` as DictKey)}
        </Lead>
        <span className={`${lg.draft} m-enter`} role="note">
          <TriangleAlert size={16} aria-hidden />
          {t("legal.draftBanner")}
        </span>
      </Sheet>
      <Sheet tone="white" className={rs.sheetTop}>
        <div className={lg.legalGrid}>
          <aside className={lg.toc} aria-label={t("legal.contents")}>
            <nav aria-labelledby="toc-title" id="legal-toc">
              <h2 id="toc-title">{t("legal.contents")}</h2>
              <ul>
                {sections.map((id) => (
                  <li key={id}>
                    <a href={`#${id}`}>{t(`legal.${doc}.sections.${id}.title` as DictKey)}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-labelledby="other-title">
              <h2 id="other-title">{t("legal.otherDocs")}</h2>
              <ul>
                {LEGAL_DOC_IDS.map((d) => (
                  <li key={d}>
                    <Link href={`/${locale}/legal/${d}`} aria-current={d === doc ? "page" : undefined}>
                      {t(`legal.${d}.title` as DictKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <TocSpy navId="legal-toc" />
          </aside>
          <article className={lg.prose} data-testid="legal-body">
            <p>{t(`legal.${doc}.intro` as DictKey)}</p>
            {sections.map((id) => (
              <section key={id} id={id} aria-labelledby={`h-${id}`}>
                <h2 id={`h-${id}`}>{t(`legal.${doc}.sections.${id}.title` as DictKey)}</h2>
                {paragraphs(t(`legal.${doc}.sections.${id}.body` as DictKey)).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </section>
            ))}
          </article>
        </div>
      </Sheet>
    </div>
  );
}
