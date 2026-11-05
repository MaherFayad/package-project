"use client";

import { useEffect } from "react";
import { Button, Card, EmptyBoxIllustration, EmptyState, Page } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export default function ApplyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page narrowWidth title={t("vendorPortal.apply.title")}>
      <Card>
        <div role="alert">
          <EmptyState heading={t("vendorPortal.common.errorTitle")} image={<EmptyBoxIllustration />} action={<Button variant="primary" onClick={() => reset()}>{t("vendorPortal.common.retry")}</Button>}>
            {t("vendorPortal.common.errorBody")}
          </EmptyState>
        </div>
      </Card>
    </Page>
  );
}
