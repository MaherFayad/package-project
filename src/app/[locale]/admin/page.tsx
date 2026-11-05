import type { Metadata } from "next";
import { BarChart3, ChevronRight } from "lucide-react";
import {
  Badge,
  BlockStack,
  Box,
  Card,
  DataTable,
  Icon,
  InlineGrid,
  InlineStack,
  Layout,
  LayoutSection,
  Link,
  MetricsStrip,
  Page,
  Text,
} from "@/components/ui";
import { ChartTableToggle } from "@/components/admin/ChartTableToggle";
import { ColumnChart, FunnelBars } from "@/components/admin/charts";
import { RangeSelect } from "@/components/admin/RangeSelect";
import { loadOverview } from "@/components/admin/server/queries";
import { asRange, RANGES } from "@/components/admin/lib/metrics";
import { getT, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("admin.overview.title")} · ${t("admin.title")}` };
}

export default async function AdminOverviewPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const range = asRange((await searchParams).range);
  const o = await loadOverview(range);
  const base = `/${locale}/admin`;
  const pct = (n: number | null) => (n === null ? t("admin.common.none") : formatPercent(n, locale));
  const signed = (n: number | null) => (n === null ? t("admin.overview.noPrev") : t("admin.overview.vsPrev", { pct: `${n > 0 ? "+" : ""}${formatPercent(n, locale)}` }));
  const label = (key: DictKey, help: DictKey) => {
    void help;
    return t(key);
  };

  const money = (p: number | null) => (p === null ? t("admin.common.none") : <bdi>{formatMoney(p, locale)}</bdi>);
  const seriesRows = o.gmvSeries.map((p, i) => [formatDate(p.start, locale, "medium"), formatMoney(p.value, locale), formatMoney(o.marginSeries[i]?.value ?? 0, locale)]);

  const tasks = [
    { n: o.tasks.qcPending, text: t("admin.overview.tasks.qc", { count: formatNumber(o.tasks.qcPending) }), url: `${base}/orders?view=qc` },
    { n: o.tasks.applications, text: t("admin.overview.tasks.applications", { count: formatNumber(o.tasks.applications) }), url: `${base}/vendors?tab=applications` },
    { n: o.tasks.openDisputes, text: t("admin.overview.tasks.disputes", { count: formatNumber(o.tasks.openDisputes) }), url: `${base}/disputes` },
    { n: o.tasks.dataRequests, text: t("admin.overview.tasks.dataRequests", { count: formatNumber(o.tasks.dataRequests) }), url: `${base}/privacy` },
  ].filter((x) => x.n > 0);

  return (
    <Page
      fullWidth
      title={t("admin.overview.title")}
      titleIcon={<BarChart3 aria-hidden="true" />}
      subtitle={t("admin.overview.subtitle")}
      primaryAction={<RangeSelect value={range} options={RANGES.map((r) => ({ value: r, label: t(`admin.overview.ranges.${r}` as DictKey) }))} label={t("admin.overview.range")} />}
    >
      <BlockStack gap="400">
        <MetricsStrip
          accessibilityLabel={t("admin.overview.metricsLabel")}
          metrics={[
            { label: label("admin.overview.metrics.gmv", "admin.overview.help.gmv"), value: money(o.money.gmvPiasters), trend: signed(o.gmvChangePct) },
            { label: label("admin.overview.metrics.margin", "admin.overview.help.margin"), value: money(o.money.marginPiasters), trend: t("admin.overview.marginPct", { pct: pct(o.money.marginPct) }) },
            { label: t("admin.overview.metrics.orders"), value: formatNumber(o.money.orders), trend: <>{t("admin.overview.metrics.aov")}: {money(o.money.aovPiasters)}</> },
            { label: label("admin.overview.metrics.onTime", "admin.overview.help.onTime"), value: pct(o.ops.onTimePct), trend: t("admin.overview.ofDelivered", { count: formatNumber(o.ops.delivered) }) },
            { label: label("admin.overview.metrics.reprint", "admin.overview.help.reprint"), value: pct(o.ops.reprintPct), trend: t("admin.overview.reprintCount", { count: formatNumber(o.ops.reprints) }) },
            { label: label("admin.overview.metrics.disputes", "admin.overview.help.disputes"), value: pct(o.ops.disputePct), trend: t("admin.overview.openDisputes", { count: formatNumber(o.ops.openDisputes) }) },
          ]}
        />

        <Layout>
          <LayoutSection>
            <BlockStack gap="400">
              <Card title={t("admin.overview.funnel.title")}>
                <BlockStack gap="400">
                  <Text as="p" tone="subdued">
                    {t("admin.overview.funnel.description")}
                  </Text>
                  <FunnelBars
                    rows={o.funnel.map((r) => ({
                      key: r.step,
                      label: t(`admin.overview.funnel.steps.${r.step}` as DictKey),
                      value: r.count,
                      display: formatNumber(r.count),
                    }))}
                  />
                  <DataTable
                    caption={t("admin.overview.funnel.caption")}
                    columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                    headings={[t("admin.overview.funnel.columns.step"), t("admin.overview.funnel.columns.count"), t("admin.overview.funnel.columns.ofFirst"), t("admin.overview.funnel.columns.ofPrev")]}
                    rows={o.funnel.map((r) => [t(`admin.overview.funnel.steps.${r.step}` as DictKey), formatNumber(r.count), pct(r.ofFirstPct), r.ofPrevPct === null ? t("admin.common.none") : pct(r.ofPrevPct)])}
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("admin.overview.funnel.note")}
                  </Text>
                </BlockStack>
              </Card>

              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <Card title={t("admin.overview.gmvChart.title")}>
                  <BlockStack gap="200">
                    <Text as="p" variant="headingLg" numeric>
                      {money(o.money.gmvPiasters)}
                    </Text>
                    <ChartTableToggle
                      chart={<ColumnChart points={o.gmvSeries.map((p) => ({ key: p.start, value: p.value }))} startLabel={formatDate(o.from, locale, "medium")} endLabel={formatDate(o.to, locale, "medium")} />}
                      table={
                        <DataTable
                          caption={t("admin.overview.gmvChart.caption")}
                          columnContentTypes={["text", "numeric", "numeric"]}
                          headings={[t("admin.overview.gmvChart.period"), t("admin.overview.gmvChart.value"), t("admin.overview.marginChart.value")]}
                          rows={seriesRows}
                        />
                      }
                    />
                  </BlockStack>
                </Card>
                <Card title={t("admin.overview.marginChart.title")}>
                  <BlockStack gap="200">
                    <Text as="p" variant="headingLg" numeric>
                      {money(o.money.marginPiasters)}
                    </Text>
                    <ChartTableToggle
                      chart={<ColumnChart points={o.marginSeries.map((p) => ({ key: p.start, value: p.value }))} startLabel={formatDate(o.from, locale, "medium")} endLabel={formatDate(o.to, locale, "medium")} />}
                      table={
                        <DataTable
                          caption={t("admin.overview.marginChart.caption")}
                          columnContentTypes={["text", "numeric", "numeric"]}
                          headings={[t("admin.overview.gmvChart.period"), t("admin.overview.gmvChart.value"), t("admin.overview.marginChart.value")]}
                          rows={seriesRows}
                        />
                      }
                    />
                  </BlockStack>
                </Card>
              </InlineGrid>
            </BlockStack>
          </LayoutSection>

          <LayoutSection variant="oneThird" as="aside">
            <BlockStack gap="400">
              <Card title={t("admin.overview.tasks.title")}>
                {tasks.length ? (
                  <BlockStack gap="300">
                    {tasks.map((x) => (
                      <div key={x.url}>
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <Badge tone="attention" progress="incomplete">
                            {formatNumber(x.n)}
                          </Badge>
                          <Link url={x.url}>{x.text}</Link>
                          <Icon source={ChevronRight} tone="subdued" flipInRtl />
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                ) : (
                  <Text as="p" tone="subdued">
                    {t("admin.overview.tasks.allClear")}
                  </Text>
                )}
              </Card>
              <Card title={t("admin.overview.ops.title")}>
                <Box>
                  <DataTable
                    caption={t("admin.overview.ops.title")}
                    columnContentTypes={["text", "numeric"]}
                    headings={[t("admin.overview.ops.metric"), t("admin.overview.ops.value")]}
                    rows={[
                      [t("admin.overview.metrics.net"), formatMoney(o.money.netPiasters, locale)],
                      [t("admin.overview.metrics.aov"), o.money.aovPiasters === null ? t("admin.common.none") : formatMoney(o.money.aovPiasters, locale)],
                      [t("admin.overview.metrics.onTime"), pct(o.ops.onTimePct)],
                      [t("admin.overview.metrics.reprint"), pct(o.ops.reprintPct)],
                      [t("admin.overview.metrics.disputes"), pct(o.ops.disputePct)],
                    ]}
                  />
                </Box>
              </Card>
              <Card title={t("admin.overview.ops.definitions")}>
                <BlockStack gap="200">
                  {(["gmv", "margin", "onTime", "reprint", "disputes"] as const).map((k) => (
                    <Text as="p" variant="bodySm" key={k}>
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        {t(`admin.overview.metrics.${k}` as DictKey)}:
                      </Text>{" "}
                      <Text as="span" variant="bodySm" tone="subdued">
                        {t(`admin.overview.help.${k}` as DictKey)}
                      </Text>
                    </Text>
                  ))}
                </BlockStack>
              </Card>
            </BlockStack>
          </LayoutSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
