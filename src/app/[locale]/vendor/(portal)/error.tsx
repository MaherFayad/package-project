"use client";

import { useEffect } from "react";
import { Button, Card, EmptyBoxIllustration, EmptyState, Page } from "@/components/ui";
import { useI18n } from "@/i18n/client";

/** Portal error boundary: keeps the frame, shows a friendly message and a retry. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page narrowWidth title={t("vendorPortal.title")}>
      <Card>
        <div role="alert">
          <EmptyState
            heading={t("vendorPortal.common.errorTitle")}
            headingAs="h2"
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" onClick={() => reset()}>
                {t("vendorPortal.common.retry")}
              </Button>
            }
            secondaryAction={
              <Button variant="plain" url={`/${locale}/vendor`}>
                {t("vendorPortal.nav.dashboard")}
              </Button>
            }
          >
            {t("vendorPortal.common.errorBody")}
          </EmptyState>
        </div>
      </Card>
    </Page>
  );
}
