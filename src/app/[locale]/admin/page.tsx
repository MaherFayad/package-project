import type { Metadata } from "next";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import {
  BlockStack,
  Card,
  CountBadge,
  DataTable,
  Icon,
  InlineGrid,
  Layout,
  LayoutSection,
  MetricsStrip,
  Page,
  Text,
  Tooltip,
} from "@/components/ui";
import { ChartTableToggle } from "@/components/admin/ChartTableToggle";
import { adminStyles, ColumnChart, FunnelBars } from "@/components/admin/charts";
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
  /** Metric label with its definition as a dotted-underline tooltip (Polaris metric pattern). */
  const label = (key: DictKey, help: DictKey) => (
    <Tooltip content={t(help)} dotted>
      {t(key)}
    </Tooltip>
  );
  /** Value on its own line (never breaks inside an amount), trend underneath. */
  const cell = (value: ReactNode, sub: ReactNode) => (
    <span className={adminStyles.MetricStack}>
      <span className={adminStyles.MetricNum}>{value}</span>
      <span className={adminStyles.MetricSub}>{sub}</span>
    </span>
  );

  const money = (p: number | null) => (p === null ? t("admin.common.none") : <bdi>{formatMoney(p, locale)}</bdi>);
  const seriesRows = o.gmvSeries.map((p, i) => [formatDate(p.start, locale, "medium"), formatMoney(p.value, locale), formatMoney(o.marginSeries[i]?.value ?? 0, locale)]);

  const tasks = [
    { n: o.tasks.qcPending, text: t("admin.overview.tasks.qc"), url: `${base}/orders?view=qc` },
    { n: o.tasks.applications, text: t("admin.overview.tasks.applications"), url: `${base}/vendors?tab=applications` },
    { n: o.tasks.openDisputes, text: t("admin.overview.tasks.disputes"), url: `${base}/disputes` },
    { n: o.tasks.payouts, text: t("admin.overview.tasks.payouts"), url: `${base}/payouts` },
    { n: o.tasks.dataRequests, text: t("admin.overview.tasks.dataRequests"), url: `${base}/privacy` },
  ].filter((x) => x.n > 0);

  const todo = (
    <Card title={t("admin.overview.tasks.title")}>
      {tasks.length ? (
        <ul className={adminStyles.TaskList}>
          {tasks.map((x) => (
            <li key={x.url}>
              <NextLink href={x.url} className={adminStyles.TaskLink}>
                <CountBadge>{formatNumber(x.n)}</CountBadge>
                <span className={adminStyles.TaskText}>{x.text}</span>
                <Icon source={ChevronRight} tone="subdued" flipInRtl />
              </NextLink>
            </li>
          ))}
        </ul>
      ) : (
        <Text as="p" tone="subdued">
          {t("admin.overview.tasks.allClear")}
        </Text>
      )}
    </Card>
  );

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
            { label: label("admin.overview.metrics.gmv", "admin.overview.help.gmv"), value: cell(money(o.money.gmvPiasters), signed(o.gmvChangePct)) },
            { label: label("admin.overview.metrics.margin", "admin.overview.help.margin"), value: cell(money(o.money.marginPiasters), t("admin.overview.marginOfNet", { pct: pct(o.money.marginPct), net: formatMoney(o.money.netPiasters, locale) })) },
            { label: t("admin.overview.metrics.orders"), value: cell(formatNumber(o.money.orders), t("admin.overview.aovShort", { amount: o.money.aovPiasters === null ? t("admin.common.none") : formatMoney(o.money.aovPiasters, locale) })) },
            { label: label("admin.overview.metrics.onTime", "admin.overview.help.onTime"), value: cell(pct(o.ops.onTimePct), t("admin.overview.ofDelivered", { count: formatNumber(o.ops.delivered) })) },
            { label: label("admin.overview.metrics.reprint", "admin.overview.help.reprint"), value: cell(pct(o.ops.reprintPct), t("admin.overview.reprintCount", { count: formatNumber(o.ops.reprints) })) },
            { label: label("admin.overview.metrics.disputes", "admin.overview.help.disputes"), value: cell(pct(o.ops.disputePct), t("admin.overview.openDisputes", { count: formatNumber(o.ops.openDisputes) })) },
          ]}
        />

        {/* Phones: the to-do list is the next action, so it comes before the funnel and charts. */}
        <div className={adminStyles.PhoneOnly}>{todo}</div>

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
              <div className={adminStyles.DesktopOnly}>{todo}</div>
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
