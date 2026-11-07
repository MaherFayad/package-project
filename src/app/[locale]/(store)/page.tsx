import { publicFileExists } from "@/lib/runtime/public-files";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BadgeCheck, FileCheck2, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
import { getT, toLocale } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import { QTY_TIERS, type StructureCode } from "@/types";
import { structureHref } from "@/components/store/catalog";
import { getPriceFrom, getReferenceUnit, listStructures, listVendors } from "@/components/store/data";
import { renderDims, renderSrc } from "@/components/marketing/assets";
import { DeniedBanner } from "@/components/marketing/DeniedBanner";
import { startHref as kitStartHref } from "@/components/marketing/MarketingHeader";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { SectionHead, Stack } from "@/components/marketing/kit/SectionHead";
import { Grid } from "@/components/marketing/kit/Grid";
import { Body, Display } from "@/components/marketing/kit/Display";
import { Pill, PillRow } from "@/components/marketing/kit/Pill";
import { Reveal } from "@/components/marketing/kit/Reveal";
import { Faq } from "@/components/marketing/kit/Faq";
import { R6, SAMPLE_LABEL, type R6Image, type R6ModelId } from "@/components/marketing/kit/assets";
import { HomeHero, type HeroVideo } from "@/components/marketing/home/HomeHero";
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

type LoopId = keyof typeof R6.loops;

/** A turntable loop from the assets branch (720p below 1024px, 1080p above), or null if not shipped. */
function loopVideo(id: LoopId): HeroVideo | null {
  const loop = R6.loops[id];
  const has = loop.sources.every((x) => publicFileExists(x.src));
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
];

const TRUST_ICONS: Record<string, ReactNode> = {
  proof: <FileCheck2 size={22} aria-hidden />,
  reprint: <RefreshCcw size={22} aria-hidden />,
  pay: <ShieldCheck size={22} aria-hidden />,
  delivery: <Truck size={22} aria-hidden />,
};

/**
 * "What we print" (copy `products.items[].key`): the printed structure whose price per piece for
 * 500 pieces the card shows (`getReferenceUnit`, default size, as returned: ex-VAT, all-in), the
 * page it links to, and a studio render (`r6`) or a catalogue render (food boxes have no studio
 * shot). Every code here is priced instantly by a seeded printer (`capabilities.structures` in
 * prisma/seed.ts).
 */
const PRODUCTS: Record<string, { code: StructureCode; r6?: R6ModelId; href?: (l: "ar" | "en") => string }> = {
  mailer: { code: "FEFCO_0427", r6: "mailer" },
  carton: { code: "ECMA_RTE", r6: "tuck-carton" },
  food: { code: "PIZZA" },
  rigid: { code: "RIGID_BOX", r6: "rigid-box" },
  // R3-02: labels and pouches are priced instantly and ordered from the designer, so both cards
  // open a page with that price and an order path (/bottles lists the label containers).
  labels: { code: "ROLL_LABEL", r6: "jar", href: (l) => `/${l}/bottles` },
  pouches: { code: "PRINTED_POUCH", r6: "pouch", href: (l) => `/${l}/design/stand-up-pouch` },
};

const cut = (id: R6ModelId, view: "iso" | "front" = "iso"): R6Image => R6.cutouts[`${id}-${view}`]!;
const studio = (id: R6ModelId, tone: "dark" | "light", view: "iso" | "front" = "iso"): R6Image => R6.hero[`${id}-${view}-${tone}`]!;

/**
 * Home, phone-first and short (R1-12): hero → what we print (price for 500) → Elba's guarantee →
 * how ordering works (3 steps) → 4 questions → closing CTA. Every "Get your box price" goes to the
 * /boxes chooser (R1-04). The model wall, finishes band, stats/receipt and 3D-preview band were
 * cut: they repeated the price, the steps and the model count.
 */
export default async function HomePage({ params }: Props) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const c = homeCopy(locale);
  const [structures, vendors, mailer] = await Promise.all([listStructures(), listVendors(), getPriceFrom("FEFCO_0427", { L: 250, W: 180, H: 80 })]);
  // Price per piece for 500 pieces per printed product (null when inactive or not instantly priced).
  const prices = new Map(
    await Promise.all(
      Object.entries(PRODUCTS).map(async ([key, p]) => {
        const st = structures.find((x) => x.code === p.code);
        return [key, st ? await getReferenceUnit(p.code, st.defaultDims).catch(() => null) : null] as const;
      }),
    ),
  );
  const row500 = mailer.rows.find((r) => r.quantity === 500) ?? null;
  const money = (p: number) => formatMoney(p, locale, { alwaysDecimals: true });
  const days = row500?.deliveryDays ?? null;
  const printers = vendors.length;
  // R1-08: the smallest quantity checkout actually offers (not the printers' own minimum).
  const minOrder = mailer.minQuantity;
  const vars = {
    days: days ?? "—",
    daysWord: daysWord(locale, days ?? 0),
    printers,
    printersWord: printersWord(locale, printers),
    min: minOrder != null ? formatNumber(minOrder) : "—",
    max: formatNumber(QTY_TIERS[QTY_TIERS.length - 1]!),
  };
  const startHref = kitStartHref(locale);
  const sample = SAMPLE_LABEL[locale];

  // FAQ answers that quote live numbers are dropped when the number is unknown.
  const faq = c.faq.items
    .filter((f) => (f.key === "min" ? minOrder != null : f.key === "days" ? days != null : true))
    .map((f) => ({ q: f.q, a: <p className={s.faqText}>{fill(f.a, vars)}</p> }));

  return (
    <div className={s.page}>
      <Suspense fallback={null}>
        <DeniedBanner message={t("store.deniedBanner")} />
      </Suspense>

      {/* 1 ───────── Hero: printed packaging for your brand, one primary action, three proof points ───────── */}
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
          <>
            <PillRow className={s.heroPills}>
              <Pill href={startHref} size="lg">
                {c.hero.primary}
              </Pill>
              <Pill href="#products" variant="outline" size="lg">
                {c.hero.secondary}
              </Pill>
            </PillRow>
            <ul className={s.heroTrust} aria-label={c.hero.trustLabel}>
              {c.hero.trust.map((x) => (
                <li key={x}>
                  <BadgeCheck size={16} aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          </>
        }
      />

      {/* 2 ───────── What we print: everyday names, price per piece for 500 pieces ───────── */}
      <Sheet tone="dark" y="xl" id="products" aria-labelledby="products-title">
        <SectionHead id="products-title" title={c.products.title} sub={c.products.sub}>
          <Stack gap="head-content">
            <Grid as="ul" cols={3} colsMd={2} colsSm={1} className={s.plainList}>
              {c.products.items.map((it, i) => {
                const p = PRODUCTS[it.key]!;
                const price = prices.get(it.key);
                const href = p.href ? p.href(locale) : structureHref(locale, p.code);
                const pic = renderSrc(p.code);
                return (
                  <Reveal as="li" key={it.key} className={s.productCard} index={i % 3}>
                    <div className={s.mediaFrame} data-ratio="wide" data-tone={p.r6 ? undefined : "light"}>
                      {p.r6 ? (
                        <R6Pic a={studio(p.r6, "light")} sizes="(min-width: 1024px) 400px, (min-width: 640px) 46vw, 92vw" alt="" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pic} alt="" {...renderDims(pic)} loading="lazy" decoding="async" className={s.productRender} />
                      )}
                    </div>
                    <div className={s.productText}>
                      <Display as="h3" size="20">
                        <Link href={href} className={s.cardLink}>
                          {it.title}
                        </Link>
                      </Display>
                      <Body>{it.body}</Body>
                      {price != null ? <p className={s.productPrice}>{fill(c.products.from, { price: money(price) })}</p> : null}
                    </div>
                  </Reveal>
                );
              })}
            </Grid>
            <p className={s.caption}>
              {c.products.note} {sample}
            </p>
            <PillRow>
              <Pill href={startHref} size="lg">
                {c.products.cta}
              </Pill>
            </PillRow>
          </Stack>
        </SectionHead>
      </Sheet>

      {/* 3 ───────── Elba's guarantee, high on the page (R1-12): reprint or refund, proof, payment, delivery ───────── */}
      <Sheet tone="dark" y="lg" id="guarantee" aria-labelledby="trust-title">
        <SectionHead id="trust-title" title={c.trust.title}>
          <Grid as="ul" cols={2} colsMd={2} colsSm={1} className={s.plainList}>
            {c.trust.items.map((it, i) => (
              <Reveal as="li" key={it.key} className={s.iconCard} index={i % 2}>
                <span className={s.iconBadge} data-tone="green">
                  {TRUST_ICONS[it.key]}
                </span>
                <Display as="h3" size="20">
                  {it.title}
                </Display>
                <Body>{fill(it.body, vars)}</Body>
              </Reveal>
            ))}
          </Grid>
        </SectionHead>
      </Sheet>

      {/* 4 ───────── How ordering works: choose → logo + price → approve, pay, receive ───────── */}
      <Sheet tone="dark" y="lg" id="how" aria-labelledby="how-title">
        <SectionHead id="how-title" title={c.how.title} sub={c.how.sub}>
          <Stack gap="head-content">
            <Grid as="ol" cols={3} colsMd={3} colsSm={1} className={`${s.plainList} ${s.howGrid}`}>
              {c.how.steps.map((st, i) => (
                <Reveal as="li" key={st.title} className={s.howCard} index={i % 3}>
                  <span className={s.howNum}>{fill(c.how.step, { n: i + 1 })}</span>
                  <Display as="h3" size="20">
                    {st.title}
                  </Display>
                  <Body>
                    {st.body}
                    {i === c.how.steps.length - 1 && days != null ? <> {fill(c.how.daysLine, vars)}</> : null}
                  </Body>
                </Reveal>
              ))}
            </Grid>
            <PillRow>
              <Pill href={startHref} size="lg">
                {c.how.cta}
              </Pill>
            </PillRow>
          </Stack>
        </SectionHead>
      </Sheet>

      {/* 5 ───────── FAQ about ordering and printing (light sheet for easy reading) ───────── */}
      <Sheet tone="light" y="lg" aria-labelledby="faq-title">
        <SectionHead id="faq-title" title={c.faq.title}>
          <Faq items={faq} name="home-faq" className={s.faq} />
        </SectionHead>
      </Sheet>

      {/* 6 ───────── Closing call to action ───────── */}
      <Sheet tone="dark" y="xl" className={s.sheetSteps} aria-labelledby="final-title">
        <div className={s.final}>
          <div className={s.finalArt} aria-hidden="true">
            <R6Pic a={cut("mailer")} sizes="(min-width: 1024px) 360px, 60vw" />
          </div>
          <SectionHead id="final-title" title={c.final.title} sub={c.final.body} size="64" align="center">
            <PillRow align="center">
              <Pill href={startHref} size="lg">
                {c.final.cta}
              </Pill>
            </PillRow>
          </SectionHead>
        </div>
      </Sheet>
    </div>
  );
}
