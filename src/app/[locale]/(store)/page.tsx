import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { getT, pick, toLocale } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { MODEL_INDEX } from "@/lib/library/model-index.generated";
import { MODEL_GROUPS } from "@/lib/library/types";
import { FINISH_CODES, type StructureCode } from "@/types";
import { designHref, structureHref } from "@/components/store/catalog";
import { getPriceFrom, listStructures, listVendors } from "@/components/store/data";
import { DeniedBanner } from "@/components/marketing/DeniedBanner";
import { startHref as kitStartHref } from "@/components/marketing/MarketingHeader";
import { TILE_BG, renderSrc, srcSetFor, vesselSrc, type VesselRender } from "@/components/marketing/assets";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { Container } from "@/components/marketing/kit/Container";
import { Display } from "@/components/marketing/kit/Display";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { Marquee } from "@/components/marketing/kit/Marquee";
import { Orbit } from "@/components/marketing/kit/Orbit";
import { Stat } from "@/components/marketing/kit/CountUp";
import { Steps } from "@/components/marketing/kit/Steps";
import { MotionScope } from "@/components/marketing/kit/MotionScope";
import { R6, R6_MODELS, SAMPLE_LABEL, type R6Image, type R6ModelId } from "@/components/marketing/kit/assets";
import { HomeHero, type HeroVideo } from "@/components/marketing/home/HomeHero";
import { EgyptDots } from "@/components/marketing/home/EgyptDots";
import { R6Pic } from "@/components/marketing/home/R6Pic";
import { daysWord, fill, homeCopy, printersWord } from "@/components/marketing/home/copy";
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
    alternates: { canonical: `/${locale}`, languages: { ar: "/ar", en: "/en" } },
    openGraph: {
      title: t("meta.tagline"),
      description: t("meta.description"),
      url: `${siteUrl()}/${locale}`,
      siteName: t("meta.siteName"),
      locale: locale === "ar" ? "ar_EG" : "en_EG",
      type: "website",
      images: ["/marketing/r6/hero/mailer-iso-dark@2x.webp"],
    },
  };
}

/** Real counts (no invented social proof): the library index, the finish list and the DB. */
const MODEL_COUNT = Object.keys(MODEL_INDEX).length;
const GROUP_COUNT = MODEL_GROUPS.length;
const FINISH_COUNT = FINISH_CODES.filter((f) => f !== "NONE").length;

/** The hero turntable loop, once the assets branch ships the files (poster first, 720p first). */
function heroVideo(): HeroVideo | null {
  const loop = R6.loops.mailer;
  const has = loop.sources.every((x) => fs.existsSync(path.join(process.cwd(), "public", x.src)));
  if (!has) return null;
  const order = [...loop.sources].sort((a, b) => a.height - b.height);
  return { sources: order.map((x) => ({ src: x.src, type: x.type })), poster: `${loop.poster.base}.webp` };
}

/** Rail: our studio renders, dark and light, mixed like the reference's storefront strip. */
const RAIL: { id: R6ModelId; tone: "dark" | "light" }[] = [
  { id: "mailer", tone: "dark" },
  { id: "perfume", tone: "light" },
  { id: "rigid-box", tone: "dark" },
  { id: "pouch", tone: "light" },
  { id: "drawer-box", tone: "dark" },
  { id: "can", tone: "light" },
  { id: "tuck-carton", tone: "dark" },
  { id: "jar", tone: "light" },
  { id: "cup", tone: "dark" },
  { id: "tea-tin", tone: "light" },
];

/** Icon wall tiles: the smallest variant of our renders (64 to 72 px slots), no srcset. */
const smallest = (src: string) => srcSetFor(src)?.split(" ")[0] ?? src;
const WALL_ITEMS: { small: string; tone: string }[] = [
  ...(["FEFCO_0427", "FEFCO_0201", "ECMA_RTE", "ECMA_STE", "PIZZA", "SLEEVE", "FEFCO_0320", "ECMA_CLB", "ECMA_SLB", "FEFCO_0422", "GABLE_BOX", "PAPER_TUBE", "RIGID_BOX"] as StructureCode[]).map((c) => ({ small: smallest(renderSrc(c)), tone: TILE_BG[c] })),
  ...(["jar", "bottle", "dropper", "pump", "can"] as VesselRender[]).map((v, i) => ({ small: smallest(vesselSrc(v)), tone: ["#f6ecd2", "#e2efec", "#ece6f3", "#f3e3d9", "#dfe7f1"][i]! })),
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

const THUMBS: { id: R6ModelId; t: string; s: string; z: string; dl: string }[] = [
  { id: "tuck-carton", t: "4%", s: "6%", z: "72px", dl: "0s" },
  { id: "jar", t: "0%", s: "64%", z: "80px", dl: "-2s" },
  { id: "drawer-box", t: "40%", s: "-2%", z: "64px", dl: "-4s" },
  { id: "dropper", t: "72%", s: "4%", z: "68px", dl: "-1s" },
  { id: "tube", t: "78%", s: "72%", z: "72px", dl: "-3s" },
  { id: "can", t: "30%", s: "86%", z: "64px", dl: "-5s" },
];

const cut = (id: R6ModelId, view: "iso" | "front" = "iso"): R6Image => R6.cutouts[`${id}-${view}`]!;
const studio = (id: R6ModelId, tone: "dark" | "light", view: "iso" | "front" = "iso"): R6Image => R6.hero[`${id}-${view}-${tone}`]!;

export default async function HomePage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const c = homeCopy(locale);
  const base = `/${locale}`;
  const [structures, vendors, mailer] = await Promise.all([listStructures(), listVendors(), getPriceFrom("FEFCO_0427", { L: 250, W: 180, H: 80 })]);
  const row500 = mailer.rows.find((r) => r.quantity === 500) ?? mailer.rows[0] ?? null;
  const money = (p: number) => formatMoney(p, locale, { alwaysDecimals: true });
  const vatOf = (p: number) => Math.round(p * 0.14);
  const price = row500 ? money(row500.unitPiasters) : "—";
  const days = row500?.deliveryDays ?? null;
  const printers = vendors.length;
  const minOrder = vendors.length ? Math.min(...vendors.map((v) => v.minOrderQty)) : null;
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
  /** Caption for a render: the catalogue name when it is a box style, else the model description. */
  const modelCaption = (id: R6ModelId) => {
    const st = structures.find((y) => y.code === R6_MODELS[id].code);
    return st ? pick(locale, st.name.ar, st.name.en) : R6_MODELS[id][locale];
  };
  const sample = SAMPLE_LABEL[locale];
  const ui = (k: string) => R6.ui[`${k}-${locale}`]!;

  const stats = [
    { value: MODEL_COUNT, label: c.stats.items[0]!.label },
    { value: printers, label: fill(c.stats.items[1]!.label, vars) },
    ...(days != null ? [{ value: days, label: fill(c.stats.items[2]!.label, vars) }] : []),
    ...(minOrder != null ? [{ value: minOrder, label: c.stats.items[3]!.label }] : []),
  ];

  const stepMedia = (a: R6Image, b: R6Image) => (
    <div className={s.stepPair}>
      <div className={s.stepImg}>
        <R6Pic a={a} sizes="(min-width: 1024px) 340px, 45vw" />
      </div>
      <div className={s.stepImg} data-fit="contain">
        <R6Pic a={b} sizes="(min-width: 1024px) 340px, 45vw" />
      </div>
    </div>
  );

  return (
    <div className={s.page}>
      <Suspense fallback={null}>
        <DeniedBanner message={t("store.deniedBanner")} />
      </Suspense>

      {/* 1 ───────── Hero: full bleed, rotating headline over our turntable ───────── */}
      <HomeHero
        titles={c.hero.titles}
        lead={c.hero.lead}
        labels={{ pause: c.hero.pause, play: c.hero.play }}
        video={heroVideo()}
        media={<R6Pic a={studio("mailer", "dark")} sizes="(min-width: 768px) 50vw, 88vw" className={s.heroPoster} priority />}
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

      {/* 2 ───────── Statement + studio rail (sheet over the hero) ───────── */}
      <Sheet tone="dark" pad="none" container={false} className={s.statementSheet} aria-labelledby="statement-title">
        <Container>
          <h2 id="statement-title" className={s.statement}>
            {c.statement.lead}
            <span className={s.statementRest}>{c.statement.rest}</span>
          </h2>
        </Container>
        <div className={s.railWrap}>
          <Marquee
            className={s.rail}
            label={c.rail.label}
            pauseLabel={c.rail.pause}
            playLabel={c.rail.play}
            duration={90}
            gap="16px"
            items={RAIL.map((r) => (
              <figure key={r.id} className={s.railItem}>
                <div className={s.railCard}>
                  <R6Pic a={studio(r.id, r.tone)} sizes="300px" alt={studio(r.id, r.tone).alt[locale]} />
                </div>
                <figcaption className={s.railCaption}>{modelCaption(r.id)}</figcaption>
              </figure>
            ))}
          />
          <p className={`${s.caption} ${s.railNote}`}>{sample}</p>
        </div>
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
            <MotionScope className={s.featureVisual} pauseLabel={c.motion.feature[0]} playLabel={c.motion.feature[1]} buttonClassName={s.scopeBtn}>
              <div aria-hidden="true" className={s.fill}>
                <R6Pic a={cut("tuck-carton")} sizes="(min-width: 1024px) 380px, 70vw" className={s.featureImg} />
                <div className={s.prompt}>
                  <span className={s.promptText}>{c.feature.prompt}</span>
                  <span className={s.promptGo}>
                    <ArrowUp size={16} />
                  </span>
                </div>
                {row500 ? (
                  <div className={`${s.chip} ${s.chipDark}`} style={{ insetBlockStart: "14%", insetInlineEnd: "8%" }}>
                    <span className={s.chipMuted}>{c.feature.chipTitle}</span>
                    <strong>{fill(c.feature.chipValue, vars)}</strong>
                    <span className={s.chipMuted}>{c.feature.chipNote}</span>
                  </div>
                ) : null}
              </div>
            </MotionScope>
          </Reveal>
        </Container>
      </section>

      {/* 4 ───────── Every step in one place: 1:2:1 cards, kit Orbit in the middle ───────── */}
      <section className={s.section} aria-labelledby="everywhere-title">
        <Container>
          <Reveal className={s.sectionHead}>
            <Display id="everywhere-title" size="56" className={s.light}>
              {c.everywhere.title}
              <br />
              {c.everywhere.titleRest}
            </Display>
          </Reveal>
          <ul className={s.trio}>
            <Reveal as="li" className={s.mediaCard} index={0}>
              <div className={s.mediaFrame} data-pad="true">
                <R6Pic a={ui("designer")} sizes="(min-width: 1024px) 300px, 92vw" className={s.uiShot} />
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
              <div className={s.mediaFrame} data-orbit="true">
                <div className={s.orbitGlow} aria-hidden="true" />
                <Orbit
                  className={s.orbit}
                  label={c.everywhere.cards[1]!.title}
                  size={400}
                  hub={
                    <span className={s.hub}>
                      <R6Pic a={cut("mailer")} sizes="96px" />
                      <span>{c.everywhere.hub}</span>
                    </span>
                  }
                  nodes={c.everywhere.nodes.map((n) => ({ label: n }))}
                />
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
              <div className={s.mediaFrame} data-pad="true">
                <R6Pic a={ui("vendor-job")} sizes="(min-width: 1024px) 300px, 92vw" className={s.uiShot} />
              </div>
              <div className={s.mediaCaption}>
                <Display as="h3" size="20" className={s.cardTitle}>
                  <Link href={`${base}/vendors`} className={s.cardLink}>
                    {c.everywhere.cards[2]!.title}
                  </Link>
                </Display>
                <p className={s.caption}>{fill(c.everywhere.cards[2]!.body, vars)}</p>
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
            <MotionScope className={s.mapStage} pauseLabel={c.motion.delivery[0]} playLabel={c.motion.delivery[1]} buttonClassName={s.scopeBtn}>
              <div aria-hidden="true" className={s.fill}>
                <div className={s.mapGlow} style={{ inlineSize: 540, blockSize: 540, insetBlockStart: -120, insetInlineStart: -160 }} />
                <div className={s.mapGlow} style={{ inlineSize: 480, blockSize: 420, insetBlockEnd: -140, insetInlineEnd: -80, opacity: 0.6 }} />
                <EgyptDots />
                <div className={s.orderCard}>
                  <R6Pic a={studio("mailer", "light")} sizes="240px" className={s.orderImg} />
                  <strong>{c.delivery.orderTitle}</strong>
                  <span className={s.chipMuted}>{c.delivery.orderQty}</span>
                  {row500 ? <span>{fill(c.delivery.orderPrice, vars)}</span> : null}
                  <span className={s.orderBtn}>{c.delivery.orderCta}</span>
                </div>
                {days != null ? (
                  <div className={`${s.chip} ${s.zoneChip}`} style={{ ["--t" as string]: "58%", ["--s" as string]: "60%" }}>
                    <strong>{fill(c.delivery.orderDays, vars)}</strong>
                    <span className={s.chipMuted}>{c.delivery.zones[0]}</span>
                  </div>
                ) : null}
                {c.delivery.zones.slice(1).map((z, i) => (
                  <div key={z} className={`${s.chip} ${s.chipDark} ${s.zoneChip}`} style={{ ["--t" as string]: ["12%", "36%", "70%", "84%"][i], ["--s" as string]: ["10%", "4%", "12%", "44%"][i], animationDelay: `${-1.5 * (i + 1)}s` }}>
                    {z}
                  </div>
                ))}
              </div>
            </MotionScope>
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
      <section className={`${s.section} ${s.sectionTail}`} aria-labelledby="anyone-title">
        <Container>
          <Reveal className={`${s.sectionHead} ${s.narrowHead}`}>
            <Display id="anyone-title" size="56">
              {c.anyone.title}
            </Display>
          </Reveal>
          <ul className={s.anyone}>
            {(
              [
                { id: "mailer", href: structureHref(locale, "FEFCO_0427") },
                { id: "cup", href: catalogHref },
                { id: "jar", href: `${base}/bottles` },
              ] as { id: R6ModelId; href: string }[]
            ).map((a, i) => (
              <Reveal as="li" key={a.id} className={s.mediaCard} index={i}>
                <div className={s.mediaFrame}>
                  <R6Pic a={studio(a.id, "light")} sizes="(min-width: 768px) 420px, 82vw" />
                  <span className={s.sampleTag}>{sample}</span>
                </div>
                <div className={s.mediaCaption}>
                  <Display as="h3" size="20" className={s.cardTitle}>
                    <Link href={a.href} className={s.cardLink}>
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
      <Sheet tone="violet" pad="none" className={s.sheetViolet} aria-labelledby="designer-title">
        <Reveal className={s.sectionHead}>
          <Display id="designer-title" size="56">
            {c.designer.title}
          </Display>
        </Reveal>
        <div className={s.duo}>
          <Reveal as="article" className={s.darkCard} index={0}>
            <div className={s.darkCardMedia} aria-hidden="true">
              <R6Pic a={ui("designer")} sizes="(min-width: 1024px) 820px, 92vw" className={s.darkCardShot} />
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
            <div className={s.darkCardMedia} aria-hidden="true">
              <div className={s.violetGlow} />
              <R6Pic a={cut("rigid-box")} sizes="(min-width: 1024px) 360px, 80vw" className={s.darkCardCut} />
            </div>
            <div className={s.darkCardBody}>
              <Display as="h3" size="20" className={s.cardTitle}>
                {c.designer.narrowTitle}
              </Display>
              <p className={s.body}>{c.designer.narrowBody}</p>
            </div>
          </Reveal>
        </div>
      </Sheet>

      {/* 8 ───────── Catalogue wall (the reference's app grid), paused by MotionScope ───────── */}
      <section className={s.bandNavy} aria-labelledby="wall-title">
        <MotionScope className={s.wall} pauseLabel={c.wall.pause} playLabel={c.wall.play} buttonClassName={s.wallControl}>
          <div className={s.wallRows} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((r) => {
              const k = (r * 5) % WALL_ITEMS.length;
              const row = [...WALL_ITEMS.slice(k), ...WALL_ITEMS.slice(0, k)];
              return (
                <ul key={r} className={s.wallRow} style={{ ["--dur" as string]: `${80 + r * 9}s` }}>
                  {[...row, ...row].map((it, i) => (
                    <li key={i} className={s.tile} style={{ ["--tone" as string]: it.tone }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.small} alt="" width={64} height={64} loading="lazy" decoding="async" />
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
        </MotionScope>
      </section>

      {/* 9 ───────── Finishes (navy) ───────── */}
      <section className={`${s.section} ${s.sectionTail} ${s.bandNavy}`} aria-labelledby="finishes-title">
        <Container>
          <Reveal className={`${s.sectionHead} ${s.navyHead}`}>
            <Display id="finishes-title" size="56">
              {c.finishes.title}
            </Display>
            <p className={s.body}>
              {fill(c.finishes.body, vars)}{" "}
              <Link href={structureHref(locale, "RIGID_BOX")} className={s.textLink}>
                {c.finishes.link}
              </Link>
            </p>
          </Reveal>
          <Reveal variant="scale">
            <MotionScope className={s.navyPanel} pauseLabel={c.motion.finishes[0]} playLabel={c.motion.finishes[1]} buttonClassName={s.scopeBtn}>
              <div className={s.navyGlow} aria-hidden="true" />
              <R6Pic a={cut("rigid-box")} sizes="(min-width: 1024px) 420px, 60vw" className={s.navyImg} />
              <ul className={s.finishList}>
                {c.finishes.names.map((n, i) => (
                  <li key={n} className={s.finishChip} style={{ ["--t" as string]: FINISH_SPOTS[i]!.t, ["--s" as string]: FINISH_SPOTS[i]!.s, ["--dl" as string]: FINISH_SPOTS[i]!.dl }}>
                    {n}
                  </li>
                ))}
              </ul>
            </MotionScope>
          </Reveal>
        </Container>
      </section>

      {/* 10 ───────── Green sheet: price, real numbers, secure payment ───────── */}
      <Sheet tone="green" pad="none" className={s.sheetGreen} aria-labelledby="stats-title">
        <Reveal className={s.greenHead}>
          <Display id="stats-title" size="64" align="center" className={s.narrowTitle}>
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
                  <Stat value={st.value} label={st.label} />
                </li>
              ))}
            </ul>
            {row500 ? <p className={s.rule}>{fill(c.stats.rule, vars)}</p> : null}
            <p className={s.footnote}>{c.stats.note}</p>
          </Reveal>
          <MotionScope className={s.splitVisual} pauseLabel={c.motion.price[0]} playLabel={c.motion.price[1]} buttonClassName={s.scopeBtn}>
            <div aria-hidden="true" className={s.fill}>
              {THUMBS.map((th) => (
                <div key={th.id} className={s.thumb} style={{ ["--t" as string]: th.t, ["--s" as string]: th.s, ["--z" as string]: th.z, ["--dl" as string]: th.dl }}>
                  <R6Pic a={cut(th.id)} sizes="80px" />
                </div>
              ))}
              {row500 ? (
                <div className={s.receipt}>
                  <div className={s.receiptHead}>
                    <R6Pic a={cut("mailer")} sizes="56px" />
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
                    <span>{money(row500.subtotalPiasters)}</span>
                  </div>
                  <div className={s.receiptRow}>
                    <span>{c.stats.receipt.vat}</span>
                    <span>{money(vatOf(row500.subtotalPiasters))}</span>
                  </div>
                  <div className={s.receiptTotal}>
                    <span>{c.stats.receipt.total}</span>
                    <span>{money(row500.subtotalPiasters + vatOf(row500.subtotalPiasters))}</span>
                  </div>
                  <div className={s.receiptPay}>{c.stats.receipt.pay}</div>
                </div>
              ) : null}
            </div>
          </MotionScope>
        </div>
        <div className={`${s.split} ${s.secure}`}>
          <Reveal>
            <Display as="h3" size="44">
              {c.stats.secureTitle}
            </Display>
            <p className={s.body}>{c.stats.secureBody}</p>
          </Reveal>
          <MotionScope className={s.splitVisual} pauseLabel={c.motion.pay[0]} playLabel={c.motion.pay[1]} buttonClassName={s.scopeBtn}>
            <div aria-hidden="true" className={s.fill}>
              <div className={s.globe} />
              {c.stats.payChips.map((m, i) => (
                <div key={m} className={`${s.chip} ${s.chipDark} ${s.payChip}`} style={{ insetBlockStart: ["14%", "40%", "64%", "84%"][i], insetInlineStart: ["6%", "70%", "2%", "58%"][i], animationDelay: `${-1.5 * i}s` } as CSSProperties}>
                  {m}
                </div>
              ))}
            </div>
          </MotionScope>
        </div>
      </Sheet>

      {/* 11 ───────── Steps sheet (kit Steps: tabs, progress underline, media swap) ───────── */}
      <Sheet tone="dark" pad="none" className={s.sheetSteps} aria-labelledby="steps-title">
        <Reveal className={s.sectionHead}>
          <Display id="steps-title" size="64">
            {c.steps.title}
          </Display>
        </Reveal>
        <Steps
          className={s.steps}
          label={c.steps.title}
          items={[
            { title: c.steps.items[0]!, media: stepMedia(studio("tuck-carton", "light"), cut("perfume")) },
            { title: c.steps.items[1]!, media: stepMedia(studio("mailer", "dark"), ui("price-badge")) },
            { title: c.steps.items[2]!, media: stepMedia(studio("rigid-box", "dark"), ui("order-timeline")) },
          ]}
        />
        <PillRow className={s.stepsCta}>
          <Pill href={startHref} size="lg">
            {c.steps.cta}
          </Pill>
        </PillRow>
      </Sheet>
    </div>
  );
}
