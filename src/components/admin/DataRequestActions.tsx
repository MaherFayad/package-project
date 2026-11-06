"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { BlockStack, Button, ButtonGroup, Modal, Text, TextField } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { decideDataRequestAction } from "./server/actions";
import { canDecideRequest } from "./lib/ops";
import { useAdminAction } from "./useAdminAction";

/** Start / complete / reject a PDPL data request. Completing a DELETE request anonymises the user. */
export function DataRequestActions({ requestId, userId, kind, status }: { requestId: string; userId: string; kind: string; status: string }) {
  const { t } = useI18n();
  const { run, busy } = useAdminAction();
  const [modal, setModal] = useState<"COMPLETE" | "REJECT" | null>(null);
  const [note, setNote] = useState("");
  if (!canDecideRequest(status)) {
    return kind === "EXPORT" ? (
      <Button size="slim" variant="plain" icon={Download} url={`/api/admin/users/${userId}/export`} external>
        {t("admin.privacy.actions.download")}
      </Button>
    ) : null;
  }
  const decide = async (decision: "START" | "COMPLETE" | "REJECT") => {
    const r = await run(`${decision}`, () => decideDataRequestAction({ requestId, decision, note }), t("admin.privacy.actions.success"));
    if (r?.ok) {
      setModal(null);
      setNote("");
    }
  };
  return (
    <>
      <ButtonGroup>
        {kind === "EXPORT" ? (
          <Button size="slim" icon={Download} url={`/api/admin/users/${userId}/export`} external>
            {t("admin.privacy.actions.download")}
          </Button>
        ) : null}
        {status === "OPEN" ? (
          <Button size="slim" loading={busy === "START"} onClick={() => decide("START")}>
            {t("admin.privacy.actions.start")}
          </Button>
        ) : null}
        <Button size="slim" tone="critical" variant="plain" onClick={() => setModal("REJECT")}>
          {t("admin.privacy.actions.reject")}
        </Button>
        <Button size="slim" variant="primary" onClick={() => setModal("COMPLETE")}>
          {t("admin.privacy.actions.complete")}
        </Button>
      </ButtonGroup>
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "REJECT" ? t("admin.privacy.actions.rejectTitle") : t("admin.privacy.actions.completeTitle")}
        primaryAction={{
          content: modal === "REJECT" ? t("admin.privacy.actions.reject") : t("admin.privacy.actions.complete"),
          destructive: modal === "REJECT" || kind === "DELETE",
          disabled: modal === "REJECT" && note.trim().length < 3,
          loading: busy === modal,
          onAction: () => modal && decide(modal),
        }}
        secondaryActions={[{ content: t("admin.common.cancel"), onAction: () => setModal(null) }]}
      >
        <BlockStack gap="300">
          {modal === "COMPLETE" ? <Text as="p">{kind === "DELETE" ? t("admin.privacy.actions.completeDelete") : t("admin.privacy.actions.completeExport")}</Text> : null}
          <TextField label={t("admin.privacy.actions.note")} autoComplete="off" dir="auto" value={note} onChange={setNote} multiline={2} maxLength={1000} />
        </BlockStack>
      </Modal>
    </>
  );
}
