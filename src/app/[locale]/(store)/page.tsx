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
import { FINISH_CODES } from "@/types";
import { designHref, structureHref } from "@/components/store/catalog";
import { getPriceFrom, listStructures, listVendors } from "@/components/store/data";
import { DeniedBanner } from "@/components/marketing/DeniedBanner";
import { startHref as kitStartHref } from "@/components/marketing/MarketingHeader";
import { Sheet, SheetCard } from "@/components/marketing/kit/Sheet";
import { SectionHead, Stack } from "@/components/marketing/kit/SectionHead";
import { Grid } from "@/components/marketing/kit/Grid";
import { Container } from "@/components/marketing/kit/Container";
import { Body, Display } from "@/components/marketing/kit/Display";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { Marquee } from "@/components/marketing/kit/Marquee";
import { Orbit } from "@/components/marketing/kit/Orbit";
import { Stat } from "@/components/marketing/kit/CountUp";
import { Steps } from "@/components/marketing/kit/Steps";
import { MotionScope } from "@/components/marketing/kit/MotionScope";
import { R6, R6_MODELS, SAMPLE_LABEL, src, srcSetW, type R6Image, type R6ModelId } from "@/components/marketing/kit/assets";
import { MediaCard } from "@/components/marketing/kit/MediaCard";
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

type LoopId = keyof typeof R6.loops;

/** A turntable loop from the assets branch (720p below 1024px, 1080p above), or null if not shipped. */
function loopVideo(id: LoopId): HeroVideo | null {
  const loop = R6.loops[id];
  const has = loop.sources.every((x) => fs.existsSync(path.join(process.cwd(), "public", x.src)));
  if (!has) return null;
  const small = loop.sources.filter((x) => x.height === 720).map((x) => ({ src: x.src, type: x.type, media: "(max-width: 1023px)" }));
  const large = loop.sources.filter((x) => x.height === 1080).map((x) => ({ src: x.src, type: x.type }));
  return { sources: [...small, ...large], poster: `${loop.poster.base}.webp` };
}

/** Set pieces on the hero's studio floor (logical x: they mirror in Arabic). depth < 0 sits further back. */
const HERO_PROPS: { id: R6ModelId; view: "iso" | "front"; x: string; y: string; w: string; depth: number; phone: boolean }[] = [
  { id: "perfume", view: "iso", x: "52%", y: "68%", w: "12%", depth: 1, phone: true },
  { id: "rigid-box", view: "iso", x: "86%", y: "70%", w: "16%", depth: 1, phone: false },
  { id: "can", view: "front", x: "95%", y: "40%", w: "10%", depth: -1, phone: false },
]

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

/** Icon wall tiles: R6 cutouts (transparent, 1x file only: 68 px slots). */
const WALL_TONES = ["#f3e3d9", "#e2efec", "#ece6f3", "#f6ecd2", "#dfe7f1", "#efe5ef", "#e6e6e3"];
const WALL_ITEMS: { small: string; tone: string }[] = (Object.keys(R6_MODELS) as R6ModelId[]).map((id, i) => ({ small: src(R6.cutouts[`${id}-iso`]!), tone: WALL_TONES[i % WALL_TONES.length]! }));

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

/** webm + mp4 (720p) for a kit MediaCard. */
function loopSources(id: LoopId): { webm?: string; mp4?: string } | undefined {
  const v = loopVideo(id);
  if (!v) return undefined;
  return { webm: v.sources.find((x) => x.type === "video/webm")?.src, mp4: v.sources.find((x) => x.type === "video/mp4")?.src };
}

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

      {/* 1 ───────── Hero: full-bleed studio scene, rotating headline (kit Sheet hero) ───────── */}
      <HomeHero
        titles={c.hero.titles}
        lead={c.hero.lead}
        labels={{ pause: c.hero.pause, play: c.hero.play }}
        scenes={(["mailer", "rigid-box"] as LoopId[]).map((id, i) => ({
          poster: <R6Pic a={R6.loops[id].poster} sizes="(min-width: 1024px) 100vw, 160vw" className={s.heroPoster} priority={i === 0} />,
          video: loopVideo(id),
        }))}
        props={HERO_PROPS.map((p) => (
          <div key={p.id} className={s.heroProp} data-depth={p.depth} data-phone={p.phone ? "true" : "false"} style={{ ["--x" as string]: p.x, ["--y" as string]: p.y, ["--w" as string]: p.w }}>
            <R6Pic a={cut(p.id, p.view)} sizes="(min-width: 1024px) 18vw, 30vw" />
          </div>
        ))}
        actions={
          <PillRow className={s.heroPills}>
            <Pill href={startHref} size="lg">
              {c.hero.primary}
            </Pill>
            <Pill href={catalogHref} variant="outline" size="lg">
              {c.hero.secondary}
            </Pill>
          </PillRow>
        }
      />

      {/* 2 ───────── After-hero statement + studio rail (xl sheet over the hero) ───────── */}
      <Sheet tone="dark" y="xl" aria-labelledby="statement-title">
        <SectionHead
          id="statement-title"
          title={
            <>
              {c.statement.lead}
              <span className={s.statementRest}>{c.statement.rest}</span>
            </>
          }
        >
          <Stack gap="title-sub">
            <Marquee
              label={c.rail.label}
              pauseLabel={c.rail.pause}
              playLabel={c.rail.play}
              duration={90}
              gap="var(--mk-grid-gap)"
              items={RAIL.map((r) => (
                <figure key={r.id} className={s.railItem}>
                  <div className={s.railCard}>
                    <R6Pic a={studio(r.id, r.tone)} sizes="360px" alt={studio(r.id, r.tone).alt[locale]} />
                  </div>
                  <figcaption className={s.railCaption}>{modelCaption(r.id)}</figcaption>
                </figure>
              ))}
            />
            <p className={s.caption}>{sample}</p>
          </Stack>
        </SectionHead>
      </Sheet>

      {/* 3 ───────── Feature card: design in the browser ───────── */}
      <Sheet tone="dark" aria-labelledby="feature-title">
        <Reveal>
          <SheetCard tone="green" as="article" className={s.featureCard}>
            <SectionHead id="feature-title" title={c.feature.title} sub={<>{c.feature.body}{" "}<Link href={designerHref} className={s.textLink}>{c.feature.link}</Link></>} />
            <MotionScope className={s.featureVisual} pauseLabel={c.motion.feature[0]} playLabel={c.motion.feature[1]} buttonClassName={s.scopeBtn}>
              <div aria-hidden="true" className={s.fill}>
                <R6Pic a={cut("tuck-carton")} sizes="(min-width: 1024px) 460px, 70vw" className={s.featureImg} />
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
          </SheetCard>
        </Reveal>
      </Sheet>

      {/* 4 ───────── Every step in one place: 1:2:1 cards, kit Orbit in the middle ───────── */}
      <Sheet tone="dark" aria-labelledby="everywhere-title">
        <SectionHead
          id="everywhere-title"
          title={
            <span className={s.light}>
              {c.everywhere.title}
              <br />
              {c.everywhere.titleRest}
            </span>
          }
        >
          <Grid as="ul" cols={4} colsMd={2} className={s.trio}>
            <Reveal as="li" className={s.mediaCard} index={0}>
              <div className={s.mediaFrame}>
                <R6Pic a={studio("perfume", "dark")} sizes="(min-width: 1024px) 320px, 92vw" />
                <R6Pic a={ui("price-badge")} sizes="(min-width: 1024px) 280px, 80vw" className={s.floatUi} />
              </div>
              <div>
                <Display as="h3" size="20">
                  <Link href={designerHref} className={s.cardLink}>
                    {c.everywhere.cards[0]!.title}
                  </Link>
                </Display>
                <Body>{c.everywhere.cards[0]!.body}</Body>
              </div>
            </Reveal>
            <Reveal as="li" className={`${s.mediaCard} ${s.span2}`} index={1}>
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
              <div>
                <Display as="h3" size="20">
                  <Link href={`${base}/orders`} className={s.cardLink}>
                    {c.everywhere.cards[1]!.title}
                  </Link>
                </Display>
                <Body>{c.everywhere.cards[1]!.body}</Body>
              </div>
            </Reveal>
            <Reveal as="li" className={s.mediaCard} index={2}>
              <div className={s.mediaFrame}>
                <R6Pic a={studio("drawer-box", "light")} sizes="(min-width: 1024px) 320px, 92vw" />
                <R6Pic a={ui("vendor-job")} sizes="(min-width: 1024px) 240px, 70vw" className={`${s.floatUi} ${s.floatUiCard}`} />
              </div>
              <div>
                <Display as="h3" size="20">
                  <Link href={`${base}/vendors`} className={s.cardLink}>
                    {c.everywhere.cards[2]!.title}
                  </Link>
                </Display>
                <Body>{fill(c.everywhere.cards[2]!.body, vars)}</Body>
              </div>
            </Reveal>
          </Grid>
        </SectionHead>
      </Sheet>

      {/* 5 ───────── Delivered across Egypt ───────── */}
      <Sheet tone="dark" aria-labelledby="delivery-title">
        <SectionHead id="delivery-title" title={c.delivery.title}>
          <Reveal as="article" className={s.mapCard}>
            <MotionScope className={s.mapStage} pauseLabel={c.motion.delivery[0]} playLabel={c.motion.delivery[1]} buttonClassName={s.scopeBtn}>
              <div aria-hidden="true" className={s.fill}>
                <div className={s.mapGlow} data-at="start" />
                <div className={s.mapGlow} data-at="end" />
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
              <Display as="h3" size="20">
                {c.delivery.cardTitle}
              </Display>
              <Body>{fill(c.delivery.cardBody, vars)}</Body>
            </div>
          </Reveal>
        </SectionHead>
      </Sheet>

      {/* 6 ───────── For every business ───────── */}
      <Sheet tone="dark" y="lg" aria-labelledby="anyone-title">
        <SectionHead id="anyone-title" title={c.anyone.title}>
          <Grid as="ul" cols={3} colsMd={3} className={s.plainList}>
            {(
              [
                { id: "mailer", href: structureHref(locale, "FEFCO_0427") },
                { id: "cup", href: catalogHref },
                { id: "jar", href: `${base}/bottles` },
              ] as { id: R6ModelId; href: string }[]
            ).map((a, i) => (
              <Reveal as="li" key={a.id} className={s.mediaCard} index={i}>
                <div className={s.mediaFrame} data-ratio="wide">
                  <R6Pic a={studio(a.id, "light")} sizes="(min-width: 768px) 420px, 92vw" />
                  <span className={s.sampleTag}>{sample}</span>
                </div>
                <div>
                  <Display as="h3" size="20">
                    <Link href={a.href} className={s.cardLink}>
                      {c.anyone.cards[i]!.title}
                    </Link>
                  </Display>
                  <Body>{c.anyone.cards[i]!.body}</Body>
                </div>
              </Reveal>
            ))}
          </Grid>
          <PillRow align="center">
            <Pill href={catalogHref} variant="outline" size="lg">
              {c.anyone.cta}
            </Pill>
          </PillRow>
        </SectionHead>
      </Sheet>

      {/* 7 ───────── Violet sheet: the 3D designer ───────── */}
      <Sheet tone="violet" y="lg" aria-labelledby="designer-title">
        <SectionHead id="designer-title" title={c.designer.title}>
          {/* The prompt caret and sparkles loop: one pause control for the band (WCAG 2.2.2, R6-AX-15). */}
          <MotionScope pauseLabel={c.motion.designer[0]} playLabel={c.motion.designer[1]} buttonClassName={s.scopeBtn}>
          <Grid cols={3} colsMd={1}>
            <Reveal as="article" className={`${s.darkCard} ${s.span2}`} index={0}>
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
                <Display as="h3" size="20">
                  <Sparkles size={18} className={s.sparkle} aria-hidden />{" "}
                  <Link href={designerHref} className={s.cardLink}>
                    {c.designer.wideTitle}
                  </Link>
                </Display>
                <Body>{c.designer.wideBody}</Body>
              </div>
            </Reveal>
            <Reveal as="article" className={s.darkCard} index={1}>
              <div className={s.darkCardMedia}>
                <MediaCard
                  className={s.loopCard}
                  ratio="auto"
                  poster={{ src: src(R6.loops.perfume.poster), srcSet: srcSetW(R6.loops.perfume.poster, "webp"), sizes: "(min-width: 1024px) 420px, 92vw", width: R6.loops.perfume.poster.width, height: R6.loops.perfume.poster.height, alt: R6.loops.perfume.alt[locale] }}
                  video={loopSources("perfume")}
                />
              </div>
              <div className={s.darkCardBody}>
                <Display as="h3" size="20">
                  {c.designer.narrowTitle}
                </Display>
                <Body>{c.designer.narrowBody}</Body>
              </div>
            </Reveal>
          </Grid>
          </MotionScope>
        </SectionHead>
      </Sheet>

      {/* 8 ───────── Catalogue wall (the reference's app grid), paused by MotionScope ───────── */}
      <Sheet tone="navy" y="lg" overlap={false} container={false} className={s.wallSheet} aria-labelledby="wall-title">
        <MotionScope className={s.wall} pauseLabel={c.wall.pause} playLabel={c.wall.play} buttonClassName={s.wallControl}>
          <div className={s.wallRows} aria-hidden="true">
            {[0, 1, 2, 3].map((r) => {
              const k = (r * 5) % WALL_ITEMS.length;
              const once = [...WALL_ITEMS.slice(k), ...WALL_ITEMS.slice(0, k)];
              const row = [...once, ...once];
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
              <SectionHead id="wall-title" title={fill(c.wall.title, vars)} sub={<>{fill(c.wall.body, vars)}{" "}<Link href={catalogHref} className={s.textLink}>{c.wall.link}</Link></>} />
            </Reveal>
          </Container>
        </MotionScope>
      </Sheet>

      {/* 9 ───────── Finishes (navy, collapses into the wall band) ───────── */}
      <Sheet tone="navy" y="lg" overlap={false} aria-labelledby="finishes-title">
        <SectionHead id="finishes-title" title={c.finishes.title} sub={<>{fill(c.finishes.body, vars)}{" "}<Link href={structureHref(locale, "RIGID_BOX")} className={s.textLink}>{c.finishes.link}</Link></>}>
          <Reveal variant="scale">
            <MotionScope className={s.navyPanel} pauseLabel={c.motion.finishes[0]} playLabel={c.motion.finishes[1]} buttonClassName={s.scopeBtn}>
              <div className={s.navyGlow} aria-hidden="true" />
              <R6Pic a={cut("rigid-box")} sizes="(min-width: 1024px) 520px, 60vw" className={s.navyImg} />
              <ul className={s.finishList}>
                {c.finishes.names.map((n, i) => (
                  <li key={n} className={s.finishChip} style={{ ["--t" as string]: FINISH_SPOTS[i]!.t, ["--s" as string]: FINISH_SPOTS[i]!.s, ["--dl" as string]: FINISH_SPOTS[i]!.dl }}>
                    {n}
                  </li>
                ))}
              </ul>
            </MotionScope>
          </Reveal>
        </SectionHead>
      </Sheet>

      {/* 10 ───────── Green sheet: price, real numbers, secure payment ───────── */}
      <Sheet tone="green" y="lg" aria-labelledby="stats-title">
        <SectionHead id="stats-title" title={c.stats.title} size="64" align="center" lg>
          <Stack gap="head-content-lg">
            <Grid cols={2} colsMd={1} className={s.middle}>
              <Reveal>
                <SectionHead as="h3" size="44" title={c.stats.checkoutTitle}>
                  <Stack gap="head-content">
                    <Grid as="ul" cols={2} colsMd={2} colsSm={2} gap="bento" className={s.plainList}>
                      {stats.map((st) => (
                        <li key={st.label} className={s.stat}>
                          <Stat value={st.value} label={st.label} />
                        </li>
                      ))}
                    </Grid>
                    <Stack gap="title-sub">
                      {row500 ? <p className={s.rule}>{fill(c.stats.rule, vars)}</p> : null}
                      <p className={s.footnote}>{c.stats.note}</p>
                    </Stack>
                  </Stack>
                </SectionHead>
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
            </Grid>
            <Grid cols={2} colsMd={1} className={s.middle}>
              <Reveal>
                <SectionHead as="h3" size="44" title={c.stats.secureTitle} sub={c.stats.secureBody} />
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
            </Grid>
          </Stack>
        </SectionHead>
      </Sheet>

      {/* 11 ───────── Steps (closing xl sheet; kit Steps: tabs, progress underline, media swap) ───────── */}
      <Sheet tone="dark" y="xl" className={s.sheetSteps} aria-labelledby="steps-title">
        <SectionHead id="steps-title" title={c.steps.title} size="64">
          <Steps
            label={c.steps.title}
            items={[
              { title: c.steps.items[0]!, media: stepMedia(studio("tuck-carton", "light"), cut("perfume")) },
              { title: c.steps.items[1]!, media: stepMedia(studio("mailer", "dark"), ui("price-badge")) },
              { title: c.steps.items[2]!, media: stepMedia(studio("rigid-box", "dark"), ui("order-timeline")) },
            ]}
          />
          <PillRow>
            <Pill href={startHref} size="lg">
              {c.steps.cta}
            </Pill>
          </PillRow>
        </SectionHead>
      </Sheet>
    </div>
  );
}
