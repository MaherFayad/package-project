"use client";

import { useMemo, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Divider, InlineGrid, InlineStack } from "@/components/ui/Stack";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import { MarginLine } from "./OrderActions";
import { priceLines } from "./lib/quotePricing";
import { parseWholeInput } from "./lib/moneyInput";
import { sendQuotePriceAction } from "./server/actions";
import { egpToPiastersInput, fieldError, piastersToInput, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";
import type { AdminQuoteLead } from "./server/queries";
import { adminStyles } from "./charts";

export interface QuoteVendorOption {
  id: string;
  name: string;
  city: string;
}

/** Piasters from an optional EGP field: empty = 0, invalid = NaN. */
const optional = (v: string) => egpToPiastersInput(v) ?? 0;

/**
 * R4-B-03 (admin half): "Send price" on a quote lead. Ex-VAT lines in the pricing engine's kinds,
 * a live summary with 14% VAT and the margin line against the printer's buy price (warned below
 * the 20 to 30% target or at a loss). On success it shows the buyer link to copy.
 */
export function SendPriceModal({ lead, vendors, validityHours, open, onClose }: { lead: AdminQuoteLead; vendors: QuoteVendorOption[]; validityHours: number; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const prev = lead.priced;
  const line = (kind: string) => prev?.lines.find((l) => l.kind === kind);
  const fromPrev = (kind: string) => (line(kind) ? piastersToInput(kind === "PRODUCT" ? line(kind)!.unitPiasters : line(kind)!.totalPiasters) : "");
  const [vendorId, setVendorId] = useState(prev?.vendorId ?? "");
  const [quantity, setQuantity] = useState(String(line("PRODUCT")?.quantity ?? lead.quantity));
  const [unit, setUnit] = useState(fromPrev("PRODUCT"));
  const [setup, setSetup] = useState(fromPrev("SETUP"));
  const [die, setDie] = useState(fromPrev("DIE"));
  const [finish, setFinish] = useState(fromPrev("FINISH"));
  const [shipping, setShipping] = useState(fromPrev("SHIPPING"));
  const [days, setDays] = useState(prev?.deliveryDays ? String(prev.deliveryDays) : "");
  const [cost, setCost] = useState(prev?.vendorCostPiasters ? piastersToInput(prev.vendorCostPiasters) : "");
  const [note, setNote] = useState("");
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const [sent, setSent] = useState<{ path: string; validUntil: string } | null>(null);

  const qty = parseWholeInput(quantity) ?? NaN;
  const dayCount = parseWholeInput(days) ?? NaN;
  const unitP = egpToPiastersInput(unit);
  const costP = egpToPiastersInput(cost);
  const extras = { setupPiasters: optional(setup), diePiasters: optional(die), finishPiasters: optional(finish), shippingPiasters: optional(shipping) };
  // R6-AD: the button used to stay disabled with no reason given. Now a malformed amount is flagged
  // as it is typed, and a missing required value when Send is pressed (WCAG 3.3.1, 3.3.3).
  const [tried, setTried] = useState(false);
  const bad = (p: number | null) => p !== null && (Number.isNaN(p) || p < 0);
  const daysOk = Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= 120;
  const problems: Record<string, string | null> = {
    vendorId: !vendorId ? (tried ? "PRINTER_REQUIRED" : null) : null,
    quantity: quantity.trim() === "" ? (tried ? "QTY_INVALID" : null) : Number.isInteger(qty) && qty >= 1 && qty <= 1_000_000 ? null : "QTY_INVALID",
    unitPiasters: unit.trim() === "" ? (tried ? "PRICE_REQUIRED" : null) : bad(unitP) || unitP === 0 ? "AMOUNT_INVALID" : null,
    setupPiasters: bad(egpToPiastersInput(setup)) ? "AMOUNT_INVALID" : null,
    diePiasters: bad(egpToPiastersInput(die)) ? "AMOUNT_INVALID" : null,
    finishPiasters: bad(egpToPiastersInput(finish)) ? "AMOUNT_INVALID" : null,
    shippingPiasters: bad(egpToPiastersInput(shipping)) ? "AMOUNT_INVALID" : null,
    deliveryDays: days.trim() === "" ? (tried ? "DAYS_RANGE" : null) : daysOk ? null : "DAYS_RANGE",
    vendorCostPiasters: cost.trim() === "" ? (tried ? "COST_REQUIRED" : null) : bad(costP) || costP === 0 ? "AMOUNT_INVALID" : null,
  };
  const valid =
    !!vendorId &&
    Number.isInteger(qty) && qty >= 1 &&
    unitP !== null && !Number.isNaN(unitP) && unitP > 0 &&
    Object.values(extras).every((v) => !Number.isNaN(v)) &&
    costP !== null && !Number.isNaN(costP) && costP > 0 &&
    daysOk;
  /** Client problem first, then the server's field error. */
  const err = (k: string) => (problems[k] ? errorText(problems[k]!) : fieldError(res, k, errorText));
  const preview = useMemo(
    () => (Number.isInteger(qty) && qty > 0 && unitP && !Number.isNaN(unitP) && Object.values(extras).every((v) => !Number.isNaN(v)) ? priceLines({ quantity: qty, unitPiasters: unitP, ...extras }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extras is rebuilt from these strings
    [qty, unitP, setup, die, finish, shipping],
  );
  const money = (p: number) => formatMoney(p, locale, { alwaysDecimals: true });
  const absolute = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);
  const close = () => {
    setSent(null);
    setRes(null);
    onClose();
  };

  const submit = async () => {
    if (!valid) {
      setTried(true);
      // Move focus to the first field that needs fixing once the errors render.
      setTimeout(() => document.querySelector<HTMLElement>("[role=dialog] [aria-invalid=true]")?.focus(), 0);
      return;
    }
    const r = await run("send-price", () =>
      sendQuotePriceAction({ quoteId: lead.quoteId, vendorId, quantity: qty, unitPiasters: unitP!, ...extras, deliveryDays: dayCount, vendorCostPiasters: costP!, note: note.trim() || undefined }),
    t("admin.quotes.price.sent"));
    setRes(r);
    if (r?.ok) setSent({ path: r.data.path, validUntil: r.data.validUntil });
  };

  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(absolute(path));
      toast.show(t("admin.quotes.linkCopied"));
    } catch {
      /* clipboard blocked: the link stays visible and selectable */
    }
  };

  if (sent) {
    return (
      <Modal open={open} onClose={close} title={t("admin.quotes.price.linkTitle")} primaryAction={{ content: t("admin.quotes.copyLink"), onAction: () => copy(sent.path) }} secondaryActions={[{ content: t("admin.common.done"), onAction: close }]}>
        <BlockStack gap="300">
          <Banner tone="success">{t("admin.quotes.price.sent")}</Banner>
          <Text as="p" variant="bodySm" breakWord>
            <bdi dir="ltr" className={adminStyles.PreWrap}>
              {absolute(sent.path)}
            </bdi>
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.quotes.price.linkHelp", { date: formatDate(sent.validUntil, locale, "long") })}
          </Text>
        </BlockStack>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="large"
      title={t("admin.quotes.price.title", { count: lead.quantity })}
      primaryAction={{ content: prev ? t("admin.quotes.price.resend") : t("admin.quotes.price.send"), loading: busy === "send-price", onAction: submit }}
      secondaryActions={[{ content: t("admin.common.cancel"), onAction: close }]}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <BlockStack gap="400">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.quotes.price.intro", { hours: validityHours })}
          </Text>
          {!lead.designId ? <Banner tone="info">{t("admin.quotes.price.catalogueNote")}</Banner> : null}
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
            <Select
              label={t("admin.quotes.price.vendor")}
              placeholder={t("admin.quotes.price.vendorPlaceholder")}
              options={vendors.map((v) => ({ label: `${v.name} · ${v.city}`, value: v.id }))}
              value={vendorId}
              onChange={setVendorId}
              error={err("vendorId")}
              requiredIndicator
            />
            <TextField label={t("admin.quotes.price.quantity")} autoComplete="off" inputMode="numeric" value={quantity} onChange={setQuantity} error={err("quantity")} requiredIndicator />
            <TextField label={t("admin.quotes.price.unit")} autoComplete="off" inputMode="decimal" value={unit} onChange={setUnit} error={err("unitPiasters")} requiredIndicator />
            <TextField label={t("admin.quotes.price.setup")} autoComplete="off" inputMode="decimal" value={setup} onChange={setSetup} helpText={t("admin.quotes.price.optional")} error={err("setupPiasters")} />
            <TextField label={t("admin.quotes.price.die")} autoComplete="off" inputMode="decimal" value={die} onChange={setDie} helpText={t("admin.quotes.price.optional")} error={err("diePiasters")} />
            <TextField label={t("admin.quotes.price.finish")} autoComplete="off" inputMode="decimal" value={finish} onChange={setFinish} helpText={t("admin.quotes.price.optional")} error={err("finishPiasters")} />
            <TextField label={t("admin.quotes.price.shipping")} autoComplete="off" inputMode="decimal" value={shipping} onChange={setShipping} error={err("shippingPiasters")} />
            <TextField label={t("admin.quotes.price.deliveryDays")} autoComplete="off" inputMode="numeric" value={days} onChange={setDays} error={err("deliveryDays")} requiredIndicator />
          </InlineGrid>
          <TextField
            label={t("admin.quotes.price.vendorCost")}
            helpText={t("admin.quotes.price.vendorCostHelp")}
            autoComplete="off"
            inputMode="decimal"
            value={cost}
            onChange={setCost}
            error={err("vendorCostPiasters")}
            requiredIndicator
          />
          <Divider />
          <section aria-label={t("admin.quotes.price.summary")}>
            <BlockStack gap="150">
              <Text as="h3" variant="headingXs">
                {t("admin.quotes.price.summary")}
              </Text>
              {preview ? (
                <>
                  {preview.lines.map((l) => (
                    <InlineStack key={l.kind} align="space-between" gap="200" wrap={false}>
                      <Text as="span" variant="bodySm">
                        {l.kind === "PRODUCT" ? t("admin.quotes.price.product", { count: l.quantity, unit: money(l.unitPiasters) }) : t(`admin.quotes.price.lines.${l.kind}` as DictKey)}
                      </Text>
                      <Text as="span" variant="bodySm" numeric>
                        {money(l.totalPiasters)}
                      </Text>
                    </InlineStack>
                  ))}
                  <InlineStack align="space-between" gap="200" wrap={false}>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t("admin.quotes.price.subtotal")}
                    </Text>
                    <Text as="span" variant="bodySm" numeric>
                      {money(preview.subtotalPiasters)}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between" gap="200" wrap={false}>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t("admin.quotes.price.vat")}
                    </Text>
                    <Text as="span" variant="bodySm" numeric>
                      {money(preview.vatPiasters)}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between" gap="200" wrap={false}>
                    <Text as="span" fontWeight="semibold">
                      {t("admin.quotes.price.total")}
                    </Text>
                    <Text as="span" fontWeight="semibold" numeric>
                      <span data-testid="send-price-total">{money(preview.totalPiasters)}</span>
                    </Text>
                  </InlineStack>
                  {costP && !Number.isNaN(costP) ? (
                    <Text as="p" variant="bodySm">
                      <MarginLine goodsPiasters={preview.goodsPiasters} vendorCostPiasters={costP} />
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text as="p" variant="bodySm" tone="subdued">
                  {t("admin.common.none")}
                </Text>
              )}
            </BlockStack>
          </section>
          <TextField label={t("admin.quotes.price.note")} autoComplete="off" dir="auto" value={note} onChange={setNote} multiline={2} maxLength={500} />
        </BlockStack>
      </form>
    </Modal>
  );
}
