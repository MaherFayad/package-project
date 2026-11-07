"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useInlineEditFocus } from "@/components/ui/useInlineEditFocus";
import { useI18n } from "@/i18n/client";
import { formatMoney, formatPercent } from "@/lib/format";
import type { DictKey } from "@/i18n";
import { addOrderNoteAction, overrideOrderAction, reassignOrderAction, refundOrderAction, reviewQcAction, shipOrderAction } from "./server/actions";
import { adminStyles } from "./charts";
import { applyGoodsOverride, isQuoteOnly, marginPreview, TARGET_MARGIN_PCT } from "./lib/orders";
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
  number,
  currentVendorName,
  marginTargetPct,
  currentVendorId,
  vendors,
  canReassign,
  vendorCostPiasters,
  goodsPiasters,
  jobLabel,
  vendor,
}: {
  orderId: string;
  number: string;
  currentVendorName: string;
  /** Margin share of the sale price the current pricing settings give (A-02). */
  marginTargetPct: number | null;
  currentVendorId: string;
  vendors: VendorOption[];
  canReassign: boolean;
  vendorCostPiasters: number;
  /** Goods ex-VAT the buyer pays (for the margin preview). */
  goodsPiasters: number;
  /** "Shipping box · B-flute kraft": the style and board a vendor needs a rate card for. */
  jobLabel: string;
  /** Current vendor summary shown at the top of the card. */
  vendor: ReactNode;
}) {
  const { t, locale } = useI18n();
  const quoteOnly = isQuoteOnly(vendors);
  const [confirming, setConfirming] = useState(false);
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [open, setOpen] = useState(false);
  const { containerRef, openerRef } = useInlineEditFocus(open); // a11y R5-AX-06 (2.4.3)
  const [vendorId, setVendorId] = useState("");
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState("");
  const [res, setRes] = useState<Res>(null);
  // Vendors with a rate card for this box come first; the rest stay selectable for manual quotes.
  const others = vendors.filter((v) => v.id !== currentVendorId).sort((a, b) => Number(b.capable) - Number(a.capable));
  const selected = others.find((v) => v.id === vendorId);
  const costValue = egpToPiastersInput(cost);
  const costRequired = !!selected && !selected.capable;
  const effectiveCost = costValue === null || Number.isNaN(costValue) ? vendorCostPiasters : costValue;
  const reset = () => {
    setOpen(false);
    setConfirming(false);
    setVendorId("");
    setCost("");
    setReason("");
    setRes(null);
  };
  const submit = async () => {
    if (Number.isNaN(costValue)) return;
    const r = await run("route", () => reassignOrderAction({ orderId, vendorId, vendorCostPiasters: costValue, reason }), t("admin.order.routing.success"));
    setRes(r);
    setConfirming(false);
    if (r?.ok) reset();
  };

  return (
    // id: target of the "Change vendor" link in the awaiting-vendor banner at the top of the page.
    <div id="order-vendor" className={adminStyles.AnchorTarget}>
      <Card title={t("admin.order.vendorCard.title")}>
        <BlockStack gap="300">
          {vendor}
          {quoteOnly ? (
            <Banner tone="info" title={t("admin.order.routing.quoteOnlyTitle")}>
              {t("admin.order.routing.quoteOnlyBody", { job: jobLabel })}
            </Banner>
          ) : null}
          {!canReassign ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t("admin.order.routing.locked")}
            </Text>
          ) : !open ? (
            <InlineStack align="start">
              <Button ref={openerRef} onClick={() => setOpen(true)}>{t("admin.order.routing.change")}</Button>
            </InlineStack>
          ) : (
            <form
              ref={containerRef}
              aria-label={t("admin.order.routing.title")}
              onSubmit={(e) => {
                e.preventDefault();
                // A-05: moving a job changes who is paid and at what price; confirm it first.
                if (!Number.isNaN(costValue)) setConfirming(true);
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
                  // Quote-only jobs: every vendor lacks a rate card, so the banner says it once instead of on every option.
                  options={others.map((v) => ({ value: v.id, label: `${v.name}${v.capable || quoteOnly ? "" : ` (${t("admin.order.routing.notCapable")})`}` }))}
                  helpText={selected ? (selected.capable ? t("admin.order.routing.capable") : t("admin.order.routing.notCapableHelp")) : undefined}
                  error={fieldError(res, "vendorId", errorText)}
                />
                <TextField
                  label={costRequired ? t("admin.order.routing.newCostRequired") : t("admin.order.routing.newCost")}
                  autoComplete="off"
                  inputMode="decimal"
                  dir="ltr"
                  value={cost}
                  onChange={setCost}
                  requiredIndicator={costRequired}
                  placeholder={costRequired ? undefined : piastersToInput(vendorCostPiasters)}
                  helpText={
                    <>
                      {costRequired ? t("admin.order.routing.newCostManualHelp") : t("admin.order.routing.newCostHelp")} <MarginLine goodsPiasters={goodsPiasters} vendorCostPiasters={effectiveCost} targetPct={marginTargetPct} />
                    </>
                  }
                  error={Number.isNaN(costValue) ? t("admin.errors.INVALID") : fieldError(res, "vendorCostPiasters", errorText)}
                />
                <TextField
                  label={t("admin.common.reason")}
                  autoComplete="off"
                  dir="auto"
                  value={reason}
                  onChange={setReason}
                  multiline={2}
                  maxLength={500}
                  helpText={t("admin.common.reasonHelp")}
                  error={fieldError(res, "reason", errorText)}
                />
                <InlineStack align="end" gap="200">
                  <Button onClick={reset}>{t("admin.common.cancel")}</Button>
                  <Button variant="primary" submit disabled={!vendorId || reason.trim().length < 3 || (costRequired && costValue === null)} loading={busy === "route"}>
                    {t("admin.order.routing.submit")}
                  </Button>
                </InlineStack>
              </BlockStack>
            </form>
          )}
        </BlockStack>
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          title={t("admin.order.routing.confirmTitle", { number, vendor: selected?.name ?? "" })}
          confirm={t("admin.order.routing.submit")}
          loading={busy === "route"}
          onConfirm={submit}
        >
          {t("admin.order.routing.confirmBody", {
            from: currentVendorName,
            to: selected?.name ?? "",
            cost: formatMoney(effectiveCost, locale, { alwaysDecimals: true }),
          })}
        </ConfirmDialog>
      </Card>
    </div>
  );
}

/**
 * "Margin: EGP 1,500 (17.5% of the sale price)". A-02: the warning compares the same measure with
 * what the current pricing settings give (targetPct), so a correctly priced order shows none.
 */
export function MarginLine({ goodsPiasters, vendorCostPiasters, targetPct }: { goodsPiasters: number; vendorCostPiasters: number; targetPct?: number | null }) {
  const { t, locale } = useI18n();
  const m = marginPreview(goodsPiasters, vendorCostPiasters, targetPct);
  const text = t("admin.order.margin.line", { amount: formatMoney(m.marginPiasters, locale, { alwaysDecimals: true }), pct: m.pct === null ? t("admin.common.none") : formatPercent(m.pct, locale) });
  return (
    <span aria-live="polite">
      <bdi>{text}</bdi>
      {m.band !== "in" ? (
        <Text as="span" variant="bodySm" tone={m.band === "loss" ? "critical" : "caution"} fontWeight="semibold">
          {` ${t(`admin.order.margin.${m.band}` as DictKey, { target: formatPercent(targetPct ?? TARGET_MARGIN_PCT.min, locale) })}`}
        </Text>
      ) : null}
    </span>
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
  marginTargetPct,
}: {
  orderId: string;
  marginTargetPct: number | null;
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
  const { containerRef, openerRef } = useInlineEditFocus(open); // a11y R5-AX-06 (2.4.3)
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
            <Button ref={openerRef} onClick={() => setOpen(true)}>{canPrice ? t("admin.order.override.edit") : t("admin.order.override.editCost")}</Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  return (
    <Card title={t("admin.order.override.title")}>
      <form
        ref={containerRef}
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
              helpText={preview ? t("admin.order.override.newTotal", { total: formatMoney(preview.totalPiasters, locale, { alwaysDecimals: true }) }) : t("admin.order.override.goodsHelp")}
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
              helpText={<MarginLine goodsPiasters={canPrice && goodsValue !== null && !Number.isNaN(goodsValue) ? goodsValue : goodsPiasters} vendorCostPiasters={costValue === null || Number.isNaN(costValue) ? vendorCostPiasters : costValue} targetPct={marginTargetPct} />}
              error={Number.isNaN(costValue) ? t("admin.errors.INVALID") : fieldError(res, "vendorCostPiasters", errorText)}
            />
          ) : null}
          <TextField label={t("admin.common.reason")} autoComplete="off" dir="auto" value={reason} onChange={setReason} multiline={2} maxLength={500} error={fieldError(res, "reason", errorText)} />
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
          <Text as="p">{t("admin.order.refund.confirmBody", { amount: formatMoney(totalPiasters, locale, { alwaysDecimals: true }) })}</Text>
          <TextField label={t("admin.common.reason")} autoComplete="off" dir="auto" value={reason} onChange={setReason} multiline={2} maxLength={500} helpText={t("admin.common.reasonHelp")} />
        </BlockStack>
      </Modal>
    </Card>
  );
}

/* ───────────────────────── QC ───────────────────────── */

/**
 * A-05 (simplicity review): approving QC releases the batch for dispatch and cannot be undone
 * here, so it asks first, the same way the refund does (A-14).
 */
export function QcActions({ orderId, number, vendorName, balancePiasters }: { orderId: string; number: string; vendorName: string; balancePiasters: number }) {
  const { t, locale } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [rejecting, setRejecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [res, setRes] = useState<Res>(null);
  return (
    <BlockStack gap="300">
      {rejecting ? (
        <TextField label={t("admin.order.qc.rejectNote")} autoComplete="off" dir="auto" value={note} onChange={setNote} multiline={3} maxLength={500} error={fieldError(res, "note", errorText)} />
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
            <Button variant="primary" onClick={() => setConfirming(true)}>
              {t("admin.order.qc.approve")}
            </Button>
          </ButtonGroup>
        )}
      </InlineStack>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("admin.order.qc.confirmTitle", { number })}
        confirm={t("admin.order.qc.approve")}
        loading={busy === "qc-approve"}
        onConfirm={async () => {
          const r = await run("qc-approve", () => reviewQcAction({ orderId, decision: "APPROVE" }), t("admin.order.qc.approved"));
          if (r?.ok) setConfirming(false);
        }}
      >
        {t("admin.order.qc.confirmBody", { vendor: vendorName, amount: formatMoney(balancePiasters, locale, { alwaysDecimals: true }) })}
      </ConfirmDialog>
    </BlockStack>
  );
}

/* ───────────────────────── Dispatch ───────────────────────── */

/** READY_TO_SHIP: book the courier pickup (creates the shipment and marks the order shipped). */
export function ShipCard({ orderId, number, vendorName, destination }: { orderId: string; number: string; vendorName: string; destination: string }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card title={t("admin.order.ship.title")}>
      <BlockStack gap="300">
        <Text as="p" tone="subdued" variant="bodySm">
          {t("admin.order.ship.help")}
        </Text>
        <InlineStack align="end">
          <Button variant="primary" onClick={() => setConfirming(true)}>
            {t("admin.order.ship.action")}
          </Button>
        </InlineStack>
      </BlockStack>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("admin.order.ship.confirmTitle", { number })}
        confirm={t("admin.order.ship.action")}
        loading={busy === "ship"}
        onConfirm={async () => {
          const r = await run("ship", () => shipOrderAction({ orderId }), t("admin.order.ship.done"));
          if (r?.ok) setConfirming(false);
        }}
      >
        {t("admin.order.ship.confirmBody", { vendor: vendorName, destination })}
      </ConfirmDialog>
    </Card>
  );
}

/* ───────────────────────── Confirmation ───────────────────────── */

/**
 * One confirmation for every money or irreversible admin step (A-05, the refund pattern A-14):
 * the title names the order, the body says exactly what happens, the button repeats the action.
 * Escape or the backdrop cancels (not while the action runs).
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  confirm,
  onConfirm,
  loading,
  destructive,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  confirm: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="small"
      preventClose={loading}
      primaryAction={{ content: confirm, destructive, loading, onAction: () => void onConfirm() }}
      secondaryActions={[{ content: t("admin.common.cancel"), onAction: onClose }]}
    >
      <Text as="p">{children}</Text>
    </Modal>
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
            <TextField label={t("admin.order.timeline.noteLabel")} labelHidden autoComplete="off" dir="auto" value={note} onChange={setNote} placeholder={t("admin.order.timeline.placeholder")} multiline={2} maxLength={1000} />
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

