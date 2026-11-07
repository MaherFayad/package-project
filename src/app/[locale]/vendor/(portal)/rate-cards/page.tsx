import { Table2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { IndexTable, IndexTableCell, IndexTableRow, IndexTableRowLink } from "@/components/ui/IndexTable";
import { Page } from "@/components/ui/Page";
import { InlineStack } from "@/components/ui/Stack";
import { Link } from "@/components/ui/Link";
import { Text } from "@/components/ui/Text";
import { requireVendorContext } from "@/components/vendor/server/context";
import { listRateCards } from "@/components/vendor/server/queries";
import { getT, toLocale, type DictKey } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import styles from "@/components/vendor/vendor.module.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("vendorPortal.rateCards.title")} · ${t("vendorPortal.title")}` };
}

export default async function RateCardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { vendor } = await requireVendorContext(locale, `/${locale}/vendor/rate-cards`);
  if (!vendor || vendor.status === "PENDING") return null;
  const cards = await listRateCards(vendor.id);

  return (
    <Page fullWidth title={t("vendorPortal.rateCards.title")} titleIcon={<Table2 aria-hidden="true" />} subtitle={t("vendorPortal.rateCards.subtitle")}>
        {/* P-08: phones get one stacked card per rate card (the 8-column table hid the prices). */}
        {cards.length ? (
          <ul className={styles.CardRows} aria-label={t("vendorPortal.rateCards.title")}>
            {cards.map((c) => {
              const tiers = [...c.qtyTiers].sort((a, b) => a.minQty - b.minQty);
              const first = tiers[0];
              const last = tiers[tiers.length - 1];
              return (
                <li key={c.id} className={styles.CardRow}>
                  <InlineStack align="space-between" blockAlign="center" gap="200">
                    <Link url={`/${locale}/vendor/rate-cards/${c.id}`}>
                      <Text as="span" fontWeight="semibold">
                        {t(`structures.${c.structureCode}` as DictKey)}
                      </Text>
                    </Link>
                    <Badge tone={c.active ? "success" : "neutral"} progress={c.active ? "complete" : "incomplete"}>
                      {c.active ? t("vendorPortal.rateCards.active") : t("vendorPortal.rateCards.inactive")}
                    </Badge>
                  </InlineStack>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {t(`materials.${c.materialCode}` as DictKey)} · {t("vendorPortal.rateCards.modelCount", { count: formatNumber(c.modelCount) })}
                  </Text>
                  {first ? (
                    <Text as="span" variant="bodySm">
                      {t("vendorPortal.rateCards.columns.to")}: <Text as="span" numeric fontWeight="semibold">{formatMoney(first.unitPiasters, locale)}</Text> ({t("vendorPortal.rateCards.tierQty", { count: formatNumber(first.minQty) })})
                    </Text>
                  ) : null}
                  {last && last !== first ? (
                    <Text as="span" variant="bodySm">
                      {t("vendorPortal.rateCards.columns.from")}: <Text as="span" numeric fontWeight="semibold">{formatMoney(last.unitPiasters, locale)}</Text> ({t("vendorPortal.rateCards.tierQty", { count: formatNumber(last.minQty) })})
                    </Text>
                  ) : null}
                  <Text as="span" tone="subdued" variant="bodySm">
                    {t("vendorPortal.rateCards.columns.setup")}: {formatMoney(c.setupPiasters, locale)} · {t("vendorPortal.rateCards.columns.lead")}: {t("vendorPortal.common.days", { count: formatNumber(c.leadTimeDays) })}
                  </Text>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className={cards.length ? styles.CardTable : undefined}>
        <IndexTable
          resourceName={{ singular: t("vendorPortal.rateCards.resourceSingular"), plural: t("vendorPortal.rateCards.resourcePlural") }}
          caption={t("vendorPortal.rateCards.title")}
          rowIds={cards.map((c) => c.id)}
          headings={[
            { title: t("vendorPortal.rateCards.columns.structure") },
            { title: t("vendorPortal.rateCards.columns.material") },
            { title: t("vendorPortal.rateCards.columns.to"), alignment: "end" },
            { title: t("vendorPortal.rateCards.columns.from"), alignment: "end" },
            { title: t("vendorPortal.rateCards.columns.setup"), alignment: "end" },
            { title: t("vendorPortal.rateCards.columns.die"), alignment: "end" },
            { title: t("vendorPortal.rateCards.columns.lead"), alignment: "end" },
            { title: t("vendorPortal.rateCards.columns.status") },
          ]}
          emptyState={
            <EmptyState heading={t("vendorPortal.rateCards.emptyTitle")} image={<EmptyBoxIllustration size={96} />} compact>
              {t("vendorPortal.rateCards.emptyBody")}
            </EmptyState>
          }
        >
          {cards.map((c) => {
            const tiers = [...c.qtyTiers].sort((a, b) => a.minQty - b.minQty);
            const first = tiers[0];
            const last = tiers[tiers.length - 1];
            // R5-JR-17: a paused card is not cancelled; the "Paused" badge says it, so no strike-through.
            return (
              <IndexTableRow key={c.id} id={c.id}>
                <IndexTableCell>
                  <IndexTableRowLink url={`/${locale}/vendor/rate-cards/${c.id}`}>{t(`structures.${c.structureCode}` as DictKey)}</IndexTableRowLink>
                  {/* How many designer models this card prices (a style covers many family models). */}
                  <Text as="span" tone="subdued" variant="bodySm">
                    {" · "}
                    {t("vendorPortal.rateCards.modelCount", { count: formatNumber(c.modelCount) })}
                  </Text>
                </IndexTableCell>
                <IndexTableCell>{t(`materials.${c.materialCode}` as DictKey)}</IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {first ? (
                    <>
                      {formatMoney(first.unitPiasters, locale)}
                      <Text as="span" tone="subdued" variant="bodySm">
                        {" · "}
                        {t("vendorPortal.rateCards.tierQty", { count: formatNumber(first.minQty) })}
                      </Text>
                    </>
                  ) : (
                    "—"
                  )}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {last ? (
                    <>
                      {formatMoney(last.unitPiasters, locale)}
                      <Text as="span" tone="subdued" variant="bodySm">
                        {" · "}
                        {t("vendorPortal.rateCards.tierQty", { count: formatNumber(last.minQty) })}
                      </Text>
                    </>
                  ) : (
                    "—"
                  )}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {formatMoney(c.setupPiasters, locale)}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {c.dieCostPiasters > 0 ? formatMoney(c.dieCostPiasters, locale) : <Text as="span" tone="subdued">{t("vendorPortal.rateCards.noDie")}</Text>}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {t("vendorPortal.common.days", { count: formatNumber(c.leadTimeDays) })}
                </IndexTableCell>
                <IndexTableCell>
                  <Badge tone={c.active ? "success" : "neutral"} progress={c.active ? "complete" : "incomplete"}>
                    {c.active ? t("vendorPortal.rateCards.active") : t("vendorPortal.rateCards.inactive")}
                  </Badge>
                </IndexTableCell>
              </IndexTableRow>
            );
          })}
        </IndexTable>
        </div>
    </Page>
  );
}
