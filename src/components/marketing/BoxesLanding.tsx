import Link from "next/link";
import type { Locale, StructureCode } from "@/types";
import { getT } from "@/i18n";
import type { DictKey } from "@/i18n";
import { getPriceFrom, listStructures, type PriceFromRow } from "@/components/store/data";
import { ProductCard } from "./ProductCard";
import rs from "./restyle/restyle.module.css";
import dt from "./restyle/detail.module.css";
import { Sheet } from "./kit/Sheet";
import { SAMPLE_LABEL } from "./kit/assets";
import { Eyebrow, Lead } from "./kit/Display";
import { HeroTitle } from "./kit/HeroTitle";
import { Pill, PillRow } from "./kit/Pill";
import { SectionHead } from "./kit/SectionHead";
import { Grid } from "./kit/Grid";

/**
 * The box types grouped by what the buyer sells (R1-09), not by board. Every active box structure
 * appears once; a structure missing here falls into the last group so nothing disappears.
 */
const USE_GROUPS: { key: "shipping" | "food" | "shelf" | "gifts"; codes: StructureCode[] }[] = [
  { key: "shipping", codes: ["FEFCO_0427", "FEFCO_0201", "FEFCO_0320"] },
  { key: "food", codes: ["PIZZA", "GABLE_BOX"] },
  { key: "shelf", codes: ["ECMA_RTE", "ECMA_STE", "ECMA_CLB", "ECMA_SLB", "SLEEVE", "FEFCO_0422"] },
  { key: "gifts", codes: ["RIGID_BOX", "PAPER_TUBE"] },
];
const BOX_FAMILIES = new Set(["CORRUGATED", "FOLDING_CARTON", "RIGID", "TUBE"]);

/**
 * The box chooser (/boxes): where every "Get your box price" CTA lands (R1-04). A short title,
 * then the box types grouped by use, each with its price per box for 500 boxes and an "Order this
 * box" button that opens the designer. Labels, pouches and quote-only shapes are one link away.
 */
export async function BoxesLanding({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const structures = (await listStructures()).filter((s) => BOX_FAMILIES.has(s.family));
  const rows = new Map<StructureCode, PriceFromRow | null>(
    await Promise.all(
      structures.map(async (s) => {
        const p = await getPriceFrom(s.code, s.defaultDims);
        return [s.code, p.rows.find((r) => r.quantity === 500) ?? null] as const;
      }),
    ),
  );
  const grouped = new Set(USE_GROUPS.flatMap((g) => g.codes));
  const groups = USE_GROUPS.map((g, i) => ({
    ...g,
    list: [
      ...g.codes.map((c) => structures.find((s) => s.code === c)).filter((s) => s != null),
      ...(i === USE_GROUPS.length - 1 ? structures.filter((s) => !grouped.has(s.code)) : []),
    ],
  }));
  const base = `/${locale}`;
  return (
    <div className={rs.page}>
      <Sheet tone="dark" hero className={rs.heroLanding} aria-labelledby="boxes-title">
        <Eyebrow className="m-enter">{t("marketing.boxes.eyebrow")}</Eyebrow>
        <HeroTitle as="h1" size="64" align="center" id="boxes-title" text={t("marketing.boxes.title")} />
        <Lead align="center" className="m-enter-lcp">
          {t("marketing.boxes.body")}
        </Lead>
        <p className={`${rs.small} ${rs.afterPills} m-enter`}>{t("marketing.boxes.priceNote")}</p>
        <p className={`${rs.small} m-enter`}>
          {t("marketing.boxes.already")}{" "}
          <Link href={`${base}/account`} className={rs.textLink}>
            {t("marketing.boxes.alreadyLink")}
          </Link>
        </p>
      </Sheet>

      {/* One white sheet per use: the first overlaps the hero, the next ones collapse onto it
          to one --mk-section-y (spec section 7, rule 2). */}
      {groups.map((g) =>
        g.list.length ? (
          <Sheet key={g.key} tone="white" id={g.key} className={rs.anchor} aria-labelledby={`use-${g.key}`}>
            <SectionHead id={`use-${g.key}`} title={t(`marketing.boxes.use.${g.key}` as DictKey)} sub={t(`marketing.boxes.use.${g.key}Body` as DictKey)}>
              <div data-rail="">
                <Grid as="ul" cols={3} colsMd={2} colsSm={1} className={`${dt.cards} ${dt.rail}`}>
                  {g.list.map((s, i) => (
                    <ProductCard key={s.code} locale={locale} structure={s} row500={rows.get(s.code) ?? null} index={i} />
                  ))}
                </Grid>
              </div>
            </SectionHead>
          </Sheet>
        ) : null,
      )}

      <Sheet tone="light" aria-labelledby="boxes-more-title">
        <SectionHead id="boxes-more-title" title={t("marketing.boxes.moreTitle")} sub={t("marketing.boxes.moreBody")}>
          <PillRow>
            <Pill href={`${base}/bottles`} variant="outline-dark" size="lg">
              {t("marketing.boxes.moreLabels")}
            </Pill>
            <Pill href={`${base}/catalog`} variant="outline-dark" size="lg">
              {t("marketing.boxes.moreAll")}
            </Pill>
          </PillRow>
          <p className={`${rs.small} ${rs.sampleNote}`}>{SAMPLE_LABEL[locale]}</p>
        </SectionHead>
      </Sheet>
    </div>
  );
}
