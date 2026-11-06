"use client";

import { useMemo, useState } from "react";
import { BlockStack, Button, Card, Checkbox, InlineGrid, InlineStack, Text, TextField } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { saveCheckoutSettingsAction } from "./server/actions";
import type { CheckoutSettingsForm as Settings } from "./lib/checkoutSettings";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/,/g, "")));

/** Prepay discount (B-11) and paid physical samples (B-05), saved to PlatformSetting "checkout". */
export function CheckoutSettingsForm({ initial }: { initial: Settings }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const start = useMemo(
    () => ({
      prepay: String(initial.prepayDiscountPct),
      enabled: initial.sample.enabled,
      price: (initial.sample.pricePiasters / 100).toFixed(2),
      pieces: String(initial.sample.maxPieces),
      days: String(initial.sample.creditDays),
      cap: String(initial.sample.monthlyCap),
      cost: initial.sample.vendorCostPiasters === null ? "" : (initial.sample.vendorCostPiasters / 100).toFixed(2),
    }),
    [initial],
  );
  const [d, setD] = useState(start);
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(start);
  const err = (k: string) => fieldError(res, k, errorText);
  const set = (k: keyof typeof d) => (v: string | boolean) => setD((x) => ({ ...x, [k]: v }));
  const prepay = num(d.prepay);
  const offPlan = Number.isFinite(prepay) && prepay !== 3;

  return (
    <Card title={t("admin.pricing.checkout.title")}>
      <form
        aria-label={t("admin.pricing.checkout.title")}
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(
            "checkout",
            () =>
              saveCheckoutSettingsAction({
                prepayDiscountPct: num(d.prepay),
                sample: { enabled: d.enabled, pricePiasters: Math.round(num(d.price) * 100), maxPieces: num(d.pieces), creditDays: num(d.days), monthlyCap: num(d.cap), vendorCostPiasters: d.cost.trim() === "" ? null : Math.round(num(d.cost) * 100) },
              }),
            t("admin.pricing.checkout.saved"),
          );
          setRes(r);
        }}
      >
        <BlockStack gap="400">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.pricing.checkout.help")}
          </Text>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
            <TextField
              label={t("admin.pricing.checkout.prepay")}
              autoComplete="off"
              inputMode="decimal"
              dir="ltr"
              suffix="%"
              value={d.prepay}
              onChange={set("prepay")}
              helpText={offPlan ? t("admin.pricing.checkout.prepayOffPlan") : t("admin.pricing.checkout.prepayHelp")}
              error={err("prepayDiscountPct")}
            />
          </InlineGrid>
          <BlockStack gap="300">
            <Text as="h3" variant="headingSm">
              {t("admin.pricing.checkout.sampleTitle")}
            </Text>
            <Checkbox label={t("admin.pricing.checkout.sampleEnabled")} helpText={t("admin.pricing.checkout.sampleEnabledHelp")} checked={d.enabled} onChange={set("enabled")} />
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
              <TextField label={t("admin.pricing.checkout.samplePrice")} autoComplete="off" inputMode="decimal" dir="ltr" value={d.price} onChange={set("price")} disabled={!d.enabled} helpText={t("admin.pricing.checkout.samplePriceHelp")} error={err("sample.pricePiasters")} />
              <TextField label={t("admin.pricing.checkout.samplePieces")} autoComplete="off" inputMode="numeric" dir="ltr" value={d.pieces} onChange={set("pieces")} disabled={!d.enabled} helpText={t("admin.pricing.checkout.samplePiecesHelp")} error={err("sample.maxPieces")} />
              <TextField label={t("admin.pricing.checkout.sampleDays")} autoComplete="off" inputMode="numeric" dir="ltr" value={d.days} onChange={set("days")} disabled={!d.enabled} helpText={t("admin.pricing.checkout.sampleDaysHelp")} error={err("sample.creditDays")} />
              <TextField label={t("admin.pricing.checkout.sampleCap")} autoComplete="off" inputMode="numeric" dir="ltr" value={d.cap} onChange={set("cap")} disabled={!d.enabled} helpText={t("admin.pricing.checkout.sampleCapHelp")} error={err("sample.monthlyCap")} />
            </InlineGrid>
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
              <TextField
                label={t("admin.pricing.checkout.sampleCost")}
                autoComplete="off"
                inputMode="decimal"
                dir="ltr"
                value={d.cost}
                onChange={set("cost")}
                disabled={!d.enabled}
                helpText={d.cost.trim() === "" ? t("admin.pricing.checkout.sampleCostAssumed") : t("admin.pricing.checkout.sampleCostHelp")}
                error={err("sample.vendorCostPiasters")}
              />
            </InlineGrid>
          </BlockStack>
          <InlineStack align="end" gap="200">
            <Button
              disabled={!dirty}
              accessibilityLabel={t("admin.pricing.checkout.discard")}
              onClick={() => {
                setD(start);
                setRes(null);
              }}
            >
              {t("admin.common.discard")}
            </Button>
            <Button variant="primary" submit disabled={!dirty} loading={busy === "checkout"} accessibilityLabel={t("admin.pricing.checkout.save")}>
              {t("admin.common.save")}
            </Button>
          </InlineStack>
        </BlockStack>
      </form>
    </Card>
  );
}
