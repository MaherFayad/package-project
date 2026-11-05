"use client";

import { useEffect } from "react";
import { Button, Card, EmptyBoxIllustration, EmptyState, Page } from "@/components/ui";
import { useI18n } from "@/i18n/client";

/** Admin error boundary: keeps the frame, explains, offers a retry. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Page narrowWidth title={t("admin.title")}>
      <Card>
        <div role="alert">
          <EmptyState
            heading={t("admin.common.errorTitle")}
            headingAs="h2"
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" onClick={() => reset()}>
                {t("admin.common.retry")}
              </Button>
            }
            secondaryAction={
              <Button variant="plain" url={`/${locale}/admin`}>
                {t("admin.nav.overview")}
              </Button>
            }
          >
            {t("admin.common.errorBody")}
          </EmptyState>
        </div>
      </Card>
    </Page>
  );
}
