import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
import { BadgeCheck, Boxes, PackageCheck, TrendingDown, Truck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDims, formatMoney, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { BOX_STRUCTURE_LIST } from "@/lib/dieline";
import type { FinishCode, StructureCode } from "@/types";
import { designHref, structureHref } from "@/components/store/catalog";
import { JsonLd } from "@/components/store/JsonLd";
import { faqJsonLd } from "@/components/store/jsonld";
import { renderSrc, srcSetFor } from "@/components/marketing/assets";
import { startHref } from "@/components/marketing/MarketingHeader";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { SectionHead, Stack } from "@/components/marketing/kit/SectionHead";
import { Grid } from "@/components/marketing/kit/Grid";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Steps } from "@/components/marketing/kit/Steps";
import { Marquee } from "@/components/marketing/kit/Marquee";
import { CountUp } from "@/components/marketing/kit/CountUp";
import { Faq } from "@/components/marketing/kit/Faq";
import { Glow } from "@/components/marketing/kit/Glow";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { whyCopy } from "@/components/marketing/why/copy";
import { loadWhyFacts } from "@/components/marketing/why/server";
import { DeferredImg } from "@/components/marketing/why/DeferredImg";
import { MockCheckout, MockPrice, MockPrinters, MockTracking } from "@/components/marketing/why/Mockups";
import s from "@/components/marketing/why/why.module.css";

type Props = { params: Promise<{ locale: string }> };

/**
 * Prerendered so the hero ships in the first HTML bytes (a per-request page streams behind the
 * shell's Suspense boundary and ~300 KB of flight data, which put the phone LCP over 3 s).
 * Prices still come from the uncached checkout loaders at render time; the page re-renders at
 * most 60 s later, and at once on every pricing edit: rate cards, pricing settings, the price
 * index, vendor status and checkout settings all call purgeCatalogCache() → revalidatePath
 * ("/[locale]", "layout"). See docs/audit/r6-why.md §4.
 */
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const c = whyCopy(locale).why;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `/${locale}/why-elba`, languages: { ar: "/ar/why-elba", en: "/en/why-elba" } },
    openGraph: { title: c.metaTitle, description: c.metaDescription, url: `${siteUrl()}/${locale}/why-elba`, images: ["/marketing/renders/fefco-0427.webp"] },
  };
}

const TICKER_FINISHES: FinishCode[] = ["MATTE_LAMINATION", "GLOSS_LAMINATION", "SOFT_TOUCH_LAMINATION", "SPOT_UV", "HOT_FOIL", "EMBOSS", "DEBOSS", "VARNISH"];
const SEGMENTS: { id: "cafes" | "beauty" | "ecommerce"; img: StructureCode; styles: StructureCode[] }[] = [
  { id: "cafes", img: "PIZZA", styles: ["PIZZA", "GABLE_BOX", "SLEEVE"] },
  { id: "beauty", img: "ECMA_RTE", styles: ["ECMA_RTE", "RIGID_BOX", "PAPER_TUBE"] },
  { id: "ecommerce", img: "FEFCO_0427", styles: ["FEFCO_0427", "FEFCO_0201"] },
];
/** A hero render: AVIF first, 400w for phones, 720w for desktop (sized ~30vw there). */
function HeroRender({ id, className, priority = false, w = 720, h = 480 }: { id: string; className: string; priority?: boolean; w?: number; h?: number }) {
  const r = `/marketing/renders/${id}`;
  const sizes = "(min-width: 768px) 30vw, 200px";
  return (
    <picture>
      <source type="image/avif" srcSet={w > 400 ? `${r}.400w.avif 400w, ${r}.720w.avif 720w` : `${r}.400w.avif`} sizes={w > 400 ? sizes : undefined} />
      <img
        className={className}
        src={w > 400 ? `${r}.720w.webp` : `${r}.400w.webp`}
        srcSet={w > 400 ? `${r}.400w.webp 400w, ${r}.720w.webp 720w` : undefined}
        sizes={w > 400 ? sizes : undefined}
        alt=""
        width={w}
        height={h}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}

const small = (code: StructureCode) => renderSrc(code).replace(/\.webp$/, ".400w.webp");

export default async function WhyElbaPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const all = whyCopy(locale);
  const c = all.why;
  const p = all.pricing;
  const u = all.units;
  const { pricing: f, designerModels } = await loadWhyFacts();
  // Phone LCP is the first hero render: fetch it ahead of the fonts and the rest of the page.
  preload("/marketing/renders/fefco-0427.400w.avif", { as: "image", type: "image/avif", fetchPriority: "high", media: "(max-width: 767px)" } as Parameters<typeof preload>[1]);
  const money = (v: number, unit = false) => formatMoney(v, locale, { alwaysDecimals: unit });
  const start = startHref(locale);
  const refStart = f ? designHref(locale, { structure: f.box.code, dims: f.box.dims, material: f.box.material }) : start;
  const pricingHref = `/${locale}/pricing`;
  const t500 = f?.tiers.find((x) => x.quantity === 500) ?? f?.tiers[0];
  const firstTier = f?.tiers[0];
  const lastTier = f?.tiers[f.tiers.length - 1];
  const pct = `${formatNumber(f?.prepayDiscountPct ?? 0, 1)}%`;
  const boxName = f ? `${t(`structures.${f.box.code}` as DictKey)} ${formatDims(f.box.dims, locale)}` : "";
  const name = (code: StructureCode) => t(`structures.${code}` as DictKey);

  // W2: our box styles (each with its render) interleaved with our finishes (no company logos).
  const items: { label: string; kind: string; img?: string }[] = [];
  BOX_STRUCTURE_LIST.slice(0, 12).forEach((st, i) => {
    items.push({ label: name(st.code), kind: c.tickerStyle, img: small(st.code).replace(/\.webp$/, ".avif") });
    if (i < TICKER_FINISHES.length) items.push({ label: t(`finishes.${TICKER_FINISHES[i]!}` as DictKey), kind: c.tickerFinish });
  });
  const tickerItems = items.map((it, i) => (
    <span key={i} className={s.tickItem}>
      {it.img ? <DeferredImg src={it.img} width={56} height={56} className={s.tickImg} /> : <span className={s.tickDot} aria-hidden="true" />}
      <span className={s.tickText}>
        <span className={s.tickLabel}>{it.label}</span>
        <span className={s.tickKind}>{it.kind}</span>
      </span>
    </span>
  ));

  // W3: one screen per point (designer, printer match, order summary), all real UI / real numbers.
  const summaryLines = t500
    ? [
        { label: p.boxes(formatNumber(t500.quantity)), value: money(t500.goodsPiasters) },
        { label: p.compareRows.shipping, value: money(t500.shippingPiasters) },
        { label: p.compareRows.vat, value: money(t500.vatPiasters) },
      ]
    : [];
  const discount = t500 && t500.discountPiasters > 0 ? { label: c.prepayLine(pct), value: money(-t500.discountPiasters) } : null;
  const screens = [
    <div key="d" className={s.screen}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={s.shot}
        src={`/marketing/designer-${locale}.720w.webp`}
        srcSet={srcSetFor(`/marketing/designer-${locale}.webp`)}
        sizes="(min-width: 960px) 600px, 92vw"
        alt=""
        width={720}
        height={450}
        loading="lazy"
        decoding="async"
      />
    </div>,
    <div key="p" className={s.screen}>
      <MockPrinters
        rows={(f?.matches ?? []).map((m, i) => ({
          name: locale === "ar" ? m.name.ar : m.name.en,
          meta: `${t(`cities.${m.city}` as DictKey)} · ${u.days(m.deliveryDays)} · ${money(m.unitPiasters, true)}`,
          badge: i === 0 ? t("pricing.badge.BEST_MATCH" as DictKey) : undefined,
        }))}
      />
    </div>,
    <div key="s" className={s.screen}>
      {t500 ? <MockCheckout lines={summaryLines} discount={discount} total={{ label: p.totalIncl, value: money(t500.totalPiasters) }} cta={p.tierCta} /> : null}
    </div>,
  ];
  const points = c.points.map((x) => ({ title: typeof x.title === "function" ? x.title(formatNumber(f?.printerCount ?? 0)) : x.title, body: x.body }));
  const faq = c.faq({ printers: formatNumber(f?.printerCount ?? 0), models: formatNumber(designerModels), max: formatNumber(f?.maxInstantQty ?? 2000) });

  return (
    <div className={s.page}>
      <JsonLd data={faqJsonLd(faq)} />

      {/* W1 hero + W2 ticker */}
      <Sheet tone="dark" hero className={s.heroBand} aria-labelledby="why-h1">
        <Stack gap="head-content">
          <div className={s.heroInner}>
            <Glow color="violet" x="40%" y="45%" size="48vmax" />
            <Glow color="green" x="62%" y="58%" size="40vmax" />
            <div className={s.collage} aria-hidden="true">
              <HeroRender className={s.c1} id="fefco-0427" priority />
              <HeroRender className={s.c2} id="rigid-box" />
              <HeroRender className={s.c3} id="paper-tube" w={400} h={691} />
              <HeroRender className={s.c4} id="ecma-rte" w={400} h={695} />
            </div>
            <div className={s.heroText}>
              <HeroTitle lines={[c.heroLine1, c.heroLine2]} size="96" align="center" id="why-h1" />
              <p className={s.heroSub}>{c.heroSub}</p>
              <PillRow align="center">
                <Pill href={start} size="lg">
                  {c.ctaStart}
                </Pill>
                <Pill href={pricingHref} size="lg" variant="outline">
                  {c.ctaPricing}
                </Pill>
              </PillRow>
            </div>
            {t500 ? (
              <div className={s.heroBadge} aria-hidden="true">
                <span>{c.heroBadgeLabel(formatNumber(t500.quantity))}</span>
                <strong className={s.num}>{money(t500.totalPiasters)}</strong>
                <span>{c.heroBadgeUnit(money(t500.unitPiasters, true))}</span>
              </div>
            ) : null}
          </div>
          <Marquee items={tickerItems} label={c.tickerLabel} pauseLabel={c.tickerPause} playLabel={c.tickerPlay} duration={49} gap="56px" />
        </Stack>
      </Sheet>

      {/* W3 light sheet: sticky device + three points */}
      <Sheet tone="light" y="lg" aria-labelledby="why-points">
        <SectionHead size="56" align="center" id="why-points" title={c.pointsTitle} sub={c.pointsSub}>
          <Steps items={points.map((x, i) => ({ title: x.title, body: x.body, media: screens[i] }))} label={c.pointsTitle} />
        </SectionHead>
      </Sheet>

      {/* W4 violet band: three UI mockup cards */}
      <Sheet tone="violet" y="lg" aria-labelledby="why-orders">
        <SectionHead size="56" align="center" id="why-orders" title={c.ordersTitle} sub={c.ordersSub}>
          <Grid as="ul" cols={3} colsMd={1} className={s.list}>
            <Reveal as="li" index={0} className={s.vCard}>
              <div className={s.vMedia}>
                {f && t500 ? (
                  <MockPrice
                    title={boxName}
                    rows={f.tiers.slice(0, 4).map((x) => ({ qty: p.boxes(formatNumber(x.quantity)), unit: money(x.unitPiasters, true), active: x.quantity === t500.quantity }))}
                    totalLabel={p.totalIncl}
                    total={money(t500.totalPiasters)}
                  />
                ) : null}
              </div>
              <div className={s.vBody}>
                <h3 className={s.vTitle}>{c.ordersCards[0]!.title.replace("2,000", formatNumber(f?.maxInstantQty ?? 2000))}</h3>
                <p className={s.vText}>{c.ordersCards[0]!.body(formatNumber(f?.maxInstantQty ?? 2000))}</p>
              </div>
            </Reveal>
            <Reveal as="li" index={1} className={s.vCard}>
              <div className={s.vMedia}>
                {t500 ? <MockCheckout lines={summaryLines.slice(0, 2)} discount={discount} total={{ label: p.totalIncl, value: money(t500.totalPiasters) }} cta={p.tierCta} /> : null}
              </div>
              <div className={s.vBody}>
                <h3 className={s.vTitle}>{c.ordersCards[1]!.title}</h3>
                <p className={s.vText}>{c.ordersCards[1]!.body(pct)}</p>
              </div>
            </Reveal>
            <Reveal as="li" index={2} className={s.vCard}>
              <div className={s.vMedia}>
                {t500 ? (
                  <MockTracking
                    current={2}
                    steps={[
                      { label: c.track[0]!, meta: c.trackMeta.done },
                      { label: c.track[1]!, meta: p.methods[t500.method] },
                      { label: c.track[2]!, meta: c.trackMeta.eta(u.days(t500.deliveryDays)) },
                      { label: c.track[3]!, meta: c.trackMeta.receipt },
                    ]}
                  />
                ) : null}
              </div>
              <div className={s.vBody}>
                <h3 className={s.vTitle}>{c.ordersCards[2]!.title}</h3>
                <p className={s.vText}>{c.ordersCards[2]!.body(u.days(f?.fastestDeliveryDays ?? 0))}</p>
              </div>
            </Reveal>
          </Grid>
        </SectionHead>
      </Sheet>

      {/* W5 green band: real numbers, counting up once */}
      <Sheet tone="green" y="lg" aria-labelledby="why-spend" className={s.greenBand}>
        <div className={s.greenTexture} aria-hidden="true" />
        <SectionHead size="56" align="center" id="why-spend" title={c.spendTitle} sub={c.spendSub}>
          <Grid as="ul" cols={4} colsMd={2} className={s.list}>
            {f?.unitDropPct != null && firstTier && lastTier ? (
              <Reveal as="li" index={0} className={s.stat}>
                <span className={s.statFig}>
                  <CountUp value={f.unitDropPct} suffix="%" />
                </span>
                <h3 className={s.statLabel}>
                  <TrendingDown size={20} aria-hidden />
                  {c.stats.drop.label}
                </h3>
                <p className={s.statBody}>{c.stats.drop.body(formatNumber(firstTier.quantity), formatNumber(lastTier.quantity))}</p>
              </Reveal>
            ) : null}
            {f ? (
              <Reveal as="li" index={1} className={s.stat}>
                <span className={s.statFig}>
                  <CountUp value={f.minOrderQty} />
                  <span className={s.statUnit}>{c.stats.min.unit}</span>
                </span>
                <h3 className={s.statLabel}>
                  <PackageCheck size={20} aria-hidden />
                  {c.stats.min.label}
                </h3>
                <p className={s.statBody}>{c.stats.min.body}</p>
              </Reveal>
            ) : null}
            {f?.fastestDeliveryDays != null ? (
              <Reveal as="li" index={2} className={s.stat}>
                <span className={s.statFig}>
                  <CountUp value={f.fastestDeliveryDays} />
                  <span className={s.statUnit}>{c.stats.days.unit}</span>
                </span>
                <h3 className={s.statLabel}>
                  <Truck size={20} aria-hidden />
                  {c.stats.days.label}
                </h3>
                <p className={s.statBody}>{c.stats.days.body}</p>
              </Reveal>
            ) : null}
            <Reveal as="li" index={3} className={s.stat}>
              <span className={s.statFig}>
                <CountUp value={designerModels} />
              </span>
              <h3 className={s.statLabel}>
                <Boxes size={20} aria-hidden />
                {c.stats.models.label}
              </h3>
              <p className={s.statBody}>{c.stats.models.body}</p>
            </Reveal>
            {f?.digitalSetupPiasters != null ? (
              <Reveal as="li" index={4} className={s.stat}>
                <span className={s.statFig}>{money(f.digitalSetupPiasters)}</span>
                <h3 className={s.statLabel}>
                  <BadgeCheck size={20} aria-hidden />
                  {c.stats.digital.label}
                </h3>
                <p className={s.statBody}>{c.stats.digital.body}</p>
              </Reveal>
            ) : null}
          </Grid>
        </SectionHead>
      </Sheet>

      {/* Segments (the header's "Why Elba" menu links here: #cafes, #beauty, #ecommerce) */}
      <Sheet tone="white" y="lg" aria-labelledby="why-segments">
        <SectionHead size="56" align="center" id="why-segments" title={c.segmentsTitle} sub={c.segmentsSub}>
          <Grid as="ul" cols={3} colsMd={1} className={s.list}>
            {SEGMENTS.map((seg, i) => (
              <Reveal as="li" key={seg.id} index={i} className={s.segCard} id={seg.id}>
                <div className={s.segMedia}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={small(seg.img)} alt="" width={400} height={300} loading="lazy" decoding="async" />
                </div>
                <h3 className={s.vTitle}>{c.segments[seg.id].title}</h3>
                <p className={s.segText}>{c.segments[seg.id].body}</p>
                <p className={s.segStylesLabel}>{c.segmentsStyles}</p>
                <ul className={s.segLinks}>
                  {seg.styles.map((code) => (
                    <li key={code}>
                      <Link href={structureHref(locale, code)}>{name(code)}</Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </Grid>
        </SectionHead>
      </Sheet>

      {/* W6 switch from your print shop + the Elba promise (our policy, not a testimonial) */}
      <Sheet tone="dark" y="lg" aria-labelledby="why-switch">
        <Grid cols={2} colsMd={1} className={s.switchGrid}>
          <Reveal>
            <SectionHead
              size="44"
              id="why-switch"
              title={
                <>
                  {c.switchTitle1}
                  <br />
                  {c.switchTitle2}
                </>
              }
            >
              <ol className={s.steps}>
                {c.switchSteps.map((st) => (
                  <li key={st.title} className={s.step}>
                    <h3 className={s.stepTitle}>{st.title}</h3>
                    <p className={s.stepBody}>{st.body}</p>
                  </li>
                ))}
              </ol>
            </SectionHead>
          </Reveal>
          <Reveal variant="fade" className={s.promiseWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={s.promiseArt} src="/marketing/renders/fefco-0201.720w.webp" alt="" width={720} height={480} loading="lazy" decoding="async" />
            <figure className={s.promise}>
              <p className={s.promiseEyebrow}>{c.promiseEyebrow}</p>
              <blockquote className={s.promiseQuote}>{c.promiseQuote}</blockquote>
              <figcaption className={s.promiseSign}>{c.promiseSign}</figcaption>
              {f ? (
                <ul className={s.promiseFacts}>
                  {c.promiseFacts(u.hours(f.quoteValidityHours), u.days(f.sample?.creditDays ?? 0)).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : null}
              <Link className={s.promiseLink} href={`/${locale}/legal/returns`}>
                {c.promisePolicy}
              </Link>
            </figure>
          </Reveal>
        </Grid>
      </Sheet>

      {/* FAQ (the header's help link points to #faq) */}
      <Sheet tone="dark" y="lg" id="faq" aria-labelledby="why-faq">
        <SectionHead size="44" id="why-faq" title={c.faqTitle}>
          <Faq items={faq} name="why-faq" />
        </SectionHead>
      </Sheet>

      {/* W7 closing CTA */}
      <Sheet tone="dark" y="xl" aria-labelledby="why-close">
        <Reveal>
          <SectionHead size="64" align="center" id="why-close" title={c.closeTitle} />
          <PillRow align="center">
            <Pill href={refStart} size="lg">
              {c.ctaStart}
            </Pill>
            <Pill href={pricingHref} size="lg" variant="outline">
              {c.ctaPricing}
            </Pill>
          </PillRow>
        </Reveal>
      </Sheet>
    </div>
  );
}
