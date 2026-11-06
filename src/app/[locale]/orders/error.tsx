"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";

/** Orders error boundary (list, detail, invoice). */
export default function OrdersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page title={t("orders.title")} narrowWidth>
      <Card>
        <div role="alert">
          <EmptyState
            heading={t("orders.errorTitle")}
            headingAs="h2"
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" onClick={() => reset()}>
                {t("orders.retry")}
              </Button>
            }
          >
            {t("orders.errorBody")}
          </EmptyState>
        </div>
      </Card>
    </Page>
  );
}
