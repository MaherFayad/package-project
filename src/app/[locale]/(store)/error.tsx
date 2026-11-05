"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button, Card, EmptyState, EmptyBoxIllustration } from "@/components/ui";
import styles from "@/components/store/store.module.css";

/** Store-wide error boundary: friendly message + retry, never a stack trace. */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      <Card>
        <div role="alert">
          <EmptyState
            heading={t("store.states.errorTitle")}
            headingAs="h2"
            image={<EmptyBoxIllustration />}
            action={
              <Button variant="primary" onClick={() => reset()}>
                {t("store.states.retry")}
              </Button>
            }
            secondaryAction={<Button url={`/${locale}`} variant="plain">{t("common.goHome")}</Button>}
          >
            {t("store.states.errorBody")}
          </EmptyState>
        </div>
      </Card>
    </div>
  );
}
