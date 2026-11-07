"use client";

import { Copy, ExternalLink, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { QTY_TIERS, type DesignDoc, type Dims } from "@/types";
import { formatDate, formatDims, formatMoney, formatNumber } from "@/lib/format";
import { arrivalDate } from "@/lib/pricing/buyer";
import { useI18n } from "@/i18n/client";
import { OtpForm, type OtpSuccess } from "@/components/auth";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Divider, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { ChoiceList } from "@/components/ui/ChoiceList";
import { Inset } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { PriceTag } from "@/components/ui/PriceTag";
import { Select } from "@/components/ui/Select";
import { SkeletonBodyText } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { BADGE_QTY, fetchQuote, quoteKey, type PriceState } from "./lib/quote";
import { ORDER_MODE_COPY } from "@/data/catalogue/order-mode";

/** Catalogue quote form for the design's model (B-16). */
const quoteUrl = (locale: string, doc: DesignDoc) => `/${locale}/catalog/${encodeURIComponent(doc.modelCode ?? doc.structureCode)}#quote`;
import styles from "./designer.module.css";
import lib from "./library.module.css";

/** R1-01: the price is public; the phone is asked for only to save, export, share or order. */
export type GateReason = "save" | "export" | "share" | "order";

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

/** The live price badge on the editor ("500 boxes: EGP X per box, all-in excl. VAT · delivered in N days"). */
export function PriceBadge({ state, onClick, vessel = false }: { state: PriceState; onClick: () => void; vessel?: boolean }) {
  const { t, locale } = useI18n();
  let label: string;
  let price: string | null = null;
  const MARK = "\u2063";
  switch (state.status) {
    case "ready":
      price = formatMoney(state.best.pay.unitPiasters, locale, { alwaysDecimals: true });
      label = t(vessel ? "designer.container.badge" : "designer.price.badge", {
        qty: formatNumber(state.quantity),
        price: MARK,
        days: state.best.deliveryDays,
      });
      break;
    // "idle" is the 500 ms debounce before the first request: show it as loading.
    case "idle":
    case "loading":
      label = t("designer.price.loading");
      break;
    case "none":
      label = t(vessel ? "designer.container.unavailable" : "designer.price.unavailable");
      break;
    case "quote":
      label = t("designer.price.quoteBadge");
      break;
    default:
      label = t("designer.price.errorBody");
  }
  const [before, after] = price !== null ? label.split(MARK) : [label, ""];
  const loading = state.status === "loading" || state.status === "idle";
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
        <Tag size={16} />
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
            {/* R1-02 / R1-21: the numbers checkout charges (`pay`), the online-payment discount
                already taken off, so there is no condition left to read in small print. */}
            <Inset>
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span">{t(vessel ? "designer.container.perPiece" : "designer.price.perBox")}</Text>
                  <PriceTag amount={state.best.pay.unitPiasters} locale={locale} vat="excluded" alwaysDecimals />
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span">{t("pricing.subtotal")}</Text>
                  <PriceTag amount={state.best.pay.subtotalPiasters} locale={locale} alwaysDecimals />
                </InlineStack>
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span">{t("pricing.vat")}</Text>
                  <PriceTag amount={state.best.pay.vatPiasters} locale={locale} alwaysDecimals />
                </InlineStack>
                <Divider />
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <Text as="span" fontWeight="semibold">
                    {t("designer.price.total")}
                  </Text>
                  <PriceTag amount={state.best.pay.totalPiasters} locale={locale} size="large" alwaysDecimals />
                </InlineStack>
              </BlockStack>
            </Inset>
            <Text as="p">
              <span suppressHydrationWarning>{t("designer.price.arrives", { date: arrivalDate(state.best.deliveryDays, locale), days: state.best.deliveryDays })}</span>
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {state.prepayDiscountPct ? t("designer.price.includesPrepay", { pct: state.prepayDiscountPct }) : t("designer.price.includes")}{" "}
              {t("designer.price.validUntil", { date: formatDate(state.validUntil, locale) })}
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

/** What the export modal downloads: 3D renders (PNG), the 3D model, the print PDF, the dieline template. */
export type ExportSize = "standard" | "hd" | "uhd" | "glb" | "pdf" | "dielineSvg" | "dielinePdf";

/** Export (screen 20 anatomy: choice lists with a "Recommended" badge): images, print and 3D files. */
export function ExportModal({
  open,
  onClose,
  onExport,
  busy,
  onOrder,
  orderLabel,
  model3d = true,
}: {
  open: boolean;
  onClose: () => void;
  onExport: (s: ExportSize) => void;
  busy: boolean;
  /** "Order this box / design" next to the download (B-03 bridge: every export leads back to an order). */
  onOrder?: () => void;
  orderLabel?: string;
  /** Offer the GLB 3D model (boxes). */
  model3d?: boolean;
}) {
  const { t } = useI18n();
  const [size, setSize] = useState<ExportSize | null>(null);
  useEffect(() => {
    if (open) setSize(null);
  }, [open]);
  const pick = (v: string[]) => setSize((v[0] as ExportSize) ?? null);
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
          title={t("designer.export.groupImage")}
          selected={size ? [size] : []}
          onChange={pick}
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
            { value: "uhd", label: t("designer.export.uhd"), helpText: t("designer.export.uhdHelp") },
          ]}
        />
        <ChoiceList
          title={t("designer.export.groupFiles")}
          selected={size ? [size] : []}
          onChange={pick}
          choices={[
            { value: "pdf", label: t("designer.export.pdf"), helpText: t("designer.export.pdfHelp") },
            ...(model3d ? [{ value: "glb", label: t("designer.export.glb"), helpText: t("designer.export.glbHelp") }] : []),
            { value: "dielineSvg", label: t("designer.export.dielineSvg"), helpText: t("designer.export.dielineSvgHelp") },
            { value: "dielinePdf", label: t("designer.export.dielinePdf"), helpText: t("designer.export.dielinePdfHelp") },
          ]}
        />
        {size === "pdf" ? (
          <Banner tone="info" inCard>
            {t("designer.export.printNote")}
          </Banner>
        ) : null}
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
