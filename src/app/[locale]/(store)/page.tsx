import type { Metadata } from "next";
import Link from "next/link";
import {
  AppWindow,
  ArrowRight,
  BadgeCheck,
  Calculator,
  CreditCard,
  Droplet,
  Feather,
  FileCheck2,
  Gift,
  Pill,
  Rotate3d,
  Shirt,
  ShoppingBag,
  Sparkles,
  Stamp,
  Tag,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { getT, pick, toLocale } from "@/i18n";
import type { DictKey } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { siteUrl } from "@/lib/env";
import type { StructureCode } from "@/types";
import { JsonLd } from "@/components/store/JsonLd";
import { faqJsonLd } from "@/components/store/jsonld";
import { designHref, structureHref } from "@/components/store/catalog";
import { getPriceFrom, listStructures, listVendors } from "@/components/store/data";
import { filterVendors } from "@/components/store/vendor-filters";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { HeroPhoneForm } from "@/components/marketing/HeroPhoneForm";
import { Marquee } from "@/components/marketing/Marquee";
import { MarketingFaq } from "@/components/marketing/Faq";
import { VendorShowcaseCard } from "@/components/marketing/VendorShowcaseCard";
import { SAMPLES, renderSrc } from "@/components/marketing/assets";
import styles from "@/components/marketing/marketing.module.css";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

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
      images: ["/marketing/renders/fefco-0427.webp"],
    },
  };
}

const VALUES = [
  { key: "design", icon: Rotate3d },
  { key: "price", icon: Calculator },
  { key: "vendors", icon: BadgeCheck },
  { key: "proof", icon: FileCheck2 },
  { key: "pay", icon: CreditCard },
  { key: "delivery", icon: Truck },
] as const;

const USE_CASES: { key: string; icon: typeof ShoppingBag; structure: StructureCode; bg: string; fg: string; ring: string }[] = [
  { key: "ecommerce", icon: ShoppingBag, structure: "FEFCO_0427", bg: "#e6f7ee", fg: "#047b5d", ring: "rgba(230,247,238,.6)" },
  { key: "food", icon: UtensilsCrossed, structure: "PIZZA", bg: "#fff1e3", fg: "#8a4b00", ring: "rgba(255,241,227,.6)" },
  { key: "cosmetics", icon: Sparkles, structure: "ECMA_RTE", bg: "#fde8ef", fg: "#a1214f", ring: "rgba(253,232,239,.6)" },
  { key: "apparel", icon: Shirt, structure: "FEFCO_0201", bg: "#e8f1ff", fg: "#1f4fbf", ring: "rgba(232,241,255,.6)" },
  { key: "gifts", icon: Gift, structure: "RIGID_BOX", bg: "#f0eaff", fg: "#5b3fc4", ring: "rgba(240,234,255,.6)" },
  { key: "pharma", icon: Pill, structure: "ECMA_CLB", bg: "#e3f6f6", fg: "#0b6b6b", ring: "rgba(227,246,246,.6)" },
];

const FINISHES = [
  { key: "foil", icon: Sparkles },
  { key: "spotUv", icon: Droplet },
  { key: "emboss", icon: Stamp },
  { key: "softTouch", icon: Feather },
  { key: "window", icon: AppWindow },
  { key: "labels", icon: Tag },
] as const;

const STAT_TAGS = [
  { label: { ar: "القاهرة", en: "Cairo" }, top: "22%", start: "12%" },
  { label: { ar: "الإسكندرية", en: "Alexandria" }, top: "10%", start: "52%" },
  { label: { ar: "المنصورة", en: "Mansoura" }, top: "40%", start: "62%" },
  { label: { ar: "أسيوط", en: "Asyut" }, top: "62%", start: "8%" },
  { label: { ar: "الأقصر", en: "Luxor" }, top: "78%", start: "44%" },
  { label: { ar: "بورسعيد", en: "Port Said" }, top: "54%", start: "70%" },
];

export default async function HomePage({ params, searchParams }: Props) {
  const locale = toLocale((await params).locale);
  const sp = await searchParams;
  const t = getT(locale);
  const base = `/${locale}`;
  const [structures, vendors, mailerPrice] = await Promise.all([
    listStructures(),
    listVendors(),
    getPriceFrom("FEFCO_0427", { L: 250, W: 180, H: 80 }),
  ]);
  const featured = filterVendors(vendors, { sort: "recommended" }).slice(0, 3);
  const lead = featured[0];
  const row500 = mailerPrice.rows.find((r) => r.quantity === 500) ?? mailerPrice.rows[0];
  const onTime = vendors.length ? Math.round(vendors.reduce((s, v) => s + v.onTimePct, 0) / vendors.length) : null;
  const faq = [1, 2, 3, 4, 5, 6].map((n) => ({ q: t(`store.home.faq.q${n}` as DictKey), a: t(`store.home.faq.a${n}` as DictKey) }));
  const startHref = designHref(locale, { structure: "FEFCO_0427" });
  const structureName = (code: StructureCode) => {
    const s = structures.find((x) => x.code === code);
    return s ? pick(locale, s.name.ar, s.name.en) : t(`structures.${code}` as DictKey);
  };
  const sampleAlt = (s: (typeof SAMPLES)[number]) =>
    t("marketing.marquee.caption", { name: s.structure ? structureName(s.structure) : t(`marketing.bottles.items.${s.vessel}` as DictKey) });

  return (
    <>
      <JsonLd data={faqJsonLd(faq)} />
      {sp.denied ? (
        <div className={styles.container}>
          <p className={styles.managed} role="status" style={{ marginBlockStart: 16 }}>
            {t("store.deniedBanner")}
          </p>
        </div>
      ) : null}

      {/* ───────── Hero (split, live 3D) ───────── */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <span className={`${styles.eyebrow} m-enter`} style={{ ["--m-i" as string]: 0 }}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              {t("marketing.hero.eyebrow")}
            </span>
            <h1 id="hero-title" className={`${styles.h1} m-enter-lcp`} style={{ ["--m-i" as string]: 1 }}>
              {t("marketing.hero.title")}
            </h1>
            <p className={`${styles.lead} m-enter`} style={{ ["--m-i" as string]: 2 }}>
              {t("marketing.hero.body")}
            </p>
            <div className="m-enter" style={{ ["--m-i" as string]: 3, inlineSize: "100%" }}>
              <HeroPhoneForm
                locale={locale}
                designPath={startHref}
                labels={{
                  label: t("marketing.hero.phoneLabel"),
                  placeholder: t("marketing.hero.phonePlaceholder"),
                  submit: t("marketing.hero.submit"),
                  error: t("marketing.hero.phoneError"),
                  fine: t("marketing.hero.fine"),
                }}
              />
            </div>
          </div>
          <div className="m-enter-scale" style={{ ["--m-i" as string]: 2 }}>
            <HeroVisual
              poster="/marketing/renders/fefco-0427.webp"
              labels={{
                viewer: t("store.home.viewerLabel"),
                roleDescription: t("viewer.roleDescription"),
                keyboardHint: t("viewer.keyboardHint"),
                unsupported: t("viewer.unsupported"),
                pause: t("store.home.pause"),
                play: t("store.home.play"),
              }}
              chips={{
                priceTitle: t("marketing.hero.chips.price"),
                priceValue: row500 ? t("marketing.hero.chips.priceValue", { price: formatMoney(row500.unitPiasters, locale) }) : "—",
                priceNote: t("marketing.hero.chips.priceNote"),
                approved: t("marketing.hero.chips.approved"),
                approvedBy: t("marketing.hero.chips.approvedBy", { vendor: lead ? pick(locale, lead.name.ar, lead.name.en) : t("meta.siteName") }),
                rating: t("marketing.hero.chips.rating", { rating: (lead?.rating ?? 4.8).toFixed(1) }),
                ratingCount: t("marketing.hero.chips.ratingCount", { count: formatNumber(lead?.ratingCount ?? 0) }),
                delivered: t("marketing.hero.chips.delivered", { place: t("marketing.hero.chips.deliveredPlace") }),
                deliveredMeta: t("marketing.hero.chips.deliveredMeta"),
              }}
            />
          </div>
        </div>
      </section>

      {/* ───────── Printed samples marquee ───────── */}
      <Marquee
        label={t("marketing.marquee.label")}
        pause={t("marketing.marquee.pause")}
        play={t("marketing.marquee.play")}
        items={SAMPLES.map((s) => ({ src: s.src, alt: sampleAlt(s) }))}
      />

      {/* ───────── Value grid ───────── */}
      <section className={`${styles.band} ${styles.bandTint}`} aria-labelledby="values-title">
        <div className={styles.container}>
          <div className={`${styles.sectionHead} ${styles.center}`} data-reveal="" suppressHydrationWarning>
            <h2 id="values-title" className={`${styles.h2} ${styles.center}`}>
              {t("marketing.values.title")}
            </h2>
          </div>
          <ul className={styles.valueGrid}>
            {VALUES.map(({ key, icon: I }, i) => (
              <li key={key} className={styles.valueItem} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: i % 3 }}>
                <I className={styles.valueIcon} strokeWidth={1.5} aria-hidden />
                <h3 className={styles.h3}>{t(`marketing.values.items.${key}Title` as DictKey)}</h3>
                <p className={styles.body}>{t(`marketing.values.items.${key}Body` as DictKey)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Stats ───────── */}
      <section className={`${styles.band} ${styles.bandGrey}`} aria-labelledby="stats-title">
        <div className={`${styles.container} ${styles.statsGrid}`}>
          <div className={styles.statsVisual} aria-hidden="true" data-reveal="scale" suppressHydrationWarning>
            <div className={styles.statsOrb} />
            {STAT_TAGS.map((s) => (
              <span key={s.label.en} className={styles.statsTag} style={{ insetBlockStart: s.top, insetInlineStart: s.start }}>
                {s.label[locale]}
              </span>
            ))}
          </div>
          <div>
            <h2 id="stats-title" className={`${styles.h2} ${styles.statsTitle}`} data-reveal="" suppressHydrationWarning>
              {t("marketing.stats.titleStart")} <span className={styles.highlight}>{t("marketing.stats.titleHighlight")}</span>
            </h2>
            <ul className={styles.statsList}>
              {[
                { v: formatNumber(vendors.length), l: t("marketing.stats.printers") },
                { v: "27", l: t("marketing.stats.governorates") },
                { v: onTime != null ? `${formatNumber(onTime)}%` : "—", l: t("marketing.stats.onTime") },
                { v: "100", l: t("marketing.stats.minOrder") },
              ].map((s, i) => (
                <li key={s.l} className={styles.statItem} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: i }}>
                  <span className={styles.statValue} dir="ltr">
                    {s.v}
                  </span>
                  <span className={styles.statLabel}>{s.l}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── Use cases ───────── */}
      <section className={styles.band} aria-labelledby="uses-title">
        <div className={styles.container}>
          <div className={styles.sectionHead} data-reveal="" suppressHydrationWarning>
            <span className={styles.eyebrow}>{t("marketing.useCases.eyebrow")}</span>
            <h2 id="uses-title" className={styles.h2}>
              {t("marketing.useCases.title")}
            </h2>
          </div>
          <ul className={styles.cardGrid}>
            {USE_CASES.map((u, i) => {
              const title = t(`marketing.useCases.items.${u.key}Title` as DictKey);
              const I = u.icon;
              return (
                <li key={u.key} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: i % 3 }}>
                  <article className={styles.card}>
                    <span className={styles.circleIcon} style={{ ["--tint-bg" as string]: u.bg, ["--tint-fg" as string]: u.fg, ["--tint-ring" as string]: u.ring }} aria-hidden="true">
                      <I size={24} />
                    </span>
                    <h3 className={styles.h3}>
                      <Link href={structureHref(locale, u.structure)} className={styles.cardLink}>
                        {title}
                      </Link>
                    </h3>
                    <p className={styles.body}>{t(`marketing.useCases.items.${u.key}Body` as DictKey)}</p>
                    <span className={styles.cardArrow} aria-hidden="true">
                      {structureName(u.structure)}
                      <ArrowRight size={16} />
                    </span>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ───────── Design in 3D (grey band) ───────── */}
      <section id="how" className={`${styles.band} ${styles.bandGrey}`} aria-labelledby="how-title">
        <div className={styles.container}>
          <div className={styles.designHead} data-reveal="" suppressHydrationWarning>
            <span className={styles.eyebrow}>{t("marketing.design.eyebrow")}</span>
            <h2 id="how-title" className={styles.h2}>
              {t("marketing.design.title")}
            </h2>
            <p className={styles.lead}>{t("marketing.design.body")}</p>
          </div>
          <div className={styles.browser} data-reveal="scale" suppressHydrationWarning>
            <div className={styles.browserBar} aria-hidden="true">
              <span />
              <span />
              <span />
              <span className={styles.browserUrl}>elba.eg/design</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/marketing/designer-${locale}.webp`} alt={t("marketing.design.imageAlt")} width={1440} height={900} loading="lazy" decoding="async" />
          </div>
          <ol className={styles.steps}>
            {[1, 2, 3].map((n) => (
              <li key={n} className={styles.step} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: n - 1 }}>
                <span className={styles.stepNum} aria-hidden="true">
                  0{n}
                </span>
                <h3 className={styles.h3}>{t(`marketing.design.steps.s${n}Title` as DictKey)}</h3>
                <p className={styles.body}>{t(`marketing.design.steps.s${n}Body` as DictKey)}</p>
              </li>
            ))}
          </ol>
          <div className={`${styles.actions} ${styles.designCta}`}>
            <Link href={startHref} className={`${styles.pill} ${styles.pillLarge}`}>
              {t("marketing.design.cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Finishes (mint tiles) ───────── */}
      <section id="finishes" className={styles.band} aria-labelledby="finishes-title">
        <div className={styles.container}>
          <div className={styles.sectionHead} data-reveal="" suppressHydrationWarning>
            <h2 id="finishes-title" className={styles.h2}>
              {t("marketing.finishes.title")}
            </h2>
            <p className={styles.lead}>{t("marketing.finishes.body")}</p>
          </div>
          <ul className={styles.tileGrid}>
            {FINISHES.map(({ key, icon: I }, i) => (
              <li key={key} className={styles.tile} data-reveal="" suppressHydrationWarning style={{ ["--m-i" as string]: i % 3 }}>
                <span className={styles.mintTile} aria-hidden="true">
                  <I size={28} strokeWidth={1.75} />
                </span>
                <h3 className={styles.h3}>{t(`marketing.finishes.items.${key}Title` as DictKey)}</h3>
                <p className={styles.body}>{t(`marketing.finishes.items.${key}Body` as DictKey)}</p>
              </li>
            ))}
          </ul>
          <div className={styles.tilesCta}>
            <Link href={`${base}/catalog`} className={`${styles.pill} ${styles.pillOutline} ${styles.pillLarge}`}>
              {t("home.ctaCatalog")}
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Featured printers ───────── */}
      {featured.length ? (
        <section className={`${styles.band} ${styles.bandGrey}`} aria-labelledby="printers-title">
          <div className={styles.container}>
            <div className={styles.sectionHeadRow} data-reveal="" suppressHydrationWarning>
              <div>
                <span className={styles.eyebrow}>{t("marketing.printers.eyebrow")}</span>
                <h2 id="printers-title" className={styles.h2}>
                  {t("marketing.printers.title")}
                </h2>
                <p className={styles.lead}>{t("marketing.printers.body")}</p>
              </div>
              <Link href={`${base}/vendors`} className={`${styles.pill} ${styles.pillOutline}`}>
                {t("marketing.printers.all")}
              </Link>
            </div>
            <ul className={styles.cardGrid}>
              {featured.map((v, i) => (
                <VendorShowcaseCard key={v.id} locale={locale} vendor={v} index={i} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ───────── FAQ ───────── */}
      <section id="faq" className={styles.band} aria-labelledby="faq-title">
        <div className={`${styles.container} ${styles.faqGrid}`}>
          <div data-reveal="" suppressHydrationWarning>
            <h2 id="faq-title" className={styles.h2}>
              {t("marketing.faq.title")}
            </h2>
          </div>
          <div data-reveal="" suppressHydrationWarning>
            <MarketingFaq items={faq} />
          </div>
        </div>
      </section>

      {/* ───────── Closing dark CTA ───────── */}
      <section className={`${styles.band} ${styles.dark} ${styles.ctaBand}`} aria-labelledby="cta-title">
        <div className={styles.ctaGridLines} aria-hidden="true" />
        <div className={styles.ctaGlow} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.ctaInner} data-reveal="" suppressHydrationWarning>
            <h2 id="cta-title" className={`${styles.h2} ${styles.ctaTitle}`}>
              {t("marketing.cta.title")}
            </h2>
            <p className={styles.lead}>{t("marketing.cta.body")}</p>
            <div className={`${styles.actions} ${styles.center}`}>
              <Link href={startHref} className={`${styles.pill} ${styles.pillLime} ${styles.pillLarge}`}>
                {t("marketing.cta.primary")}
              </Link>
              <Link href={`${base}/vendors`} className={`${styles.pill} ${styles.pillGhostDark} ${styles.pillLarge}`}>
                {t("marketing.cta.secondary")}
              </Link>
            </div>
          </div>
          <ul className={styles.ctaTiles} aria-hidden="true">
            <li className={styles.ctaTile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SAMPLES[2].src} alt="" loading="lazy" width={320} height={400} />
            </li>
            <li className={styles.ctaCardUi}>
              <span className={styles.chipMeta}>{t("marketing.cta.tileOrder")}</span>
              <strong>{t("marketing.cta.tileOrderStatus")}</strong>
              <span className={styles.chipUp}>{t("marketing.cta.tileOrderMeta")}</span>
              <svg className={styles.spark} viewBox="0 0 200 60" fill="none">
                <path d="M2 52 C40 50 60 40 90 36 S150 18 198 6" stroke="#d4f36b" strokeWidth="3" strokeLinecap="round" />
                <circle cx="198" cy="6" r="4" fill="#d4f36b" />
              </svg>
            </li>
            <li className={styles.ctaTile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SAMPLES[0].src} alt="" loading="lazy" width={320} height={400} />
            </li>
            <li className={styles.ctaCardUi}>
              <span className={styles.chipMeta}>{t("marketing.cta.tileProofMeta")}</span>
              <strong>{t("marketing.cta.tileProof")}</strong>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={renderSrc("ECMA_RTE")} alt="" loading="lazy" width={200} height={150} style={{ inlineSize: "100%", blockSize: "auto", marginBlockStart: "auto" }} />
            </li>
            <li className={styles.ctaTile}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SAMPLES[6].src} alt="" loading="lazy" width={320} height={400} />
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
