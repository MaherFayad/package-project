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
  SkeletonBodyText,
  Text,
  TextField,
} from "@/components/ui";
import { BADGE_QTY, fetchQuote, quoteKey, type PriceState } from "./lib/quote";
import { ORDER_MODE_COPY } from "@/data/catalogue/order-mode";

/** Catalogue quote form for the design's model (B-16). */
const quoteUrl = (locale: string, doc: DesignDoc) => `/${locale}/catalog/${encodeURIComponent(doc.modelCode ?? doc.structureCode)}#quote`;
import styles from "./designer.module.css";
import lib from "./library.module.css";

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
export function PriceBadge({ state, onClick, vessel = false }: { state: PriceState; onClick: () => void; vessel?: boolean }) {
  const { t, locale } = useI18n();
  let label: string;
  let price: string | null = null;
  const MARK = "\u2063";
  switch (state.status) {
    case "ready":
      price = formatMoney(state.best.unitPiasters, locale);
      label = t(vessel ? "designer.container.badge" : "designer.price.badge", {
        qty: formatNumber(state.quantity),
        price: MARK,
        days: state.best.deliveryDays,
      });
      break;
    case "loading":
      label = t("designer.price.loading");
      break;
    case "none":
      label = t(vessel ? "designer.container.unavailable" : "designer.price.unavailable");
      break;
    case "quote":
      label = t("designer.price.quoteBadge");
      break;
    case "error":
      label = t("designer.price.errorBody");
      break;
    default:
      label = t(vessel ? "designer.container.badgeLocked" : "designer.price.badgeLocked", { qty: formatNumber(BADGE_QTY) });
  }
  const [before, after] = price !== null ? label.split(MARK) : [label, ""];
  const loading = state.status === "loading";
  return (
    <button
      type="button"
      className={styles.priceBadge}
      onClick={onClick}
      aria-live="polite"
      aria-busy={loading || undefined}
      data-state={state.status}
      data-testid="price-badge"
    >
      <span className={styles.priceBadgeIcon} aria-hidden="true">
        {state.status === "ready" || state.status === "quote" || loading ? <Tag size={16} /> : <Lock size={16} />}
      </span>
      <span className={styles.priceBadgeText}>
        {before}
        {/* Only the amount re-keys and ticks in (CR-20); off under reduced motion. */}
        {price !== null ? (
          <span key={price} className={`${styles.priceBadgeAmount} ${lib.priceTick}`}>
            {price}
          </span>
        ) : null}
        {after}
        {/* Loading: a shimmer bar, not a spinner (CR-21); the text alone is the accessible name. */}
        {loading ? <span className={styles.priceShimmer} aria-hidden="true" /> : null}
      </span>
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
  // Containers price per piece, not per box (R2-04).
  const vessel = !!doc.vessel;
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
  }, [open, qty, attempt, quoteKey(doc, qty)]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={state.status === "quote" ? t("designer.price.quoteHeading") : t("designer.price.heading")}
      primaryAction={
        state.status === "quote"
          ? { content: t("designer.price.quoteAction"), url: quoteUrl(locale, doc) }
          : { content: t(vessel ? "designer.container.order" : "designer.order.button"), onAction: onOrder, loading: ordering, disabled: state.status !== "ready" }
      }
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
          <div role="status" aria-busy="true">
            <span className="visually-hidden">{t("designer.price.loading")}</span>
            <SkeletonBodyText lines={4} />
          </div>
        ) : state.status === "ready" ? (
          <BlockStack gap="300">
            <Inset>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span">{t(vessel ? "designer.container.perPiece" : "designer.price.perBox")}</Text>
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
        ) : state.status === "quote" ? (
          <Banner tone="info" inCard title={t("designer.price.quoteTitle")}>
            {ORDER_MODE_COPY[state.reason][locale]}
          </Banner>
        ) : state.status === "none" ? (
          <Banner tone="warning" inCard>
            {t(vessel ? "designer.container.unavailable" : "designer.price.unavailable")}
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
export function ExportModal({
  open,
  onClose,
  onExport,
  busy,
  onOrder,
  orderLabel,
}: {
  open: boolean;
  onClose: () => void;
  onExport: (s: ExportSize) => void;
  busy: boolean;
  /** "Order this box / design" next to the download (B-03 bridge: every export leads back to an order). */
  onOrder?: () => void;
  orderLabel?: string;
}) {
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
      secondaryActions={[
        ...(onOrder && orderLabel ? [{ content: orderLabel, onAction: onOrder }] : []),
        { content: t("common.cancel"), onAction: onClose },
      ]}
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
export function ShareModal({ open, onClose, url, error, vessel = false }: { open: boolean; onClose: () => void; url: string | null; error: boolean; vessel?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<boolean | "failed">(false);
  useEffect(() => {
    if (open) setCopied(false);
  }, [open, url]);
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard blocked (permissions, insecure origin): say so instead of failing silently (R4-06).
      setCopied("failed");
    }
  };
  const status = copied === true ? t("designer.share.copied") : copied === "failed" ? t("designer.share.copyFailed") : "";
  return (
    <Modal open={open} onClose={onClose} title={t("designer.share.heading")} size="small" secondaryActions={[{ content: t("common.close"), onAction: onClose }]}>
      <BlockStack gap="300">
        <Text as="p">{t(vessel ? "designer.container.shareBody" : "designer.share.body")}</Text>
        {error ? (
          <Banner tone="critical" inCard>
            {t("designer.share.failed")}
          </Banner>
        ) : url ? (
          <>
            <TextField
              label={t("designer.share.link")}
              autoComplete="off"
              value={url}
              readOnly
              dir="ltr"
              // One tap selects the whole link, ready to copy by hand (R4-06).
              onFocus={() => (document.activeElement as HTMLInputElement | null)?.select?.()}
            />
            <InlineStack gap="200" wrap>
              <Button icon={Copy} variant="primary" onClick={copy}>
                {copied === true ? t("designer.share.copied") : t("designer.share.copy")}
              </Button>
              <Button icon={ExternalLink} url={url} external>
                {t("designer.share.open")}
              </Button>
            </InlineStack>
            {copied === "failed" ? (
              <Text as="p" variant="bodySm" tone="critical">
                {status}
              </Text>
            ) : null}
            <span role="status" className="visually-hidden">
              {status}
            </span>
          </>
        ) : (
          // Skeleton of the link field, not a spinner (CR-21 pattern, R4-04).
          <div role="status" aria-busy="true">
            <span className="visually-hidden">{t("designer.share.creating")}</span>
            <SkeletonBodyText lines={2} />
          </div>
        )}
      </BlockStack>
    </Modal>
  );
}
