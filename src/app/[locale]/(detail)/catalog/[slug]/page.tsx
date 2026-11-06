import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Locale } from "@/types";
import { toLocale } from "@/i18n";
import { getSession } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { CATALOGUE, catalogueEntryFromParam, familyName, subFamilyName, type AxisKey, type CatalogueEntry } from "@/data/catalogue";
import { COPY, fill } from "@/components/catalogue/copy";
import { ORDER_MODE_COPY } from "@/data/catalogue/order-mode";
import { DetailStage } from "@/components/catalogue/DetailStage";
import { QuoteRequestForm } from "@/components/catalogue/QuoteRequestForm";
import { ModelCard } from "@/components/catalogue/CatalogueBrowser";
import { getCatalogueData } from "@/components/catalogue/server";
import { STRUCTURE_LIST } from "@/lib/dieline";
import rs from "@/components/marketing/restyle/restyle.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Display, Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { Pill } from "@/components/marketing/kit/Pill";
import styles from "@/components/catalogue/catalogue.module.css";

type Props = { params: Promise<{ locale: string; slug: string }> };

const CORE_SLUGS = new Set(STRUCTURE_LIST.map((s) => s.slug));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = toLocale(l);
  const e = catalogueEntryFromParam(slug);
  if (!e) return {};
  return {
    title: `${e.name[locale]}${e.standard.code ? ` (${e.standard.system} ${e.standard.code})` : ""}`,
    description: e.description[locale],
    alternates: { canonical: `/${locale}/catalog/${e.slug}`, languages: { ar: `/ar/catalog/${e.slug}`, en: `/en/catalog/${e.slug}` } },
  };
}

function sizeText(locale: Locale, axes: AxisKey[], dims: Partial<Record<AxisKey, number>>, capacityMl?: number): string {
  const parts = axes.filter((a) => typeof dims[a] === "number").map((a) => `${COPY.axes[a][locale]} ${formatNumber(dims[a]!)}`);
  const s = `${parts.join(" × ")} ${COPY.mm[locale]}`;
  return capacityMl ? `${s} · ${formatNumber(capacityMl)} ${COPY.ml[locale]}` : s;
}

/** Catalogue model page: live 3D, standard, Egyptian availability, sizes and the commerce path. */
export default async function Page({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = toLocale(l);
  const e = catalogueEntryFromParam(slug);
  if (!e) {
    // Old structure URLs (/catalog/<structure>) moved to /boxes/<structure>.
    if (CORE_SLUGS.has(slug)) permanentRedirect(`/${locale}/boxes/${encodeURIComponent(slug)}`);
    notFound();
  }
  const [data, session] = await Promise.all([getCatalogueData(), getSession()]);
  const mode = data.modes.get(e.code) ?? { mode: "quote", reason: "NO_VENDOR" as const };
  const fam = familyName(e.family);
  const sub = subFamilyName(e.subFamily);
  const related = CATALOGUE.filter((x: CatalogueEntry) => x.subFamily === e.subFamily && x.code !== e.code).slice(0, 4);
  const cards = new Map(data.cards.map((c) => [c.code, c]));
  const presets = e.presets.map((p) => ({ ...p, label: `${p.name[locale]} · ${sizeText(locale, e.axes, p.dims, p.capacityMl)}` }));

  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={`${rs.heroCompact} ${rs.glow}`} aria-labelledby="model-title">
        <nav aria-label={COPY.back[locale]} className={`${rs.crumbs} m-enter`}>
          <ol>
            <li>
              <Link href={`/${locale}/catalog`}>{COPY.back[locale]}</Link>
            </li>
            <li>
              <Link href={`/${locale}/catalog?family=${e.family}&scope=world`}>{fam[locale]}</Link>
            </li>
            {e.subFamily.includes("/") ? (
              <li>
                <Link href={`/${locale}/catalog?family=${e.family}&sub=${encodeURIComponent(e.subFamily)}&scope=world`}>{sub[locale]}</Link>
              </li>
            ) : null}
          </ol>
        </nav>
        {e.standard.label ? (
          <Eyebrow className="m-enter">
            <bdi dir="ltr">{e.standard.code ? `${e.standard.system} ${e.standard.code}` : e.standard.label}</bdi>
          </Eyebrow>
        ) : null}
        <Display as="h1" size="64" id="model-title" className="m-enter-lcp">
          {e.name[locale]}
        </Display>
        <Lead className="m-enter-lcp">{e.description[locale]}</Lead>
        {e.source === "fefco-09" ? (
          <p className={rs.small} style={{ marginBlockStart: 12 }}>
            {COPY.hostNote[locale]}
          </p>
        ) : null}
      </Sheet>
      <Sheet tone="white" className={rs.sheetTop}>
        <div className={styles.detail}>
          <DetailStage locale={locale} code={e.code} render={e.render} source={e.source} name={e.name[locale]} />
          <div className={styles.facts}>
            <div className={styles.priceCard} data-mode={mode.mode} data-testid="price-path">
              <p className={styles.priceTitle}>
                {mode.mode === "instant" ? (e.render === "vessel" ? COPY.instantLabelsTitle[locale] : COPY.instantTitle[locale]) : COPY.quoteTitle[locale]}
              </p>
              <p className={rs.muted} style={{ margin: 0 }}>
                {mode.mode === "instant"
                  ? fill(COPY.instantBody[locale], { count: formatNumber(mode.vendorIds.length) })
                  : mode.reason === "NO_VENDOR"
                    ? COPY.quoteBody[locale]
                    : ORDER_MODE_COPY[mode.reason][locale]}
              </p>
              {e.designer ? (
                <div className={styles.ctaRow}>
                  {/* One primary per card: with a quote path the request is primary, design is secondary (R4-10). */}
                  <Pill href={`/${locale}/design/${e.slug}`} variant={mode.mode === "instant" ? "dark" : "outline-dark"} size="lg" prefetch={false}>
                    {COPY.designCta[locale]}
                  </Pill>
                  {CORE_SLUGS.has(e.slug) ? (
                    <Pill href={`/${locale}/boxes/${e.slug}`} variant="outline-dark" size="lg">
                      {fill(COPY.sizesPrices[locale], { name: e.name[locale] })}
                    </Pill>
                  ) : null}
                </div>
              ) : null}
              {mode.mode === "quote" ? <QuoteRequestForm locale={locale} code={e.code} slug={e.slug} presets={presets} signedIn={!!session} /> : null}
            </div>

            <dl className={styles.factList}>
              <div className={styles.fact}>
                <dt>{COPY.family[locale]}</dt>
                <dd>
                  {fam[locale]}
                  {e.subFamily.includes("/") ? <span className={styles.factSub}>{sub[locale]}</span> : null}
                </dd>
              </div>
              <div className={styles.fact}>
                <dt>{COPY.standard[locale]}</dt>
                <dd dir="auto">{e.standard.label || COPY.noStandard[locale]}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{COPY.availability[locale]}</dt>
                <dd>
                  <span className={styles.badge} data-egypt={e.availableInEgypt}>
                    {COPY.egypt[e.availableInEgypt][locale]}
                  </span>
                  <span className={styles.factSub}>{COPY.egyptLong[e.availableInEgypt][locale]}</span>
                </dd>
              </div>
              <div className={styles.fact}>
                <dt>{COPY.regions[locale]}</dt>
                <dd>{e.regions.map((r) => COPY.regionNames[r][locale]).join(locale === "ar" ? "، " : ", ")}</dd>
              </div>
              <div className={styles.fact}>
                <dt>{COPY.defaultSize[locale]}</dt>
                <dd>{sizeText(locale, e.axes, e.defaultDims)}</dd>
              </div>
            </dl>

            {e.presets.length ? (
              <div>
                <h2 className={rs.cardTitle} style={{ marginBlockEnd: 12 }}>
                  {COPY.sizes[locale]}
                </h2>
                <ul className={styles.sizes}>
                  {e.presets.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <strong>{p.name[locale]}</strong>
                      {sizeText(locale, e.axes, p.dims, p.capacityMl)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </Sheet>
      {related.length ? (
        <Sheet tone="light" aria-labelledby="related-title">
          <Display size="44" id="related-title" className={rs.headGap}>
            {fill(COPY.related[locale], { name: sub[locale] })}
          </Display>
          <ul className={styles.relatedGrid}>
            {related.map((r) => {
              const c = cards.get(r.code);
              return c ? (
                <li key={r.code}>
                  <ModelCard locale={locale} card={c} />
                </li>
              ) : null;
            })}
          </ul>
        </Sheet>
      ) : null}
    </div>
  );
}
