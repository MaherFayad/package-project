import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { getT, pick, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { MODEL_INDEX } from "@/lib/library/model-index.generated";
import { MODEL_GROUPS } from "@/lib/library/types";
import { FINISH_CODES, type StructureCode } from "@/types";
import { designHref, structureHref } from "@/components/store/catalog";
import {
  getPriceFrom,
  listStructures,
  listVendors,
} from "@/components/store/data";
import { DeniedBanner } from "@/components/marketing/DeniedBanner";
import { startHref as kitStartHref } from "@/components/marketing/MarketingHeader";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Container } from "@/components/marketing/kit/Container";
import { Display } from "@/components/marketing/kit/Display";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { HeroImage } from "@/components/marketing/HeroImage";
import {
  SAMPLES,
  TILE_BG,
  renderDims,
  renderSrc,
  srcSetFor,
  vesselSrc,
  type VesselRender,
} from "@/components/marketing/assets";
import { HomeHero } from "@/components/marketing/home/HomeHero";
import { Loop } from "@/components/marketing/home/Loop";
import { CountUp } from "@/components/marketing/home/CountUp";
import { HomeSteps } from "@/components/marketing/home/HomeSteps";
import { EgyptDots } from "@/components/marketing/home/EgyptDots";
import {
  daysWord,
  fill,
  homeCopy,
  printersWord,
} from "@/components/marketing/home/copy";
import s from "@/components/marketing/home/home.module.css";

type Props = { params: Promise<{ locale: string }> };

/** Prerendered; prices, printers and delivery days refresh hourly. */
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return {
    title: { absolute: `${t("meta.siteName")} · ${t("meta.tagline")}` },
    description: t("meta.description"),
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: "/ar", en: "/en" },
    },
    openGraph: {
      title: t("meta.tagline"),
      description: t("meta.description"),
      url: `${siteUrl()}/${locale}`,
      siteName: t("meta.siteName"),
      locale: locale === "ar" ? "ar_EG" : "en_EG",
      type: "website",
      images: ["/marketing/renders/fefco-0427.webp"],
    },
  };
}

/** Real counts (no invented social proof): the library index, the finish list and the DB. */
const MODEL_COUNT = Object.keys(MODEL_INDEX).length;
const GROUP_COUNT = MODEL_GROUPS.length;
const FINISH_COUNT = FINISH_CODES.filter((f) => f !== "NONE").length;

const RAIL: (
  | { kind: "render"; code: StructureCode }
  | { kind: "sample"; i: number }
)[] = [
  { kind: "render", code: "FEFCO_0427" },
  { kind: "sample", i: 0 },
  { kind: "render", code: "ECMA_RTE" },
  { kind: "sample", i: 2 },
  { kind: "render", code: "RIGID_BOX" },
  { kind: "sample", i: 4 },
  { kind: "render", code: "GABLE_BOX" },
  { kind: "sample", i: 7 },
  { kind: "render", code: "PIZZA" },
  { kind: "sample", i: 10 },
  { kind: "render", code: "PAPER_TUBE" },
  { kind: "sample", i: 5 },
];

const WALL_ITEMS: { src: string; tone: string }[] = [
  ...(
    [
      "FEFCO_0427",
      "FEFCO_0201",
      "ECMA_RTE",
      "ECMA_STE",
      "PIZZA",
      "SLEEVE",
      "FEFCO_0320",
      "ECMA_CLB",
      "ECMA_SLB",
      "FEFCO_0422",
      "GABLE_BOX",
      "PAPER_TUBE",
      "RIGID_BOX",
    ] as StructureCode[]
  ).map((c) => ({ src: renderSrc(c), tone: TILE_BG[c] })),
  ...(["jar", "bottle", "dropper", "pump", "can"] as VesselRender[]).map(
    (v, i) => ({
      src: vesselSrc(v),
      tone: ["#f6ecd2", "#e2efec", "#ece6f3", "#f3e3d9", "#dfe7f1"][i]!,
    }),
  ),
];

const ANYONE: { code: StructureCode; sample: number }[] = [
  { code: "FEFCO_0427", sample: 0 },
  { code: "PIZZA", sample: 2 },
  { code: "ECMA_RTE", sample: 3 },
];

const FINISH_SPOTS: { t: string; s: string; dl: string }[] = [
  { t: "12%", s: "8%", dl: "0s" },
  { t: "24%", s: "70%", dl: "-1.5s" },
  { t: "64%", s: "6%", dl: "-3s" },
  { t: "72%", s: "72%", dl: "-4.5s" },
  { t: "40%", s: "80%", dl: "-2s" },
  { t: "8%", s: "40%", dl: "-5s" },
  { t: "82%", s: "38%", dl: "-1s" },
  { t: "44%", s: "2%", dl: "-3.5s" },
];

const THUMBS: {
  code?: StructureCode;
  vessel?: VesselRender;
  t: string;
  s: string;
  z: string;
  dl: string;
}[] = [
  { code: "ECMA_STE", t: "4%", s: "6%", z: "64px", dl: "0s" },
  { vessel: "jar", t: "0%", s: "62%", z: "72px", dl: "-2s" },
  { code: "GABLE_BOX", t: "38%", s: "-2%", z: "56px", dl: "-4s" },
  { vessel: "dropper", t: "70%", s: "4%", z: "60px", dl: "-1s" },
  { code: "PAPER_TUBE", t: "78%", s: "70%", z: "64px", dl: "-3s" },
  { vessel: "can", t: "30%", s: "84%", z: "56px", dl: "-5s" },
];

const ORBIT_ANGLES = [-90, -18, 54, 126, 198];

export default async function HomePage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const c = homeCopy(locale);
  const base = `/${locale}`;
  const [structures, vendors, mailer] = await Promise.all([
    listStructures(),
    listVendors(),
    getPriceFrom("FEFCO_0427", { L: 250, W: 180, H: 80 }),
  ]);
  const row500 =
    mailer.rows.find((r) => r.quantity === 500) ?? mailer.rows[0] ?? null;
  const price = row500
    ? formatMoney(row500.unitPiasters, locale, { alwaysDecimals: true })
    : "—";
  const subtotal = row500
    ? formatMoney(row500.subtotalPiasters, locale, { alwaysDecimals: true })
    : "—";
  const vat = row500
    ? formatMoney(Math.round(row500.subtotalPiasters * 0.14), locale, {
        alwaysDecimals: true,
      })
    : "—";
  const total = row500
    ? formatMoney(
        row500.subtotalPiasters + Math.round(row500.subtotalPiasters * 0.14),
        locale,
        { alwaysDecimals: true },
      )
    : "—";
  const days = row500?.deliveryDays ?? null;
  const printers = vendors.length;
  const minOrder = vendors.length
    ? Math.min(...vendors.map((v) => v.minOrderQty))
    : null;
  const vars = {
    price,
    days: days ?? "—",
    daysWord: daysWord(locale, days ?? 0),
    printers,
    printersWord: printersWord(locale, printers),
    models: MODEL_COUNT,
    groups: GROUP_COUNT,
    finishes: FINISH_COUNT,
  };
  const startHref = kitStartHref(locale);
  const designerHref = designHref(locale, { structure: "FEFCO_0427" });
  const catalogHref = `${base}/catalog`;
  const structureName = (code: StructureCode) => {
    const x = structures.find((y) => y.code === code);
    return x
      ? pick(locale, x.name.ar, x.name.en)
      : t(`structures.${code}` as DictKey);
  };
  const sampleName = (i: number) => {
    const sm = SAMPLES[i]!;
    return sm.structure
      ? structureName(sm.structure)
      : t(`marketing.bottles.items.${sm.vessel}` as DictKey);
  };
  const heroPoster = "/marketing/renders/fefco-0427.webp";

  const stats = [
    { value: MODEL_COUNT, label: c.stats.items[0]!.label },
    { value: printers, label: fill(c.stats.items[1]!.label, vars) },
    ...(days != null
      ? [{ value: days, label: fill(c.stats.items[2]!.label, vars) }]
      : []),
    ...(minOrder != null
      ? [{ value: minOrder, label: c.stats.items[3]!.label }]
      : []),
  ];

  const railItems = RAIL.map((it) =>
    it.kind === "render"
      ? {
          src: renderSrc(it.code),
          kind: "render" as const,
          name: structureName(it.code),
          w: 500,
        }
      : {
          src: SAMPLES[it.i]!.src,
          kind: "sample" as const,
          name: sampleName(it.i),
          w: 300,
        },
  );

  return (
    <div className={s.page}>
      <Suspense fallback={null}>
        <DeniedBanner message={t("store.deniedBanner")} />
      </Suspense>

      {/* 1 ───────── Hero ───────── */}
      <HomeHero
        titles={c.hero.titles}
        lead={c.hero.lead}
        labels={{
          pause: c.hero.pause,
          play: c.hero.play,
          mediaAlt: c.hero.mediaAlt,
        }}
        video={null}
        poster={
          <HeroImage
            src={heroPoster}
            sizes="(min-width: 768px) 60vw, 92vw"
            alt=""
            className={s.heroPoster}
            width={914}
            height={608}
          />
        }
        actions={
          <PillRow className={s.pills}>
            <Pill href={startHref} size="lg">
              {c.hero.primary}
            </Pill>
            <Pill href={catalogHref} variant="outline" size="lg">
              {c.hero.secondary}
            </Pill>
          </PillRow>
        }
      />

      {/* 2 ───────── Statement + model rail (sheet over the hero) ───────── */}
      <Sheet
        tone="dark"
        pad="none"
        container={false}
        className={s.statementSheet}
        aria-labelledby="statement-title"
      >
        <Container>
          <h2 id="statement-title" className={s.statement}>
            {c.statement.lead}
            <span className={s.statementRest}>{c.statement.rest}</span>
          </h2>
        </Container>
        <Loop
          className={s.railWrap}
          labels={c.rail}
          foot={<p className={s.caption}>{c.rail.label}</p>}
        >
          <div
            className={s.railViewport}
            role="region"
            aria-label={c.rail.label}
            tabIndex={0}
          >
            <ul className={s.railTrack}>
              {[...railItems, ...railItems].map((it, i) => {
                const clone = i >= railItems.length;
                return (
                  <li
                    key={i}
                    className={s.railItem}
                    aria-hidden={clone || undefined}
                    style={{
                      inlineSize: it.w,
                      ["--rw" as string]: `${it.w}px`,
                    }}
                  >
                    <div className={s.railCard} data-kind={it.kind}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.src}
                        srcSet={srcSetFor(it.src)}
                        sizes={`${it.w}px`}
                        alt={clone ? "" : it.name}
                        width={it.w}
                        height={380}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <span className={s.railCaption}>{it.name}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Loop>
      </Sheet>

      {/* 3 ───────── Feature card: design in the browser ───────── */}
      <section className={s.section} aria-labelledby="feature-title">
        <Container>
          <Reveal as="article" className={s.featureCard}>
            <div className={s.featureCopy}>
              <Display id="feature-title" size="56">
                {c.feature.title}
              </Display>
              <p className={s.body}>
                {c.feature.body}{" "}
                <Link href={designerHref} className={s.textLink}>
                  {c.feature.link}
                </Link>
              </p>
            </div>
            <div className={s.featureVisual} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={renderSrc("ECMA_STE")}
                srcSet={srcSetFor(renderSrc("ECMA_STE"))}
                sizes="(min-width: 1024px) 460px, 70vw"
                alt=""
                {...renderDims(renderSrc("ECMA_STE"))}
                loading="lazy"
                decoding="async"
                style={{ inlineSize: "min(42%, 260px)" }}
              />
              <div className={s.prompt}>
                <span className={s.promptText}>{c.feature.prompt}</span>
                <span className={s.promptGo}>
                  <ArrowUp size={16} />
                </span>
              </div>
              {row500 ? (
                <div
                  className={`${s.chip} ${s.chipDark}`}
                  style={{ insetBlockStart: "14%", insetInlineEnd: "8%" }}
                >
                  <span className={s.chipMuted}>{c.feature.chipTitle}</span>
                  <strong>{fill(c.feature.chipValue, vars)}</strong>
                  <span className={s.chipMuted}>{c.feature.chipNote}</span>
                </div>
              ) : null}
            </div>
          </Reveal>
        </Container>
      </section>

      {/* 4 ───────── Every step in one place (1:2:1 cards + orbit) ───────── */}
      <section className={s.section} aria-labelledby="everywhere-title">
        <Container>
          <Reveal className={s.sectionHead}>
            <Display id="everywhere-title" size="56" className={s.light}>
              {c.everywhere.title}
              <br />
              {c.everywhere.titleRest}
            </Display>
          </Reveal>
          <ul
            className={s.trio}
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            <Reveal as="li" className={s.mediaCard} index={0}>
              <div className={s.mediaFrame} data-fit="contain">
                <div
                  className={s.ringGlow}
                  style={{
                    inset: "auto",
                    insetBlockStart: "10%",
                    insetInlineStart: "-20%",
                    inlineSize: "140%",
                  }}
                  aria-hidden="true"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={renderSrc("FEFCO_0201")}
                  srcSet={srcSetFor(renderSrc("FEFCO_0201"))}
                  sizes="(min-width: 1024px) 320px, 92vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ position: "relative" }}
                />
                <div
                  className={`${s.prompt} ${s.promptSmall}`}
                  aria-hidden="true"
                >
                  <span className={s.promptText}>
                    {fill("{L} × {W} × {H}", { L: 300, W: 200, H: 100 })}
                  </span>
                  <span
                    className={s.promptGo}
                    style={{ background: "#5b3fff" }}
                  >
                    <ArrowUp size={14} />
                  </span>
                </div>
              </div>
              <div className={s.mediaCaption}>
                <Display as="h3" size="20" className={s.cardTitle}>
                  <Link href={designerHref} className={s.cardLink}>
                    {c.everywhere.cards[0]!.title}
                  </Link>
                </Display>
                <p className={s.caption}>{c.everywhere.cards[0]!.body}</p>
              </div>
            </Reveal>
            <Reveal as="li" className={s.mediaCard} index={1}>
              <div className={s.mediaFrame} aria-hidden="true">
                <div className={s.orbit}>
                  <div className={s.ringGlow} />
                  <div
                    className={`${s.ring} ${s.ringSpin}`}
                    style={{ ["--k" as string]: 0.55 } as CSSProperties}
                  />
                  <div
                    className={`${s.ring} ${s.ringSpin}`}
                    style={{ borderStyle: "dashed" }}
                  />
                  <div
                    className={s.ring}
                    style={{ ["--k" as string]: 1.5 } as CSSProperties}
                  />
                  <div className={s.orbitNodes}>
                    {c.everywhere.nodes.map((n, i) => (
                      <div
                        key={n}
                        className={s.orbitNode}
                        style={{ ["--a" as string]: `${ORBIT_ANGLES[i]}deg` }}
                      >
                        <span>{n}</span>
                      </div>
                    ))}
                  </div>
                  <div className={s.hub}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={renderSrc("FEFCO_0427")}
                      srcSet={srcSetFor(renderSrc("FEFCO_0427"))}
                      sizes="168px"
                      alt=""
                      {...renderDims(renderSrc("FEFCO_0427"))}
                      loading="lazy"
                      decoding="async"
                    />
                    {c.everywhere.hub}
                  </div>
                </div>
              </div>
              <div className={s.mediaCaption}>
                <Display as="h3" size="20" className={s.cardTitle}>
                  <Link href={`${base}/orders`} className={s.cardLink}>
                    {c.everywhere.cards[1]!.title}
                  </Link>
                </Display>
                <p className={s.caption}>{c.everywhere.cards[1]!.body}</p>
              </div>
            </Reveal>
            <Reveal as="li" className={s.mediaCard} index={2}>
              <div className={s.mediaFrame}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={SAMPLES[7]!.src}
                  srcSet={srcSetFor(SAMPLES[7]!.src)}
                  sizes="(min-width: 1024px) 320px, 92vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className={s.mediaCaption}>
                <Display as="h3" size="20" className={s.cardTitle}>
                  <Link href={`${base}/vendors`} className={s.cardLink}>
                    {c.everywhere.cards[2]!.title}
                  </Link>
                </Display>
                <p className={s.caption}>
                  {fill(c.everywhere.cards[2]!.body, vars)}
                </p>
              </div>
            </Reveal>
          </ul>
        </Container>
      </section>

      {/* 5 ───────── Delivered across Egypt ───────── */}
      <section className={s.section} aria-labelledby="delivery-title">
        <Container>
          <Reveal className={s.sectionHead}>
            <Display id="delivery-title" size="56">
              {c.delivery.title}
            </Display>
          </Reveal>
          <Reveal as="article" className={s.mapCard}>
            <div className={s.mapStage} aria-hidden="true">
              <div
                className={s.mapGlow}
                style={{
                  inlineSize: 540,
                  blockSize: 540,
                  insetBlockStart: -120,
                  insetInlineStart: -160,
                }}
              />
              <div
                className={s.mapGlow}
                style={{
                  inlineSize: 480,
                  blockSize: 420,
                  insetBlockEnd: -140,
                  insetInlineEnd: -80,
                  opacity: 0.6,
                }}
              />
              <EgyptDots className={s.mapDots} />
              <div className={s.orderCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={renderSrc("FEFCO_0427")}
                  srcSet={srcSetFor(renderSrc("FEFCO_0427"))}
                  sizes="240px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <strong>{c.delivery.orderTitle}</strong>
                <span className={s.chipMuted}>{c.delivery.orderQty}</span>
                {row500 ? (
                  <span>{fill(c.delivery.orderPrice, vars)}</span>
                ) : null}
                <span className={s.orderBtn}>{c.delivery.orderCta}</span>
              </div>
              {days != null ? (
                <div
                  className={`${s.chip} ${s.zoneChip}`}
                  style={{ ["--t" as string]: "58%", ["--s" as string]: "64%" }}
                >
                  <strong>{fill(c.delivery.orderDays, vars)}</strong>
                  <span className={s.chipMuted}>{c.delivery.zones[0]}</span>
                </div>
              ) : null}
              {c.delivery.zones.slice(1).map((z, i) => (
                <div
                  key={z}
                  className={`${s.chip} ${s.chipDark} ${s.zoneChip}`}
                  style={{
                    ["--t" as string]: ["12%", "36%", "70%", "84%"][i],
                    ["--s" as string]: ["10%", "4%", "12%", "44%"][i],
                    animationDelay: `${-1.5 * (i + 1)}s`,
                  }}
                >
                  {z}
                </div>
              ))}
            </div>
            <div className={s.mapCaption}>
              <Display as="h3" size="20" className={s.cardTitle}>
                {c.delivery.cardTitle}
              </Display>
              <p className={s.body}>{fill(c.delivery.cardBody, vars)}</p>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* 6 ───────── For every business ───────── */}
      <section
        className={`${s.section} ${s.sectionTail}`}
        aria-labelledby="anyone-title"
      >
        <Container>
          <Reveal className={s.sectionHead} style={{ maxInlineSize: "46rem" }}>
            <Display id="anyone-title" size="56">
              {c.anyone.title}
            </Display>
          </Reveal>
          <ul className={s.anyone}>
            {ANYONE.map((a, i) => (
              <Reveal as="li" key={a.code} className={s.mediaCard} index={i}>
                <div className={s.mediaFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={SAMPLES[a.sample]!.src}
                    srcSet={srcSetFor(SAMPLES[a.sample]!.src)}
                    sizes="(min-width: 768px) 420px, 82vw"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className={s.mediaCaption}>
                  <Display as="h3" size="20" className={s.cardTitle}>
                    <Link
                      href={structureHref(locale, a.code)}
                      className={s.cardLink}
                    >
                      {c.anyone.cards[i]!.title}
                    </Link>
                  </Display>
                  <p className={s.body}>{c.anyone.cards[i]!.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <div className={s.centerRow}>
            <Pill href={catalogHref} variant="outline" size="lg">
              {c.anyone.cta}
            </Pill>
          </div>
        </Container>
      </section>

      {/* 7 ───────── Violet sheet: the 3D designer ───────── */}
      <Sheet
        tone="violet"
        pad="none"
        container={false}
        className={s.sheetViolet}
        aria-labelledby="designer-title"
      >
        <Container>
          <Reveal className={s.sectionHead}>
            <Display id="designer-title" size="56">
              {c.designer.title}
            </Display>
          </Reveal>
          <div className={s.duo}>
            <Reveal as="article" className={s.darkCard} index={0}>
              <div className={s.darkCardMedia} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/marketing/designer-${locale}.webp`}
                  srcSet={srcSetFor(`/marketing/designer-${locale}.webp`)}
                  sizes="(min-width: 1024px) 820px, 92vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ opacity: 0.72 }}
                />
                <div className={s.promptDark}>
                  <Sparkles size={18} className={s.sparkle} />
                  <span className={s.promptText}>{c.designer.prompt}</span>
                  <span className={s.promptGo}>
                    <ArrowUp size={16} />
                  </span>
                </div>
              </div>
              <div className={s.darkCardBody}>
                <Display as="h3" size="20" className={s.cardTitle}>
                  <Sparkles size={18} className={s.sparkle} aria-hidden />
                  <Link href={designerHref} className={s.cardLink}>
                    {c.designer.wideTitle}
                  </Link>
                </Display>
                <p className={s.body}>{c.designer.wideBody}</p>
              </div>
            </Reveal>
            <Reveal as="article" className={s.darkCard} index={1}>
              <div
                className={s.darkCardMedia}
                data-fit="contain"
                aria-hidden="true"
              >
                <div className={s.violetGlow} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={renderSrc("RIGID_BOX")}
                  srcSet={srcSetFor(renderSrc("RIGID_BOX"))}
                  sizes="(min-width: 1024px) 400px, 92vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className={s.darkCardBody}>
                <Display as="h3" size="20" className={s.cardTitle}>
                  {c.designer.narrowTitle}
                </Display>
                <p className={s.body}>{c.designer.narrowBody}</p>
              </div>
            </Reveal>
          </div>
        </Container>
      </Sheet>

      {/* 8 ───────── Catalogue wall (app-grid equivalent) ───────── */}
      <section className={s.bandNavy} aria-labelledby="wall-title">
        <Loop
          className={s.wall}
          labels={c.wall}
          controlClassName={s.wallControl}
        >
          <div className={s.wallRows} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((r) => {
              const k = (r * 5) % WALL_ITEMS.length;
              const once = [...WALL_ITEMS.slice(k), ...WALL_ITEMS.slice(0, k)];
              const row = [...once, ...once];
              return (
                <ul
                  key={r}
                  className={s.wallRow}
                  style={{ ["--dur" as string]: `${80 + r * 9}s` }}
                >
                  {[...row, ...row].map((it, i) => (
                    <li
                      key={i}
                      className={s.tile}
                      style={{ ["--tone" as string]: it.tone }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.src}
                        srcSet={srcSetFor(it.src)}
                        sizes="76px"
                        alt=""
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                      />
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>
          <Container>
            <Reveal className={s.wallCopy} variant="fade">
              <Display id="wall-title" size="56">
                {fill(c.wall.title, vars)}
              </Display>
              <p className={s.body}>
                {fill(c.wall.body, vars)}{" "}
                <Link href={catalogHref} className={s.textLink}>
                  {c.wall.link}
                </Link>
              </p>
            </Reveal>
          </Container>
        </Loop>
      </section>

      {/* 9 ───────── Finishes (navy) ───────── */}
      <section
        className={`${s.section} ${s.sectionTail} ${s.bandNavy}`}
        aria-labelledby="finishes-title"
      >
        <Container>
          <Reveal className={`${s.sectionHead} ${s.navyHead}`}>
            <Display id="finishes-title" size="56">
              {c.finishes.title}
            </Display>
            <p className={s.body}>
              {fill(c.finishes.body, vars)}{" "}
              <Link
                href={structureHref(locale, "RIGID_BOX")}
                className={s.textLink}
              >
                {c.finishes.link}
              </Link>
            </p>
          </Reveal>
          <Reveal className={s.navyPanel} variant="scale">
            <div
              className={s.navyGlow}
              style={{
                inlineSize: 900,
                blockSize: 500,
                insetBlockStart: -80,
                insetInlineStart: "10%",
              }}
              aria-hidden="true"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={renderSrc("RIGID_BOX")}
              srcSet={srcSetFor(renderSrc("RIGID_BOX"))}
              sizes="(min-width: 1024px) 520px, 56vw"
              alt=""
              {...renderDims(renderSrc("RIGID_BOX"))}
              loading="lazy"
              decoding="async"
            />
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {c.finishes.names.map((n, i) => (
                <li
                  key={n}
                  className={s.finishChip}
                  style={{
                    ["--t" as string]: FINISH_SPOTS[i]!.t,
                    ["--s" as string]: FINISH_SPOTS[i]!.s,
                    ["--dl" as string]: FINISH_SPOTS[i]!.dl,
                  }}
                >
                  {n}
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </section>

      {/* 10 ───────── Green sheet: price, real numbers, secure payment ───────── */}
      <Sheet
        tone="green"
        pad="none"
        container={false}
        className={s.sheetGreen}
        aria-labelledby="stats-title"
      >
        <Container>
          <Reveal className={s.greenHead}>
            <Display
              id="stats-title"
              size="64"
              align="center"
              className={s.narrowTitle}
            >
              {c.stats.title}
            </Display>
          </Reveal>
          <div className={s.split}>
            <Reveal>
              <Display as="h3" size="44">
                {c.stats.checkoutTitle}
              </Display>
              <ul className={s.stats}>
                {stats.map((st) => (
                  <li key={st.label} className={s.stat}>
                    <CountUp
                      value={st.value}
                      locale={locale}
                      className={s.statValue}
                    />
                    <span className={s.statLabel}>{st.label}</span>
                  </li>
                ))}
              </ul>
              {row500 ? (
                <p className={s.rule}>{fill(c.stats.rule, vars)}</p>
              ) : null}
              <p className={s.footnote}>{c.stats.note}</p>
            </Reveal>
            <div className={s.splitVisual} aria-hidden="true">
              {THUMBS.map((th, i) => {
                const src = th.code
                  ? renderSrc(th.code)
                  : vesselSrc(th.vessel!);
                return (
                  <div
                    key={i}
                    className={s.thumb}
                    style={{
                      ["--t" as string]: th.t,
                      ["--s" as string]: th.s,
                      ["--z" as string]: th.z,
                      ["--dl" as string]: th.dl,
                      ["--tone" as string]: th.code
                        ? TILE_BG[th.code]
                        : "#f6ecd2",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      srcSet={srcSetFor(src)}
                      sizes="72px"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                );
              })}
              <div className={s.receipt}>
                <div className={s.receiptHead}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={renderSrc("FEFCO_0427")}
                    srcSet={srcSetFor(renderSrc("FEFCO_0427"))}
                    sizes="56px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <div>
                    <strong>{c.stats.receipt.title}</strong>
                    <div className={s.chipMuted}>{c.stats.receipt.line}</div>
                  </div>
                </div>
                <div className={s.receiptRow}>
                  <span>{c.stats.receipt.setup}</span>
                  <span>{c.stats.receipt.included}</span>
                </div>
                <div className={s.receiptRow}>
                  <span>{c.stats.receipt.delivery}</span>
                  <span>{c.stats.receipt.included}</span>
                </div>
                <div className={s.receiptRow}>
                  <span>{c.stats.receipt.subtotal}</span>
                  <span>{subtotal}</span>
                </div>
                <div className={s.receiptRow}>
                  <span>{c.stats.receipt.vat}</span>
                  <span>{vat}</span>
                </div>
                <div className={s.receiptTotal}>
                  <span>{c.stats.receipt.total}</span>
                  <span>{total}</span>
                </div>
                <div className={s.receiptPay}>{c.stats.receipt.pay}</div>
              </div>
            </div>
          </div>
          <div className={`${s.split} ${s.secure}`}>
            <Reveal>
              <Display as="h3" size="44">
                {c.stats.secureTitle}
              </Display>
              <p className={s.body}>{c.stats.secureBody}</p>
            </Reveal>
            <div className={s.splitVisual} aria-hidden="true">
              <div className={s.globe} />
              {c.stats.payChips.map((m, i) => (
                <div
                  key={i}
                  className={`${s.chip} ${s.chipDark} ${s.payChip}`}
                  style={{
                    insetBlockStart: ["14%", "40%", "64%", "84%"][i],
                    insetInlineStart: ["6%", "70%", "2%", "58%"][i],
                    animationDelay: `${-1.5 * i}s`,
                  }}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Sheet>

      {/* 11 ───────── Steps sheet ───────── */}
      <Sheet
        tone="dark"
        pad="none"
        container={false}
        className={s.sheetSteps}
        aria-labelledby="steps-title"
      >
        <Container>
          <Reveal className={s.sectionHead}>
            <Display id="steps-title" size="64">
              {c.steps.title}
            </Display>
          </Reveal>
          <HomeSteps
            items={c.steps.items}
            labels={c.steps}
            media={[
              [
                { src: SAMPLES[0]!.src, srcSet: srcSetFor(SAMPLES[0]!.src) },
                {
                  src: `/marketing/designer-${locale}.webp`,
                  srcSet: srcSetFor(`/marketing/designer-${locale}.webp`),
                },
                { src: SAMPLES[7]!.src, srcSet: srcSetFor(SAMPLES[7]!.src) },
              ],
              [
                {
                  src: renderSrc("FEFCO_0201"),
                  srcSet: srcSetFor(renderSrc("FEFCO_0201")),
                  fit: "contain",
                },
                { src: SAMPLES[4]!.src, srcSet: srcSetFor(SAMPLES[4]!.src) },
                {
                  src: renderSrc("FEFCO_0427"),
                  srcSet: srcSetFor(renderSrc("FEFCO_0427")),
                  fit: "contain",
                },
              ],
            ]}
            cta={
              <Pill href={startHref} size="lg">
                {c.steps.cta}
              </Pill>
            }
          />
        </Container>
      </Sheet>
    </div>
  );
}
