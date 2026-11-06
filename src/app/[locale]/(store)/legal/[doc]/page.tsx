import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDate } from "@/lib/format";
import { TriangleAlert } from "lucide-react";
import { LEGAL_DOCS, LEGAL_DOC_IDS, LEGAL_UPDATED, isLegalDoc, paragraphs } from "@/components/store/legal";
import mk from "@/components/marketing/marketing.module.css";

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
    <>
      <section className={`${mk.centerHero} ${mk.bandMint}`} style={{ paddingBlockEnd: "clamp(40px, 5vw, 72px)" }} aria-labelledby="legal-title">
        <div className={`${mk.container} ${mk.narrow}`}>
          <span className={`${mk.eyebrow} m-enter`}>{t("marketing.legal.eyebrow")}</span>
          <h1 id="legal-title" className={`${mk.h1} m-enter`} style={{ ["--m-i" as string]: 1 }}>
            {title}
          </h1>
          <p className={`${mk.lead} m-enter`} style={{ ["--m-i" as string]: 2 }}>
            {t("legal.updated", { date: formatDate(LEGAL_UPDATED, locale, "long") })}
          </p>
          <p className="m-enter" style={{ ["--m-i" as string]: 3, marginBlockStart: 16 }}>
            <span className={mk.draft} role="note">
              <TriangleAlert size={16} aria-hidden />
              {t("legal.draftBanner")}
            </span>
          </p>
        </div>
      </section>
      <section className={mk.band} style={{ paddingBlockStart: 56 }}>
        <div className={`${mk.container} ${mk.legalGrid}`}>
          <aside className={mk.legalToc} aria-label={t("legal.contents")}>
            <nav aria-labelledby="toc-title">
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
          </aside>
          <article className={mk.prose} data-testid="legal-body">
            <p style={{ fontSize: "1.1875rem", color: "var(--mk-ink)" }}>{t(`legal.${doc}.intro` as DictKey)}</p>
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
      </section>
    </>
  );
}
