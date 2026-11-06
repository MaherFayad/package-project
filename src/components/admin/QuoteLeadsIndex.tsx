"use client";

import { MessageSquareQuote } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { IndexFilters, IndexTable, IndexTableCell, IndexTableRow } from "@/components/ui/IndexTable";
import { Link } from "@/components/ui/Link";
import { MetricsStrip } from "@/components/ui/MetricsStrip";
import { Modal } from "@/components/ui/Modal";
import { Page } from "@/components/ui/Page";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatDims, formatNumber } from "@/lib/format";
import { asLeadView, inLeadView, LEAD_VIEWS, slaHoursLeft, type LeadView } from "./lib/quoteLeads";
import { quoteLeadStepAction } from "./server/actions";
import { adminStyles } from "./charts";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";
import type { AdminQuoteLead } from "./server/queries";

/** Quote leads inbox (B-15): runs above 2,000 units and quote-only models, with a 24 h reply target. */
export function QuoteLeadsIndex({ rows, now }: { rows: AdminQuoteLead[]; now: string }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useState<LeadView>(asLeadView(params.get("view")));
  const [query, setQuery] = useState("");
  const nowDate = useMemo(() => new Date(now), [now]);
  const counts = useMemo(() => Object.fromEntries(LEAD_VIEWS.map((v) => [v, rows.filter((r) => inLeadView(r, v)).length])) as Record<LeadView, number>, [rows]);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => inLeadView(r, view) && (!q || [r.buyerName, r.buyerPhone, r.modelName, r.standard].some((x) => (x ?? "").toLowerCase().includes(q))));
  /** Checkout stores a code ("GIZA"); older or catalogue leads may carry a name ("Cairo"). */
  const governorate = (g: string) => {
    const key = `governorates.${g.toUpperCase().replace(/[\s-]+/g, "_")}`;
    const s = t(key as DictKey);
    return s === key ? g : s;
  };
  /** R4-09: a retired or unknown board code shows as written, never as a raw "materials.X" key. */
  const materialLabel = (code: string) => {
    const key = `materials.${code}`;
    const s = t(key as DictKey);
    return s === key ? code : s;
  };
  const units = rows.filter((r) => r.state !== "CLOSED").reduce((s, r) => s + r.quantity, 0);

  const sla = (r: AdminQuoteLead) => {
    if (r.state !== "OPEN") return null;
    const h = slaHoursLeft(new Date(r.dueAt), nowDate);
    return h < 0 ? (
      <Badge tone="critical" progress="incomplete">
        {t("admin.quotes.overdue", { hours: formatNumber(Math.ceil(-h)) })}
      </Badge>
    ) : (
      <Badge tone={h < 6 ? "warning" : "attention"} progress="incomplete">
        {t("admin.quotes.dueIn", { hours: formatNumber(Math.max(1, Math.floor(h))) })}
      </Badge>
    );
  };
  const stateBadge = (r: AdminQuoteLead) =>
    r.state === "OPEN" ? (
      sla(r)
    ) : (
      <Badge tone={r.state === "CONTACTED" ? "info" : "neutral"} progress={r.state === "CONTACTED" ? "partiallyComplete" : "complete"}>
        {t(`admin.quotes.states.${r.state}` as DictKey)}
      </Badge>
    );

  return (
    <Page fullWidth title={t("admin.quotes.title")} titleIcon={MessageSquareQuote} subtitle={t("admin.quotes.subtitle")}>
      <BlockStack gap="400">
        <MetricsStrip
          accessibilityLabel={t("admin.quotes.metricsLabel")}
          metrics={[
            { label: t("admin.quotes.metrics.open"), value: formatNumber(counts.open) },
            { label: t("admin.quotes.metrics.overdue"), value: formatNumber(counts.overdue) },
            { label: t("admin.quotes.metrics.contacted"), value: formatNumber(counts.contacted) },
            { label: t("admin.quotes.metrics.units"), value: formatNumber(units) },
          ]}
        />
        <div id="admin-quotes-table">
          <IndexTable
            resourceName={{ singular: t("admin.quotes.singular"), plural: t("admin.quotes.plural") }}
            caption={t("admin.quotes.title")}
            rowIds={shown.map((r) => r.quoteId)}
            headings={[
              { title: t("admin.quotes.columns.request") },
              { title: t("admin.quotes.columns.buyer") },
              { title: t("admin.quotes.columns.quantity"), alignment: "end" },
              { title: t("admin.quotes.columns.where") },
              { title: t("admin.quotes.columns.status") },
              { title: t("admin.quotes.columns.next"), alignment: "end" },
            ]}
            toolbar={
              <IndexFilters
                views={LEAD_VIEWS.map((v) => ({ id: `quotes-view-${v}`, panelID: "admin-quotes-table", content: t(`admin.quotes.views.${v}` as DictKey), badge: v !== "all" && counts[v] > 0 ? formatNumber(counts[v]) : undefined }))}
                selectedView={LEAD_VIEWS.indexOf(view)}
                onSelectView={(i) => {
                  const v = LEAD_VIEWS[i]!;
                  setView(v);
                  window.history.replaceState(null, "", `${pathname}${v === "open" ? "" : `?view=${v}`}`);
                }}
                queryValue={query}
                onQueryChange={setQuery}
                queryPlaceholder={t("admin.quotes.search")}
              />
            }
            emptyState={
              <EmptyState heading={view === "open" && !q ? t("admin.quotes.emptyOpen") : t("admin.quotes.empty")} image={<EmptyBoxIllustration size={96} />} compact>
                {view === "open" && !q ? t("admin.quotes.emptyOpenBody") : t("admin.quotes.emptyBody")}
              </EmptyState>
            }
            footer={
              shown.length ? (
                <Text as="p" tone="subdued" alignment="center" variant="bodySm">
                  {t("admin.common.count", { count: formatNumber(shown.length) })}
                </Text>
              ) : undefined
            }
          >
            {shown.map((r) => (
              <IndexTableRow key={r.quoteId} id={r.quoteId}>
                <IndexTableCell>
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="semibold">
                      <bdi>{r.modelName ?? t("admin.common.none")}</bdi>
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {[r.standard ? <bdi key="s" dir="ltr">{r.standard}</bdi> : null, r.dims ? <bdi key="d" dir="ltr">{formatDims(r.dims, locale)}</bdi> : null, r.materialCode ? materialLabel(r.materialCode) : null]
                        .filter(Boolean)
                        .flatMap((x, i) => (i ? [" · ", x] : [x]))}
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t(`admin.quotes.sources.${r.source}` as DictKey)} · {formatDate(r.createdAt, locale, "medium")}
                    </Text>
                    {r.note ? (
                      <Text as="span" variant="bodySm">
                        <span className={adminStyles.PreWrap} dir="auto">
                          {r.note}
                        </span>
                      </Text>
                    ) : null}
                    {/* R4-05: on phones the table scrolls sideways, so the buyer's call link and the
                        next step live here too (the desktop copies are hidden on phones). */}
                    <div className={adminStyles.PhoneOnly}>
                      <BlockStack gap="200">
                        <InlineStack gap="200" blockAlign="center">
                          {stateBadge(r)}
                          <Text as="span" variant="bodySm" numeric>
                            {t("admin.quotes.units", { count: formatNumber(r.quantity) })}
                          </Text>
                        </InlineStack>
                        {r.buyerPhone ? (
                          <Link url={`tel:${r.buyerPhone}`} className={adminStyles.TapLink}>
                            <bdi>{r.buyerName ?? t("admin.users.noName")}</bdi> · <bdi dir="ltr">{r.buyerPhone}</bdi>
                          </Link>
                        ) : null}
                        {r.state !== "CLOSED" ? <LeadActions lead={r} align="start" /> : null}
                      </BlockStack>
                    </div>
                  </BlockStack>
                </IndexTableCell>
                <IndexTableCell>
                  <BlockStack gap="100">
                    {r.buyerId ? (
                      <Link url={`/${locale}/admin/users/${r.buyerId}`} className={adminStyles.TapLink}>
                        <bdi>{r.buyerName ?? t("admin.users.noName")}</bdi>
                      </Link>
                    ) : (
                      <bdi>{r.buyerName ?? t("admin.users.noName")}</bdi>
                    )}
                    {r.buyerPhone ? (
                      <span className={adminStyles.DesktopOnly}>
                        <Link url={`tel:${r.buyerPhone}`} className={adminStyles.TapLink}>
                          <bdi dir="ltr">{r.buyerPhone}</bdi>
                        </Link>
                      </span>
                    ) : null}
                  </BlockStack>
                </IndexTableCell>
                <IndexTableCell alignment="end" numeric>
                  {formatNumber(r.quantity)}
                </IndexTableCell>
                <IndexTableCell>
                  <BlockStack gap="050">
                    <span>{r.governorate ? governorate(r.governorate) : t("admin.common.none")}</span>
                    {r.neededBy ? (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {t("admin.quotes.neededBy", { date: formatDate(r.neededBy, locale, "medium") })}
                      </Text>
                    ) : null}
                  </BlockStack>
                </IndexTableCell>
                <IndexTableCell>
                  <BlockStack gap="050">
                    <InlineStack>{stateBadge(r)}</InlineStack>
                    {r.state !== "OPEN" && r.lastNote ? (
                      <Text as="span" variant="bodySm" tone="subdued">
                        <bdi>{r.lastNote}</bdi>
                      </Text>
                    ) : null}
                  </BlockStack>
                </IndexTableCell>
                <IndexTableCell alignment="end">
                  <span className={adminStyles.DesktopOnly}>
                    {r.state !== "CLOSED" ? <LeadActions lead={r} /> : <Text as="span" tone="subdued">{t("admin.common.none")}</Text>}
                  </span>
                </IndexTableCell>
              </IndexTableRow>
            ))}
          </IndexTable>
        </div>
      </BlockStack>
    </Page>
  );
}

function LeadActions({ lead, align = "end" }: { lead: AdminQuoteLead; align?: "start" | "end" }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [step, setStep] = useState<"CONTACTED" | "CLOSED" | null>(null);
  const [note, setNote] = useState("");
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const who = lead.buyerName ?? lead.buyerPhone ?? "";
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "contents" }}>
      <InlineStack gap="200" align={align} wrap={false}>
        {lead.state === "OPEN" ? (
          <Button size="slim" variant="primary" onClick={() => setStep("CONTACTED")} accessibilityLabel={`${t("admin.quotes.contacted")}: ${who}`}>
            {t("admin.quotes.contacted")}
          </Button>
        ) : null}
        <Button size="slim" onClick={() => setStep("CLOSED")} accessibilityLabel={`${t("admin.quotes.close")}: ${who}`}>
          {t("admin.quotes.close")}
        </Button>
      </InlineStack>
      <Modal
        open={step !== null}
        onClose={() => setStep(null)}
        title={step === "CLOSED" ? t("admin.quotes.closeTitle") : t("admin.quotes.contactedTitle")}
        primaryAction={{
          content: step === "CLOSED" ? t("admin.quotes.close") : t("admin.quotes.contacted"),
          disabled: note.trim().length < 3,
          loading: busy === "lead",
          onAction: async () => {
            const r = await run("lead", () => quoteLeadStepAction({ quoteId: lead.quoteId, step: step!, note }), t("admin.quotes.saved"));
            setRes(r);
            if (r?.ok) {
              setStep(null);
              setNote("");
            }
          },
        }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setStep(null) }]}
      >
        <TextField
          label={step === "CLOSED" ? t("admin.quotes.closeNote") : t("admin.quotes.contactNote")}
          helpText={step === "CLOSED" ? t("admin.quotes.closeHelp") : t("admin.quotes.contactHelp")}
          autoComplete="off"
          dir="auto"
          value={note}
          onChange={setNote}
          multiline={3}
          maxLength={500}
          error={fieldError(res, "note", errorText)}
        />
      </Modal>
    </span>
  );
}
