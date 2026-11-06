"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, EmptyBoxIllustration } from "@/components/ui/EmptyState";
import { Page } from "@/components/ui/Page";

/** 404 for /s/<token> (unknown, revoked or never shared), inside the store chrome. */
export default function ShareNotFound() {
  const { t, locale } = useI18n();
  const title = `${t("designer.shared.notFoundTitle")} · ${t("meta.siteName")}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <Page narrowWidth title={t("designer.shared.notFoundTitle")}>
      <Card>
        <EmptyState
          heading={t("designer.shared.notFoundTitle")}
          image={<EmptyBoxIllustration />}
          action={
            <Button variant="primary" url={`/${locale}/design`}>
              {t("designer.shared.copyDesign")}
            </Button>
          }
        >
          <p>{t("designer.shared.notFoundBody")}</p>
        </EmptyState>
      </Card>
    </Page>
  );
}
