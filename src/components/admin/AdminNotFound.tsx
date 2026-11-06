"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyBoxIllustration, EmptyState } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";

const BACK: Record<string, { path: string; label: DictKey }> = {
  orders: { path: "orders", label: "admin.order.back" },
  vendors: { path: "vendors", label: "admin.vendors.detail.back" },
  applications: { path: "vendors?tab=applications", label: "admin.application.back" },
  users: { path: "users", label: "admin.users.detail.back" },
  disputes: { path: "disputes", label: "admin.disputes.detail.back" },
};

/**
 * Body of the admin `not-found.tsx` boundaries: detail pages call notFound() for an unknown id, so
 * the response is a real HTTP 404 while the admin frame and a way back stay on screen.
 */
export function AdminNotFound({ section }: { section: keyof typeof BACK }) {
  const { t, locale } = useI18n();
  const back = BACK[section]!;
  const url = `/${locale}/admin/${back.path}`;
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
