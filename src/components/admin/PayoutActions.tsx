"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { Text } from "@/components/ui/Text";
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
 * A-01 (simplicity review): one confirmed "Mark paid" per payout part. Ops makes the bank transfer,
 * then records it here; the raise and approve steps it implies are written in the same action
 * (each audited). The dialog states the amount, the vendor and the part, and for the balance asks
 * for the vendor's ETA e-invoice (Egyptian e-invoicing: Elba books it against this payment).
 */
export function PayoutStepButton({
  orderId,
  orderNumber,
  kind,
  amountPiasters,
  vendorName,
  size,
}: {
  orderId: string;
  orderNumber: string;
  kind: PayoutKind;
  /** The row's next step; any step is completed by recording the payment. */
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
  const label = t("admin.payouts.steps.PAY");
  const go = async () => {
    const r = await run(key, () => payoutStepAction({ orderId, kind, step: "PAY", eInvoice: kind === "BALANCE" ? eInvoice : undefined }), t("admin.payouts.done.PAY"));
    setRes(r);
    if (r?.ok) {
      setOpen(false);
      setEInvoice(false);
    }
  };
  return (
    // React events bubble out of the portalled modal; keep them from reaching a clickable table row.
    <span onClick={(e) => e.stopPropagation()} style={{ display: "contents" }}>
      <Button size={size} variant="primary" accessibilityLabel={`${label}: ${orderNumber}, ${kindLabel}`} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.payouts.payTitle", { kind: kindLabel, number: orderNumber })}
        primaryAction={{ content: t("admin.payouts.payConfirm", { amount: formatMoney(amountPiasters, locale, { alwaysDecimals: true }) }), disabled: kind === "BALANCE" && !eInvoice, loading: busy === key, onAction: go }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setOpen(false) }]}
      >
        <BlockStack gap="300">
          <Text as="p">{t("admin.payouts.payBody", { amount: formatMoney(amountPiasters, locale, { alwaysDecimals: true }), vendor: vendorName, kind: kindLabel, number: orderNumber })}</Text>
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
                  {formatMoney(p.amountPiasters, locale, { alwaysDecimals: true })}
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
