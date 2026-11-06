"use client";

import { useState } from "react";
import { Badge, BlockStack, Button, Card, Checkbox, InlineStack, Modal, Text } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { payoutBadge, type ScheduleStatus } from "@/components/vendor/lib/payouts";
import type { PayoutKind } from "@/types";
import { payoutStepAction } from "./server/actions";
import type { PayoutStep } from "./lib/payouts";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";

export function PayoutStatusBadge({ status }: { status: ScheduleStatus }) {
  const { t } = useI18n();
  const b = payoutBadge(status);
  return (
    <Badge tone={b.tone} progress={b.progress}>
      {t(`admin.payouts.statuses.${status}` as DictKey)}
    </Badge>
  );
}

/**
 * One next step on a payout part. Raise and approve run at once (both are reversible by ops until
 * money moves); "Mark paid" asks for confirmation, and for the balance also for the vendor's ETA
 * e-invoice (Egyptian e-invoicing: Elba books the vendor's invoice against this payment).
 */
export function PayoutStepButton({
  orderId,
  orderNumber,
  kind,
  step,
  amountPiasters,
  vendorName,
  size,
}: {
  orderId: string;
  orderNumber: string;
  kind: PayoutKind;
  step: PayoutStep;
  amountPiasters: number;
  vendorName: string;
  size?: "slim";
}) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [open, setOpen] = useState(false);
  const [eInvoice, setEInvoice] = useState(false);
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const key = `payout-${orderId}-${kind}`;
  const kindLabel = t(`admin.payouts.kinds.${kind}` as DictKey);
  const label = t(`admin.payouts.steps.${step}` as DictKey);
  const go = async () => {
    const r = await run(key, () => payoutStepAction({ orderId, kind, step, eInvoice: kind === "BALANCE" && step === "PAY" ? eInvoice : undefined }), t(`admin.payouts.done.${step}` as DictKey));
    setRes(r);
    if (r?.ok) {
      setOpen(false);
      setEInvoice(false);
    }
  };
  return (
    // React events bubble out of the portalled modal; keep them from reaching a clickable table row.
    <span onClick={(e) => e.stopPropagation()} style={{ display: "contents" }}>
      <Button
        size={size}
        variant={step === "PAY" ? "primary" : undefined}
        loading={busy === key && !open}
        accessibilityLabel={`${label}: ${orderNumber}, ${kindLabel}`}
        onClick={() => (step === "PAY" ? setOpen(true) : void go())}
      >
        {label}
      </Button>
      {step === "PAY" ? (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title={t("admin.payouts.payTitle", { kind: kindLabel, number: orderNumber })}
          primaryAction={{ content: label, disabled: kind === "BALANCE" && !eInvoice, loading: busy === key, onAction: go }}
          secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setOpen(false) }]}
        >
          <BlockStack gap="300">
            <Text as="p">{t("admin.payouts.payBody", { amount: formatMoney(amountPiasters, locale), vendor: vendorName })}</Text>
            {kind === "BALANCE" ? (
              <Checkbox
                label={t("admin.payouts.eInvoiceConfirm")}
                helpText={t("admin.payouts.eInvoiceHelp")}
                checked={eInvoice}
                onChange={setEInvoice}
                error={fieldError(res, "eInvoice", errorText)}
              />
            ) : null}
          </BlockStack>
        </Modal>
      ) : null}
    </span>
  );
}

export interface OrderPayoutPart {
  kind: PayoutKind;
  amountPiasters: number;
  status: ScheduleStatus;
  date: string | null;
  step: PayoutStep | null;
  /** Balance held by an open dispute. */
  held?: boolean;
}

/** Order page sidebar: the two parts of the vendor's buy price and the next step on each. */
export function PayoutsCard({ orderId, orderNumber, vendorName, parts }: { orderId: string; orderNumber: string; vendorName: string; parts: OrderPayoutPart[] }) {
  const { t, locale } = useI18n();
  return (
    <Card title={t("admin.payouts.cardTitle")}>
      <BlockStack gap="300">
        {parts.length === 0 ? (
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.payouts.notEarned")}
          </Text>
        ) : (
          parts.map((p) => (
            <BlockStack key={p.kind} gap="150">
              <InlineStack align="space-between" blockAlign="center" gap="200">
                <Text as="p" fontWeight="semibold">
                  {t(`admin.payouts.kinds.${p.kind}` as DictKey)}
                </Text>
                <Text as="p" numeric fontWeight="semibold">
                  {formatMoney(p.amountPiasters, locale)}
                </Text>
              </InlineStack>
              <InlineStack align="space-between" blockAlign="center" gap="200">
                <InlineStack gap="150" blockAlign="center">
                  <PayoutStatusBadge status={p.status} />
                  {p.date ? (
                    <Text as="span" variant="bodySm" tone="subdued">
                      {formatDate(p.date, locale, "medium")}
                    </Text>
                  ) : null}
                </InlineStack>
                {p.step ? <PayoutStepButton orderId={orderId} orderNumber={orderNumber} kind={p.kind} step={p.step} amountPiasters={p.amountPiasters} vendorName={vendorName} size="slim" /> : null}
              </InlineStack>
              <Text as="p" variant="bodySm" tone={p.held ? "caution" : "subdued"}>
                {p.held ? t("admin.payouts.disputeHold") : t(`admin.payouts.trigger.${p.kind}` as DictKey)}
              </Text>
            </BlockStack>
          ))
        )}
      </BlockStack>
    </Card>
  );
}
