/* eslint-disable @next/next/no-img-element -- local pre-sized /marketing renders with hand-written srcset and AVIF (see HeroImage); next/image would re-encode them. */
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Box, FileDown, Link2, PackageCheck, RefreshCw, Rotate3d } from "lucide-react";
import { pick, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { getT } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { vatOf } from "@/lib/pricing/money";
import { MODELS } from "@/lib/library";
import { DESIGN_FINISH_CODES, type StructureCode } from "@/types";
import { designHref } from "@/components/store/catalog";
import { getPriceFrom, listStructures, listVendors } from "@/components/store/data";
import { HeroImage } from "@/components/marketing/HeroImage";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Display, Lead } from "@/components/marketing/kit/Display";
import { Pill } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Collage, type CollageItem } from "@/components/marketing/kit/Collage";
import { PinnedScale } from "@/components/marketing/kit/PinnedScale";
import { CardFan } from "@/components/marketing/kit/CardFan";
import { Bento, BentoCard } from "@/components/marketing/kit/Bento";
import { Glow } from "@/components/marketing/kit/Glow";
import { PhoneSignup } from "@/components/marketing/kit/PhoneSignup";
import { renderDims, renderSrc, srcSetFor } from "@/components/marketing/assets";
import { fill, startCopy } from "@/components/marketing/start/copy";
import s from "@/components/marketing/start/start.module.css";

type Props = { params: Promise<{ locale: string }> };

/** Prerendered; prices and counts refresh hourly with the rest of the catalogue. */
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const c = startCopy(locale);
  const t = getT(locale);
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `/${locale}/start`, languages: { ar: "/ar/start", en: "/en/start" } },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: `${siteUrl()}/${locale}/start`,
      siteName: t("meta.siteName"),
      locale: locale === "ar" ? "ar_EG" : "en_EG",
      type: "website",
      images: ["/marketing/renders/fefco-0427.webp"],
    },
  };
}

/**
 * Hero collage around the centre render: sample tiles at different parallax depths (kit Collage,
 * logical x so it mirrors in Arabic). Decorative (alt=""): the headline and chips carry the meaning.
 */
const PIECES: { src: string; x: string; y: string; w: string; depth: number; rotate: number; hideOnPhone?: boolean }[] = [
  { src: "/marketing/samples/sample-05.webp", x: "68%", y: "6%", w: "12%", depth: 0.8, rotate: -6 },
  { src: "/marketing/samples/sample-02.webp", x: "18%", y: "4%", w: "11%", depth: 0.4, rotate: 5 },
  { src: "/marketing/samples/sample-04.webp", x: "30%", y: "66%", w: "9%", depth: 0.6, rotate: 4, hideOnPhone: true },
  { src: "/marketing/samples/sample-09.webp", x: "72%", y: "64%", w: "8%", depth: 1, rotate: -4 },
  { src: "/marketing/samples/sample-07.webp", x: "4%", y: "62%", w: "9%", depth: 0.3, rotate: -3, hideOnPhone: true },
];

/** Card fan: sample designs for made-up brands (each card says so). Same order as copy.fan.brands. */
const FAN = [
  { src: "/marketing/samples/sample-01.webp", structure: "FEFCO_0427" },
  { src: "/marketing/samples/sample-03.webp", structure: "PIZZA" },
  { src: "/marketing/samples/sample-04.webp", structure: "ECMA_RTE" },
  { src: "/marketing/samples/sample-05.webp", structure: "RIGID_BOX" },
  { src: "/marketing/samples/sample-07.webp", structure: "GABLE_BOX" },
  { src: "/marketing/samples/sample-10.webp", structure: "ECMA_STE" },
] as const satisfies readonly { src: string; structure: StructureCode }[];

const SIDE_STYLES: StructureCode[] = ["RIGID_BOX", "PIZZA", "FEFCO_0201", "GABLE_BOX"];

const FINISH_KEYS = ["foil", "spotUv", "emboss", "softTouch", "window"] as const;

const QTYS = [100, 500, 1000];

export default async function StartPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const c = startCopy(locale);
  const [structures, vendors, mailer] = await Promise.all([
    listStructures(),
    listVendors(),
    getPriceFrom("FEFCO_0427", { L: 250, W: 180, H: 80 }),
  ]);
  const design = designHref(locale, { structure: "FEFCO_0427" });
  const structureName = (code: StructureCode) => {
    const x = structures.find((v) => v.code === code);
    return x ? pick(locale, x.name.ar, x.name.en) : t(`structures.${code}` as DictKey);
  };
  const money = (p: number) => formatMoney(p, locale, { alwaysDecimals: true });
  const rows = QTYS.map((q) => mailer.rows.find((r) => r.quantity === q)).filter((r): r is NonNullable<typeof r> => !!r);
  const row500 = rows.find((r) => r.quantity === 500) ?? rows[0];
  const stats = [
    { n: MODELS.length, label: c.bento.stats.models },
    { n: DESIGN_FINISH_CODES.length, label: c.bento.stats.finishes },
    { n: vendors.length, label: c.bento.stats.printers },
  ];
  const heroSrc = renderSrc("FEFCO_0427");
  const heroDims = renderDims(heroSrc);
  const designerSrc = `/marketing/designer-${locale}.webp`;

  const tile = (src: string, sizes: string) => (
    <img src={src} srcSet={srcSetFor(src)} sizes={sizes} width={640} height={800} loading="lazy" decoding="async" fetchPriority="low" alt="" className={s.tileImg} />
  );
  const collage: CollageItem[] = [
    ...PIECES.map((p) => ({ media: tile(p.src, "180px"), x: p.x, y: p.y, w: p.w, depth: p.depth, rotate: p.rotate, hideOnPhone: p.hideOnPhone })),
    ...(row500
      ? [
          {
            media: (
              <div className={s.chip}>
                <span className={s.chipIcon} aria-hidden="true"><Box size={16} /></span>
                <span>
                  <strong className={s.num}>{fill(c.hero.chipPrice, { price: money(row500.unitPiasters) })}</strong>
                  <span className={s.chipNote}>{c.hero.chipPriceNote}</span>
                </span>
              </div>
            ),
            x: "2%",
            y: "28%",
            w: "auto",
            depth: 1,
            front: true,
          },
        ]
      : []),
    {
      media: (
        <div className={s.chip}>
          <span className={s.chipIcon} aria-hidden="true"><Rotate3d size={16} /></span>
          <span>
            <strong>{c.hero.chipProof}</strong>
            <span className={s.chipNote}>{c.hero.chipProofNote}</span>
          </span>
        </div>
      ),
      x: "62%",
      y: "80%",
      w: "auto",
      depth: 0.7,
      front: true,
      hideOnPhone: true,
    },
  ];

  return (
    <div className={s.page} data-locale={locale}>
      {/* ───────── 1 · Hero: giant split headline around the box collage ───────── */}
      <Sheet tone="dark" hero pad="none" container={false} className={s.hero} aria-labelledby="start-title">
        <div className={s.heroStage}>
          <Collage items={collage} height="min(64svh, 640px)" travel={120} className={s.collage}>
            <div className={s.heroCenter}>
              <HeroImage src={heroSrc} sizes="(max-width: 720px) 72vw, 480px" alt={c.hero.heroAlt} width={heroDims.width} height={heroDims.height} className={s.heroImg} />
            </div>
          </Collage>
          <HeroTitle id="start-title" size="hero" lines={[c.hero.word1, c.hero.word2]} className={s.heroTitle} />
        </div>
        <div className={s.heroFoot}>
          <p className={s.heroSub}>{c.hero.sub}</p>
          <Pill href={design}>{c.hero.cta}</Pill>
        </div>
      </Sheet>

      {/* ───────── 2 · Choose your box: pinned card that grows into the designer ───────── */}
      <section className={s.choose} aria-labelledby="choose-title">
        <Reveal as="header" className={s.head}>
          <Display id="choose-title" size="56" align="center">{c.choose.title}</Display>
          <Lead align="center">{c.choose.sub}</Lead>
        </Reveal>
        <PinnedScale
          from={0.5}
          length="190vh"
          className={s.pin}
          media={
            <>
              <span className={s.liveTag}>
                <span className={s.liveDot} aria-hidden="true" />
                {c.choose.live}
              </span>
              <img src={designerSrc} srcSet={srcSetFor(designerSrc)} sizes="100vw" width={1440} height={900} loading="lazy" decoding="async" alt={c.choose.previewAlt} className={s.pinImg} />
            </>
          }
        />
        <div className={s.pinFoot}>
          <Pill href={design}>
            {c.choose.cta}
            <ArrowRight size={18} aria-hidden="true" className={s.flip} />
          </Pill>
          <span className={s.muted}>{fill(c.choose.count, { count: formatNumber(MODELS.length) })}</span>
        </div>
        <ul className={s.styles} aria-label={c.choose.stylesLabel}>
          {SIDE_STYLES.map((code) => {
            const src = renderSrc(code);
            const d = renderDims(src);
            return (
              <li key={code} className={s.styleTile}>
                <img src={src} srcSet={srcSetFor(src)} sizes="200px" width={d.width} height={d.height} loading="lazy" decoding="async" alt="" />
                <span>{structureName(code)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ───────── 3 · Make your packaging shine: finishes and 3D ───────── */}
      <section className={s.band} aria-labelledby="shine-title">
        <Reveal as="header" className={s.head}>
          <Display id="shine-title" size="56" align="center">{c.shine.title}</Display>
          <Lead align="center">{c.shine.sub}</Lead>
        </Reveal>
        <Reveal variant="scale" className={s.stage}>
          <Glow color="violet" size="min(640px, 90vw)" />
          <figure className={s.shineCard}>
            <img src={renderSrc("RIGID_BOX")} srcSet={srcSetFor(renderSrc("RIGID_BOX"))} sizes="(max-width: 720px) 80vw, 460px" {...renderDims(renderSrc("RIGID_BOX"))} loading="lazy" decoding="async" alt={c.shine.alt} />
            <span className={s.toolChip}>
              <Rotate3d size={14} aria-hidden="true" />
              {c.shine.chip}
            </span>
          </figure>
        </Reveal>
        <ul className={s.finishes} aria-label={fill(c.shine.count, { count: DESIGN_FINISH_CODES.length })}>
          {FINISH_KEYS.map((k) => (
            <li key={k} className={`${s.finish} ${s[`fin_${k}`]}`}>
              <span className={s.swatch} aria-hidden="true" />
              {c.shine.finishes[k]}
            </li>
          ))}
        </ul>
      </section>

      {/* ───────── 4 · Get paid: real engine prices in a checkout preview ───────── */}
      <section className={s.band} aria-labelledby="paid-title">
        <Reveal as="header" className={s.head}>
          <Display id="paid-title" size="56" align="center">{c.paid.title}</Display>
          <Lead align="center">{c.paid.sub}</Lead>
        </Reveal>
        <Reveal className={s.stage}>
          <Glow color="navy" size="min(620px, 90vw)" />
          <article className={s.checkout} aria-labelledby="paid-card-title">
            <div className={s.coItem}>
              <img src={renderSrc("FEFCO_0427")} srcSet={srcSetFor(renderSrc("FEFCO_0427"))} sizes="72px" width={914} height={608} loading="lazy" decoding="async" alt="" />
              <div>
                <h3 id="paid-card-title" className={s.coTitle}>{c.paid.cardTitle}</h3>
                <p className={s.coMeta}>{c.paid.item}</p>
              </div>
            </div>
            {rows.length ? (
              <table className={s.coTable}>
                <thead>
                  <tr>
                    <th scope="col">{c.paid.qty}</th>
                    <th scope="col">{c.paid.unit}</th>
                    <th scope="col">{c.paid.subtotal}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.quantity} aria-current={r.quantity === row500?.quantity ? "true" : undefined}>
                      <th scope="row" className={s.num}>{fill(c.paid.pieces, { count: formatNumber(r.quantity) })}</th>
                      <td className={s.num}>{money(r.unitPiasters)}</td>
                      <td className={s.num}>{money(r.subtotalPiasters)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={s.coMeta}>{c.paid.noPrice}</p>
            )}
            {row500 ? (
              <dl className={s.coSum}>
                <div>
                  <dt>{c.paid.vat}</dt>
                  <dd className={s.num}>{money(vatOf(row500.subtotalPiasters, 0.14))}</dd>
                </div>
                <div className={s.coTotal}>
                  <dt>{c.paid.total} · {fill(c.paid.pieces, { count: formatNumber(row500.quantity) })}</dt>
                  <dd className={s.num}>{money(row500.subtotalPiasters + vatOf(row500.subtotalPiasters, 0.14))}</dd>
                </div>
                <div>
                  <dt>{c.paid.pay}</dt>
                  <dd>{c.paid.methods}</dd>
                </div>
              </dl>
            ) : null}
            {row500 ? <p className={s.coMeta}>{fill(c.paid.delivery, { days: formatNumber(row500.deliveryDays) })}</p> : null}
            <Pill href={design} variant="dark" className={s.coCta}>
              {c.choose.cta}
            </Pill>
          </article>
          <div className={s.notify}>
            <span className={s.chipIcon} aria-hidden="true"><BadgeCheck size={16} /></span>
            <span>
              <strong>{c.paid.status}</strong>
              <span className={s.chipNote}>{c.paid.statusNote}</span>
            </span>
          </div>
        </Reveal>
      </section>

      {/* ───────── 5 · Card fan of SAMPLE brand boxes (each card says so) ───────── */}
      <section className={s.fanBand} aria-labelledby="fan-title">
        <Reveal as="header" className={s.head}>
          <Display id="fan-title" size="64" align="center">{c.fan.title}</Display>
          <Lead align="center">{c.fan.sub}</Lead>
        </Reveal>
        <CardFan
          aria-label={c.fan.listLabel}
          width={220}
          tilt={5}
          height={520}
          className={s.fan}
          cards={[
            ...FAN.map((f, i) => ({
              media: (
                <>
                  <img src={f.src} srcSet={srcSetFor(f.src)} sizes="240px" width={640} height={800} loading="lazy" decoding="async" alt={fill(c.hero.pieceAlt, { name: structureName(f.structure) })} />
                  <span className={s.fanBadge}>{c.fan.badge}</span>
                </>
              ),
              label: (
                <span className={s.fanName}>
                  {c.fan.brands[i]}
                  <span className={s.fanStyle}>{structureName(f.structure)}</span>
                </span>
              ),
            })),
            {
              media: (
                <div className={s.fanYours}>
                  <strong className={s.fanYoursTitle}>{c.fan.yours}</strong>
                  <span>{c.fan.yoursBody}</span>
                  <Pill href={design} size="sm">
                    {c.fan.yoursCta}
                    <ArrowRight size={16} aria-hidden="true" className={s.flip} />
                  </Pill>
                </div>
              ),
            },
          ]}
        />
      </section>

      {/* ───────── 6 · Light bento: start, then grow ───────── */}
      <Sheet tone="white" aria-labelledby="bento-title">
        <Reveal as="header" className={s.head}>
          <Display id="bento-title" size="64" align="center">{c.bento.title}</Display>
        </Reveal>
        <Bento cols={2} row={360} className={s.bento}>
          <BentoCard
            tone="grey"
            title={c.bento.share.title}
            body={c.bento.share.body}
            media={
              <div className={s.mock} aria-hidden="true">
                <span className={s.mockLink}>
                  <Link2 size={16} />
                  <span dir="ltr">{c.bento.linkLabel}</span>
                </span>
                <img src={renderSrc("ECMA_RTE")} srcSet={srcSetFor(renderSrc("ECMA_RTE"))} sizes="140px" {...renderDims(renderSrc("ECMA_RTE"))} loading="lazy" decoding="async" alt="" className={s.mockImg} />
              </div>
            }
          />
          <BentoCard
            tone="grey"
            title={c.bento.export.title}
            body={c.bento.export.body}
            media={
              <div className={s.mock} aria-hidden="true">
                <span className={s.mockFile}>
                  <FileDown size={22} />
                  <span dir="ltr">{c.bento.pdfName}</span>
                </span>
                <svg className={s.dieline} viewBox="0 0 200 120" aria-hidden="true">
                  <path d="M40 10h120v100H40z M40 40h120 M40 80h120 M10 40h30v40H10z M160 40h30v40h-30z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4" />
                </svg>
              </div>
            }
          />
          <BentoCard
            tone="grey"
            title={c.bento.sample.title}
            body={c.bento.sample.body}
            media={
              <div className={s.mock} aria-hidden="true">
                <img src="/marketing/samples/sample-08.webp" srcSet={srcSetFor("/marketing/samples/sample-08.webp")} sizes="160px" width={640} height={800} loading="lazy" decoding="async" alt="" className={s.mockSample} />
                <span className={s.mockQty}>
                  <PackageCheck size={16} />
                  {c.bento.sampleQty}
                </span>
              </div>
            }
          />
          <BentoCard
            tone="grey"
            title={c.bento.reorder.title}
            body={c.bento.reorder.body}
            media={
              <div className={s.mock} aria-hidden="true">
                <span className={s.mockOrder}>
                  <img src={renderSrc("FEFCO_0201")} srcSet={srcSetFor(renderSrc("FEFCO_0201"))} sizes="64px" {...renderDims(renderSrc("FEFCO_0201"))} loading="lazy" decoding="async" alt="" />
                  <span className={s.mockBtn}>
                    <RefreshCw size={14} />
                    {c.bento.reorderCta}
                  </span>
                </span>
              </div>
            }
          />
          <BentoCard span={2} tone="dark" title={c.bento.statsTitle} className={s.statsCard}>
            <dl className={s.stats}>
              {stats.map((x) => (
                <div key={x.label}>
                  <dt>{x.label}</dt>
                  <dd className={s.num}>{formatNumber(x.n)}</dd>
                </div>
              ))}
            </dl>
          </BentoCard>
        </Bento>
      </Sheet>

      {/* ───────── 7 · Closing CTA with phone sign-up (kit PhoneSignup = HeroPhoneForm logic) ───────── */}
      <Sheet tone="dark" container="narrow" aria-labelledby="closing-title">
        <Reveal className={s.closingInner}>
          <span className={s.mark} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" focusable="false">
              <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" fill="#fff" />
              <path d="M3 7l9 4.5L21 7M12 11.5V21.5" fill="none" stroke="#02090a" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </span>
          <Display id="closing-title" size="56" align="center">{c.closing.title}</Display>
          <ol className={s.steps}>
            {c.closing.steps.map((step, i) => (
              <li key={step}>
                {i > 0 ? <ArrowRight size={18} aria-hidden="true" className={s.flip} /> : null}
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <PhoneSignup
            designPath={design}
            align="center"
            className={s.signup}
            labels={{ label: c.closing.label, placeholder: c.closing.placeholder, submit: c.closing.submit, error: c.closing.error, fine: c.closing.fine }}
          />
        </Reveal>
      </Sheet>
    </div>
  );
}
