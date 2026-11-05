"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button, Card, EmptyState, EmptyBoxIllustration, Page } from "@/components/ui";

/** Checkout error boundary: friendly message and retry. */
export default function CheckoutError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page title={t("checkout.title")} narrowWidth>
      <Card>
        <div role="alert">
          <EmptyState
            heading={t("checkout.errorPage.title")}
            headingAs="h2"
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" onClick={() => reset()}>
                {t("checkout.errorPage.retry")}
              </Button>
            }
            secondaryAction={
              <Button variant="plain" url={`/${locale}/orders`}>
                {t("orders.title")}
              </Button>
            }
          >
            {t("checkout.errorPage.body")}
          </EmptyState>
        </div>
      </Card>
    </Page>
  );
}
