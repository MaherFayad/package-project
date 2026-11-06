"use client";

import { useState } from "react";
import { BlockStack, InlineGrid, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/i18n/client";
import { parseWholeInput } from "@/lib/money/input";
import { saveVendorMetricsAction } from "./server/actions";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";

/** R5-JR-05 (admin round 8): deliveries a printer needs before buyers see its on-time figure. */
export function VendorMetricsForm({ initial }: { initial: number }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [value, setValue] = useState(String(initial));
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const n = parseWholeInput(value);
  const invalid = n === null || Number.isNaN(n) || n < 1 || n > 50;
  return (
    <Card title={t("admin.pricing.vendorMetrics.title")}>
      <form
        aria-label={t("admin.pricing.vendorMetrics.title")}
        onSubmit={async (e) => {
          e.preventDefault();
          if (invalid) {
            setRes({ ok: false, error: "INVALID", fieldErrors: { onTimeMinDeliveries: "ON_TIME_MIN_RANGE" } });
            return;
          }
          setRes(await run("vendor-metrics", () => saveVendorMetricsAction({ onTimeMinDeliveries: n! }), t("admin.pricing.vendorMetrics.saved")));
        }}
      >
        <BlockStack gap="300">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.pricing.vendorMetrics.help")}
          </Text>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
            <TextField
              label={t("admin.pricing.vendorMetrics.min")}
              autoComplete="off"
              inputMode="numeric"
              dir="ltr"
              value={value}
              onChange={setValue}
              helpText={t("admin.pricing.vendorMetrics.minHelp")}
              error={fieldError(res, "onTimeMinDeliveries", errorText)}
            />
          </InlineGrid>
          <InlineStack align="end">
            <Button variant="primary" submit disabled={value === String(initial)} loading={busy === "vendor-metrics"}>
              {t("admin.common.save")}
            </Button>
          </InlineStack>
        </BlockStack>
      </form>
    </Card>
  );
}
