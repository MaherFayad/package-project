"use client";

import { ImagePlus, RotateCcw, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { DISPUTE_REASONS_LIST } from "@/lib/orders/schema-constants";
import { Banner } from "@/components/ui/Banner";
import { BlockStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
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

const MAX_PHOTOS = 5;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const [sent, setSent] = useState(false);
  // Checkout round 9: photos of the boxes, uploaded as they are chosen (max 5, JPG/PNG/WebP, 10 MB).
  const [photos, setPhotos] = useState<{ id: string; name: string; preview: string; key?: string; error?: string; uploading?: boolean }[]>([]);
  const ready = photos.filter((p) => p.key);
  const uploading = photos.some((p) => p.uploading);
  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.filter((p) => !p.error).length;
    const chosen = Array.from(files);
    const take = chosen.slice(0, Math.max(0, room));
    const extra = chosen.length - take.length;
    const rows = take.map((f) => ({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`, name: f.name, preview: URL.createObjectURL(f), file: f }));
    setPhotos((cur) => [
      ...cur,
      ...rows.map((r) =>
        !PHOTO_TYPES.includes(r.file.type)
          ? { id: r.id, name: r.name, preview: r.preview, error: t("buyer.photos.type") }
          : r.file.size > PHOTO_MAX_BYTES
            ? { id: r.id, name: r.name, preview: r.preview, error: t("buyer.photos.tooLarge") }
            : { id: r.id, name: r.name, preview: r.preview, uploading: true },
      ),
    ]);
    if (extra > 0) setError(t("buyer.photos.tooMany", { max: MAX_PHOTOS }));
    for (const r of rows) {
      if (!PHOTO_TYPES.includes(r.file.type) || r.file.size > PHOTO_MAX_BYTES) continue;
      const fd = new FormData();
      fd.append("file", r.file);
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/dispute-photos`, { method: "POST", body: fd }).catch(() => null);
      const j = (await res?.json().catch(() => null)) as { ok?: boolean; key?: string; error?: string } | null;
      setPhotos((cur) =>
        cur.map((p) =>
          p.id !== r.id
            ? p
            : j?.ok && j.key
              ? { ...p, uploading: false, key: j.key }
              : { ...p, uploading: false, error: j?.error === "TOO_LARGE" ? t("buyer.photos.tooLarge") : j?.error === "TYPE" ? t("buyer.photos.type") : t("buyer.photos.failed") },
        ),
      );
    }
  };
  return (
    <Card title={t("orders.dispute.title")}>
      <BlockStack gap="300">
        <Text as="p" tone="subdued">
          {t("orders.dispute.help")}
        </Text>
        {sent ? (
          <Banner tone="success" announce>
            {t("orders.dispute.sent")}
          </Banner>
        ) : !open ? (
          <div>
            <Button onClick={() => setOpen(true)}>{t("orders.dispute.title")}</Button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (description.trim().length < 10) return setDescErr(t("orders.dispute.tooShort"));
              if (uploading) return setError(t("buyer.photos.wait"));
              setBusy(true);
              const r = await disputeAction(orderId, { reason, description, photos: ready.map((p) => p.key!) });
              setBusy(false);
              // Confirm at once (announced), then refresh the order: the refresh alone could miss.
              if (r.ok) {
                setSent(true);
                router.refresh();
              }
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
              <BlockStack gap="200">
                <Text as="p" fontWeight="medium">
                  {t("buyer.photos.label")} <Text as="span" tone="subdued">{t("buyer.photos.optional")}</Text>
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" id="dispute-photos-help">
                  {t("buyer.photos.help", { max: MAX_PHOTOS })}
                </Text>
                {photos.length ? (
                  <ul className={styles.photoList} aria-label={t("buyer.photos.label")}>
                    {photos.map((p) => (
                      <li key={p.id} className={styles.photoItem} data-error={p.error ? "" : undefined}>
                        {p.error ? (
                          <span className={styles.photoThumb} aria-hidden="true" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- local preview (blob:) of the chosen file
                          <img src={p.preview} alt="" className={styles.photoThumb} />
                        )}
                        <span className={styles.photoMeta}>
                          <bdi className={styles.photoName}>{p.name}</bdi>
                          <span role={p.error ? "alert" : undefined} className={p.error ? styles.photoError : undefined}>
                            {p.error ?? (p.uploading ? t("buyer.photos.uploading") : t("buyer.photos.added"))}
                          </span>
                        </span>
                        <Button
                          variant="tertiary"
                          size="slim"
                          icon={X}
                          accessibilityLabel={t("buyer.photos.remove", { name: p.name })}
                          disabled={p.uploading}
                          onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {photos.filter((p) => !p.error).length < MAX_PHOTOS ? (
                  <label className={styles.photoPick}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="visually-hidden"
                      aria-describedby="dispute-photos-help"
                      onChange={(e) => {
                        void addPhotos(e.currentTarget.files);
                        e.currentTarget.value = "";
                      }}
                    />
                    <Icon source={ImagePlus} size="small" />
                    {t("buyer.photos.add")}
                  </label>
                ) : null}
              </BlockStack>
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
