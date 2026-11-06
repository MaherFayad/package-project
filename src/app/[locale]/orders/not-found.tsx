"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button, Card, EmptyState, EmptyBoxIllustration, Page } from "@/components/ui";

/** 404 for /orders/<id> (unknown or not the viewer's), inside the store chrome. */
export default function OrderNotFound() {
  const { t, locale } = useI18n();
  const title = `${t("buyer.orderNotFound.title")} · ${t("meta.siteName")}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <Page title={t("orders.title")} narrowWidth backAction={{ content: t("orders.detail.back"), url: `/${locale}/orders` }}>
      <Card>
        <EmptyState heading={t("buyer.orderNotFound.title")} image={<EmptyBoxIllustration />} action={<Button url={`/${locale}/orders`}>{t("buyer.orderNotFound.action")}</Button>}>
          {t("buyer.orderNotFound.body")}
        </EmptyState>
      </Card>
    </Page>
  );
}
