import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { Banner, BlockStack, Card, DataTable, Page, Text } from "@/components/ui";
import { PriceIndexForm, PricingSettingsForm } from "@/components/admin/PricingForms";
import { loadPricingSettings } from "@/components/admin/server/settings";
import { currentMultipliers } from "@/components/admin/lib/pricingSettings";
import { getT, toLocale } from "@/i18n";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.pricing.title")} · ${t("admin.title")}` };
}

export default async function AdminPricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { settings, updatedAt } = await loadPricingSettings();
  const { row } = currentMultipliers(settings.priceIndex, new Date());
  const range = (b: Record<string, number | undefined>) => {
    const vals = Object.values(b).filter((v): v is number => typeof v === "number");
    if (!vals.length) return "×1";
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return lo === hi ? `×${formatNumber(lo, 4)}` : `×${formatNumber(lo, 4)} – ×${formatNumber(hi, 4)}`;
  };

  return (
    <Page title={t("admin.pricing.title")} titleIcon={<Tags aria-hidden="true" />} subtitle={updatedAt ? t("admin.pricing.lastSaved", { date: formatDateTime(updatedAt, locale) }) : t("admin.pricing.subtitle")}>
      <BlockStack gap="400">
        <Banner tone="info">{t("admin.pricing.notWired")}</Banner>
        <PricingSettingsForm initial={{ marginPct: settings.marginPct, marginOnShipping: settings.marginOnShipping, quoteValidityHours: settings.quoteValidityHours, zones: settings.zones }} />
        <Card title={t("admin.pricing.index.title")}>
          <BlockStack gap="400">
            <Text as="p" variant="bodySm" tone="subdued">
              {t("admin.pricing.index.help")}
            </Text>
            <Text as="p" fontWeight="semibold">
              {t("admin.pricing.index.current", { date: formatDate(row.effectiveFrom, locale, "medium"), fx: formatNumber(row.fx, 4) })}
            </Text>
            <PriceIndexForm current={{ fx: row.fx, board: row.board }} />
          </BlockStack>
        </Card>
        <Card title={t("admin.pricing.index.history")}>
          <DataTable
            caption={t("admin.pricing.index.historyCaption")}
            columnContentTypes={["text", "text", "numeric", "numeric", "text"]}
            headings={[t("admin.pricing.index.columns.id"), t("admin.pricing.index.columns.from"), t("admin.pricing.index.columns.fx"), t("admin.pricing.index.columns.board"), t("admin.pricing.index.columns.note")]}
            rows={[...settings.priceIndex].reverse().map((r) => [<bdi key={r.id}>{r.id}</bdi>, formatDate(r.effectiveFrom, locale, "medium"), <bdi key="fx" dir="ltr">{`×${formatNumber(r.fx, 4)}`}</bdi>, <bdi key="b" dir="ltr">{range(r.board)}</bdi>, r.note ?? t("admin.common.none")])}
          />
        </Card>
      </BlockStack>
    </Page>
  );
}
