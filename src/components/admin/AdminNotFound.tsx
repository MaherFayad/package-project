"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";

const BACK: Record<string, { path: string; label: DictKey; title: DictKey }> = {
  orders: { path: "orders", label: "admin.order.back", title: "admin.orders.title" },
  vendors: { path: "vendors", label: "admin.vendors.detail.back", title: "admin.vendors.title" },
  applications: { path: "vendors?tab=applications", label: "admin.application.back", title: "admin.vendors.tabs.applications" },
  users: { path: "users", label: "admin.users.detail.back", title: "admin.users.title" },
  disputes: { path: "disputes", label: "admin.disputes.detail.back", title: "admin.disputes.title" },
};

/**
 * Body of the admin `not-found.tsx` boundaries: detail pages call notFound() for an unknown id, so
 * the response is a real HTTP 404 while the admin frame and a way back stay on screen.
 */
export function AdminNotFound({ section }: { section: keyof typeof BACK }) {
  const { t, locale } = useI18n();
  const back = BACK[section]!;
  const url = `/${locale}/admin/${back.path}`;
  // a11y R6-AX-11 (WCAG 2.4.2): detail layouts that check the record call notFound() before the
  // page's generateMetadata runs, so the tab kept the site's default title. Say "Not found" here.
  const title = `${t("admin.common.notFoundTitle")} · ${t(back.title)} · ${t("admin.title")}`;
  useEffect(() => {
    if (!document.title.startsWith(t("admin.common.notFoundTitle"))) document.title = `${title} · ${locale === "ar" ? "علبة" : "Elba"}`;
  }, [title, t, locale]);
  return (
    <Page narrowWidth title={t("admin.common.notFoundTitle")} backAction={{ content: t(back.label), url }}>
      <Card>
        <EmptyState heading={t("admin.common.notFoundTitle")} headingAs="h2" image={<EmptyBoxIllustration />} action={<Button url={url}>{t(back.label)}</Button>}>
          {t("admin.common.notFoundBody")}
        </EmptyState>
      </Card>
    </Page>
  );
}
