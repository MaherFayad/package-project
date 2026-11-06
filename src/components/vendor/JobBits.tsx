"use client";

import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/ui/Text";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate } from "@/lib/format";
import { daysUntil, dueState, jobView, statusBadge, type JobStateInput } from "./lib/jobs";

/** Status pill: colour + progress pip + explicit text (declined/awaiting use the vendor's view names). */
export function JobStatusBadge({ job }: { job: JobStateInput }) {
  const { t } = useI18n();
  const view = jobView(job);
  const { tone, progress } = statusBadge(job);
  const label =
    view === "declined" ? t("vendorPortal.views.declined") : view === "awaiting" ? t("vendorPortal.views.awaiting") : t(`orderStatus.${job.status}` as DictKey);
  return (
    <Badge tone={tone} progress={progress}>
      {label}
    </Badge>
  );
}

/** "Due in 2 days" / "Overdue by 1 days" / date, with a badge when it needs attention. */
export function DueLabel({ dueDate, status, compact }: { dueDate: string | null; status: string; compact?: boolean }) {
  const { t, locale } = useI18n();
  if (!dueDate) return <Text as="span" tone="subdued">—</Text>;
  const state = dueState(dueDate, status);
  const days = daysUntil(dueDate);
  const date = formatDate(dueDate, locale, "medium");
  if (state === "overdue") {
    return (
      <span suppressHydrationWarning>
        <Badge tone="critical" progress="incomplete">{-days <= 1 ? t("vendorPortal.due.overdueOne") : t("vendorPortal.due.overdue", { count: -days })}</Badge>
      </span>
    );
  }
  if (state === "dueSoon") {
    return (
      <span suppressHydrationWarning>
        <Badge tone="warning" progress="partiallyComplete">{days <= 0 ? t("vendorPortal.due.today") : days === 1 ? t("vendorPortal.due.tomorrow") : t("vendorPortal.due.inDays", { count: days })}</Badge>
      </span>
    );
  }
  return (
    <Text as="span" numeric={!compact}>
      <time dateTime={dueDate}>{date}</time>
    </Text>
  );
}

/** What was ordered: the exact library model ("FEFCO 0203 · Full overlap slotted container"),
 *  or the box style for jobs placed before the model library. */
export function useProductName() {
  const { t, locale } = useI18n();
  return (job: { structureCode: string; model?: { code: string; standard: string; name: { ar: string; en: string } } | null }) =>
    job.model && job.model.code !== job.structureCode ? job.model.name[locale] : t(`structures.${job.structureCode}` as DictKey);
}
