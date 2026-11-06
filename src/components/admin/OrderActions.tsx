"use client";

import { useState, type ReactNode } from "react";
import { Avatar, BlockStack, Button, ButtonGroup, Card, InlineStack, Modal, Select, Text, TextField } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { formatMoney } from "@/lib/format";
import { addOrderNoteAction, overrideOrderAction, reassignOrderAction, refundOrderAction, reviewQcAction, shipOrderAction } from "./server/actions";
import { applyGoodsOverride } from "./lib/orders";
import { egpToPiastersInput, fieldError, piastersToInput, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";

type Res = AdminActionResponse<unknown> | null;

/* ───────────────────────── Routing ───────────────────────── */

export interface VendorOption {
  id: string;
  name: string;
  capable: boolean;
}

export function RoutingCard({
  orderId,
  currentVendorId,
  vendors,
  canReassign,
  vendorCostPiasters,
  vendor,
}: {
  orderId: string;
  currentVendorId: string;
  vendors: VendorOption[];
  canReassign: boolean;
  vendorCostPiasters: number;
  /** Current vendor summary shown at the top of the card. */
  vendor: ReactNode;
}) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState("");
  const [res, setRes] = useState<Res>(null);
  // Vendors with a rate card for this box come first; the rest stay selectable for manual quotes.
  const others = vendors.filter((v) => v.id !== currentVendorId).sort((a, b) => Number(b.capable) - Number(a.capable));
  const selected = others.find((v) => v.id === vendorId);
  const costValue = egpToPiastersInput(cost);
  const reset = () => {
    setOpen(false);
    setVendorId("");
    setCost("");
    setReason("");
    setRes(null);
  };

  return (
    // id: target of the "Change vendor" link in the awaiting-vendor banner at the top of the page.
    <div id="order-vendor">
      <Card title={t("admin.order.vendorCard.title")}>
        <BlockStack gap="300">
          {vendor}
          {!canReassign ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t("admin.order.routing.locked")}
            </Text>
          ) : !open ? (
            <InlineStack align="start">
              <Button onClick={() => setOpen(true)}>{t("admin.order.routing.change")}</Button>
            </InlineStack>
          ) : (
            <form
              aria-label={t("admin.order.routing.title")}
              onSubmit={async (e) => {
                e.preventDefault();
                if (Number.isNaN(costValue)) return;
                const r = await run("route", () => reassignOrderAction({ orderId, vendorId, vendorCostPiasters: costValue, reason }), t("admin.order.routing.success"));
                setRes(r);
                if (r?.ok) reset();
              }}
            >
              <BlockStack gap="300">
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("admin.order.routing.help")}
                </Text>
                <Select
                  label={t("admin.order.routing.newVendor")}
                  value={vendorId}
                  onChange={setVendorId}
                  placeholder={t("admin.order.routing.choose")}
                  options={others.map((v) => ({ value: v.id, label: `${v.name}${v.capable ? "" : ` (${t("admin.order.routing.notCapable")})`}` }))}
                  helpText={selected ? (selected.capable ? t("admin.order.routing.capable") : t("admin.order.routing.notCapable")) : undefined}
                  error={fieldError(res, "vendorId", errorText)}
                />
                <TextField
                  label={t("admin.order.routing.newCost")}
                  autoComplete="off"
                  inputMode="decimal"
                  dir="ltr"
                  value={cost}
                  onChange={setCost}
                  placeholder={piastersToInput(vendorCostPiasters)}
                  helpText={t("admin.order.routing.newCostHelp")}
                  error={Number.isNaN(costValue) ? t("admin.errors.INVALID") : fieldError(res, "vendorCostPiasters", errorText)}
                />
                <TextField
                  label={t("admin.common.reason")}
                  autoComplete="off"
                  value={reason}
                  onChange={setReason}
                  multiline={2}
                  maxLength={500}
                  helpText={t("admin.common.reasonHelp")}
                  error={fieldError(res, "reason", errorText)}
                />
                <InlineStack align="end" gap="200">
                  <Button onClick={reset}>{t("admin.common.cancel")}</Button>
                  <Button variant="primary" submit disabled={!vendorId || reason.trim().length < 3} loading={busy === "route"}>
                    {t("admin.order.routing.submit")}
                  </Button>
                </InlineStack>
              </BlockStack>
            </form>
          )}
        </BlockStack>
      </Card>
    </div>
  );
}

/* ───────────────────────── Override ───────────────────────── */

export function OverrideCard({
  orderId,
  status,
  money,
  goodsPiasters,
  vendorCostPiasters,
  canPrice,
  canCost,
}: {
  orderId: string;
  status: string;
  money: { subtotalPiasters: number; vatPiasters: number; shippingPiasters: number; totalPiasters: number };
  goodsPiasters: number;
  vendorCostPiasters: number;
  canPrice: boolean;
  canCost: boolean;
}) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [goods, setGoods] = useState("");
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState("");
  const [res, setRes] = useState<Res>(null);
  const goodsValue = egpToPiastersInput(goods);
  const costValue = egpToPiastersInput(cost);
  const preview = canPrice && goodsValue !== null && !Number.isNaN(goodsValue) ? applyGoodsOverride(money, goodsValue) : null;
  const [open, setOpen] = useState(false);
  const reset = () => {
    setOpen(false);
    setGoods("");
    setCost("");
    setReason("");
    setRes(null);
  };
  void status;

  if (!canPrice && !canCost) {
    return (
      <Card title={t("admin.order.override.title")}>
        <Text as="p" tone="subdued">
          {t("admin.order.override.costLocked")}
        </Text>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card title={t("admin.order.override.title")}>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            {canPrice ? t("admin.order.override.help") : t("admin.order.override.priceLocked")}
          </Text>
          <InlineStack align="start">
            <Button onClick={() => setOpen(true)}>{canPrice ? t("admin.order.override.edit") : t("admin.order.override.editCost")}</Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  return (
    <Card title={t("admin.order.override.title")}>
      <form
        aria-label={t("admin.order.override.title")}
        onSubmit={async (e) => {
          e.preventDefault();
          if (Number.isNaN(goodsValue) || Number.isNaN(costValue)) return;
          const r = await run("override", () => overrideOrderAction({ orderId, goodsPiasters: canPrice ? goodsValue : null, vendorCostPiasters: costValue, reason }), t("admin.order.override.success"));
          setRes(r);
          if (r?.ok) reset();
        }}
      >
        <BlockStack gap="300">
          {canPrice ? (
            <TextField
              label={t("admin.order.override.goods")}
              autoComplete="off"
              inputMode="decimal"
              dir="ltr"
              value={goods}
              onChange={setGoods}
              placeholder={piastersToInput(goodsPiasters)}
              helpText={preview ? t("admin.order.override.newTotal", { total: formatMoney(preview.totalPiasters, locale) }) : t("admin.order.override.goodsHelp")}
              error={Number.isNaN(goodsValue) ? t("admin.errors.INVALID") : fieldError(res, "goodsPiasters", errorText)}
            />
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">
              {t("admin.order.override.priceLocked")}
            </Text>
          )}
          {canCost ? (
            <TextField
              label={t("admin.order.override.vendorCost")}
              autoComplete="off"
              inputMode="decimal"
              dir="ltr"
              value={cost}
              onChange={setCost}
              placeholder={piastersToInput(vendorCostPiasters)}
              error={Number.isNaN(costValue) ? t("admin.errors.INVALID") : fieldError(res, "vendorCostPiasters", errorText)}
            />
          ) : null}
          <TextField label={t("admin.common.reason")} autoComplete="off" value={reason} onChange={setReason} multiline={2} maxLength={500} error={fieldError(res, "reason", errorText)} />
          <InlineStack align="end" gap="200">
            <Button onClick={reset}>{t("admin.common.cancel")}</Button>
            <Button variant="primary" submit disabled={(goodsValue === null && costValue === null) || reason.trim().length < 3} loading={busy === "override"}>
              {t("admin.order.override.submit")}
            </Button>
          </InlineStack>
        </BlockStack>
      </form>
    </Card>
  );
}

/* ───────────────────────── Refund ───────────────────────── */

export function RefundCard({ orderId, number, totalPiasters, canRefund }: { orderId: string; number: string; totalPiasters: number; canRefund: boolean }) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Card title={t("admin.order.refund.title")}>
      <BlockStack gap="300">
        <Text as="p" tone="subdued" variant="bodySm">
          {canRefund ? t("admin.order.refund.help") : t("admin.order.refund.notRefundable")}
        </Text>
        {canRefund ? (
          <InlineStack align="end">
            <Button tone="critical" onClick={() => setOpen(true)}>
              {t("admin.order.refund.button")}
            </Button>
          </InlineStack>
        ) : null}
      </BlockStack>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.order.refund.confirmTitle", { number })}
        primaryAction={{
          content: t("admin.order.refund.button"),
          destructive: true,
          disabled: reason.trim().length < 3,
          loading: busy === "refund",
          onAction: async () => {
            const r = await run("refund", () => refundOrderAction({ orderId, reason }), t("admin.order.refund.success"));
            if (r?.ok) {
              setOpen(false);
              setReason("");
            }
          },
        }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setOpen(false) }]}
      >
        <BlockStack gap="300">
          <Text as="p">{t("admin.order.refund.confirmBody", { amount: formatMoney(totalPiasters, locale) })}</Text>
          <TextField label={t("admin.common.reason")} autoComplete="off" value={reason} onChange={setReason} multiline={2} maxLength={500} helpText={t("admin.common.reasonHelp")} />
        </BlockStack>
      </Modal>
    </Card>
  );
}

/* ───────────────────────── QC ───────────────────────── */

export function QcActions({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [res, setRes] = useState<Res>(null);
  return (
    <BlockStack gap="300">
      {rejecting ? (
        <TextField label={t("admin.order.qc.rejectNote")} autoComplete="off" value={note} onChange={setNote} multiline={3} maxLength={500} error={fieldError(res, "note", errorText)} />
      ) : null}
      <InlineStack align="end" gap="200">
        {rejecting ? (
          <ButtonGroup>
            <Button onClick={() => setRejecting(false)}>{t("admin.common.cancel")}</Button>
            <Button
              tone="critical"
              variant="primary"
              disabled={note.trim().length < 3}
              loading={busy === "qc-reject"}
              onClick={async () => setRes(await run("qc-reject", () => reviewQcAction({ orderId, decision: "REJECT", note }), t("admin.order.qc.rejected")))}
            >
              {t("admin.order.qc.reject")}
            </Button>
          </ButtonGroup>
        ) : (
          <ButtonGroup>
            <Button onClick={() => setRejecting(true)}>{t("admin.order.qc.reject")}</Button>
            <Button variant="primary" loading={busy === "qc-approve"} onClick={() => run("qc-approve", () => reviewQcAction({ orderId, decision: "APPROVE" }), t("admin.order.qc.approved"))}>
              {t("admin.order.qc.approve")}
            </Button>
          </ButtonGroup>
        )}
      </InlineStack>
    </BlockStack>
  );
}

/* ───────────────────────── Dispatch ───────────────────────── */

/** READY_TO_SHIP: book the courier pickup (creates the shipment and marks the order shipped). */
export function ShipCard({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  return (
    <Card title={t("admin.order.ship.title")}>
      <BlockStack gap="300">
        <Text as="p" tone="subdued" variant="bodySm">
          {t("admin.order.ship.help")}
        </Text>
        <InlineStack align="end">
          <Button variant="primary" loading={busy === "ship"} onClick={() => run("ship", () => shipOrderAction({ orderId }), t("admin.order.ship.done"))}>
            {t("admin.order.ship.action")}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

/* ───────────────────────── Notes ───────────────────────── */

export function NoteComposer({ orderId, userName }: { orderId: string; userName: string }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run("note", () => addOrderNoteAction({ orderId, note }), t("admin.order.timeline.noteSaved"));
        if (r?.ok) setNote("");
      }}
    >
      <BlockStack gap="200">
        <InlineStack gap="300" blockAlign="start" wrap={false}>
          <Avatar name={userName} size="md" />
          <div style={{ flex: 1, minInlineSize: 0 }}>
            <TextField label={t("admin.order.timeline.noteLabel")} labelHidden autoComplete="off" value={note} onChange={setNote} placeholder={t("admin.order.timeline.placeholder")} multiline={2} maxLength={1000} />
          </div>
        </InlineStack>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" variant="bodySm" tone="subdued">
            {t("admin.order.timeline.internalHint")}
          </Text>
          <Button submit disabled={!note.trim()} loading={busy === "note"}>
            {t("admin.order.timeline.post")}
          </Button>
        </InlineStack>
      </BlockStack>
    </form>
  );
}

