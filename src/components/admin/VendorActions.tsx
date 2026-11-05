"use client";

import { useState } from "react";
import { BadgeCheck, Ban, RotateCcw } from "lucide-react";
import { BlockStack, Button, ButtonGroup, Card, ChoiceList, InlineStack, Modal, Text, TextField } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { decideApplicationAction, setVendorStatusAction } from "./server/actions";
import { APPLICATION_CHECKLIST, canApprove, canDecideApplication, missingRequired, type ChecklistItemId } from "./lib/ops";
import { fieldError, useAdminAction, useAdminErrorText } from "./useAdminAction";
import type { AdminActionResponse } from "./server/context";
import type { DictKey } from "@/i18n";

/** Suspend / reinstate / verify buttons for a vendor (suspension needs a reason in a modal). */
export function VendorStatusActions({ vendorId, name, status, verified }: { vendorId: string; name: string; status: string; verified: boolean }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const act = (action: "SUSPEND" | "REINSTATE" | "VERIFY" | "UNVERIFY", r = "") => run(action, () => setVendorStatusAction({ vendorId, action, reason: r }), t("admin.vendors.detail.success"));
  return (
    <>
      <ButtonGroup>
        {status !== "PENDING" ? (
          verified ? (
            <Button loading={busy === "UNVERIFY"} onClick={() => act("UNVERIFY")}>
              {t("admin.vendors.detail.unverify")}
            </Button>
          ) : (
            <Button icon={BadgeCheck} loading={busy === "VERIFY"} onClick={() => act("VERIFY")}>
              {t("admin.vendors.detail.verify")}
            </Button>
          )
        ) : null}
        {status === "ACTIVE" ? (
          <Button tone="critical" icon={Ban} onClick={() => setOpen(true)}>
            {t("admin.vendors.detail.suspend")}
          </Button>
        ) : null}
        {status === "SUSPENDED" ? (
          <Button variant="primary" icon={RotateCcw} loading={busy === "REINSTATE"} onClick={() => act("REINSTATE")}>
            {t("admin.vendors.detail.reinstate")}
          </Button>
        ) : null}
      </ButtonGroup>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.vendors.detail.suspendTitle", { name })}
        primaryAction={{
          content: t("admin.vendors.detail.suspend"),
          destructive: true,
          disabled: reason.trim().length < 3,
          loading: busy === "SUSPEND",
          onAction: async () => {
            const r = await act("SUSPEND", reason);
            if (r?.ok) {
              setOpen(false);
              setReason("");
            }
          },
        }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setOpen(false) }]}
      >
        <BlockStack gap="300">
          <Text as="p">{t("admin.vendors.detail.suspendBody")}</Text>
          <TextField label={t("admin.common.reason")} autoComplete="off" value={reason} onChange={setReason} multiline={2} maxLength={500} helpText={t("admin.common.reasonHelp")} />
        </BlockStack>
      </Modal>
    </>
  );
}

/** Verification checklist + decision for a vendor application. */
export function ApplicationReview({ applicationId, status, initialChecklist, initialNote }: { applicationId: string; status: string; initialChecklist: string[]; initialNote: string }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const errorText = useAdminErrorText();
  const [checked, setChecked] = useState<string[]>(initialChecklist);
  const [note, setNote] = useState(initialNote);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [res, setRes] = useState<AdminActionResponse<unknown> | null>(null);
  const editable = canDecideApplication(status);
  const missing = missingRequired(checked);
  const decide = async (decision: "UNDER_REVIEW" | "APPROVE" | "REJECT") =>
    setRes(await run(decision, () => decideApplicationAction({ applicationId, decision, checklist: checked as ChecklistItemId[], note }), t("admin.application.decision.success")));

  return (
    <BlockStack gap="400">
      <Card title={t("admin.application.checklist.title")}>
        <BlockStack gap="300">
          <Text as="p" tone="subdued" variant="bodySm">
            {t("admin.application.checklist.help")}
          </Text>
          <ChoiceList
            title={t("admin.application.checklist.title")}
            titleHidden
            allowMultiple
            disabled={!editable}
            selected={checked}
            onChange={(sel) => setChecked(sel)}
            error={fieldError(res, "checklist", errorText)}
            choices={APPLICATION_CHECKLIST.map((c) => ({
              value: c.id,
              label: t(`admin.application.checklist.items.${c.id}` as DictKey),
              helpText: c.required ? undefined : t("admin.application.checklist.optional"),
            }))}
          />
          {editable && missing.length ? (
            <Text as="p" variant="bodySm" tone="caution">
              {t("admin.application.checklist.missing", { count: missing.length })}
            </Text>
          ) : null}
        </BlockStack>
      </Card>

      {editable ? (
        <Card title={t("admin.application.decision.title")}>
          <BlockStack gap="300">
            <TextField label={t("admin.application.decision.note")} autoComplete="off" value={note} onChange={setNote} multiline={3} maxLength={1000} error={fieldError(res, "note", errorText)} />
            <InlineStack align="end">
              <ButtonGroup>
                {status === "SUBMITTED" ? (
                  <Button loading={busy === "UNDER_REVIEW"} onClick={() => decide("UNDER_REVIEW")}>
                    {t("admin.application.decision.startReview")}
                  </Button>
                ) : null}
                <Button tone="critical" onClick={() => setRejectOpen(true)}>
                  {t("admin.application.decision.reject")}
                </Button>
                <Button variant="primary" disabled={!canApprove(checked)} loading={busy === "APPROVE"} onClick={() => decide("APPROVE")}>
                  {t("admin.application.decision.approve")}
                </Button>
              </ButtonGroup>
            </InlineStack>
          </BlockStack>
        </Card>
      ) : null}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t("admin.application.decision.rejectTitle")}
        primaryAction={{
          content: t("admin.application.decision.reject"),
          destructive: true,
          disabled: note.trim().length < 3,
          loading: busy === "REJECT",
          onAction: async () => {
            await decide("REJECT");
            setRejectOpen(false);
          },
        }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setRejectOpen(false) }]}
      >
        <BlockStack gap="300">
          <Text as="p">{t("admin.application.decision.rejectBody")}</Text>
          <TextField label={t("admin.application.decision.note")} autoComplete="off" value={note} onChange={setNote} multiline={3} maxLength={1000} />
        </BlockStack>
      </Modal>
    </BlockStack>
  );
}
