import { Banknote } from "lucide-react";
import {
  Badge,
  Banner,
  BlockStack,
  Card,
  EmptyBoxIllustration,
  EmptyState,
  IndexTable,
  IndexTableCell,
  IndexTableRow,
  IndexTableRowLink,
  MetricsStrip,
  Page,
  Text,
} from "@/components/ui";
import { requireVendorContext } from "@/components/vendor/server/context";
import { getPayoutRows } from "@/components/vendor/server/queries";
import { payoutBadge, payoutSummary } from "@/components/vendor/lib/payouts";
import styles from "@/components/vendor/vendor.module.css";
import { getT, toLocale, type DictKey } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const t = getT(toLocale((await params).locale));
  return { title: `${t("vendorPortal.payouts.title")} · ${t("vendorPortal.title")}` };
}

export default async function PayoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = toLocale((await params).locale);
  const t = getT(locale);
  const { vendor } = await requireVendorContext(locale, `/${locale}/vendor/payouts`);
  if (!vendor || vendor.status === "PENDING") return null;
  const rows = await getPayoutRows(vendor.id);
  const sum = payoutSummary(rows);

  return (
    <Page fullWidth title={t("vendorPortal.payouts.title")} titleIcon={<Banknote aria-hidden="true" />} subtitle={t("vendorPortal.payouts.subtitle")}>
      <BlockStack gap="400">
        <div className={styles.MetricsWrap}>
          <MetricsStrip
            accessibilityLabel={t("vendorPortal.payouts.metricsLabel")}
            metrics={[
              { label: t("vendorPortal.payouts.metrics.paid"), value: formatMoney(sum.paidPiasters, locale) },
              { label: t("vendorPortal.payouts.metrics.approved"), value: formatMoney(sum.approvedPiasters, locale) },
              { label: t("vendorPortal.payouts.metrics.pending"), value: formatMoney(sum.pendingPiasters, locale) },
              { label: t("vendorPortal.payouts.metrics.scheduled"), value: formatMoney(sum.scheduledPiasters, locale) },
            ]}
          />
        </div>
        {sum.eInvoiceCount > 0 ? (
          <Banner tone="warning" title={t("vendorPortal.payouts.eInvoiceTitle")}>
            {t("vendorPortal.payouts.eInvoiceBody", { count: sum.eInvoiceCount })}
          </Banner>
        ) : null}
        <div className={styles.CondensedTable}>
        <IndexTable
          resourceName={{ singular: t("vendorPortal.payouts.resourceSingular"), plural: t("vendorPortal.payouts.resourcePlural") }}
          caption={t("vendorPortal.payouts.scheduleTitle")}
          title={t("vendorPortal.payouts.scheduleTitle")}
          rowIds={rows.map((r) => r.key)}
          headings={[
            { title: t("vendorPortal.payouts.columns.order") },
            { title: t("vendorPortal.payouts.columns.kind") },
            { title: t("vendorPortal.payouts.columns.trigger") },
            { title: t("vendorPortal.payouts.columns.status") },
            { title: t("vendorPortal.payouts.columns.date") },
            { title: t("vendorPortal.payouts.columns.amount"), alignment: "end" },
          ]}
          emptyState={
            <EmptyState heading={t("vendorPortal.payouts.emptyTitle")} image={<EmptyBoxIllustration size={96} />} compact>
              {t("vendorPortal.payouts.emptyBody")}
            </EmptyState>
          }
        >
          {rows.map((r) => {
            const b = payoutBadge(r.status);
            return (
              <IndexTableRow key={r.key} id={r.key}>
                <IndexTableCell>
                  {r.orderNumber ? (
                    <IndexTableRowLink url={`/${locale}/vendor/jobs/${r.orderNumber}`}>
                      <bdi>{r.orderNumber}</bdi>
                    </IndexTableRowLink>
                  ) : (
                    "—"
                  )}
                  {/* Phones: condensed row (part, status, date and amount under the job number). */}
                  <div className={styles.Condensed}>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {t(`vendorPortal.payouts.kinds.${r.kind}` as DictKey)} · {t(`vendorPortal.payouts.triggers.${r.trigger}` as DictKey)}
                    </Text>
                    <span className={styles.CondensedMeta}>
                      <Badge tone={b.tone} progress={b.progress}>
                        {t(`vendorPortal.payouts.statuses.${r.status}` as DictKey)}
                      </Badge>
                      <Text as="span" numeric fontWeight="semibold">
                        {formatMoney(r.amountPiasters, locale)}
                      </Text>
                    </span>
                    {r.date ? (
                      <Text as="span" tone="subdued" variant="bodySm">
                        <time dateTime={r.date}>{formatDate(r.date, locale)}</time>
                      </Text>
                    ) : null}
                  </div>
                </IndexTableCell>
                <IndexTableCell className={styles.WideOnly}>{t(`vendorPortal.payouts.kinds.${r.kind}` as DictKey)}</IndexTableCell>
                <IndexTableCell className={styles.WideOnly}>
                  <Text as="span" tone="subdued">
                    {t(`vendorPortal.payouts.triggers.${r.trigger}` as DictKey)}
                  </Text>
                </IndexTableCell>
                <IndexTableCell className={styles.WideOnly}>
                  <Badge tone={b.tone} progress={b.progress}>
                    {t(`vendorPortal.payouts.statuses.${r.status}` as DictKey)}
                  </Badge>
                </IndexTableCell>
                <IndexTableCell className={styles.WideOnly}>{r.date ? <time dateTime={r.date}>{formatDate(r.date, locale)}</time> : "—"}</IndexTableCell>
                <IndexTableCell className={styles.WideOnly} alignment="end" numeric>
                  {formatMoney(r.amountPiasters, locale)}
                </IndexTableCell>
              </IndexTableRow>
            );
          })}
        </IndexTable>
        </div>
        <Card title={t("vendorPortal.payouts.termsTitle")}>
          <ul className={styles.Steps}>
            <li>{t("vendorPortal.payouts.termsAdvance")}</li>
            <li>{t("vendorPortal.payouts.termsBalance")}</li>
            <li>{t("vendorPortal.payouts.termsBank")}</li>
          </ul>
        </Card>
      </BlockStack>
    </Page>
  );
}
