import { CircleCheck, Circle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Box, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Layout, LayoutSection } from "@/components/ui/Layout";
import { Link } from "@/components/ui/Link";
import { MetricsStrip } from "@/components/ui/MetricsStrip";
import { Page } from "@/components/ui/Page";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Text } from "@/components/ui/Text";
import { DueLabel, JobStatusBadge } from "@/components/vendor/JobBits";
import { requireVendorContext } from "@/components/vendor/server/context";
import { getDashboard } from "@/components/vendor/server/queries";
import styles from "@/components/vendor/vendor.module.css";
import { getT, pick, toLocale, type DictKey } from "@/i18n";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { JobListItemDTO } from "@/components/vendor/types";
import type { Locale } from "@/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  return { title: `${t("vendorPortal.dashboard.title")} · ${t("vendorPortal.title")}` };
}

function JobList({ jobs, locale, empty }: { jobs: JobListItemDTO[]; locale: Locale; empty: string }) {
  const t = getT(locale);
  if (!jobs.length) {
    return (
      <Text as="p" tone="subdued">
        {empty}
      </Text>
    );
  }
  return (
    <ul className={styles.List}>
      {jobs.map((j) => (
        <li key={j.id} className={styles.ListItem}>
          <div className={styles.ListMain}>
            <InlineStack gap="200" blockAlign="center">
              <Link url={`/${locale}/vendor/jobs/${j.number}`} monochrome removeUnderline>
                <Text as="span" fontWeight="semibold" numeric>
                  {j.number}
                </Text>
              </Link>
              <JobStatusBadge job={j} />
            </InlineStack>
            <Text as="span" tone="subdued" variant="bodySm">
              {j.model && j.model.code !== j.structureCode ? j.model.name[locale] : t(`structures.${j.structureCode}` as DictKey)} · {t("vendorPortal.common.pcs", { count: formatNumber(j.quantity) })} · <bdi>{j.buyerName}</bdi>
            </Text>
          </div>
          <div className={styles.ListMeta}>
            <DueLabel dueDate={j.dueDate} status={j.status} />
            <Text as="span" numeric fontWeight="semibold">
              {formatMoney(j.vendorCostPiasters, locale)}
            </Text>
            <Button size="slim" url={`/${locale}/vendor/jobs/${j.number}`} accessibilityLabel={`${t("vendorPortal.dashboard.review")} ${j.number}`}>
              {t("vendorPortal.dashboard.review")}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function VendorDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { vendor } = await requireVendorContext(locale);
  if (!vendor || vendor.status === "PENDING") return null;
  const d = await getDashboard(vendor.id);
  const base = `/${locale}/vendor`;

  const setupItems: { key: keyof typeof d.setup; label: DictKey; url: string }[] = [
    { key: "bio", label: "vendorPortal.dashboard.setup.bio", url: `${base}/profile` },
    { key: "machines", label: "vendorPortal.dashboard.setup.machines", url: `${base}/profile#machines` },
    { key: "portfolio", label: "vendorPortal.dashboard.setup.portfolio", url: `${base}/profile#portfolio` },
    { key: "foodSafe", label: "vendorPortal.dashboard.setup.foodSafe", url: `${base}/profile#certifications` },
    { key: "rateCards", label: "vendorPortal.dashboard.setup.rateCards", url: `${base}/rate-cards` },
  ];
  const done = setupItems.filter((s) => d.setup[s.key]).length;
  // R7 (CR-35): one money precision per group: the two money metrics, and the payouts card column.
  const upcoming = d.payouts.pendingPiasters + d.payouts.approvedPiasters + d.payouts.scheduledPiasters;
  const hasPiasters = (...v: number[]) => ({ alwaysDecimals: v.some((x) => Math.round(x) % 100 !== 0) });
  const metricDec = hasPiasters(d.payouts.paidPiasters, upcoming);
  const cardDec = hasPiasters(d.payouts.paidPiasters, d.payouts.pendingPiasters + d.payouts.approvedPiasters, d.payouts.scheduledPiasters);

  return (
    <Page fullWidth title={t("vendorPortal.dashboard.greeting", { name: pick(locale, vendor.nameAr, vendor.nameEn) })} subtitle={t("vendorPortal.dashboard.subtitle")}>
      <BlockStack gap="400">
        {d.bioReview ? (
          <Banner
            tone={d.bioReview === "PENDING" ? "info" : "warning"}
            title={t(d.bioReview === "PENDING" ? "vendorPortal.dashboard.bioPending" : "vendorPortal.dashboard.bioRejected")}
            action={{ content: t("vendorPortal.dashboard.bioAction"), url: `${base}/profile` }}
          />
        ) : null}
        <div className={styles.MetricsWrap}>
          <MetricsStrip
            accessibilityLabel={t("vendorPortal.dashboard.metricsLabel")}
            metrics={[
              { label: t("vendorPortal.dashboard.metrics.awaiting"), value: <span data-testid="metric-awaiting">{formatNumber(d.awaitingCount)}</span> },
              { label: t("vendorPortal.dashboard.metrics.inProduction"), value: formatNumber(d.inProductionCount) },
              { label: t("vendorPortal.dashboard.metrics.dueSoon"), value: formatNumber(d.dueSoonCount) },
              { label: t("vendorPortal.dashboard.metrics.onTime"), value: formatPercent(d.onTimePct, locale) },
              {
                label: t("vendorPortal.dashboard.metrics.rating"),
                value: t("vendorPortal.dashboard.ratingValue", { rating: d.rating.toFixed(1) }),
                trend: t("vendorPortal.dashboard.ratingCount", { count: formatNumber(d.ratingCount) }),
              },
              { label: t("vendorPortal.dashboard.metrics.paidOut"), value: formatMoney(d.payouts.paidPiasters, locale, metricDec) },
              { label: t("vendorPortal.dashboard.metrics.upcoming"), value: formatMoney(upcoming, locale, metricDec) },
            ]}
          />
        </div>
        <Layout>
          <LayoutSection>
            <BlockStack gap="400">
              <Card
                title={t("vendorPortal.dashboard.awaitingTitle")}
                headerActions={d.awaitingCount > 0 ? <Badge tone="attention">{formatNumber(d.awaitingCount)}</Badge> : undefined}
                footer={
                  <Button variant="plain" url={`${base}/jobs?view=awaiting`}>
                    {t("vendorPortal.dashboard.viewAll")}
                  </Button>
                }
              >
                <BlockStack gap="300">
                  {d.awaitingCount > 0 ? (
                    <Text as="p" tone="subdued">
                      {t("vendorPortal.dashboard.awaitingHelp")}
                    </Text>
                  ) : null}
                  <JobList jobs={d.awaiting} locale={locale} empty={t("vendorPortal.dashboard.awaitingEmpty")} />
                </BlockStack>
              </Card>
              <Card
                title={t("vendorPortal.dashboard.dueTitle")}
                footer={
                  <Button variant="plain" url={`${base}/jobs?due=soon`}>
                    {t("vendorPortal.dashboard.viewAll")}
                  </Button>
                }
              >
                <JobList jobs={d.dueSoon} locale={locale} empty={d.dueSoonCount > 0 ? t("vendorPortal.dashboard.dueOnlyAwaiting") : t("vendorPortal.dashboard.dueEmpty")} />
              </Card>
            </BlockStack>
          </LayoutSection>
          <LayoutSection variant="oneThird" as="aside" aria-label={t("vendorPortal.dashboard.payoutsTitle")}>
            <BlockStack gap="400">
              <Card
                title={t("vendorPortal.dashboard.payoutsTitle")}
                footer={
                  <Button variant="plain" url={`${base}/payouts`}>
                    {t("vendorPortal.dashboard.payoutsLink")}
                  </Button>
                }
              >
                <BlockStack gap="100">
                  {(
                    [
                      ["vendorPortal.dashboard.payoutsPaid", d.payouts.paidPiasters],
                      ["vendorPortal.dashboard.payoutsPending", d.payouts.pendingPiasters + d.payouts.approvedPiasters],
                      ["vendorPortal.dashboard.payoutsScheduled", d.payouts.scheduledPiasters],
                    ] as [DictKey, number][]
                  ).map(([label, amount]) => (
                    <div key={label} className={styles.SummaryRow}>
                      <Text as="span" tone="subdued">
                        {t(label)}
                      </Text>
                      <Text as="span" numeric fontWeight="semibold">
                        {formatMoney(amount, locale, cardDec)}
                      </Text>
                    </div>
                  ))}
                  {d.payouts.eInvoiceCount > 0 ? (
                    <Box paddingBlockStart="200">
                      <Banner tone="warning" inCard>
                        {t("vendorPortal.dashboard.eInvoiceReminder", { count: formatNumber(d.payouts.eInvoiceCount) })}
                      </Banner>
                    </Box>
                  ) : null}
                </BlockStack>
              </Card>
              <Card
                title={t("vendorPortal.dashboard.setupTitle")}
                footer={
                  <Button url={`${base}/profile`}>{t("vendorPortal.dashboard.setupAction")}</Button>
                }
              >
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("vendorPortal.dashboard.setupProgress", { done, total: setupItems.length })}
                    </Text>
                    <ProgressBar progress={(done / setupItems.length) * 100} size="small" accessibilityLabel={t("vendorPortal.dashboard.setupProgress", { done, total: setupItems.length })} />
                  </BlockStack>
                  <ul className={styles.Checklist}>
                    {setupItems.map((s) => (
                      <li key={s.key} className={styles.ChecklistItem}>
                        <Icon source={d.setup[s.key] ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />} tone={d.setup[s.key] ? "success" : "subdued"} />
                        {d.setup[s.key] ? (
                          // CR-41: done = check icon + secondary text (strikethrough cuts Arabic letter joins).
                          <Text as="span" tone="subdued">
                            {t(s.label)}
                            <span className="visually-hidden">{` (${t("vendorPortal.dashboard.setupDone")})`}</span>
                          </Text>
                        ) : (
                          <Link url={s.url}>{t(s.label)}</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </BlockStack>
              </Card>
              <Card
                title={t("vendorPortal.dashboard.rateCardsTitle")}
                footer={
                  <Button variant="plain" url={`${base}/rate-cards`}>
                    {t("vendorPortal.dashboard.rateCardsLink")}
                  </Button>
                }
              >
                <Text as="p">{t("vendorPortal.dashboard.rateCardsBody", { active: formatNumber(d.activeCards) })}</Text>
              </Card>
            </BlockStack>
          </LayoutSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
