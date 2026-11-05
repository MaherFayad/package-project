"use client";

import { Copy, ExternalLink, Lock, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { QTY_TIERS, type DesignDoc, type Dims } from "@/types";
import { formatDate, formatDims, formatMoney, formatNumber } from "@/lib/format";
import { useI18n } from "@/i18n/client";
import { OtpForm, type OtpSuccess } from "@/components/auth";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  ChoiceList,
  Divider,
  InlineStack,
  Inset,
  Modal,
  PriceTag,
  Select,
  Spinner,
  Text,
  TextField,
} from "@/components/ui";
import { BADGE_QTY, fetchQuote, type PriceState } from "./lib/quote";
import styles from "./designer.module.css";

export type GateReason = "price" | "save" | "export" | "share" | "order";

/** Soft gate G2: phone + OTP with a separate, unchecked marketing consent (inside OtpForm). */
export function GateModal({ reason, onClose, onSuccess }: { reason: GateReason | null; onClose: () => void; onSuccess: (u: OtpSuccess) => void }) {
  const { t } = useI18n();
  return (
    <Modal open={reason !== null} onClose={onClose} title={t("designer.gate.title")} size="small" secondaryActions={[{ content: t("common.cancel"), onAction: onClose }]}>
      {reason ? (
        <BlockStack gap="300">
          <OtpForm reason={t(`designer.gate.reason.${reason}`)} onSuccess={onSuccess} />
          <Text as="p" variant="bodySm" tone="subdued">
            {t("designer.gate.note")}
          </Text>
        </BlockStack>
      ) : null}
    </Modal>
  );
}

/** The live price badge on the editor ("500 boxes from EGP X each, delivered in N days"). */
export function PriceBadge({ state, onClick }: { state: PriceState; onClick: () => void }) {
  const { t, locale } = useI18n();
  let label: string;
  switch (state.status) {
    case "ready":
      label = t("designer.price.badge", {
        qty: formatNumber(state.quantity),
        price: formatMoney(state.best.unitPiasters, locale),
        days: state.best.deliveryDays,
      });
      break;
    case "loading":
      label = t("designer.price.loading");
      break;
    case "none":
      label = t("designer.price.unavailable");
      break;
    case "error":
      label = t("designer.price.errorBody");
      break;
    default:
      label = t("designer.price.badgeLocked", { qty: formatNumber(BADGE_QTY) });
  }
  return (
    <button type="button" className={styles.priceBadge} onClick={onClick} aria-live="polite" data-state={state.status} data-testid="price-badge">
      <span className={styles.priceBadgeIcon} aria-hidden="true">
        {state.status === "loading" ? <Spinner size="small" /> : state.status === "ready" ? <Tag size={16} /> : <Lock size={16} />}
      </span>
      <span className={styles.priceBadgeText}>{label}</span>
    </button>
  );
}

/** Instant price for a chosen quantity, with the standard-size nudge and "Order this box". */
export function PriceModal({
  open,
  doc,
  onClose,
  onOrder,
  onUseDims,
  ordering,
}: {
  open: boolean;
  doc: DesignDoc;
  onClose: () => void;
  onOrder: () => void;
  onUseDims: (dims: Dims) => void;
  ordering: boolean;
}) {
  const { t, locale } = useI18n();
  const [qty, setQty] = useState<number>(BADGE_QTY);
  const [state, setState] = useState<PriceState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setState({ status: "loading" });
    fetchQuote(doc, qty, ctrl.signal)
      .then(setState)
      .catch(() => undefined);
    return () => ctrl.abort();
    // Re-price when the priced spec changes (not on artwork edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qty, attempt, doc.structureCode, doc.dims.L, doc.dims.W, doc.dims.H, doc.materialCode, doc.finishCode, doc.printSides]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("designer.price.heading")}
      primaryAction={{ content: t("designer.order.button"), onAction: onOrder, loading: ordering, disabled: state.status !== "ready" }}
      secondaryActions={[{ content: t("common.close"), onAction: onClose }]}
    >
      <BlockStack gap="400">
        <Select
          label={t("designer.price.quantity")}
          value={String(qty)}
          options={QTY_TIERS.map((q) => ({ value: String(q), label: formatNumber(q) }))}
          onChange={(v) => setQty(Number(v))}
        />
        {state.status === "loading" || state.status === "idle" ? (
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <Text as="span" tone="subdued">
              {t("designer.price.loading")}
            </Text>
          </InlineStack>
        ) : state.status === "ready" ? (
          <BlockStack gap="300">
            <Inset>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span">{t("designer.price.perBox")}</Text>
                  <PriceTag amount={state.best.unitPiasters} locale={locale} vat="excluded" />
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span">{t("pricing.subtotal")}</Text>
                  <PriceTag amount={state.best.subtotalPiasters} locale={locale} />
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span">{t("pricing.vat")}</Text>
                  <PriceTag amount={state.best.vatPiasters} locale={locale} />
                </InlineStack>
                <Divider />
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span" fontWeight="semibold">
                    {t("designer.price.total")}
                  </Text>
                  <PriceTag amount={state.best.totalPiasters} locale={locale} size="large" />
                </InlineStack>
              </BlockStack>
            </Inset>
            <InlineStack gap="200" wrap>
              <Badge tone="info">{t("designer.price.delivery", { days: state.best.deliveryDays })}</Badge>
              <Badge>{t("designer.price.vendor", { vendor: state.best.vendor.name[locale] })}</Badge>
              <Badge>{t("designer.price.vendorsCount", { count: state.vendorCount })}</Badge>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              {t("designer.price.validUntil", { date: formatDate(state.validUntil, locale) })} · {t("designer.price.note")}
            </Text>
            {state.suggestion ? (
              <Banner
                tone="info"
                inCard
                action={{ content: t("designer.price.useSuggestion"), onAction: () => onUseDims(state.suggestion!.dims) }}
              >
                {t("designer.price.suggestion", {
                  dims: formatDims(state.suggestion.dims, locale),
                  pct: state.suggestion.savingsPct,
                  days: state.suggestion.leadTimeDaysSaved,
                })}
              </Banner>
            ) : null}
          </BlockStack>
        ) : state.status === "none" ? (
          <Banner tone="warning" inCard>
            {t("designer.price.unavailable")}
          </Banner>
        ) : (
          <Banner tone="critical" inCard action={{ content: t("designer.price.retry"), onAction: () => setAttempt((a) => a + 1) }}>
            {t("designer.price.errorBody")}
          </Banner>
        )}
      </BlockStack>
    </Modal>
  );
}

export type ExportSize = "standard" | "hd";

/** PNG mockup export (screen 20 anatomy: choice list with a "Recommended" badge). No dieline PDF. */
export function ExportModal({ open, onClose, onExport, busy }: { open: boolean; onClose: () => void; onExport: (s: ExportSize) => void; busy: boolean }) {
  const { t } = useI18n();
  const [size, setSize] = useState<ExportSize | null>(null);
  useEffect(() => {
    if (open) setSize(null);
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("designer.export.heading")}
      size="small"
      primaryAction={{ content: t("designer.export.download"), disabled: !size, loading: busy, onAction: () => size && onExport(size) }}
      secondaryActions={[{ content: t("common.cancel"), onAction: onClose }]}
    >
      <BlockStack gap="400">
        <ChoiceList
          title={t("designer.export.heading")}
          titleHidden
          selected={size ? [size] : []}
          onChange={(v) => setSize((v[0] as ExportSize) ?? null)}
          choices={[
            {
              value: "standard",
              label: (
                <InlineStack gap="200" blockAlign="center" as="span">
                  <span>{t("designer.export.standard")}</span>
                  <Badge>{t("designer.export.recommended")}</Badge>
                </InlineStack>
              ),
              helpText: t("designer.export.standardHelp"),
            },
            { value: "hd", label: t("designer.export.hd"), helpText: t("designer.export.hdHelp") },
          ]}
        />
        <Banner tone="info" inCard>
          {t("designer.export.noPdf")}
        </Banner>
      </BlockStack>
    </Modal>
  );
}

/** Read-only share link for a saved design. */
export function ShareModal({ open, onClose, url, error }: { open: boolean; onClose: () => void; url: string | null; error: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (open) setCopied(false);
  }, [open, url]);
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("designer.share.heading")} size="small" secondaryActions={[{ content: t("common.close"), onAction: onClose }]}>
      <BlockStack gap="300">
        <Text as="p">{t("designer.share.body")}</Text>
        {error ? (
          <Banner tone="critical" inCard>
            {t("designer.share.failed")}
          </Banner>
        ) : url ? (
          <>
            <TextField label={t("designer.share.link")} autoComplete="off" value={url} readOnly dir="ltr" onFocus={() => undefined} />
            <InlineStack gap="200" wrap>
              <Button icon={Copy} variant="primary" onClick={copy}>
                {copied ? t("designer.share.copied") : t("designer.share.copy")}
              </Button>
              <Button icon={ExternalLink} url={url} external>
                {t("designer.share.open")}
              </Button>
            </InlineStack>
            <span role="status" className="visually-hidden">
              {copied ? t("designer.share.copied") : ""}
            </span>
          </>
        ) : (
          <InlineStack gap="200" blockAlign="center">
            <Spinner size="small" />
            <Text as="span" tone="subdued">
              {t("designer.share.creating")}
            </Text>
          </InlineStack>
        )}
      </BlockStack>
    </Modal>
  );
}
