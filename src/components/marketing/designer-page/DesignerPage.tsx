import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  Smartphone,
  Store,
} from "lucide-react";
import type {
  Locale,
  PaymentMethod,
  StructureCode,
  StructureFamily,
} from "@/types";
import { FINISH_CODES, MATERIAL_CODES } from "@/types";
import type { DictKey, TFunction } from "@/i18n";
import { JsonLd } from "@/components/store/JsonLd";
import { faqJsonLd } from "@/components/store/jsonld";
import { designHref, structureHref } from "@/components/store/catalog";
import { HeroImage } from "../HeroImage";
import { Sheet } from "../kit/Sheet";
import { Display } from "../kit/Display";
import { Container } from "../kit/Container";
import { SectionHead, Stack } from "../kit/SectionHead";
import { Grid } from "../kit/Grid";
import { Pill } from "../kit/Pill";
import { renderDims, renderSrc, srcSetFor } from "../assets";
import {
  R6,
  SAMPLE_LABEL,
  srcSet as r6SrcSet,
  src as r6Src,
} from "../kit/assets";
import { designerPageCopy, fill } from "./copy";
import { LiveBox, type LoopSource } from "./LiveBox";
import { PromptBar } from "./PromptBar";
import { Marquee } from "../kit/Marquee";
import { Faq } from "../kit/Faq";
import { Glow } from "../kit/Glow";
import { MotionScope } from "../kit/MotionScope";
import { StartCarousel } from "./StartCarousel";
import {
  ColourMock,
  CropMock,
  DielineMock,
  LinkMock,
  MockupMock,
  OrderMock,
  ProofMock,
  TextMock,
} from "./mockups";
import styles from "./designer-page.module.css";

export interface DesignerPageData {
  locale: Locale;
  t: TFunction;
  /** Box styles for the wall, in catalogue order (name in both languages). */
  styles: { code: StructureCode; family: StructureFamily; name: string }[];
  /** "EGP 4.20" unit price of the default mailer at 500, from the pricing engine (null when no rate card). */
  mailerUnit500: string | null;
  vendorCount: number;
  modelCount: string;
  vatPct: number;
  payMethods: PaymentMethod[];
  dielineSvg: string;
  bleedMm: number;
  safeMm: number;
  host: string;
  /** Mailer turntable loop from the ASSETS kit, when its files are deployed. */
  loop?: LoopSource[];
}

/** Board and finish swatches for the materials wall (a colour study of each, not a photo). */
const MAT_SWATCH: Record<string, string> = {
  E_FLUTE_KRAFT:
    "repeating-linear-gradient(90deg,#b98a56 0 3px,#a87a48 3px 6px)",
  E_FLUTE_WHITE:
    "repeating-linear-gradient(90deg,#f2efe8 0 3px,#e1ddd3 3px 6px)",
  B_FLUTE_KRAFT:
    "repeating-linear-gradient(90deg,#b5844f 0 5px,#9c6f3e 5px 10px)",
  SBS_300: "linear-gradient(135deg,#ffffff,#e9e9ee)",
  SBS_350: "linear-gradient(135deg,#fbfbfd,#dcdce4)",
  GREYBOARD_WRAP: "linear-gradient(135deg,#2f5d50 60%,#8d9690 60%)",
  KRAFT_TUBE:
    "repeating-linear-gradient(120deg,#c39a68 0 8px,#b38a58 8px 16px)",
  LABEL_PAPER: "linear-gradient(135deg,#fffdf6,#efe9d8)",
  LABEL_WHITE_BOPP: "linear-gradient(135deg,#ffffff,#d9e6f2)",
  LABEL_CLEAR_BOPP:
    "linear-gradient(135deg,rgba(255,255,255,.35),rgba(200,220,255,.12)),repeating-linear-gradient(45deg,#2a3142 0 6px,#353d50 6px 12px)",
  LABEL_METALLIC_BOPP: "linear-gradient(135deg,#9aa3ad,#eef2f6 45%,#7d8792)",
  SHRINK_PETG: "linear-gradient(135deg,#7ec8c0,#2e7d74)",
  POUCH_PET_PE: "linear-gradient(135deg,#d64f6e,#8c2a44)",
  POUCH_KRAFT_PE: "linear-gradient(135deg,#c9a06c,#9b7646)",
  TUBE_PE: "linear-gradient(135deg,#f4f6fb,#c9d2e3)",
  MATTE_LAMINATION: "linear-gradient(135deg,#3b3f4a,#2b2e36)",
  GLOSS_LAMINATION: "linear-gradient(135deg,#1f2a44,#3f5a9a 50%,#1f2a44)",
  SPOT_UV: "radial-gradient(circle at 50% 50%,#3a3f52 0 28%,#22262f 30%)",
  SOFT_TOUCH_LAMINATION: "linear-gradient(135deg,#d9cfe6,#b7a8cc)",
  VARNISH: "linear-gradient(135deg,#efe6cf,#d6c7a1)",
  HOT_FOIL: "linear-gradient(135deg,#8a6a2a,#f3e2a5 45%,#9b7a35 70%,#e8d08a)",
  EMBOSS: "radial-gradient(circle at 40% 40%,#ffffff,#d8d2c6 60%)",
  DEBOSS: "radial-gradient(circle at 60% 60%,#cfc8bb,#efebe3 60%)",
};

const BOX_FAMILIES: StructureFamily[] = [
  "CORRUGATED",
  "FOLDING_CARTON",
  "RIGID",
  "TUBE",
];
const TILE_TONES = [
  "#ece6f3",
  "#dfeee4",
  "#f6e1da",
  "#e2efec",
  "#f6ecd2",
  "#dfe7f1",
  "#efe6d8",
];

export function DesignerPage(d: DesignerPageData) {
  const { locale, t } = d;
  const c = designerPageCopy(locale);
  const base = `/${locale}`;
  const startHref = designHref(locale, { structure: "FEFCO_0427" });
  const pickerHref = `${base}/design`;
  const mailer = renderSrc("FEFCO_0427");
  const mailerDims = renderDims(mailer);
  const finishes = FINISH_CODES.filter((f) => f !== "NONE");
  const matCount = MATERIAL_CODES.length + finishes.length;
  const wall = d.styles.filter((s) => BOX_FAMILIES.includes(s.family));
  const faq = c.faq.items;

  const matGroupHref: Record<string, string> = {
    corrugated: structureHref(locale, "FEFCO_0427"),
    carton: structureHref(locale, "ECMA_RTE"),
    rigid: structureHref(locale, "RIGID_BOX"),
    tube: structureHref(locale, "PAPER_TUBE"),
    labels: `${base}/bottles`,
    pouch: `${base}/catalog`,
    lamination: designHref(locale, { structure: "ECMA_RTE" }),
    uv: designHref(locale, { structure: "ECMA_STE" }),
    foil: designHref(locale, { structure: "RIGID_BOX" }),
  };
  const payIcon: Record<PaymentMethod, typeof CreditCard> = {
    CARD: CreditCard,
    WALLET: Smartphone,
    FAWRY: Store,
    INSTAPAY: Banknote,
  };

  // Items for the kit Marquee (it adds the <li>, the inert loop copy and the pause button).
  const styleCard = (s: (typeof wall)[number], i: number) => {
    const src = renderSrc(s.code);
    const dims = renderDims(src);
    return (
      <Link
        key={s.code}
        href={designHref(locale, { structure: s.code })}
        className={styles.styleCard}
        style={{ background: TILE_TONES[i % TILE_TONES.length] }}
        prefetch={false}
      >
        <div>
          <p className={styles.styleName}>{s.name}</p>
          <p className={styles.styleFamily}>
            {c.families[s.family as keyof typeof c.families] ?? ""}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSetFor(src)}
          sizes="280px"
          alt=""
          width={dims.width}
          height={dims.height}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
        <span className={styles.stylePill}>
          {fill(c.wall.using, { name: s.name })}
        </span>
      </Link>
    );
  };

  const matTiles = [
    ...MATERIAL_CODES.map((m) => ({
      code: m,
      name: t(`materials.${m}` as DictKey),
    })),
    ...finishes.map((f) => ({ code: f, name: t(`finishes.${f}` as DictKey) })),
  ].map((m) => (
    <span key={m.code} className={styles.matTile}>
      <span
        className={styles.matSwatch}
        style={{ background: MAT_SWATCH[m.code] ?? "#333" }}
      />
      <span className={styles.matName}>{m.name}</span>
    </span>
  ));

  const price = d.mailerUnit500
    ? fill(c.hero.priceValue, { price: d.mailerUnit500 })
    : null;

  // Head CTA pill (reference: top end of the head row). After the head in the DOM so a heading
  // never overlaps the block after it (spec section 7 rule 4); laid out at the head's end from
  // 768px, in flow under the head on phones.
  const headPill = (label: string, variant: "dark" | "light") => (
    <Pill
      href={startHref}
      variant={variant}
      prefetch={false}
      className={styles.headAction}
    >
      {label}
      <ArrowRight size={18} className={styles.flip} aria-hidden />
    </Pill>
  );

  return (
    <div className={styles.page}>
      <JsonLd data={faqJsonLd(faq)} />

      {/* ───────── 1. Hero ───────── */}
      <Sheet
        tone="navy"
        hero
        container={false}
        className={`${styles.canvas} ${styles.hero}`}
        aria-labelledby="dp-hero-title"
      >
        <div className={styles.heroGrid} aria-hidden="true" />
        <Glow color="violet" y="62%" size="70vmax" blur={60} />
        <Container>
          <Stack gap="head-content" className={styles.heroInner}>
            <div className={styles.frame}>
              <span className={styles.frameTag} aria-hidden="true">
                {c.hero.frameTag}
              </span>
              <Stack gap="title-sub">
                <h1 id="dp-hero-title" className={styles.eyebrow}>
                  {c.hero.eyebrow}
                </h1>
                <Display as="p" size="96" align="center">
                  {c.hero.title}
                </Display>
                <p className={styles.lead}>{c.hero.body}</p>
              </Stack>
            </div>
            <Stack gap="title-sub" className={styles.heroCtas}>
              <div className={styles.pillLine}>
                <Pill
                  href={startHref}
                  variant="light"
                  size="lg"
                  prefetch={false}
                >
                  {c.hero.cta}
                  <ArrowRight size={18} className={styles.flip} aria-hidden />
                </Pill>
                <Pill href="#dp-styles" variant="outline" size="lg">
                  {c.hero.secondary}
                </Pill>
              </div>
              <p className={styles.small}>{c.hero.small}</p>
            </Stack>
            <LiveBox
              poster={
                <HeroImage
                  src={mailer}
                  sizes="(min-width: 768px) 720px, calc(100vw - 32px)"
                  alt={c.hero.viewer}
                  width={mailerDims.width}
                  height={mailerDims.height}
                  className={styles.boxPoster}
                />
              }
              pieces={
                <>
                  <div
                    className={`${styles.float} ${styles.floatLayers}`}
                    style={{ ["--i" as string]: 0 }}
                    aria-hidden="true"
                  >
                    <p className={styles.floatTitle}>{c.hero.layers}</p>
                    <ul className={styles.layerList}>
                      {c.hero.layerItems.map((l, i) => (
                        <li key={l} data-active={i === 0 ? "" : undefined}>
                          {l}
                        </li>
                      ))}
                      <li className={styles.layerAdd}>+ {c.hero.addLayer}</li>
                    </ul>
                  </div>
                  <div
                    className={`${styles.float} ${styles.floatSwatches}`}
                    style={{ ["--i" as string]: 1 }}
                    aria-hidden="true"
                  >
                    <p className={styles.floatTitle}>{c.hero.swatches}</p>
                    <div className={styles.swatchRow}>
                      {c.ui.colours.map((col) => (
                        <span
                          key={col.hex}
                          className={styles.swatch}
                          style={{ background: col.hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <div
                    className={`${styles.float} ${styles.floatTiles}`}
                    style={{ ["--i" as string]: 2 }}
                    aria-hidden="true"
                  >
                    {(
                      ["tuck-carton-iso", "rigid-box-iso", "tube-iso"] as const
                    ).map((k) => {
                      const a = R6.cutouts[k];
                      return (
                        <span key={k} className={styles.tile}>
                          <picture>
                            <source
                              type="image/avif"
                              srcSet={r6SrcSet(a, "avif")}
                            />
                            <img
                              src={r6Src(a)}
                              srcSet={r6SrcSet(a, "webp")}
                              alt=""
                              width={64}
                              height={64}
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                            />
                          </picture>
                        </span>
                      );
                    })}
                  </div>
                  <div
                    className={`${styles.float} ${styles.floatFinish}`}
                    style={{ ["--i" as string]: 3 }}
                    aria-hidden="true"
                  >
                    <span className={styles.finishDot} />
                    {c.hero.finish}
                  </div>
                  {price ? (
                    <div
                      className={`${styles.float} ${styles.floatPrice}`}
                      style={{ ["--i" as string]: 4 }}
                      aria-hidden="true"
                    >
                      <span className={styles.floatTitle}>
                        {c.hero.priceTitle}
                      </span>
                      <span className={`${styles.priceValue} ${styles.num}`}>
                        {price}
                      </span>
                      <span className={styles.priceNote}>
                        {fill(c.hero.priceNote, { rate: d.vatPct })}
                      </span>
                    </div>
                  ) : null}
                </>
              }
              loop={d.loop}
              labels={{
                viewer: c.hero.viewer,
                roleDescription: t("viewer.roleDescription"),
                keyboardHint: t("viewer.keyboardHint"),
                unsupported: t("viewer.unsupported"),
                turn: c.hero.turn,
                turnHint: c.hero.turnHint,
                pause: c.hero.pause,
                play: c.hero.play,
              }}
            />
            <p className={styles.sampleNote}>{SAMPLE_LABEL[locale]}</p>
          </Stack>
        </Container>
      </Sheet>

      {/* ───────── 2. Prompt bar: head, then the violet band ───────── */}
      <Sheet
        tone="navy"
        overlap={false}
        className={styles.canvas}
        aria-labelledby="dp-prompt-title"
      >
        <SectionHead
          id="dp-prompt-title"
          align="center"
          title={c.prompt.title}
          sub={c.prompt.body}
        />
      </Sheet>
      <MotionScope pauseLabel={c.prompt.pause} playLabel={c.prompt.play}>
        <Sheet
          tone="violet"
          y="lg"
          overlap={false}
          as="div"
          className={styles.violet}
        >
          <Stack gap="grid" className={styles.promptStack}>
            <PromptBar
              action={pickerHref}
              label={c.prompt.label}
              submit={c.prompt.submit}
              examples={c.prompt.examples}
            />
            <div className={styles.promptChips}>
              {c.prompt.examples.map((ex) => (
                <Link
                  key={ex}
                  href={`${pickerHref}?q=${encodeURIComponent(ex)}`}
                  className={styles.promptChip}
                  prefetch={false}
                >
                  {ex}
                </Link>
              ))}
            </div>
            <p className={styles.promptNote}>
              {fill(c.prompt.note, { models: d.modelCount })}
            </p>
          </Stack>
        </Sheet>
      </MotionScope>

      {/* ───────── 3. Style wall ───────── */}
      <Sheet
        tone="navy"
        overlap={false}
        container={false}
        id="dp-styles"
        className={styles.canvas}
        aria-labelledby="dp-wall-title"
      >
        <Stack gap="head-content">
          <Container>
            <SectionHead
              id="dp-wall-title"
              align="center"
              title={c.wall.title}
              sub={
                <>
                  {c.wall.body}{" "}
                  <Link
                    href={`${base}/catalog`}
                    className={styles.inlineLink}
                    prefetch={false}
                  >
                    {c.wall.all}
                  </Link>
                </>
              }
            />
          </Container>
          <Marquee
            className={styles.wallRail}
            label={c.wall.label}
            pauseLabel={c.wall.pause}
            playLabel={c.wall.play}
            duration={70}
            gap="var(--mk-grid-gap-tight)"
            items={wall.map((s, i) => styleCard(s, i))}
          />
          <Container>
            <p className={`${styles.sampleNote} ${styles.center}`}>
              {SAMPLE_LABEL[locale]}
            </p>
          </Container>
        </Stack>
      </Sheet>

      {/* ───────── 4-5. Light sheet: bento ───────── */}
      <Sheet tone="white" y="lg" as="div" className={`${styles.sheet}`}>
        <Stack gap="head-content-lg">
          <section aria-labelledby="dp-make-title">
            <SectionHead
              id="dp-make-title"
              title={c.make.title}
              sub={c.make.body}
              className={styles.headRow}
            >
              <Stack gap="head-content">
                {headPill(c.make.cta, "dark")}
                <Grid
                  as="ul"
                  cols={2}
                  colsMd={2}
                  colsSm={1}
                  gap="bento"
                  className={styles.plainList}
                >
                  {c.make.cards.map((card, i) => (
                    <li
                      key={card.key}
                      className={styles.card}
                      data-reveal
                      style={{ ["--m-i" as string]: i % 2 }}
                    >
                      {card.key === "artwork" ? (
                        <CropMock
                          render={renderSrc("ECMA_RTE")}
                          labels={{
                            upload: c.ui.upload,
                            crop: c.ui.crop,
                            rotate: c.ui.rotate,
                            fit: c.ui.fit,
                          }}
                        />
                      ) : card.key === "colours" ? (
                        <ColourMock
                          title={c.hero.swatches}
                          colours={c.ui.colours}
                          render={renderSrc("FEFCO_0201").replace(
                            /\.webp$/,
                            ".400w.webp",
                          )}
                        />
                      ) : card.key === "text" ? (
                        <TextMock
                          ar={c.ui.textAr}
                          en={c.ui.textEn}
                          tool={c.ui.textTool}
                        />
                      ) : (
                        <DielineMock svg={d.dielineSvg} legend={c.ui.legend} />
                      )}
                      <div className={styles.cardBody}>
                        <h3 className={styles.cardTitle}>{card.title}</h3>
                        <p className={styles.cardText}>{card.body}</p>
                      </div>
                    </li>
                  ))}
                </Grid>
              </Stack>
            </SectionHead>
          </section>
          <section aria-labelledby="dp-share-title">
            <SectionHead
              id="dp-share-title"
              title={c.share.title}
              sub={c.share.body}
              className={styles.headRow}
            >
              <Stack gap="head-content">
                {headPill(c.share.cta, "dark")}
                <Grid
                  as="ul"
                  cols={2}
                  colsMd={2}
                  colsSm={1}
                  gap="bento"
                  className={styles.plainList}
                >
                  {c.share.cards.map((card, i) => (
                    <li
                      key={card.key}
                      className={styles.card}
                      data-reveal
                      style={{ ["--m-i" as string]: i % 2 }}
                    >
                      {card.key === "link" ? (
                        <LinkMock host={d.host} button={c.ui.shareButton} />
                      ) : card.key === "export" ? (
                        <ProofMock
                          rows={[
                            [c.ui.proofRows[0][0], c.ui.proofRows[0][1]],
                            [
                              c.ui.legend.bleed,
                              `${d.bleedMm} ${locale === "ar" ? "مم" : "mm"}`,
                            ],
                            [
                              c.ui.legend.safe,
                              `${d.safeMm} ${locale === "ar" ? "مم" : "mm"}`,
                            ],
                          ]}
                          ok={c.ui.proofOk}
                        />
                      ) : card.key === "views" ? (
                        <MockupMock
                          render={renderSrc("RIGID_BOX").replace(
                            /\.webp$/,
                            ".400w.webp",
                          )}
                          label={c.ui.download}
                        />
                      ) : (
                        <OrderMock
                          title={c.ui.orderTitle}
                          qty={c.ui.qty}
                          price={price ?? ""}
                        />
                      )}
                      <div className={styles.cardBody}>
                        <h3 className={styles.cardTitle}>{card.title}</h3>
                        <p className={styles.cardText}>{card.body}</p>
                      </div>
                    </li>
                  ))}
                </Grid>
              </Stack>
            </SectionHead>
          </section>
        </Stack>
      </Sheet>

      {/* ───────── 6. Trust trio ───────── */}
      <Sheet
        tone="navy"
        y="lg"
        className={`${styles.canvas}`}
        aria-labelledby="dp-trust-title"
      >
        <SectionHead id="dp-trust-title" title={c.trust.title}>
          <Grid
            as="ul"
            cols={3}
            colsMd={1}
            colsSm={1}
            className={styles.plainList}
          >
            {c.trust.cards.map((card, i) => (
              <li
                key={card.key}
                className={styles.trustCard}
                data-reveal
                style={{ ["--m-i" as string]: i }}
              >
                <div className={styles.trustMedia} aria-hidden="true">
                  {card.key === "printers" ? (
                    <>
                      <div className={styles.stat}>
                        <div>
                          <b className={styles.num}>
                            {d.vendorCount.toLocaleString(
                              locale === "ar" ? "ar-EG-u-nu-latn" : "en",
                            )}
                          </b>
                          <span>{c.trust.printersStat}</span>
                        </div>
                      </div>
                      <div className={styles.tags}>
                        {c.trust.printerTags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </>
                  ) : card.key === "vat" ? (
                    <div className={styles.receipt}>
                      <div>
                        <span>{c.trust.vatLines.subtotal}</span>
                        <span className={styles.num}>1,000.00</span>
                      </div>
                      <div>
                        <span>
                          {fill(c.trust.vatLines.vat, { rate: d.vatPct })}
                        </span>
                        <span className={styles.num}>
                          {(10 * d.vatPct).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span>{c.trust.vatLines.total}</span>
                        <span className={styles.num}>
                          {(1000 + 10 * d.vatPct).toLocaleString("en", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.payGrid}>
                      {d.payMethods.map((m) => {
                        const I = payIcon[m];
                        return (
                          <span key={m}>
                            <I size={16} />
                            {c.trust.payLabels[m]}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className={styles.trustBody}>
                  <h3 className={styles.trustTitle}>
                    {fill(card.title, { rate: d.vatPct })}
                  </h3>
                  <p className={styles.trustText}>{card.body}</p>
                </div>
              </li>
            ))}
          </Grid>
        </SectionHead>
      </Sheet>

      {/* ───────── 7. Materials and finishes wall ───────── */}
      <Sheet
        tone="navy"
        overlap={false}
        container={false}
        className={`${styles.canvas}`}
        aria-labelledby="dp-mat-title"
      >
        <Stack gap="head-content">
          <Container>
            <SectionHead
              id="dp-mat-title"
              title={fill(c.materials.title, { count: matCount })}
            />
          </Container>
          <Marquee
            className={styles.matRail}
            label={c.materials.label}
            pauseLabel={c.materials.pause}
            playLabel={c.materials.play}
            duration={50}
            gap="var(--mk-grid-gap-tight)"
            items={matTiles}
          />
          <Container>
            <Stack gap="head-content">
              <p className={styles.matLead}>
                {c.materials.body}{" "}
                <Link href={`${base}/catalog`} prefetch={false}>
                  {c.materials.linkLabel}
                </Link>
              </p>
              <Grid
                as="ul"
                cols={3}
                colsMd={2}
                colsSm={1}
                className={`${styles.plainList} ${styles.matGroups}`}
              >
                {c.materials.groups.map((g) => (
                  <li key={g.key}>
                    <Link
                      href={matGroupHref[g.key] ?? `${base}/catalog`}
                      prefetch={false}
                    >
                      {g.title}
                    </Link>
                    <p>{g.body}</p>
                  </li>
                ))}
              </Grid>
            </Stack>
          </Container>
        </Stack>
      </Sheet>

      {/* ───────── 8. Start carousel ───────── */}
      <Sheet
        tone="navy"
        overlap={false}
        className={styles.canvas}
        aria-labelledby="dp-start-title"
      >
        <SectionHead
          id="dp-start-title"
          title={c.start.title}
          sub={c.start.body}
          className={styles.headRow}
        >
          <Stack gap="head-content">
            {headPill(c.start.cta, "light")}
            <StartCarousel
              steps={c.start.steps}
              label={c.start.label}
              prev={c.start.prev}
              next={c.start.next}
              locale={locale}
            />
          </Stack>
        </SectionHead>
      </Sheet>

      {/* ───────── 9. FAQ (closing band) ───────── */}
      <Sheet
        tone="dark"
        y="xl"
        overlap={false}
        className={`${styles.faq}`}
        aria-labelledby="dp-faq-title"
      >
        <SectionHead id="dp-faq-title" size="64" title={c.faq.title}>
          <Faq className={styles.faqList} items={faq} />
        </SectionHead>
      </Sheet>
    </div>
  );
}
