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
import { TextField } from "@/components/ui/TextField";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { decideDisputeAction } from "./server/actions";
import { allowedDecisions, type DisputeDecision as Decision } from "./lib/ops";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";

/** Resolve a dispute: start review, reprint (same or other vendor), refund, or reject. */
export function DisputeDecision({
  disputeId,
  status,
  vendors,
  originalVendorId,
  refundable,
}: {
  disputeId: string;
  status: string;
  vendors: { id: string; name: string }[];
  originalVendorId: string;
  refundable: boolean;
}) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
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
  const submit = async () => {
    if (!decision) return;
    const r = await run("decide", () => decideDisputeAction({ disputeId, decision, note, vendorId: decision === "REPRINT" ? vendorId : undefined }), t("admin.disputes.detail.success"));
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
                        <Select label={t("admin.disputes.detail.reprintVendor")} value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: v.id, label: v.name }))} />
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
            error={fieldError(res, "note", errorText)}
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
              disabled={!decision || (needsNote && note.trim().length < 3)}
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
