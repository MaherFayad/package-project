"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDate } from "@/lib/format";
import { signOut } from "@/components/auth";
import { Badge, Banner, BlockStack, Button, InlineStack, Modal, Text, TextField, useToast } from "@/components/ui";
import type { AccountErrorCode, ActionResult, DataRequestStatus } from "@/components/store/account-logic";
import { deleteDesignAction, requestDeletionAction, setMarketingConsentAction, updateProfileAction } from "./actions";

const errKey = (code: AccountErrorCode) => `account.errors.${code}` as DictKey;

/** Profile form: name + optional email. Phone is the sign-in identity and read-only. */
export function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateProfileAction, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.show(t("account.profileSaved"));
      router.refresh();
    } else if (state.error === "unauthorized") router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} noValidate>
      <BlockStack gap="300">
        {state && !state.ok && !fe ? (
          <Banner tone="critical" announce>
            {t(errKey(state.error))}
          </Banner>
        ) : null}
        <TextField label={t("account.phone")} autoComplete="tel" value={phone} readOnly dir="ltr" helpText={t("account.phoneHelp")} />
        <TextField label={t("account.name")} name="name" autoComplete="name" defaultValue={name} maxLength={80} error={fe?.name ? t(errKey(fe.name)) : undefined} />
        <TextField
          label={t("account.email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          defaultValue={email}
          optional
          error={fe?.email ? t(errKey(fe.email)) : undefined}
        />
        <InlineStack align="end">
          <Button submit variant="primary" loading={pending}>
            {t("account.saveProfile")}
          </Button>
        </InlineStack>
      </BlockStack>
    </form>
  );
}

/** Marketing consent (PDPL): separate, revocable, every change logged as a Consent row. */
export function MarketingConsent({ granted }: { granted: boolean }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const change = (next: boolean) =>
    start(async () => {
      const r = await setMarketingConsentAction({ granted: next, locale });
      if (r.ok) {
        toast.show(next ? t("account.consentGranted") : t("account.consentWithdrawn"));
        router.refresh();
      } else toast.show(t(errKey(r.error)), { tone: "critical" });
    });
  return (
    <InlineStack gap="300" align="space-between" blockAlign="center">
      <BlockStack gap="100">
        <Text as="h3" variant="headingSm">
          {t("account.marketingLabel")}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {t("account.marketingHelp")}
        </Text>
        <span>
          <Badge tone={granted ? "success" : "neutral"} progress={granted ? "complete" : "incomplete"}>
            {granted ? t("account.marketingOn") : t("account.marketingOff")}
          </Badge>
        </span>
      </BlockStack>
      {granted ? (
        <Button tone="critical" onClick={() => change(false)} loading={pending}>
          {t("account.withdraw")}
        </Button>
      ) : (
        <Button onClick={() => change(true)} loading={pending}>
          {t("account.grant")}
        </Button>
      )}
    </InlineStack>
  );
}

/** Delete-design button with confirmation modal. */
export function DeleteDesignButton({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const confirm = () =>
    start(async () => {
      const r = await deleteDesignAction(id);
      setOpen(false);
      if (r.ok) {
        toast.show(t("account.designDeleted"));
        router.refresh();
      } else toast.show(t(errKey(r.error)), { tone: "critical" });
    });
  return (
    <>
      <Button icon={Trash2} tone="critical" variant="tertiary" accessibilityLabel={`${t("account.deleteDesign")}: ${name}`} onClick={() => setOpen(true)} ariaHaspopup="dialog" />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("account.deleteDesignTitle")}
        preventClose={pending}
        primaryAction={{ content: t("account.deleteDesign"), destructive: true, onAction: confirm, loading: pending }}
        secondaryActions={[{ content: t("common.cancel"), onAction: () => setOpen(false), disabled: pending }]}
      >
        <Text as="p">{t("account.deleteDesignBody", { name })}</Text>
      </Modal>
    </>
  );
}

/** PDPL data rights: download a copy (GET route) and request erasure (server action + confirm). */
export function DataRights({ pending: initialPending }: { pending: { status: DataRequestStatus; createdAt: string } | null }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(initialPending);
  const [busy, start] = useTransition();
  const confirm = () =>
    start(async () => {
      const r = await requestDeletionAction();
      setOpen(false);
      if (r.ok && r.data) {
        setRequest(r.data);
        toast.show(t("account.deleteRequested"));
        router.refresh();
      } else if (!r.ok) toast.show(t(errKey(r.error)), { tone: "critical" });
    });
  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {t("account.exportTitle")}
        </Text>
        <Text as="p" tone="subdued">
          {t("account.exportBody")}
        </Text>
        <span>
          <Button url={`/${locale}/account/export`} icon={Download} download>
            {t("account.exportButton")}
          </Button>
        </span>
      </BlockStack>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {t("account.deleteTitle")}
        </Text>
        <Text as="p" tone="subdued">
          {t("account.deleteBody")}
        </Text>
        {request ? (
          <Banner tone="info">
            {t("account.deletePending", {
              date: formatDate(request.createdAt, locale),
              status: t(`account.requestStatus.${request.status}` as DictKey),
            })}
          </Banner>
        ) : (
          <span>
            <Button tone="critical" onClick={() => setOpen(true)} ariaHaspopup="dialog">
              {t("account.deleteButton")}
            </Button>
          </span>
        )}
      </BlockStack>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("account.deleteConfirmTitle")}
        preventClose={busy}
        primaryAction={{ content: t("account.deleteButton"), destructive: true, onAction: confirm, loading: busy }}
        secondaryActions={[{ content: t("common.cancel"), onAction: () => setOpen(false), disabled: busy }]}
      >
        <Text as="p">{t("account.deleteConfirmBody")}</Text>
      </Modal>
    </BlockStack>
  );
}

export function AccountSignOut() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      icon={LogOut}
      loading={pending}
      onClick={() =>
        start(async () => {
          await signOut();
          router.push(`/${locale}`);
          router.refresh();
        })
      }
    >
      {t("nav.signOut")}
    </Button>
  );
}
