import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Check, FileCheck2, ReceiptText, Rotate3d, ShieldCheck, Truck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { formatDimsCm } from "@/lib/orders/box-name";
import { designHref } from "@/components/store/catalog";
import { JsonLd } from "@/components/store/JsonLdScript";
import { faqJsonLd } from "@/components/store/jsonld";
import { startHref } from "@/components/marketing/MarketingHeader";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { SectionHead, Stack } from "@/components/marketing/kit/SectionHead";
import { Grid } from "@/components/marketing/kit/Grid";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { whyCopy } from "@/components/marketing/why/copy";
import { loadWhyFacts } from "@/components/marketing/why/server";
import { VatToggle } from "@/components/marketing/why/VatToggle";
import { Faq } from "@/components/marketing/kit/Faq";
import type { PriceTier } from "@/components/marketing/why/pricing-facts";
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
  const c = whyCopy(locale).pricing;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `/${locale}/pricing`, languages: { ar: "/ar/pricing", en: "/en/pricing" } },
    openGraph: { title: c.metaTitle, description: c.metaDescription, url: `${siteUrl()}/${locale}/pricing`, images: ["/marketing/renders/fefco-0427.webp"] },
  };
}

/** Order bands shown as cards (every quantity is in the comparison table). */
const CARD_QTYS = [100, 500, 2000] as const;
const INCLUDED_ICONS = [Rotate3d, FileCheck2, ShieldCheck, ReceiptText, Truck];

export default async function PricingPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const all = whyCopy(locale);
  const c = all.pricing;
  const u = all.units;
  const { pricing: f } = await loadWhyFacts();
  const money = (v: number, unit = false) => formatMoney(v, locale, { alwaysDecimals: unit });
  const refStart = f ? designHref(locale, { structure: f.box.code, dims: f.box.dims, material: f.box.material }) : startHref(locale);
  // R3-06: the size in cm, as on the box page, kept on one line so it never wraps out of order.
  const boxName = f ? `${t(`structures.${f.box.code}` as DictKey)} ${formatDimsCm(f.box.dims, locale).replace(/ /g, "\u00a0")}` : "";
  const pct = `${formatNumber(f?.prepayDiscountPct ?? 0, 1)}%`;
  const cards = f ? CARD_QTYS.map((q) => f.tiers.find((x) => x.quantity === q)).filter((x): x is PriceTier => !!x) : [];
  const faq = c.faq({
    max: formatNumber(f?.maxInstantQty ?? 2000),
    pct,
    pieces: formatNumber(f?.sample?.pieces ?? 5),
    days: u.days(f?.sample?.creditDays ?? 60),
    hours: u.hours(f?.quoteValidityHours ?? 72),
    min: formatNumber(f?.minOrderQty ?? 1),
  });
  const yes = (
    <>
      <Check size={18} className={s.tick} aria-hidden />
      <span className={s.srOnly}>{c.included1}</span>
    </>
  );
  const span = (f?.tiers.length ?? 0) + 2;

  return (
    <div className={s.page}>
      <JsonLd data={faqJsonLd(faq)} />

      {/* P1 hero, P2 VAT toggle, P3 tier cards */}
      <Sheet tone="dark" hero className={s.pricingHero} aria-labelledby="pricing-h1">
        <SectionHead as="h1" size="64" align="center" id="pricing-h1" title={c.title} sub={f ? c.sub(boxName, pct) : undefined}>
          {f ? (
            <VatToggle
              label={c.vatToggle}
              excl={c.vatExcl}
              incl={c.vatIncl}
              aside={
                <a href="#compare" className={s.compareLink}>
                  {c.compareLink}
                </a>
              }
            >
              <Grid as="ul" cols={4} colsMd={2} className={s.list}>
                {cards.map((tier, i) => (
                  <li key={tier.quantity} className={s.tier} style={{ ["--m-i" as string]: i }} data-testid={`tier-${tier.quantity}`}>
                    {/* R1-15: a plain quantity, no plan names: the buyer is choosing how many boxes. */}
                    <div className={s.tierTop}>
                      <h2 className={s.tierName}>{c.boxes(formatNumber(tier.quantity))}</h2>
                    </div>
                    <p className={`${s.tierPrice} ${s.showIncl}`}>
                      <strong>{money(tier.unitInclVatPiasters, true)}</strong>
                      <span>{c.perBoxIncl}</span>
                    </p>
                    {/* R1-15: the same per-box basis as the home page and the box pages, to compare. */}
                    <p className={`${s.tierAlt} ${s.showIncl}`}>
                      {money(tier.unitPiasters, true)} {c.perBoxExcl}
                    </p>
                    <p className={`${s.tierPrice} ${s.showExcl}`}>
                      <strong>{money(tier.unitPiasters, true)}</strong>
                      <span>{c.perBoxExcl}</span>
                    </p>
                    <div className={s.tierTotals}>
                      {/* R2-08: the VAT-inclusive total is always in view (what checkout charges). */}
                      <p className={s.showExcl}>
                        {c.totalExcl} <strong data-testid="tier-subtotal">{money(tier.subtotalPiasters)}</strong>
                      </p>
                      <p>
                        {c.totalIncl} <strong data-testid="tier-total">{money(tier.totalPiasters)}</strong>
                      </p>
                      {/* R2-08: the ex-VAT discount, the same figure as the table row and the order's price details. */}
                      {tier.discountPiasters > 0 ? <p className={s.save}>{c.youSave(money(tier.discountPiasters), pct)}</p> : null}
                    </div>
                    <Pill href={refStart} variant="outline" className={s.tierCta}>
                      {c.tierCta}
                      <span className={s.srOnly}> {c.boxes(formatNumber(tier.quantity))}</span>
                    </Pill>
                    <ul className={s.feat}>
                      <li>
                        <Truck size={16} aria-hidden />
                        {c.deliveryIn(u.days(tier.deliveryDays))}
                      </li>
                    </ul>
                  </li>
                ))}
                <li className={s.tier} style={{ ["--m-i" as string]: cards.length }} data-testid="tier-wholesale">
                  <div className={s.tierTop}>
                    <h2 className={s.tierName}>{c.wholesaleQty(formatNumber(f.maxInstantQty))}</h2>
                  </div>
                  <p className={s.tierPrice}>
                    <strong>{c.wholesalePrice}</strong>
                  </p>
                  <div className={s.tierTotals}>
                    <p>{c.wholesaleBody}</p>
                  </div>
                  <Pill href={refStart} variant="outline" className={s.tierCta}>
                    {c.wholesaleCta}
                  </Pill>
                </li>
              </Grid>
            </VatToggle>
          ) : (
            <p className={s.unavailable} role="status">
              {c.unavailable}
            </p>
          )}
        </SectionHead>
      </Sheet>

      {/* P4 always included + P5 sample order */}
      <Sheet tone="dark-2" y="lg" aria-labelledby="pricing-included">
        <SectionHead size="44" id="pricing-included" title={c.includedTitle}>
          <Stack gap="head-content">
            <Grid as="ul" cols={5} colsMd={2} className={s.list}>
              {c.included.map((it, i) => {
                const I = INCLUDED_ICONS[i]!;
                return (
                  <Reveal as="li" key={it.title} index={i} className={s.inc}>
                    <I size={24} aria-hidden />
                    <h3 className={s.incTitle}>{it.title}</h3>
                    <p className={s.incBody}>{it.body}</p>
                  </Reveal>
                );
              })}
            </Grid>
            {f?.sample ? (
              <Reveal className={s.sample}>
                <div>
                  <span className={s.sampleBadge}>{c.sampleBadge}</span>
                  <h2 className={s.sampleTitle}>{c.sampleTitle}</h2>
                  <p className={s.sampleBody}>{c.sampleBody(formatNumber(f.sample.pieces), u.days(f.sample.creditDays))}</p>
                </div>
                <div>
                  <p className={s.sampleFig}>{money(f.sample.totalPiasters)}</p>
                  <p className={s.sampleMeta}>{c.sampleTotal}</p>
                  <p className={s.sampleMeta}>{c.sampleDelivery(u.days(f.sample.deliveryDays))}</p>
                  <PillRow className={s.sampleCta}>
                    <Pill href={refStart} variant="dark">
                      {c.tierCta}
                    </Pill>
                  </PillRow>
                </div>
              </Reveal>
            ) : null}
          </Stack>
        </SectionHead>
      </Sheet>

      {/* P7 comparison table */}
      {f ? (
        <Sheet tone="white" y="lg" id="compare" aria-labelledby="pricing-compare">
          <SectionHead size="44" id="pricing-compare" title={c.compareTitle} sub={<span aria-hidden="true">{c.compareCaption(boxName)}</span>}>
            <div className={s.tableWrap} role="region" aria-label={c.tableScroll} tabIndex={0}>
              <table className={s.table}>
                <caption className={s.srOnly}>{c.compareCaption(boxName)}</caption>
                <thead>
                  <tr>
                    <td />
                    {f.tiers.map((x) => (
                      <th key={x.quantity} scope="col">
                        {c.boxes(formatNumber(x.quantity))}
                      </th>
                    ))}
                    <th scope="col">
                      {c.wholesaleQty(formatNumber(f.maxInstantQty))}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <Group label={c.compareRows.group1} span={span} />
                  <Row label={c.compareRows.unit} cells={f.tiers.map((x) => money(x.unitPiasters, true))} tail={c.onRequest} />
                  {/* R2-08: one basis, ex-VAT, so the rows add up: list − discount = subtotal; + VAT = total. */}
                  <Row label={c.compareRows.list} cells={f.tiers.map((x) => money(x.listSubtotalPiasters, true))} tail={c.onRequest} />
                  <Row label={c.compareRows.discount(pct)} cells={f.tiers.map((x) => money(-x.discountPiasters))} tail={c.onRequest} />
                  <Row label={c.compareRows.subtotal} cells={f.tiers.map((x) => money(x.subtotalPiasters))} tail={c.onRequest} />
                  <Row label={c.compareRows.vat} cells={f.tiers.map((x) => money(x.vatPiasters))} tail={c.onRequest} />
                  <Row
                    label={c.compareRows.total}
                    cells={f.tiers.map((x) => (
                      <strong key={x.quantity}>{money(x.totalPiasters)}</strong>
                    ))}
                    tail={c.onRequest}
                  />
                  <Group label={c.compareRows.group2} span={span} />
                  <Row label={c.compareRows.setup} cells={f.tiers.map((x) => (x.setupPiasters ? money(x.setupPiasters) : c.none))} tail={c.onRequest} />
                  <Row label={c.compareRows.die} cells={f.tiers.map((x) => (x.diePiasters ? money(x.diePiasters) : c.none))} tail={c.onRequest} />
                  <Row label={c.compareRows.shipping} cells={f.tiers.map((x) => money(x.shippingPiasters))} tail={c.onRequest} />
                  <Group label={c.compareRows.group3} span={span} />
                  <Row label={c.compareRows.method} cells={f.tiers.map((x) => c.methods[x.method])} tail={c.onRequest} />
                  <Row label={c.compareRows.days} cells={f.tiers.map((x) => u.days(x.deliveryDays))} tail={c.onRequest} />
                  <Row label={c.compareRows.proof} cells={f.tiers.map(() => yes)} tail={yes} />
                  <Row label={c.compareRows.receipt} cells={f.tiers.map(() => yes)} tail={yes} />
                </tbody>
              </table>
            </div>
          </SectionHead>
        </Sheet>
      ) : null}

      {/* P8 FAQ */}
      <Sheet tone="dark" y="lg" id="faq" aria-labelledby="pricing-faq">
        <SectionHead size="44" id="pricing-faq" title={c.faqTitle}>
          <Faq items={faq} name="pricing-faq" />
        </SectionHead>
      </Sheet>

      {/* P9 closing CTA */}
      <Sheet tone="dark" y="xl" aria-labelledby="pricing-close">
        <Reveal>
          <SectionHead size="64" align="center" id="pricing-close" title={c.closeTitle} sub={c.closeSub} />
          <PillRow align="center">
            <Pill href={startHref(locale)} size="lg">
              {all.why.ctaStart}
            </Pill>
            <Pill href={`/${locale}/why-elba`} size="lg" variant="outline">
              {all.why.metaTitle}
            </Pill>
          </PillRow>
        </Reveal>
      </Sheet>
    </div>
  );
}

function Group({ label, span }: { label: string; span: number }) {
  return (
    <tr className={s.groupRow}>
      <th scope="colgroup" colSpan={span}>
        {label}
      </th>
    </tr>
  );
}

function Row({ label, cells, tail }: { label: string; cells: ReactNode[]; tail: ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {cells.map((x, i) => (
        <td key={i}>{x}</td>
      ))}
      <td>{tail}</td>
    </tr>
  );
}
