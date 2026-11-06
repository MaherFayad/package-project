"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceList } from "@/components/ui/ChoiceList";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { useToast } from "@/components/ui/Toast";
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { decideDisputeAction } from "./server/actions";
import { allowedDecisions, CHARGE_BACK_MODES, defaultChargeBack, planReprint, type ChargeBackMode, type DisputeDecision as Decision } from "./lib/ops";
import { egpToPiastersInput, fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import { parseWholeInput } from "@/lib/money/input";
import { formatMoney, formatNumber } from "@/lib/format";
import type { AdminActionResponse } from "./server/context";

/** Resolve a dispute: start review, reprint (same or other vendor), refund, or reject. */
export function DisputeDecision({
  disputeId,
  status,
  vendors,
  originalVendorId,
  refundable,
  reason,
  originalQuantity,
  originalCostPiasters,
  paidToVendorPiasters,
}: {
  disputeId: string;
  status: string;
  vendors: { id: string; name: string }[];
  originalVendorId: string;
  refundable: boolean;
  /** R5-JR-09: dispute reason (picks the default charge-back), boxes and buy price of the order. */
  reason: string;
  originalQuantity: number;
  originalCostPiasters: number;
  paidToVendorPiasters: number;
}) {
  const { t, locale } = useI18n();
  const [qtyText, setQtyText] = useState(String(originalQuantity));
  const [charge, setCharge] = useState<ChargeBackMode>(defaultChargeBack(reason));
  const [chargeText, setChargeText] = useState("");
  const [tried, setTried] = useState(false);
  const { run, busy } = useAdminAction();
  const toast = useToast();
  const errorText = useAdminErrorText();
  const options = allowedDecisions(status).filter((d) => d !== "REFUND" || refundable);
  const [picked, setDecision] = useState<Decision | "">(options[0] ?? "");
  const decision: Decision | "" = picked && options.includes(picked) ? picked : (options[0] ?? "");
  const [note, setNote] = useState("");
  const [vendorId, setVendorId] = useState(originalVendorId);
  const [res, setRes] = useState<AdminActionResponse<{ reprintNumber?: string }> | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  if (!options.length) return null;
  const needsNote = decision !== "REVIEW";
  const qty = parseWholeInput(qtyText);
  const chargeP = egpToPiastersInput(chargeText);
  const qtyError = qty === null || Number.isNaN(qty) || qty < 1 || qty > originalQuantity ? "REPRINT_QTY_RANGE" : null;
  const preview =
    !qtyError && qty
      ? planReprint({
          originalQty: originalQuantity,
          originalCostPiasters,
          paidToOriginalPiasters: paidToVendorPiasters,
          sameVendor: vendorId === originalVendorId,
          terms: { quantity: qty, chargeBack: charge, chargeBackPiasters: charge === "PARTIAL" ? (chargeP ?? undefined) : undefined },
        })
      : null;
  // R8-AD: a malformed amount ("١٢٣,٤٥", "-5") says how to type it; only a clear number above the
  // reprint cost gets the range message.
  const chargeError =
    charge !== "PARTIAL" || (chargeText.trim() === "" && !tried)
      ? null
      : chargeP === null || Number.isNaN(chargeP)
        ? "AMOUNT_INVALID"
        : preview === "CHARGE_RANGE"
          ? "CHARGE_BACK_RANGE"
          : null;
  // R7-AD: the button explains itself instead of staying disabled (same rule as R6-AD-02).
  const noteError = tried && needsNote && note.trim().length < 3 ? "NOTE_REQUIRED" : null;
  const blocked = !decision || (needsNote && note.trim().length < 3) || (decision === "REPRINT" && (!!qtyError || !!chargeError || (charge === "PARTIAL" && chargeText.trim() === "")));
  const submit = async () => {
    if (!decision) return;
    const reprintTerms =
      decision === "REPRINT"
        ? { reprintQuantity: parseWholeInput(qtyText) ?? undefined, chargeBack: charge, chargeBackPiasters: charge === "PARTIAL" ? (egpToPiastersInput(chargeText) ?? undefined) : undefined }
        : {};
    const r = await run("decide", () => decideDisputeAction({ disputeId, decision, note, vendorId: decision === "REPRINT" ? vendorId : undefined, ...reprintTerms }), decision === "REPRINT" ? undefined : t("admin.disputes.detail.success"));
    // R7-AD: the card leaves once the dispute is resolved, so the reprint number goes in the toast.
    if (r?.ok && r.data.reprintNumber) toast.show(t("admin.disputes.detail.reprintCreated", { number: r.data.reprintNumber }));
    setRes(r);
    setConfirmRefund(false);
    if (r?.ok) setNote("");
  };

  return (
    <Card title={t("admin.disputes.detail.decisionTitle")}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          // Money leaves through the payment provider and cannot be undone: confirm first.
          if (blocked) {
            setTried(true);
            setTimeout(() => (e.target as HTMLElement).querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
            return;
          }
          if (decision === "REFUND") setConfirmRefund(true);
          else await submit();
        }}
      >
        <BlockStack gap="300">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("admin.disputes.detail.decisionHelp")}
          </Text>
          <ChoiceList
            title={t("admin.disputes.detail.decisionTitle")}
            titleHidden
            selected={decision ? [decision] : []}
            onChange={(s) => setDecision((s[0] as Decision) ?? "")}
            choices={options.map((d) => ({
              value: d,
              label: t(`admin.disputes.detail.decisions.${d}` as DictKey),
              renderChildren:
                d === "REPRINT"
                  ? (sel) =>
                      sel ? (
                        <BlockStack gap="300">
                          <Select label={t("admin.disputes.detail.reprintVendor")} value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: v.id, label: v.name }))} />
                          <TextField
                            label={t("admin.disputes.detail.reprintQty")}
                            helpText={t("admin.disputes.detail.reprintQtyHelp", { count: formatNumber(originalQuantity) })}
                            autoComplete="off"
                            inputMode="numeric"
                            value={qtyText}
                            onChange={setQtyText}
                            error={qtyError ? errorText(qtyError) : fieldError(res, "reprintQuantity", errorText)}
                          />
                          <ChoiceList
                            title={t("admin.disputes.detail.chargeBack")}
                            selected={[charge]}
                            onChange={(v) => setCharge((v[0] as ChargeBackMode) ?? "NONE")}
                            choices={CHARGE_BACK_MODES.map((m) => ({
                              value: m,
                              label: t(`admin.disputes.detail.chargeBackModes.${m}` as DictKey),
                              renderChildren:
                                m === "PARTIAL"
                                  ? (on) =>
                                      on ? (
                                        <TextField
                                          label={t("admin.disputes.detail.chargeBackAmount")}
                                          autoComplete="off"
                                          inputMode="decimal"
                                          value={chargeText}
                                          onChange={setChargeText}
                                          error={chargeError ? errorText(chargeError) : fieldError(res, "chargeBackPiasters", errorText)}
                                        />
                                      ) : null
                                  : undefined,
                            }))}
                          />
                          {preview && typeof preview === "object" ? (
                            <Text as="p" variant="bodySm" tone="subdued">
                              <span aria-live="polite">
                                {t(vendorId === originalVendorId ? "admin.disputes.detail.chargeSameVendor" : "admin.disputes.detail.chargeOtherVendor", {
                                  cost: formatMoney(preview.reprintCostPiasters, locale, { alwaysDecimals: true }),
                                  charge: formatMoney(preview.chargeBackPiasters, locale, { alwaysDecimals: true }),
                                  pays: formatMoney(preview.reprintVendorCostPiasters, locale, { alwaysDecimals: true }),
                                })}
                                {preview.owedPiasters > 0 ? ` ${t("admin.disputes.detail.chargeOwed", { amount: formatMoney(preview.owedPiasters, locale, { alwaysDecimals: true }) })}` : ""}
                              </span>
                            </Text>
                          ) : null}
                        </BlockStack>
                      ) : null
                  : undefined,
            }))}
          />
          {!refundable && status !== "REJECTED" ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {t("admin.disputes.detail.notRefundable")}
            </Text>
          ) : null}
          <TextField
            label={t("admin.disputes.detail.note")}
            autoComplete="off"
            dir="auto"
            value={note}
            onChange={setNote}
            multiline={3}
            maxLength={1000}
            helpText={t("admin.disputes.detail.noteHelp")}
            requiredIndicator={needsNote}
            error={noteError ? errorText(noteError) : fieldError(res, "note", errorText)}
          />
          {res?.ok && res.data.reprintNumber ? (
            <Banner tone="success" inCard announce>
              {t("admin.disputes.detail.reprintCreated", { number: res.data.reprintNumber })}
            </Banner>
          ) : null}
          <InlineStack align="end">
            <Button
              submit
              variant="primary"
              tone={decision === "REFUND" || decision === "REJECT" ? "critical" : undefined}
              disabled={!decision}
              loading={busy === "decide"}
            >
              {t("admin.disputes.detail.submit")}
            </Button>
          </InlineStack>
        </BlockStack>
      </form>
      <Modal
        open={confirmRefund}
        onClose={() => setConfirmRefund(false)}
        title={t("admin.disputes.detail.refundConfirmTitle")}
        primaryAction={{ content: t("admin.disputes.detail.decisions.REFUND"), destructive: true, loading: busy === "decide", onAction: submit }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setConfirmRefund(false) }]}
      >
        <Text as="p">{t("admin.disputes.detail.refundConfirmBody")}</Text>
      </Modal>
    </Card>
  );
}
