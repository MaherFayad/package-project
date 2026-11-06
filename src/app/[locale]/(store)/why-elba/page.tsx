import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Boxes, PackageCheck, TrendingDown, Truck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatDims, formatMoney, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { BOX_STRUCTURE_LIST } from "@/lib/dieline";
import type { FinishCode } from "@/types";
import { designHref } from "@/components/store/catalog";
import { RENDER_ID, renderSrc, srcSetFor } from "@/components/marketing/assets";
import { whyCopy } from "@/components/marketing/why/copy";
import { loadWhyFacts } from "@/components/marketing/why/server";
import { Ticker, type TickerItem } from "@/components/marketing/why/Ticker";
import { StickyPoints } from "@/components/marketing/why/StickyPoints";
import { CountUp } from "@/components/marketing/why/CountUp";
import { MockCheckout, MockPrice, MockPrinters, MockTracking } from "@/components/marketing/why/Mockups";
import s from "@/components/marketing/why/why.module.css";

type Props = { params: Promise<{ locale: string }> };

/** Prices are read live from the checkout pricing inputs on every request (never a stale cache). */
export const dynamic = "force-dynamic";

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

export default async function WhyElbaPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const all = whyCopy(locale);
  const c = all.why;
  const u = all.units;
  const { pricing: f, designerModels } = await loadWhyFacts();
  const money = (p: number, unit = false) => formatMoney(p, locale, { alwaysDecimals: unit });
  const start = designHref(locale, f ? { structure: f.box.code, dims: f.box.dims, material: f.box.material } : { structure: "FEFCO_0427" });
  const pricingHref = `/${locale}/pricing`;
  const t500 = f?.tiers.find((x) => x.quantity === 500) ?? f?.tiers[0];
  const firstTier = f?.tiers[0];
  const lastTier = f?.tiers[f.tiers.length - 1];

  // W2: our box styles (with their renders) interleaved with our finishes.
  const styles = BOX_STRUCTURE_LIST.filter((st) => RENDER_ID[st.code]).slice(0, 12);
  const items: TickerItem[] = [];
  styles.forEach((st, i) => {
    items.push({ label: t(`structures.${st.code}` as DictKey), kind: c.tickerStyle, img: renderSrc(st.code).replace(".webp", ".400w.webp") });
    const fin = TICKER_FINISHES[i % TICKER_FINISHES.length]!;
    if (i < TICKER_FINISHES.length) items.push({ label: t(`finishes.${fin}` as DictKey), kind: c.tickerFinish });
  });

  // W3 screens.
  const screens = [
    <div key="d" className={s.screen}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={s.shot} src={`/marketing/designer-${locale}.720w.webp`} srcSet={srcSetFor(`/marketing/designer-${locale}.webp`)} sizes="(min-width: 960px) 600px, 92vw" alt="" width={720} height={450} loading="lazy" decoding="async" />
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
      {t500 ? (
        <MockCheckout
          lines={[
            { label: all.pricing.boxes(formatNumber(t500.quantity)), value: money(t500.subtotalPiasters - t500.shippingPiasters) },
            { label: all.pricing.compareRows.shipping, value: money(t500.shippingPiasters) },
          ]}
          discount={null}
          total={{ label: all.pricing.orderTotal, value: money(t500.totalPiasters) }}
          cta={all.pricing.tierCta}
        />
      ) : null}
    </div>,
  ];

  const points = c.points.map((p) => ({ title: typeof p.title === "function" ? p.title(formatNumber(f?.printerCount ?? 0)) : p.title, body: p.body }));
  const boxName = f ? `${t(`structures.${f.box.code}` as DictKey)} ${formatDims(f.box.dims, locale)}` : "";

  return (
    <div className={s.page}>
      {/* W1 hero */}
      <section className={`${s.sheet} ${s.hero}`} aria-labelledby="why-h1">
        <div className={s.container}>
          <div className={s.heroInner}>
            <div className={s.glow} aria-hidden="true" />
            <div className={s.collage} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={s.c1} src="/marketing/renders/fefco-0427.720w.webp" alt="" width={720} height={479} fetchPriority="high" decoding="async" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={s.c2} src="/marketing/renders/rigid-box.720w.webp" alt="" width={720} height={481} decoding="async" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={s.c3} src="/marketing/renders/paper-tube.400w.webp" alt="" width={400} height={691} decoding="async" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={s.c4} src="/marketing/renders/ecma-rte.400w.webp" alt="" width={400} height={695} decoding="async" />
            </div>
            <div className={s.heroText}>
              <h1 id="why-h1" className={s.display}>
                <span className={s.displayLine}>
                  <span className={s.displayLineInner}>{c.heroLine1}</span>
                </span>
                <span className={s.displayLine}>
                  <span className={s.displayLineInner}>{c.heroLine2}</span>
                </span>
              </h1>
              <p className={s.heroSub}>{c.heroSub}</p>
              <div className={s.pills}>
                <Link href={start} className={s.pill}>
                  {c.ctaStart}
                </Link>
                <Link href={pricingHref} className={`${s.pill} ${s.pillOutline}`}>
                  {c.ctaPricing}
                </Link>
              </div>
            </div>
            {t500 ? (
              <div className={s.heroBadge} aria-hidden="true">
                <span>{c.heroBadgeLabel(formatNumber(t500.quantity))}</span>
                <strong className={s.num}>{money(t500.totalPiasters)}</strong>
                <span>{c.heroBadgeUnit(money(t500.unitPiasters, true))}</span>
              </div>
            ) : null}
          </div>
        </div>
        {/* W2 ticker */}
        <div className={s.container}>
          <Ticker items={items} label={c.tickerLabel} pause={c.tickerPause} play={c.tickerPlay} />
        </div>
      </section>

      {/* W3 light sheet, sticky device + three points */}
      <section className={`${s.sheet} ${s.light}`} aria-labelledby="why-points">
        <div className={s.container}>
          <div className={`${s.head} ${s.center}`} data-reveal>
            <h2 id="why-points" className={s.h2}>
              {c.pointsTitle}
            </h2>
            <p className={s.lead}>{c.pointsSub}</p>
          </div>
          <StickyPoints points={points} screens={screens} deviceLabel={c.deviceLabels.join(", ")} />
        </div>
      </section>

      {/* W4 violet band */}
      <section className={`${s.sheet} ${s.violet}`} aria-labelledby="why-orders">
        <div className={s.container}>
          <div className={`${s.head} ${s.center}`} data-reveal>
            <h2 id="why-orders" className={s.h2}>
              {c.ordersTitle}
            </h2>
            <p className={s.lead}>{c.ordersSub}</p>
          </div>
          <ul className={s.cards3} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li className={s.vCard} data-reveal style={{ ["--m-i" as string]: 0 }}>
              <div className={s.vMedia}>
                {f ? (
                  <MockPrice
                    title={boxName}
                    rows={f.tiers.slice(0, 4).map((x) => ({ qty: all.pricing.boxes(formatNumber(x.quantity)), unit: money(x.unitPiasters, true), active: x.quantity === 500 }))}
                    totalLabel={all.pricing.orderTotal}
                    total={money(t500!.totalPiasters)}
                  />
                ) : null}
              </div>
              <div className={s.vBody}>
                <h3 className={s.vTitle}>{c.ordersCards[0]!.title.replace("2,000", formatNumber(f?.maxInstantQty ?? 2000))}</h3>
                <p className={s.vText}>{c.ordersCards[0]!.body(formatNumber(f?.maxInstantQty ?? 2000))}</p>
              </div>
            </li>
            <li className={s.vCard} data-reveal style={{ ["--m-i" as string]: 1 }}>
              <div className={s.vMedia}>
                {t500 ? (
                  <MockCheckout
                    lines={[
                      { label: all.pricing.boxes(formatNumber(t500.quantity)), value: money(t500.subtotalPiasters - t500.shippingPiasters) },
                      { label: all.pricing.compareRows.shipping, value: money(t500.shippingPiasters) },
                    ]}
                    discount={f && f.prepayDiscountPct > 0 ? { label: c.prepayLine(`${formatNumber(f.prepayDiscountPct, 1)}%`), value: money(-t500.prepaidSavingPiasters) } : null}
                    total={{ label: all.pricing.prepaidTotal, value: money(t500.prepaidTotalPiasters) }}
                    cta={all.pricing.tierCta}
                  />
                ) : null}
              </div>
              <div className={s.vBody}>
                <h3 className={s.vTitle}>{c.ordersCards[1]!.title}</h3>
                <p className={s.vText}>{c.ordersCards[1]!.body(`${formatNumber(f?.prepayDiscountPct ?? 0, 1)}%`)}</p>
              </div>
            </li>
            <li className={s.vCard} data-reveal style={{ ["--m-i" as string]: 2 }}>
              <div className={s.vMedia}>
                {t500 ? (
                  <MockTracking
                    current={2}
                    steps={[
                      { label: c.track[0]!, meta: c.trackMeta.done },
                      { label: c.track[1]!, meta: all.pricing.methods[t500.method] },
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
            </li>
          </ul>
        </div>
      </section>

      {/* W5 green stats */}
      <section className={`${s.sheet} ${s.green}`} aria-labelledby="why-spend">
        <div className={s.greenTexture} aria-hidden="true" />
        <div className={s.container}>
          <div className={`${s.head} ${s.center}`} data-reveal>
            <h2 id="why-spend" className={s.h2}>
              {c.spendTitle}
            </h2>
            <p className={s.lead}>{c.spendSub}</p>
          </div>
          <ul className={s.stats} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {f?.unitDropPct != null && firstTier && lastTier ? (
              <li className={s.stat} data-reveal style={{ ["--m-i" as string]: 0 }}>
                <span className={s.statFig}>
                  <CountUp value={f.unitDropPct} suffix="%" />
                </span>
                <h3 className={s.statLabel}>
                  <TrendingDown size={20} aria-hidden />
                  {c.stats.drop.label}
                </h3>
                <p className={s.statBody}>{c.stats.drop.body(formatNumber(firstTier.quantity), formatNumber(lastTier.quantity))}</p>
              </li>
            ) : null}
            {f ? (
              <li className={s.stat} data-reveal style={{ ["--m-i" as string]: 1 }}>
                <span className={s.statFig}>
                  <CountUp value={f.minOrderQty} />
                  <span className={s.statUnit}>{c.stats.min.unit}</span>
                </span>
                <h3 className={s.statLabel}>
                  <PackageCheck size={20} aria-hidden />
                  {c.stats.min.label}
                </h3>
                <p className={s.statBody}>{c.stats.min.body}</p>
              </li>
            ) : null}
            {f?.fastestDeliveryDays != null ? (
              <li className={s.stat} data-reveal style={{ ["--m-i" as string]: 2 }}>
                <span className={s.statFig}>
                  <CountUp value={f.fastestDeliveryDays} />
                  <span className={s.statUnit}>{c.stats.days.unit}</span>
                </span>
                <h3 className={s.statLabel}>
                  <Truck size={20} aria-hidden />
                  {c.stats.days.label}
                </h3>
                <p className={s.statBody}>{c.stats.days.body}</p>
              </li>
            ) : null}
            <li className={s.stat} data-reveal style={{ ["--m-i" as string]: 3 }}>
              <span className={s.statFig}>
                <CountUp value={designerModels} />
              </span>
              <h3 className={s.statLabel}>
                <Boxes size={20} aria-hidden />
                {c.stats.models.label}
              </h3>
              <p className={s.statBody}>{c.stats.models.body}</p>
            </li>
            {f?.digitalSetupPiasters != null ? (
              <li className={s.stat} data-reveal style={{ ["--m-i" as string]: 4 }}>
                <span className={s.statFig}>{money(f.digitalSetupPiasters)}</span>
                <h3 className={s.statLabel}>
                  <BadgeCheck size={20} aria-hidden />
                  {c.stats.digital.label}
                </h3>
                <p className={s.statBody}>{c.stats.digital.body}</p>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      {/* W6 switch from your print shop */}
      <section className={`${s.sheet} ${s.dark}`} aria-labelledby="why-switch">
        <div className={s.container}>
          <div className={s.switchGrid}>
            <div data-reveal>
              <h2 id="why-switch" className={`${s.h2} ${s.h2sm}`}>
                {c.switchTitle1}
                <br />
                {c.switchTitle2}
              </h2>
              <ol className={s.steps}>
                {c.switchSteps.map((st) => (
                  <li key={st.title} className={s.step}>
                    <h3 className={s.stepTitle}>{st.title}</h3>
                    <p className={s.stepBody}>{st.body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className={s.promiseWrap} data-reveal="fade">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={s.promiseArt} src="/marketing/renders/fefco-0201.720w.webp" alt="" width={720} height={480} loading="lazy" decoding="async" />
              <figure className={s.promise} style={{ margin: 0 }}>
                <p className={s.promiseEyebrow}>{c.promiseEyebrow}</p>
                <blockquote className={s.promiseQuote} style={{ margin: 0 }}>
                  {c.promiseQuote}
                </blockquote>
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
            </div>
          </div>
        </div>
      </section>

      {/* W7 closing CTA */}
      <section className={`${s.sheet} ${s.dark} ${s.close}`} aria-labelledby="why-close">
        <div className={s.container} data-reveal>
          <h2 id="why-close" className={s.h2}>
            {c.closeTitle}
          </h2>
          <div className={s.pills}>
            <Link href={start} className={s.pill}>
              {c.ctaStart}
            </Link>
            <Link href={pricingHref} className={`${s.pill} ${s.pillOutline}`}>
              {c.ctaPricing}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
