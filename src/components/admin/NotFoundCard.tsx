import { Button, Card, EmptyBoxIllustration, EmptyState, Page } from "@/components/ui";
import { getT } from "@/i18n";
import type { Locale } from "@/types";

/** Shared "record not found" state for admin detail pages (keeps the frame and gives a way back). */
export function NotFoundCard({ locale, backUrl, backLabel }: { locale: Locale; backUrl: string; backLabel: string }) {
  const t = getT(locale);
  return (
    <Page narrowWidth title={t("admin.common.notFoundTitle")} backAction={{ content: backLabel, url: backUrl }}>
      <Card>
        <EmptyState heading={t("admin.common.notFoundTitle")} headingAs="h2" image={<EmptyBoxIllustration />} action={<Button url={backUrl}>{backLabel}</Button>}>
          {t("admin.common.notFoundBody")}
        </EmptyState>
      </Card>
    </Page>
  );
}
