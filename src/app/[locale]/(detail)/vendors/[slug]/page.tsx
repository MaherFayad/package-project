import type { Metadata } from "next";
import { Badge, Card, Icon, Layout, LayoutSection, Text } from "@/components/marketing/mkui";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin } from "lucide-react";
import { getT, pick, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { dirOf } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { PortfolioGallery } from "@/components/store/PortfolioGallery";
import { SpecTable } from "@/components/store/SpecTable";
import { RatingStars } from "@/components/store/RatingStars";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbJsonLd, vendorJsonLd } from "@/components/store/jsonld";
import { designHref } from "@/components/store/catalog";
import { getVendorBySlug } from "@/components/store/data";
import Link from "next/link";
import styles from "@/components/store/store.module.css";
import rs from "@/components/marketing/restyle/restyle.module.css";
import dt from "@/components/marketing/restyle/detail.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Glow } from "@/components/marketing/kit/Glow";
import { Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";

/** Prerendered; prices and printer data refresh hourly (ISR). */
export const revalidate = 3600;

/** No build-time list: each printer page is rendered on first request, then cached (ISR). */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = toLocale(raw);
  const v = await getVendorBySlug(slug);
  if (!v) notFound();
  const name = pick(locale, v.name.ar, v.name.en);
  const bio = pick(locale, v.bio.ar, v.bio.en);
  return {
    title: name,
    description: bio.slice(0, 160),
    alternates: { canonical: `/${locale}/vendors/${slug}`, languages: { ar: `/ar/vendors/${slug}`, en: `/en/vendors/${slug}` } },
    openGraph: { title: name, description: bio, images: v.coverUrl ? [v.coverUrl] : undefined },
  };
}

export default async function VendorProfilePage({ params }: Props) {
  const { locale: raw, slug } = await params;
  const locale = toLocale(raw);
  const v = await getVendorBySlug(slug);
  if (!v) notFound();
  const t = getT(locale);
  const name = pick(locale, v.name.ar, v.name.en);
  const city = t(`cities.${v.city}` as DictKey);
  const base = siteUrl();
  const url = `${base}/${locale}/vendors/${slug}`;
  const cta = designHref(locale, { vendor: v.slug, structure: v.capabilities.structures[0] });
  const sep = locale === "ar" ? "، " : ", ";

  return (
    <div className={rs.page}>
      <JsonLd
        data={[
          vendorJsonLd({
            name,
            url,
            logo: v.logoUrl ? `${base}${v.logoUrl}` : null,
            city,
            description: pick(locale, v.bio.ar, v.bio.en),
            rating: v.rating,
            ratingCount: v.ratingCount,
          }),
          breadcrumbJsonLd([
            { name: t("nav.home"), url: `${base}/${locale}` },
            { name: t("vendors.title"), url: `${base}/${locale}/vendors` },
            { name, url },
          ]),
        ]}
      />
      <Sheet tone="dark" hero className={`${rs.heroCompact} ${rs.clip}`} aria-labelledby="vendor-title">
        <Glow color="violet" x="85%" y="0%" size="70vmax" />
        <Glow color="green" x="5%" y="110%" size="45vmax" />
        <nav aria-label={t("store.breadcrumb")} className={`${rs.crumbs} m-enter`}>
          <ol>
            <li>
              <Link href={`/${locale}`}>{t("nav.home")}</Link>
            </li>
            <li>
              <Link href={`/${locale}/vendors`}>{t("vendors.title")}</Link>
            </li>
            <li>
              <span aria-current="page">{name}</span>
            </li>
          </ol>
        </nav>
        <div className={rs.split}>
          <div>
            <div className={`${dt.identity} m-enter`}>
              {v.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.logoUrl} alt="" className={dt.logo} width={72} height={72} />
              ) : null}
              <Eyebrow className={rs.inlineIcon}>
                <MapPin size={16} aria-hidden />
                {city}
              </Eyebrow>
            </div>
            <HeroTitle size="64" id="vendor-title" text={name} />
            <Lead className="m-enter-lcp">{pick(locale, v.bio.ar, v.bio.en)}</Lead>
            <div className={`${dt.badges} m-enter`}>
              {v.verified ? (
                <Badge tone="success" icon={<Icon source={BadgeCheck} size="small" />}>
                  {t("vendors.verified")}
                </Badge>
              ) : null}
              {v.foodSafe ? <Badge tone="info">{t("vendors.foodSafe")}</Badge> : null}
              {v.capabilities.digitalShortRun ? <Badge>{t("store.vendors.digital")}</Badge> : null}
            </div>
            <PillRow className="m-enter">
              <Pill href={cta} size="lg">
                {t("store.vendor.designCta")}
              </Pill>
              <Pill href={`/${locale}/vendors`} variant="outline" size="lg">
                {t("marketing.printers.all")}
              </Pill>
            </PillRow>
            <p className={`${rs.small} m-enter`} style={{ marginBlockStart: 16 }}>
              {t("store.vendor.designHint")}
            </p>
          </div>
          <dl className={`${rs.stats} ${rs.stats2} m-enter`} aria-label={t("store.vendor.statsTitle")}>
            <div className={rs.stat}>
              <dt className={`${rs.statLabel} ${rs.inlineIcon}`}>
                <RatingStars rating={v.rating} label={t("store.vendor.stars", { rating: v.rating.toFixed(1) })} />
                {t("store.vendor.rating")}
              </dt>
              <dd className={rs.statNum}>
                <bdi>{v.rating.toFixed(1)}</bdi>
              </dd>
            </div>
            <div className={rs.stat}>
              <dt className={rs.statLabel}>{t("store.vendor.onTime")}</dt>
              <dd className={rs.statNum}>
                <bdi>{formatNumber(v.onTimePct)}%</bdi>
              </dd>
            </div>
            <div className={rs.stat}>
              <dt className={rs.statLabel}>{t("store.vendor.leadTime")}</dt>
              <dd className={rs.statNum}>{t("store.structure.deliveryDays", { days: v.leadTimeDays })}</dd>
            </div>
            <div className={rs.stat}>
              <dt className={rs.statLabel}>{t("store.vendor.minOrder")}</dt>
              <dd className={rs.statNum}>
                <bdi>{formatNumber(v.minOrderQty)}</bdi>
              </dd>
            </div>
          </dl>
        </div>
      </Sheet>

      <Sheet tone="white" className={rs.sheetTop} aria-label={t("store.vendor.about")}>
        <Layout>
          <LayoutSection>
            <div className={dt.stack}>
              <Card title={t("store.vendor.portfolioTitle")} as="section">
                {v.portfolio.length ? (
                  <PortfolioGallery
                    dir={dirOf(locale)}
                    items={v.portfolio.map((p) => ({ id: p.id, src: p.imageUrl, caption: pick(locale, p.caption.ar, p.caption.en) }))}
                    labels={{
                      title: `${t("store.vendor.portfolioTitle")}: ${name}`,
                      open: t("store.vendor.openImage"),
                      prev: t("store.vendor.prev"),
                      next: t("store.vendor.next"),
                      counter: t("store.vendor.counter"),
                    }}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    {t("store.vendor.portfolioEmpty")}
                  </Text>
                )}
              </Card>

              <Card title={t("store.vendor.capabilitiesTitle")} as="section">
                <dl className={styles.specs}>
                  <div className={styles.specRow}>
                    <dt>{t("store.vendor.structures")}</dt>
                    <dd>{v.capabilities.structures.map((s) => t(`structures.${s}` as DictKey)).join(sep)}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.vendor.materials")}</dt>
                    <dd>{v.capabilities.materials.map((m) => t(`materials.${m}` as DictKey)).join(sep)}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.vendor.finishes")}</dt>
                    <dd>{v.capabilities.finishes.map((f) => t(`finishes.${f}` as DictKey)).join(sep)}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.vendor.colours")}</dt>
                    <dd>{t("store.vendor.coloursValue", { count: v.capabilities.maxColors })}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.vendor.digital")}</dt>
                    <dd>{v.capabilities.digitalShortRun ? t("store.vendor.digitalYes") : t("store.vendor.digitalNo")}</dd>
                  </div>
                  <div className={styles.specRow}>
                    <dt>{t("store.vendor.capacity")}</dt>
                    <dd>{t("store.vendor.capacityValue", { count: formatNumber(v.capabilities.monthlyCapacityUnits) })}</dd>
                  </div>
                </dl>
              </Card>

              <Card title={t("store.vendor.machinesTitle")} as="section">
                {v.machines.length ? (
                  <div className={styles.tableWrap}>
                    <SpecTable
                      caption={t("store.vendor.machinesTitle")}
                      numeric={[2]}
                      headings={[t("store.vendor.machineType"), t("store.vendor.machineModel"), t("store.vendor.machineQty")]}
                      rows={v.machines.map((m) => [
                        t(`store.vendor.machineKind.${m.kind}` as DictKey),
                        <bdi key="m" dir="ltr">
                          {m.model}
                        </bdi>,
                        <bdi key="c">{m.count}</bdi>,
                      ])}
                    />
                  </div>
                ) : null}
              </Card>

              <Card title={t("store.vendor.certificationsTitle")} as="section">
                {v.certifications.length ? (
                  <ul className={styles.plainList}>
                    {v.certifications.map((c) => (
                      <li key={c.code} className={styles.designRow}>
                        <div className={styles.designMain}>
                          <Text as="span" fontWeight="semibold">
                            {t(`store.vendor.cert.${c.code}` as DictKey)}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {t("store.vendor.certIssuer", { issuer: c.issuer })}
                            {c.validUntil ? ` · ${t("store.vendor.certValid", { date: formatDate(c.validUntil, locale) })}` : ""}
                          </Text>
                        </div>
                        <Badge tone="success" progress="complete">
                          {t("vendors.verified")}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text as="p" tone="subdued">
                    {t("store.vendor.certNone")}
                  </Text>
                )}
              </Card>

              <Card title={t("store.vendor.reviewsTitle")} as="section">
                {v.reviews.length ? (
                  <ul className={styles.plainList}>
                    {v.reviews.map((r) => (
                      <li key={r.id} className={styles.review}>
                        <RatingStars rating={r.rating} label={t("store.vendor.stars", { rating: r.rating })} />
                        {r.body ? <Text as="p">{r.body}</Text> : null}
                        <Text as="p" variant="bodySm" tone="subdued">
                          {r.author || "—"} · {formatDate(r.createdAt, locale)}
                        </Text>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.reviewsEmpty}>
                    <Text as="h3" variant="headingSm">
                      {t("store.vendor.reviewsEmpty")}
                    </Text>
                    <Text as="p" tone="subdued">
                      {t("store.vendor.reviewsEmptyBody")}
                    </Text>
                  </div>
                )}
              </Card>
            </div>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside" aria-label={t("store.vendor.serviceAreas")}>
            <div className={dt.stack}>
              <Card>
                <dl className={styles.specs}>
                  <div className={styles.specRow}>
                    <dt>{t("store.vendor.serviceAreas")}</dt>
                    <dd>{v.serviceAreas.map((c) => t(`cities.${c}` as DictKey)).join(sep)}</dd>
                  </div>
                </dl>
                <Text as="p" variant="bodySm" tone="subdued">
                  {t("store.vendor.joined", { date: formatDate(v.joinedAt, locale) })}
                </Text>
              </Card>
              <p className={rs.small}>{t("store.vendor.contactNote")}</p>
            </div>
          </LayoutSection>
        </Layout>
      </Sheet>
    </div>
  );
}
