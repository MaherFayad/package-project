"use client";

import { RotateCcw, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { DISPUTE_REASONS_LIST } from "@/lib/orders/schema-constants";
import { Banner, BlockStack, Button, Card, Icon, Select, Text, TextField, useToast } from "@/components/ui";
import { cancelAction, disputeAction, reorderAction, reviewAction } from "../[id]/actions";
import styles from "./orders.module.css";

function useErr() {
  const { t } = useI18n();
  return (code: string) => {
    const key = `checkout.errors.${code}` as DictKey;
    const s = t(key);
    return s === key ? t("checkout.errors.generic") : s;
  };
}

/** One-click reorder (same proof, printer, quantity, address; today's price). */
export function ReorderButton({ orderId, locale, primary }: { orderId: string; locale: Locale; primary?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const err = useErr();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={primary ? "primary" : "tertiary"}
      icon={RotateCcw}
      loading={busy}
      accessibilityLabel={`${t("orders.detail.reorder")}: ${t("orders.detail.reorderHelp")}`}
      onClick={async () => {
        setBusy(true);
        const r = await reorderAction(orderId, locale);
        if (r.ok) router.push(`/${locale}/checkout/pay/${r.orderId}`);
        else {
          setBusy(false);
          toast.show(err(r.error), { tone: "critical" });
        }
      }}
    >
      {t("orders.detail.reorder")}
    </Button>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const err = useErr();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      tone="critical"
      variant="plain"
      loading={busy}
      onClick={async () => {
        if (!window.confirm(t("payment.cancelConfirm"))) return;
        setBusy(true);
        const r = await cancelAction(orderId);
        setBusy(false);
        if (r.ok) {
          toast.show(t("payment.cancelled"));
          router.refresh();
        } else toast.show(err(r.error), { tone: "critical" });
      }}
    >
      {t("orders.detail.cancel")}
    </Button>
  );
}

/** 1–5 star rating as a native radio group (keyboard: arrows), 44px targets. */
export function ReviewForm({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const err = useErr();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title={t("orders.review.title")}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!rating) return setError(t("orders.review.rating"));
          setBusy(true);
          const r = await reviewAction(orderId, { rating, body: body || undefined });
          setBusy(false);
          if (r.ok) router.refresh();
          else setError(err(r.error));
        }}
      >
        <BlockStack gap="300">
          <Text as="p" tone="subdued">
            {t("orders.review.help")}
          </Text>
          <fieldset className={styles.stars}>
            <legend className={styles.legend}>{t("orders.review.rating")}</legend>
            <div className={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={styles.star} data-on={n <= rating || undefined}>
                  <input className={styles.radio} type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} />
                  <Icon source={Star} />
                  <span className="visually-hidden">{t("orders.review.stars", { n })}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <TextField label={t("orders.review.body")} autoComplete="off" multiline={3} maxLength={1000} value={body} onChange={setBody} />
          {error ? (
            <Banner tone="critical" announce>
              {error}
            </Banner>
          ) : null}
          <div>
            <Button submit loading={busy}>
              {t("orders.review.submit")}
            </Button>
          </div>
        </BlockStack>
      </form>
    </Card>
  );
}

export function DisputeForm({ orderId }: { orderId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const err = useErr();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("PRINT_DEFECT");
  const [description, setDescription] = useState("");
  const [descErr, setDescErr] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title={t("orders.dispute.title")}>
      <BlockStack gap="300">
        <Text as="p" tone="subdued">
          {t("orders.dispute.help")}
        </Text>
        {!open ? (
          <div>
            <Button onClick={() => setOpen(true)}>{t("orders.dispute.title")}</Button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (description.trim().length < 10) return setDescErr(t("orders.dispute.tooShort"));
              setBusy(true);
              const r = await disputeAction(orderId, { reason, description });
              setBusy(false);
              if (r.ok) router.refresh();
              else setError(err(r.error));
            }}
          >
            <BlockStack gap="300">
              <Select
                label={t("orders.dispute.reason")}
                options={DISPUTE_REASONS_LIST.map((r) => ({ value: r, label: t(`orders.dispute.reasons.${r}` as DictKey) }))}
                value={reason}
                onChange={setReason}
              />
              <TextField
                label={t("orders.dispute.description")}
                helpText={t("orders.dispute.descriptionHelp")}
                autoComplete="off"
                multiline={4}
                maxLength={2000}
                value={description}
                onChange={(v) => {
                  setDescription(v);
                  setDescErr(undefined);
                }}
                error={descErr}
              />
              {error ? (
                <Banner tone="critical" announce>
                  {error}
                </Banner>
              ) : null}
              <div>
                <Button submit loading={busy}>
                  {t("orders.dispute.submit")}
                </Button>
              </div>
            </BlockStack>
          </form>
        )}
      </BlockStack>
    </Card>
  );
}
