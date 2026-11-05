import { Table2 } from "lucide-react";
import {
  Badge,
  EmptyBoxIllustration,
  EmptyState,
  IndexTable,
  IndexTableCell,
  IndexTableRow,
  IndexTableRowLink,
  Page,
  BlockStack,
  Text,
} from "@/components/ui";
import { requireVendorContext } from "@/components/vendor/server/context";
import { listRateCards } from "@/components/vendor/server/queries";
import { getT, toLocale, type DictKey } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";

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
    <Page fullWidth title={t("vendorPortal.rateCards.title")} titleIcon={<Table2 aria-hidden="true" />}>
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          {t("vendorPortal.rateCards.subtitle")}
        </Text>
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
            return (
              <IndexTableRow key={c.id} id={c.id} tone={c.active ? undefined : "subdued"}>
                <IndexTableCell>
                  <IndexTableRowLink url={`/${locale}/vendor/rate-cards/${c.id}`}>{t(`structures.${c.structureCode}` as DictKey)}</IndexTableRowLink>
                </IndexTableCell>
                <IndexTableCell>{t(`materials.${c.materialCode}` as DictKey)}</IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {first ? formatMoney(first.unitPiasters, locale) : "—"}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {last ? formatMoney(last.unitPiasters, locale) : "—"}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {formatMoney(c.setupPiasters, locale)}
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {formatMoney(c.dieCostPiasters, locale)}
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
      </BlockStack>
    </Page>
  );
}
