import type { Metadata } from "next";
import Link from "next/link";
import { getT, toLocale } from "@/i18n";
import { getModelReferenceUnit } from "@/components/store/data";
import { formatMoney } from "@/lib/format";
import { DEFINITIONS as BAGS } from "@/lib/dieline/families/bags/definitions";
import { HANDLE_NAMES } from "@/lib/dieline/families/bags/handles";
import { BAG_MOQ } from "@/lib/pricing/bags";
import { catalogueThumb } from "@/data/catalogue";
import rs from "@/components/marketing/restyle/restyle.module.css";
import dt from "@/components/marketing/restyle/detail.module.css";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Eyebrow, Lead } from "@/components/marketing/kit/Display";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Grid } from "@/components/marketing/kit/Grid";

/** Prerendered; prices refresh hourly (ISR). */
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: t("marketing.bags.title"),
    description: t("marketing.bags.body"),
    alternates: { canonical: `/${locale}/bags`, languages: { ar: "/ar/bags", en: "/en/bags" } },
  };
}

const cm = (mm: number) => String(Math.round(mm / 10));

/**
 * Products → Paper bags (added by bags). Every store bag model with its sizes, handles and the
 * price per bag the designer would show for its default size (1 colour on kraft, 4 colours on
 * laminated art paper, the reference quantity), or "price by quote". Images are renders of the 3D
 * models. No reviews or customer counts: Elba has none for bags yet.
 */
export default async function BagsPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const prices = await Promise.all(
    BAGS.map((b) => (b.orderMode === "quote" ? Promise.resolve(null) : getModelReferenceUnit("PAPER_BAG", b.code, b.defaultDims, b.materials[0], b.line === "handmade" ? 4 : 1))),
  );
  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={rs.heroLanding} aria-labelledby="bags-title">
        <Eyebrow className="m-enter">{t("marketing.bags.eyebrow")}</Eyebrow>
        <HeroTitle as="h1" size="64" align="center" id="bags-title" text={t("marketing.bags.title")} />
        <Lead align="center" className="m-enter-lcp">
          {t("marketing.bags.body")}
        </Lead>
        <PillRow align="center" className="m-enter">
          <Pill href="#bags" size="lg">
            {t("marketing.bags.primary")}
          </Pill>
          <Pill href={`/${locale}/design/${BAGS[0].slug}`} variant="outline" size="lg">
            {t("marketing.bags.secondary")}
          </Pill>
        </PillRow>
        <p className={`${rs.small} ${rs.sampleNote} ${rs.heroLandingNote}`}>{t("marketing.bags.moq", { kraft: BAG_MOQ.machine, art: BAG_MOQ.handmade })}</p>
      </Sheet>
      <Sheet tone="white" id="bags" aria-labelledby="bags-list-title">
        <h2 id="bags-list-title" className="visually-hidden">
          {t("marketing.bags.eyebrow")}
        </h2>
        <Grid as="ul" cols={3} colsMd={2} colsSm={1} className={dt.cards}>
          {BAGS.map((b, i) => {
            const price = prices[i];
            return (
              <li key={b.code} data-bag={b.code} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: i % 3 }}>
                <article className={dt.card}>
                  <div className={dt.cardMedia}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={catalogueThumb(b.code)} alt="" loading="lazy" decoding="async" width={480} height={480} />
                  </div>
                  <div className={dt.cardBody}>
                    <h3 className={rs.cardTitle}>
                      <Link href={`/${locale}/design/${b.slug}`} prefetch={false} className={dt.cardLink}>
                        {b.name[locale]}
                      </Link>
                    </h3>
                    <p className={rs.small}>{b.description[locale]}</p>
                    <p className={rs.small}>
                      <strong>{t("marketing.bags.sizes")}</strong>{" "}
                      {b.presets.map((p, k) => (
                        <span key={p.id}>
                          {k ? "، ".replace("، ", locale === "ar" ? "، " : ", ") : ""}
                          {p.name[locale]} <bdi dir="ltr">{`${cm(p.dims.L)} × ${cm(p.dims.W)} × ${cm(p.dims.H)}`}</bdi>
                        </span>
                      ))}{" "}
                      {t("marketing.bags.cm")}
                    </p>
                    <p className={rs.small}>
                      <strong>{t("marketing.bags.handles")}</strong> {b.handles.map((h) => HANDLE_NAMES[h][locale]).join(locale === "ar" ? "، " : ", ")}
                    </p>
                    <p className={rs.small} data-testid="bag-price">
                      {price ? t("marketing.bags.price", { price: formatMoney(price.unitPiasters, locale, { alwaysDecimals: true }), count: price.quantity }) : t("marketing.bags.quote")}
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </Grid>
        <p className={rs.small}>{t("marketing.bags.priceNote")}</p>
      </Sheet>
    </div>
  );
}
