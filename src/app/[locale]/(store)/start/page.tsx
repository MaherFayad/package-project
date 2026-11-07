/* eslint-disable @next/next/no-img-element -- local pre-sized /marketing renders with hand-written srcset and AVIF (see HeroImage); next/image would re-encode them. */
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Box, FileDown, Link2, PackageCheck, RefreshCw, Rotate3d } from "lucide-react";
import { pick, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { getT } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { vatOf } from "@/lib/pricing/money";
import { DESIGN_FINISH_CODES, type StructureCode } from "@/types";
import { designHref } from "@/components/store/catalog";
import { getPriceFrom, listStructures } from "@/components/store/data";
import { preload } from "react-dom";
import { R6_CARDS, SAMPLE_LABEL } from "@/components/marketing/kit/assets";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { SectionHead, Stack } from "@/components/marketing/kit/SectionHead";
import { Grid } from "@/components/marketing/kit/Grid";
import { Pill } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { Collage, type CollageItem } from "@/components/marketing/kit/Collage";
import { PinnedScale } from "@/components/marketing/kit/PinnedScale";
import { CardFan } from "@/components/marketing/kit/CardFan";
import { Bento, BentoCard } from "@/components/marketing/kit/Bento";
import { Glow } from "@/components/marketing/kit/Glow";
import { renderDims, renderSrc, srcSetFor } from "@/components/marketing/assets";
import { fill, startCopy } from "@/components/marketing/start/copy";
import { daysWord } from "@/components/marketing/home/copy";
import { startHref } from "@/components/marketing/navModel";
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
 * Hero collage: transparent cutouts rendered from our own 3D engine (ASSETS session, public/marketing/r6),
 * at different parallax depths (kit Collage, logical x so it mirrors in Arabic). Decorative (alt=""):
 * the headline and chips carry the meaning. Sizes are the 1x files (400x400 cutouts, 600x900 cards).
 */
const R6 = "/marketing/r6";
const PIECES: { key: string; x: string; y: string; w: string; depth: number; rotate: number; hideOnPhone?: boolean }[] = [
  { key: "collage/rigid-box-high", x: "66%", y: "2%", w: "15%", depth: 0.8, rotate: -6 },
  { key: "collage/perfume-turn", x: "17%", y: "0%", w: "11%", depth: 0.4, rotate: 5 },
  { key: "collage/drawer-box-side", x: "28%", y: "64%", w: "13%", depth: 0.6, rotate: 4, hideOnPhone: true },
  { key: "collage/cup-turn", x: "74%", y: "62%", w: "11%", depth: 1, rotate: -4 },
  { key: "collage/pouch-turn", x: "2%", y: "58%", w: "11%", depth: 0.3, rotate: -3, hideOnPhone: true },
  { key: "collage/jar-high", x: "86%", y: "26%", w: "10%", depth: 0.5, rotate: 3, hideOnPhone: true },
];
const HERO_KEY = "collage/mailer-tilt";
/** Sample brand cards rendered so far (public/marketing/r6/cards). All fictional; each card is labelled as a sample. */
const FAN_IDS = new Set<string>(["nour", "attar", "halawa", "waraqa", "sahwa", "nada", "attar-perfume"]);

/** <picture> for an r6 still: AVIF then WebP, 1x / 2x. */
function R6Pic({ k, w, h, alt, sizes, className, priority = false }: { k: string; w: number; h: number; alt: string; sizes: string; className?: string; priority?: boolean }) {
  const set = (fmt: string) => `${R6}/${k}.${fmt} ${w}w, ${R6}/${k}@2x.${fmt} ${w * 2}w`;
  return (
    <picture style={{ display: "contents" }}>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <img
        src={`${R6}/${k}.webp`}
        srcSet={set("webp")}
        sizes={sizes}
        width={w}
        height={h}
        alt={alt}
        className={className}
        loading={priority ? undefined : "lazy"}
        decoding={priority ? undefined : "async"}
        fetchPriority={priority ? "high" : "low"}
      />
    </picture>
  );
}

const SIDE_STYLES: StructureCode[] = ["RIGID_BOX", "PIZZA", "FEFCO_0201", "GABLE_BOX"];

const FINISH_KEYS = ["foil", "spotUv", "emboss", "softTouch", "window"] as const;

const QTYS = [100, 500, 1000];

export default async function StartPage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const c = startCopy(locale);
  const [structures, mailer] = await Promise.all([
    listStructures(),
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
  // The centre cutout is the LCP image: preload its AVIF from <head> with the same srcset.
  const heroSizes = "(max-width: 767px) 74vw, 480px";
  preload(`${R6}/${HERO_KEY}.avif`, { as: "image", type: "image/avif", imageSrcSet: `${R6}/${HERO_KEY}.avif 400w, ${R6}/${HERO_KEY}@2x.avif 800w`, imageSizes: heroSizes, fetchPriority: "high" });
  const designerSrc = `/marketing/designer-${locale}.webp`;

  const collage: CollageItem[] = [
    ...PIECES.map((p) => ({ media: <R6Pic k={p.key} w={400} h={400} alt="" sizes="(max-width: 767px) 30vw, 200px" className={s.cutout} />, x: p.x, y: p.y, w: p.w, depth: p.depth, rotate: p.rotate, hideOnPhone: p.hideOnPhone })),
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
      x: "6%",
      y: "82%",
      w: "auto",
      depth: 0.7,
      front: true,
      hideOnPhone: true,
    },
  ];

  return (
    <div className={s.page} data-locale={locale}>
      {/* ───────── 1 · Hero: giant split headline around the box collage ───────── */}
      <Sheet tone="dark" hero aria-labelledby="start-title">
        <Stack gap="head-content">
        <div className={s.heroStage}>
          <Collage items={collage} height="min(64svh, 640px)" travel={120} className={s.collage}>
            <div className={s.heroCenter}>
              <R6Pic k={HERO_KEY} w={400} h={400} alt={c.hero.heroAlt} sizes={heroSizes} className={s.heroImg} priority />
            </div>
          </Collage>
          <HeroTitle id="start-title" size="hero" lines={[c.hero.word1, c.hero.word2]} className={s.heroTitle} />
        </div>
        <div className={s.heroFoot}>
          <p className={s.heroSub}>{c.hero.sub}</p>
          <Pill href={startHref(locale)}>{c.hero.cta}</Pill>
        </div>
        </Stack>
      </Sheet>

      {/* ───────── 2 · Choose your box: pinned card that grows into the designer ───────── */}
      <Sheet tone="dark" y="lg" aria-labelledby="choose-title">
        <SectionHead id="choose-title" title={c.choose.title} sub={c.choose.sub} align="center">
          <Stack gap="head-content">
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
              <picture style={{ display: "contents" }}>
                {/* Phones get the portrait phone frame of the designer (ASSETS ui/phone-designer). */}
                <source media="(max-width: 767px)" type="image/avif" srcSet={`${R6}/ui/phone-designer-${locale}.avif 498w, ${R6}/ui/phone-designer-${locale}@2x.avif 996w`} sizes="90vw" />
                <source media="(max-width: 767px)" type="image/webp" srcSet={`${R6}/ui/phone-designer-${locale}.webp 498w, ${R6}/ui/phone-designer-${locale}@2x.webp 996w`} sizes="90vw" />
                <img src={designerSrc} srcSet={srcSetFor(designerSrc)} sizes="100vw" width={1440} height={900} loading="lazy" decoding="async" alt={c.choose.previewAlt} className={s.pinImg} />
              </picture>
            </>
          }
        />
        <div className={s.pinFoot}>
          <Pill href={design}>
            {c.choose.cta}
            <ArrowRight size={18} aria-hidden="true" className={s.flip} />
          </Pill>
        </div>
        <Grid as="ul" cols={4} colsMd={4} colsSm={2} className={s.styles}>
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
        </Grid>
          </Stack>
        </SectionHead>
      </Sheet>

      {/* ───────── 3 · Make your packaging shine: finishes and 3D ───────── */}
      <Sheet tone="dark" y="lg" aria-labelledby="shine-title">
        <SectionHead id="shine-title" title={c.shine.title} sub={c.shine.sub} align="center">
          <Stack gap="head-content">
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
        </Stack>
        </SectionHead>
      </Sheet>

      {/* ───────── 4 · Get paid: real engine prices in a checkout preview ───────── */}
      <Sheet tone="dark" y="lg" aria-labelledby="paid-title">
        <SectionHead id="paid-title" title={c.paid.title} sub={c.paid.sub} align="center">
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
            {row500 ? <p className={s.coMeta}>{fill(c.paid.delivery, { days: formatNumber(row500.deliveryDays), daysWord: daysWord(locale, row500.deliveryDays) })}</p> : null}
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
        </SectionHead>
      </Sheet>

      {/* ───────── 5 · Card fan of SAMPLE brand boxes (each card says so) ───────── */}
      <Sheet tone="dark" y="lg" aria-labelledby="fan-title">
        <SectionHead id="fan-title" title={c.fan.title} sub={c.fan.sub} size="64" align="center">
        <CardFan
          aria-label={c.fan.listLabel}
          width={220}
          tilt={5}
          height={520}
          className={s.fan}
          cards={[
            ...R6_CARDS.filter((card) => FAN_IDS.has(card.id)).map((card) => ({
              media: (
                <>
                  <R6Pic k={`cards/${card.id}`} w={600} h={900} sizes="240px" alt={locale === "ar" ? `${card.nameAr}: ${card.ar} (${SAMPLE_LABEL.ar})` : `${card.name}: ${card.en} (${SAMPLE_LABEL.en})`} />
                  <span className={s.fanBadge}>{c.fan.badge}</span>
                </>
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
        </SectionHead>
      </Sheet>

      {/* ───────── 6 · Light bento: start, then grow ───────── */}
      <Sheet tone="white" y="lg" aria-labelledby="bento-title">
        <SectionHead id="bento-title" title={c.bento.title} size="64" align="center">
        <Bento cols={2} row={360} className={s.bento}>
          <BentoCard
            tone="grey"
            title={c.bento.share.title}
            body={c.bento.share.body}
            media={
              <div className={s.mock} aria-hidden="true">
                <span className={s.mockLink}>
                  <Link2 size={16} />
                  <span>{c.bento.linkLabel}</span>
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
                  <span>{c.bento.pdfName}</span>
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
        </Bento>
        </SectionHead>
      </Sheet>

      {/* ───────── 7 · Closing CTA: one link to the /boxes chooser. No phone field (R3-07): the price never needs a number. ───────── */}
      <Sheet tone="dark" y="xl" aria-labelledby="closing-title">
        <SectionHead
          id="closing-title"
          title={c.closing.title}
          align="center"
          eyebrow={
            <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false" className={s.mark}>
              <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" fill="#fff" />
              <path d="M3 7l9 4.5L21 7M12 11.5V21.5" fill="none" stroke="#02090a" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          }
        >
          <Stack gap="head-content" className={s.closingBody}>
            <ol className={s.steps}>
              {c.closing.steps.map((step, i) => (
                <li key={step}>
                  {i > 0 ? <ArrowRight size={18} aria-hidden="true" className={s.flip} /> : null}
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className={s.closingCta}>
              <Pill href={startHref(locale)} size="lg">
                {c.closing.cta}
              </Pill>
              <p className={s.muted}>{c.closing.fine}</p>
            </div>
          </Stack>
        </SectionHead>
      </Sheet>
    </div>
  );
}
