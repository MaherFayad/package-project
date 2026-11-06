/* eslint-disable @next/next/no-img-element -- local pre-sized /marketing renders with hand-written srcset and AVIF (see HeroImage); next/image would re-encode them. */
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ArrowRight, BadgeCheck, Box, FileDown, Link2, PackageCheck, RefreshCw, Rotate3d, Sparkles } from "lucide-react";
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
import { HeroPhoneForm } from "@/components/marketing/HeroPhoneForm";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Display, Lead } from "@/components/marketing/kit/Display";
import { Pill } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { renderDims, renderSrc, srcSetFor } from "@/components/marketing/assets";
import { StartMotion } from "@/components/marketing/start/StartMotion";
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

/** Hero collage around the centre render: sample tiles and chips at different parallax depths. */
const PIECES: { src: string; cls: string; depth: number; rot: number }[] = [
  { src: "/marketing/samples/sample-05.webp", cls: "p1", depth: 1.4, rot: -6 },
  { src: "/marketing/samples/sample-02.webp", cls: "p2", depth: 0.7, rot: 5 },
  { src: "/marketing/samples/sample-04.webp", cls: "p3", depth: 1.1, rot: 4 },
  { src: "/marketing/samples/sample-09.webp", cls: "p4", depth: 1.8, rot: -4 },
  { src: "/marketing/samples/sample-07.webp", cls: "p5", depth: 0.5, rot: -3 },
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

  return (
    <div className={s.page} data-locale={locale}>
      <StartMotion />

      {/* Collage pieces are decorative (alt=""): the headline and chips carry the meaning. */}
      {/* ───────── 1 · Hero: giant split headline around the box collage ───────── */}
      <Sheet tone="dark" hero pad="none" container={false} className={s.hero} aria-labelledby="start-title">
        <div className={s.heroBody} data-sp="view">
        <div className={s.heroStage}>
          <div className={s.collage}>
            <div className={s.heroCenter} style={{ "--depth": 0.25 } as CSSProperties}>
              <HeroImage
                src={heroSrc}
                sizes="(max-width: 720px) 72vw, 520px"
                alt={c.hero.heroAlt}
                width={heroDims.width}
                height={heroDims.height}
                className={s.heroImg}
              />
            </div>
            {PIECES.map((p) => (
              <div key={p.cls} className={`${s.piece} ${s[p.cls]}`} style={{ "--depth": p.depth, "--rot": `${p.rot}deg` } as CSSProperties}>
                <img
                  src={p.src}
                  srcSet={srcSetFor(p.src)}
                  sizes="180px"
                  width={640}
                  height={800}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  alt=""
                />
              </div>
            ))}
            {row500 ? (
              <div className={`${s.chip} ${s.chipPrice}`} style={{ "--depth": 2.1 } as CSSProperties}>
                <span className={s.chipIcon} aria-hidden="true"><Box size={16} /></span>
                <span>
                  <strong className={s.num}>{fill(c.hero.chipPrice, { price: money(row500.unitPiasters) })}</strong>
                  <span className={s.chipNote}>{c.hero.chipPriceNote}</span>
                </span>
              </div>
            ) : null}
            <div className={`${s.chip} ${s.chipProof}`} style={{ "--depth": 1.6 } as CSSProperties}>
              <span className={s.chipIcon} aria-hidden="true"><Rotate3d size={16} /></span>
              <span>
                <strong>{c.hero.chipProof}</strong>
                <span className={s.chipNote}>{c.hero.chipProofNote}</span>
              </span>
            </div>
          </div>
          <h1 id="start-title" className={s.heroTitle}>
            <span className={`${s.heroWord} ${s.word1}`}>{c.hero.word1}</span>{" "}
            <span className={`${s.heroWord} ${s.word2}`}>{c.hero.word2}</span>
          </h1>
        </div>
        <div className={s.heroFoot}>
          <p className={s.heroSub}>{c.hero.sub}</p>
          <Pill href={design}>{c.hero.cta}</Pill>
        </div>
        </div>
      </Sheet>

      {/* ───────── 2 · Choose your box: pinned card that grows into the designer ───────── */}
      <section className={s.choose} aria-labelledby="choose-title">
        <div className={s.pinRun} data-sp="pin">
          <div className={s.pinStick}>
            <header className={s.head}>
              <Display id="choose-title" size="56" align="center">{c.choose.title}</Display>
              <Lead align="center">{c.choose.sub}</Lead>
            </header>
            <div className={s.pinStage}>
              {SIDE_STYLES.map((code, i) => {
                const src = renderSrc(code);
                const d = renderDims(src);
                return (
                  <figure key={code} className={`${s.side} ${s[`side${i}`]}`}>
                    <img src={src} srcSet={srcSetFor(src)} sizes="240px" width={d.width} height={d.height} loading="lazy" decoding="async" alt={fill(c.choose.styleAlt, { name: structureName(code) })} />
                    <figcaption>{structureName(code)}</figcaption>
                  </figure>
                );
              })}
              <div className={s.pinCard}>
                <span className={s.liveTag}>
                  <span className={s.liveDot} aria-hidden="true" />
                  {c.choose.live}
                </span>
                <img
                  src={designerSrc}
                  srcSet={srcSetFor(designerSrc)}
                  sizes="(max-width: 720px) 100vw, 1100px"
                  width={1440}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  alt={c.choose.previewAlt}
                  className={s.pinImg}
                />
              </div>
            </div>
            <div className={s.pinFoot}>
              <Pill href={design}>
                {c.choose.cta}
                <ArrowRight size={18} aria-hidden="true" className={s.flip} />
              </Pill>
              <span className={s.muted}>{fill(c.choose.count, { count: formatNumber(MODELS.length) })}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── 3 · Make your packaging shine: finishes and 3D ───────── */}
      <section className={s.band} aria-labelledby="shine-title">
        <Reveal as="header" className={s.head}>
          <Display id="shine-title" size="56" align="center">{c.shine.title}</Display>
          <Lead align="center">{c.shine.sub}</Lead>
        </Reveal>
        <Reveal variant="scale" className={s.shineStage}>
          <div className={s.glow} aria-hidden="true" />
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
        <Reveal className={s.paidStage}>
          <div className={s.glowBlue} aria-hidden="true" />
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

      {/* ───────── 5 · Card fan of SAMPLE brand boxes ───────── */}
      <section className={s.fanBand} aria-labelledby="fan-title">
        <Reveal as="header" className={s.head}>
          <Display id="fan-title" size="64" align="center">{c.fan.title}</Display>
          <Lead align="center">{c.fan.sub}</Lead>
        </Reveal>
        <div className={s.fanWrap} data-sp="view">
          <ul className={s.fan} aria-label={c.fan.listLabel}>
            {FAN.map((f, i) => (
              <li key={f.src} className={s.fanCard} style={{ "--i": i - (FAN.length) / 2 } as CSSProperties}>
                <img src={f.src} srcSet={srcSetFor(f.src)} sizes="260px" width={640} height={800} loading="lazy" decoding="async" alt={fill(c.hero.pieceAlt, { name: structureName(f.structure) })} />
                <span className={s.fanBadge}>{c.fan.badge}</span>
                <span className={s.fanName}>
                  {c.fan.brands[i]}
                  <span className={s.fanStyle}>{structureName(f.structure)}</span>
                </span>
              </li>
            ))}
            <li className={`${s.fanCard} ${s.fanYours}`} style={{ "--i": FAN.length / 2 } as CSSProperties}>
              <strong className={s.fanYoursTitle}>{c.fan.yours}</strong>
              <span>{c.fan.yoursBody}</span>
              <Pill href={design} size="sm">
                {c.fan.yoursCta}
                <ArrowRight size={16} aria-hidden="true" className={s.flip} />
              </Pill>
            </li>
          </ul>
        </div>
      </section>

      {/* ───────── 6 · Light bento: start, then grow ───────── */}
      <Sheet tone="white" container={false} className={s.sheet} aria-labelledby="bento-title">
        <div className={s.sheetInner}>
          <Reveal as="header" className={s.head}>
            <Display id="bento-title" size="64" align="center">{c.bento.title}</Display>
          </Reveal>
          <div className={s.bento}>
            <Reveal as="article" className={s.tile}>
              <div className={s.mock} aria-hidden="true">
                <div className={s.mockLink}>
                  <Link2 size={16} />
                  <span dir="ltr">{c.bento.linkLabel}</span>
                </div>
                <img src={renderSrc("ECMA_RTE")} srcSet={srcSetFor(renderSrc("ECMA_RTE"))} sizes="140px" {...renderDims(renderSrc("ECMA_RTE"))} loading="lazy" decoding="async" alt="" className={s.mockImg} />
              </div>
              <h3 className={s.tileTitle}>{c.bento.share.title}</h3>
              <p className={s.tileBody}>{c.bento.share.body}</p>
            </Reveal>
            <Reveal as="article" className={s.tile}>
              <div className={s.mock} aria-hidden="true">
                <div className={s.mockFile}>
                  <FileDown size={22} />
                  <span dir="ltr">{c.bento.pdfName}</span>
                </div>
                <svg className={s.dieline} viewBox="0 0 200 120" aria-hidden="true">
                  <path d="M40 10h120v100H40z M40 40h120 M40 80h120 M10 40h30v40H10z M160 40h30v40h-30z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4" />
                </svg>
              </div>
              <h3 className={s.tileTitle}>{c.bento.export.title}</h3>
              <p className={s.tileBody}>{c.bento.export.body}</p>
            </Reveal>
            <Reveal as="article" className={s.tile}>
              <div className={s.mock} aria-hidden="true">
                <img src="/marketing/samples/sample-08.webp" srcSet={srcSetFor("/marketing/samples/sample-08.webp")} sizes="160px" width={640} height={800} loading="lazy" decoding="async" alt="" className={s.mockSample} />
                <span className={s.mockQty}>
                  <PackageCheck size={16} />
                  {c.bento.sampleQty}
                </span>
              </div>
              <h3 className={s.tileTitle}>{c.bento.sample.title}</h3>
              <p className={s.tileBody}>{c.bento.sample.body}</p>
            </Reveal>
            <Reveal as="article" className={s.tile}>
              <div className={s.mock} aria-hidden="true">
                <div className={s.mockOrder}>
                  <img src={renderSrc("FEFCO_0201")} srcSet={srcSetFor(renderSrc("FEFCO_0201"))} sizes="64px" {...renderDims(renderSrc("FEFCO_0201"))} loading="lazy" decoding="async" alt="" />
                  <span className={s.mockBtn}>
                    <RefreshCw size={14} />
                    {c.bento.reorderCta}
                  </span>
                </div>
              </div>
              <h3 className={s.tileTitle}>{c.bento.reorder.title}</h3>
              <p className={s.tileBody}>{c.bento.reorder.body}</p>
            </Reveal>
          </div>
          <Reveal className={s.statsCard}>
            <h3 className={s.statsTitle}>
              <Sparkles size={18} aria-hidden="true" />
              {c.bento.statsTitle}
            </h3>
            <dl className={s.stats}>
              {stats.map((x) => (
                <div key={x.label}>
                  <dt>{x.label}</dt>
                  <dd className={s.num}>{formatNumber(x.n)}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Sheet>

      {/* ───────── 7 · Closing CTA with phone sign-up ───────── */}
      <Sheet tone="dark" container={false} className={s.closing} aria-labelledby="closing-title">
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
          <div className={s.closingForm}>
            <HeroPhoneForm
              locale={locale}
              designPath={design}
              labels={{
                label: c.closing.label,
                placeholder: c.closing.placeholder,
                submit: c.closing.submit,
                error: c.closing.error,
                fine: c.closing.fine,
              }}
            />
          </div>
        </Reveal>
      </Sheet>
    </div>
  );
}
