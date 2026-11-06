"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Banner } from "@/components/ui/Banner";
import { Box, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import styles from "@/components/designer/designer.module.css";

/** Error state for the designer area. Local autosave keeps the user's work. */
export default function DesignError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Box padding="400" className={styles.errorWrap}>
      <Banner tone="critical" title={t("designer.load.errorTitle")}>
        <p>{t("designer.load.errorBody")}</p>
        <Box paddingBlockStart="300">
          <InlineStack gap="200">
            <Button variant="primary" onClick={reset}>
              {t("designer.load.retry")}
            </Button>
            <Button url={`/${locale}/design`}>{t("designer.backToStyles")}</Button>
          </InlineStack>
        </Box>
      </Banner>
    </Box>
  );
}
