"use client";

import { ORDER_MODE_COPY } from "@/data/catalogue/order-mode";
import { BadgeCheck, Check, Clock, Star, Truck } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { MAX_INSTANT_QTY, type DesignDoc, type Locale, type QuoteLine } from "@/types";
import type { PackagingSceneHandle } from "@/components/three";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDateTime, formatDims, formatMoney } from "@/lib/format";
import { normalizeEgyptPhone } from "@/lib/phone";
import { GOVERNORATES } from "@/lib/orders/governorates";
import type { CheckoutOffer } from "@/lib/orders/service";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Icon,
  InlineStack,
  Link,
  Page,
  PriceTag,
  Select,
  SkeletonBodyText,
  Stepper,
  Text,
  TextField,
} from "@/components/ui";
import { getOffersAction, placeOrderAction, requestQuoteAction, type OffersResult } from "../actions";
import { QUOTE_NOTE_MAX } from "../quote-request";
import type { DocSpec } from "@/lib/library/spec";
import styles from "./checkout.module.css";

// The proof viewer pulls the model library, dieline engine and three.js: load it only when the
// buyer reaches the proof step, so steps 1 and 2 stay light (PERF-03). docSpec is computed on the server.
const ProofViewer = dynamic(() => import("./ProofViewer").then((m) => m.ProofViewer), {
  ssr: false,
  loading: () => <div className={styles.stageSkeleton} aria-hidden="true" />,
});

export interface TierPrice {
  quantity: number;
  unitPiasters: number | null;
  totalPiasters: number | null;
}

export interface AddressState {
  name: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  landmark: string;
  notes: string;
}

type Step = 0 | 1 | 2;
type AddressErrors = Partial<Record<keyof AddressState, string>>;

/** Lines in the summary: label from the dictionary key the pricing engine set. */
function lineLabel(t: (k: DictKey, v?: Record<string, string | number>) => string, l: QuoteLine): string {
  const map: Record<string, DictKey> = {
    "pricing.line.product": "pricing.line.product",
    "pricing.line.setup": "pricing.line.setup",
    "pricing.line.die": "pricing.line.die",
    "pricing.line.shipping": "checkout.summary.shipping",
    "pricing.line.discount": "pricing.line.discount",
  };
  return t((map[l.labelKey] ?? l.labelKey) as DictKey);
}

export function CheckoutClient(props: {
  locale: Locale;
  designId: string;
  doc: DesignDoc;
  designName: string;
  editUrl: string;
  tiers: TierPrice[];
  initialQty: number;
  initial: OffersResult;
  defaultAddress: AddressState;
  spec: DocSpec;
  /** Buyer's mobile number, formatted, for the "we will reply on …" line of a quote request. */
  contactPhone: string;
}) {
  const { locale, designId, doc, editUrl } = props;
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [qty, setQty] = useState(props.initialQty);
  const [customQty, setCustomQty] = useState("");
  const [customErr, setCustomErr] = useState<string | undefined>();
  const [result, setResult] = useState<OffersResult>(props.initial);
  const [vendorId, setVendorId] = useState<string | null>(props.initial.ok && props.initial.mode === "instant" ? (props.initial.offers[0]?.vendorId ?? null) : null);
  const [showAll, setShowAll] = useState(false);
  const [loading, startLoading] = useTransition();
  const [address, setAddress] = useState<AddressState>(props.defaultAddress);
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const [approved, setApproved] = useState(false);
  const [approveErr, setApproveErr] = useState<string | undefined>();
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState<string | null>(null);
  const [shippingNote, setShippingNote] = useState<string | null>(null);
  const [quoteNote, setQuoteNote] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  /** Quantities a quote request was sent for in this visit (re-sending the same one is a no-op on the server). */
  const [quoteSent, setQuoteSent] = useState<number | null>(null);
  const headingRefs = [useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null)];
  const sceneRef = useRef<PackagingSceneHandle | null>(null);
  const lastGov = useRef(props.defaultAddress.governorate);

  const offers = result.ok && result.mode === "instant" ? result.offers : [];
  const selected = offers.find((o) => o.vendorId === vendorId) ?? null;
  const total = selected?.pay.totalPiasters ?? null;
  const [announce, setAnnounce] = useState("");
  const lastTotal = useRef(total);
  useEffect(() => {
    if (total === null || total === lastTotal.current) return;
    lastTotal.current = total;
    setAnnounce(t("buyer.priceUpdated", { amount: formatMoney(total, locale) }));
  }, [total, locale, t]);

  const fetchOffers = useCallback(
    (quantity: number, governorate: string, after?: () => void) => {
      startLoading(async () => {
        const r = await getOffersAction({ designId, quantity, governorate: governorate || undefined });
        setResult(r);
        if (r.ok && r.mode === "instant") {
          setVendorId((cur) => (cur && r.offers.some((o) => o.vendorId === cur) ? cur : (r.offers[0]?.vendorId ?? null)));
        } else setVendorId(null);
        after?.();
      });
    },
    [designId],
  );

  const pickQty = (q: number) => {
    setQty(q);
    setCustomQty("");
    setCustomErr(undefined);
    fetchOffers(q, address.governorate);
  };

  const applyCustom = () => {
    const n = Number(customQty.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,\s]/g, ""));
    if (!Number.isInteger(n) || n < 1) {
      setCustomErr(t("checkout.quantity.invalid", { max: MAX_INSTANT_QTY }));
      return;
    }
    setCustomErr(undefined);
    setQty(n);
    fetchOffers(n, address.governorate);
  };

  // Delivery price depends on the governorate: re-price when it changes.
  useEffect(() => {
    if (address.governorate === lastGov.current) return;
    lastGov.current = address.governorate;
    if (!address.governorate) return;
    const g = GOVERNORATES.find((x) => x.name === address.governorate);
    fetchOffers(qty, address.governorate, () =>
      setShippingNote(g ? t("checkout.address.shippingChanged", { governorate: t(`governorates.${g.key}` as DictKey) }) : null),
    );
  }, [address.governorate, qty, fetchOffers, t]);

  const manual = result.ok && result.mode === "manual_quote";

  const requestQuote = async () => {
    setQuoteErr(null);
    setQuoteBusy(true);
    const r = await requestQuoteAction({ designId, quantity: qty, governorate: address.governorate || undefined, note: quoteNote.trim() || undefined });
    setQuoteBusy(false);
    if (r.ok) {
      setQuoteSent(qty);
      requestAnimationFrame(() => document.getElementById("quote-sent")?.focus());
      return;
    }
    const key = `checkout.errors.${r.error}` as DictKey;
    setQuoteErr(t(key) === key ? t("checkout.errors.generic") : t(key));
  };

  const goTo = (s: Step) => {
    setStep(s);
    requestAnimationFrame(() => {
      const h = headingRefs[s].current;
      h?.focus({ preventScroll: true });
      h?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const validateAddress = (): boolean => {
    const e: AddressErrors = {};
    const req = t("checkout.address.required");
    if (address.name.trim().length < 2) e.name = req;
    if (!normalizeEgyptPhone(address.phone)) e.phone = t("checkout.address.invalidPhone");
    if (!address.governorate) e.governorate = req;
    if (address.city.trim().length < 2) e.city = req;
    if (address.street.trim().length < 3) e.street = req;
    setAddrErrors(e);
    const first = Object.keys(e)[0];
    if (first) requestAnimationFrame(() => document.getElementById(`addr-${first}`)?.focus());
    return !first;
  };

  const captureProof = async (): Promise<string | null> => {
    const h = sceneRef.current;
    if (!h) return null;
    try {
      const blob = await Promise.race([
        h.screenshot({ width: 768, height: 768, mimeType: "image/jpeg", quality: 0.85, background: "#ffffff" }),
        new Promise<null>((r) => setTimeout(() => r(null), 4000)),
      ]);
      if (!blob) return null;
      return await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("read"));
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const onPrimary = async () => {
    setPlaceErr(null);
    if (step === 0) {
      if (selected) goTo(1);
      return;
    }
    if (step === 1) {
      if (validateAddress() && selected) goTo(2);
      return;
    }
    if (!approved) {
      setApproveErr(t("checkout.proof.approveRequired"));
      requestAnimationFrame(() => document.getElementById("proof-approve")?.focus());
      return;
    }
    if (!selected) return;
    setPlacing(true);
    const preview = await captureProof();
    const r = await placeOrderAction({
      designId,
      quantity: qty,
      vendorId: selected.vendorId,
      address,
      approved: true,
      preview,
      locale,
    });
    if (r.ok) {
      router.push(`/${locale}/checkout/pay/${r.orderId}`);
      return;
    }
    setPlacing(false);
    if (r.error === "OFFER_UNAVAILABLE") {
      fetchOffers(qty, address.governorate);
      goTo(0);
    }
    if (r.error === "INVALID" && r.fields?.some((f) => f.startsWith("address"))) {
      validateAddress();
      goTo(1);
    }
    const key = `checkout.errors.${r.error}` as DictKey;
    setPlaceErr(t(key) === key ? t("checkout.errors.generic") : t(key));
  };

  const primaryLabel = step === 2 ? (placing ? t("checkout.actions.placing") : t("checkout.actions.approveAndPay")) : t("checkout.actions.continue");
  const governorateOptions = useMemo(
    () => GOVERNORATES.map((g) => ({ value: g.name, label: t(`governorates.${g.key}` as DictKey) })),
    [t],
  );
  const set = (k: keyof AddressState) => (v: string) => {
    setAddress((a) => ({ ...a, [k]: v }));
    if (addrErrors[k]) setAddrErrors((e) => ({ ...e, [k]: undefined }));
  };

  const visibleOffers = showAll ? offers : offers.slice(0, 3);
  const steps = [
    { id: "offer", label: t("checkout.steps.offer") },
    { id: "delivery", label: t("checkout.steps.delivery") },
    { id: "proof", label: t("checkout.steps.proof") },
    { id: "payment", label: t("checkout.steps.payment") },
  ];

  // ── step bodies ───────────────────────────────────────────────────
  const offerStep = (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <fieldset className={styles.tiers} aria-describedby="qty-help">
          <legend className="visually-hidden">{t("checkout.quantity.title")}</legend>
          {props.tiers.map((tier) => (
            <label key={tier.quantity} className={styles.tier}>
              <input
                className={styles.radio}
                type="radio"
                name="qty"
                value={tier.quantity}
                checked={qty === tier.quantity}
                disabled={tier.unitPiasters === null}
                onChange={() => pickQty(tier.quantity)}
              />
              <Text as="span" variant="headingSm" numeric>
                {t("checkout.summary.quantity", { qty: tier.quantity.toLocaleString("en-US") })}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {tier.unitPiasters === null ? t("checkout.quantity.unavailable") : t("checkout.quantity.perBox", { price: formatMoney(tier.unitPiasters, locale) })}
              </Text>
            </label>
          ))}
        </fieldset>
        <Text as="p" variant="bodySm" tone="subdued" id="qty-help">
          {t("checkout.quantity.help", { max: MAX_INSTANT_QTY.toLocaleString("en-US") })}
        </Text>
        <form
          className={styles.customQty}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
        >
          <div className={styles.customField}>
            <TextField
              label={t("checkout.quantity.custom")}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("buyer.qtyRange", { max: MAX_INSTANT_QTY.toLocaleString("en-US") })}
              value={customQty}
              onChange={setCustomQty}
              error={customErr}
              dir="ltr"
            />
          </div>
          <div className={styles.customApply}>
            <Button submit disabled={!customQty.trim() || loading}>
              {t("checkout.quantity.apply")}
            </Button>
          </div>
        </form>
      </BlockStack>

      <Divider />

      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="h3" variant="headingSm">
            {t("checkout.offers.title")}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {t("checkout.offers.help")}
          </Text>
        </BlockStack>
        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <BlockStack gap="200">
              <span className="visually-hidden">{t("checkout.offers.loading")}</span>
              <SkeletonBodyText lines={4} />
            </BlockStack>
          ) : !result.ok ? (
            <Banner tone="critical" action={{ content: t("checkout.offers.retry"), onAction: () => fetchOffers(qty, address.governorate) }}>
              {t("checkout.offers.error")}
            </Banner>
          ) : result.mode === "manual_quote" ? (
            quoteSent === qty ? (
              <div id="quote-sent" tabIndex={-1} className={styles.quoteSent}>
                <Banner
                  tone="success"
                  title={t("buyer.quote.sentTitle", { qty: qty.toLocaleString("en-US") })}
                  action={{ content: t("buyer.quote.viewRequests"), url: `/${locale}/account#quote-requests` }}
                  announce
                >
                  {t("buyer.quote.sentBody", { phone: props.contactPhone })}
                </Banner>
              </div>
            ) : (
              <form
                className={styles.quoteForm}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void requestQuote();
                }}
              >
                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="h4" variant="headingSm">
                      {t("buyer.quote.title", { qty: qty.toLocaleString("en-US") })}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {result.reason === "MODEL_BY_QUOTE"
                        ? ORDER_MODE_COPY[result.orderReason ?? "QUOTE_ONLY_STOCK"][locale]
                        : t("buyer.quote.body", { max: MAX_INSTANT_QTY.toLocaleString("en-US") })}
                    </Text>
                  </BlockStack>
                  <TextField
                    label={t("buyer.quote.note")}
                    helpText={t("buyer.quote.noteHelp")}
                    autoComplete="off"
                    multiline={3}
                    maxLength={QUOTE_NOTE_MAX}
                    value={quoteNote}
                    onChange={setQuoteNote}
                    optional
                  />
                  {quoteErr ? (
                    <Banner tone="critical" announce>
                      {quoteErr}
                    </Banner>
                  ) : null}
                  <div className={styles.quoteActions}>
                    <Button variant="primary" submit loading={quoteBusy}>
                      {t("buyer.quote.send")}
                    </Button>
                    <Button variant="plain" onClick={() => pickQty(MAX_INSTANT_QTY)} disabled={quoteBusy}>
                      {t("buyer.manualOrderMax", { max: MAX_INSTANT_QTY.toLocaleString("en-US") })}
                    </Button>
                  </div>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("buyer.quote.contact", { phone: props.contactPhone })}
                  </Text>
                </BlockStack>
              </form>
            )
          ) : offers.length === 0 ? (
            <Banner tone="warning">{t("checkout.offers.none")}</Banner>
          ) : (
            <BlockStack gap="200">
              <fieldset className={styles.offers}>
                <legend className="visually-hidden">{t("checkout.offers.title")}</legend>
                {visibleOffers.map((o) => (
                  <OfferCard key={o.vendorId} offer={o} checked={o.vendorId === vendorId} onSelect={() => setVendorId(o.vendorId)} locale={locale} />
                ))}
              </fieldset>
              {offers.length > 3 ? (
                <InlineStack align="center">
                  <Button variant="plain" onClick={() => setShowAll((s) => !s)}>
                    {showAll ? t("checkout.offers.showLess") : t("checkout.offers.showAll", { count: offers.length })}
                  </Button>
                </InlineStack>
              ) : null}
              {result.suggestion ? (
                <Banner
                  tone="info"
                  title={t("checkout.suggestion.title")}
                  secondaryAction={{ content: t("checkout.suggestion.action"), url: editUrl }}
                >
                  {t("checkout.suggestion.body", {
                    name: locale === "ar" ? result.suggestion.name.ar : result.suggestion.name.en,
                    dims: formatDims(result.suggestion.dims, locale),
                    pct: result.suggestion.savingsPct,
                    days: result.suggestion.leadTimeDaysSaved,
                  })}
                </Banner>
              ) : null}
            </BlockStack>
          )}
        </div>
      </BlockStack>
    </BlockStack>
  );

  const deliveryStep = (
    <BlockStack gap="300">
      <Text as="p" tone="subdued">
        {t("checkout.address.help")}
      </Text>
      <div className={styles.grid2}>
        <TextField id="addr-name" label={t("checkout.address.name")} autoComplete="name" value={address.name} onChange={set("name")} error={addrErrors.name} requiredIndicator />
        <TextField
          id="addr-phone"
          label={t("checkout.address.phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          value={address.phone}
          onChange={set("phone")}
          helpText={t("checkout.address.phoneHelp")}
          error={addrErrors.phone}
          requiredIndicator
        />
      </div>
      <div className={styles.grid2}>
        <Select
          id="addr-governorate"
          label={t("checkout.address.governorate")}
          options={governorateOptions}
          placeholder={t("checkout.address.governoratePlaceholder")}
          value={address.governorate}
          onChange={set("governorate")}
          error={addrErrors.governorate}
          requiredIndicator
        />
        <TextField id="addr-city" label={t("checkout.address.city")} autoComplete="address-level2" value={address.city} onChange={set("city")} error={addrErrors.city} requiredIndicator />
      </div>
      <TextField id="addr-street" label={t("checkout.address.street")} autoComplete="address-line1" value={address.street} onChange={set("street")} error={addrErrors.street} requiredIndicator />
      <div className={styles.grid3}>
        <TextField label={t("checkout.address.building")} autoComplete="off" value={address.building} onChange={set("building")} optional />
        <TextField label={t("checkout.address.floor")} autoComplete="off" value={address.floor} onChange={set("floor")} optional />
        <TextField label={t("checkout.address.apartment")} autoComplete="off" value={address.apartment} onChange={set("apartment")} optional />
      </div>
      <TextField label={t("checkout.address.landmark")} autoComplete="off" value={address.landmark} onChange={set("landmark")} optional />
      <TextField label={t("checkout.address.notes")} autoComplete="off" value={address.notes} onChange={set("notes")} multiline={2} maxLength={300} optional />
      {shippingNote ? (
        <Text as="p" variant="bodySm" tone="subdued">
          <span role="status">{shippingNote}</span>
        </Text>
      ) : null}
    </BlockStack>
  );

  const spec = props.spec;
  const proofStep = (
    <BlockStack gap="400">
      <Text as="p" tone="subdued">
        {t("checkout.proof.help")}
      </Text>
      <ProofViewer doc={doc} handleRef={sceneRef} />
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {t("checkout.proof.specs")}
        </Text>
        <dl className={styles.specs}>
          <dt>{t("checkout.proof.structure")}</dt>
          <dd data-testid="spec-model">
            {spec.model ?? t(`structures.${doc.structureCode}` as DictKey)}
            {spec.standard ? <bdi> ({spec.standard})</bdi> : null}
          </dd>
          <dt>{t("checkout.proof.size")}</dt>
          <dd>{spec.vesselSize ?? formatDims(doc.dims, locale)}</dd>
          {spec.container ? (
            <>
              <dt>{t("library.panel.container")}</dt>
              <dd>
                {spec.container}
                {spec.closure ? ` · ${spec.closure}` : ""}
              </dd>
            </>
          ) : null}
          <dt>{t("checkout.proof.material")}</dt>
          <dd>{t(`materials.${doc.materialCode}` as DictKey)}</dd>
          <dt>{t("checkout.proof.finish")}</dt>
          <dd data-testid="spec-finishes">{spec.finishes.length ? spec.finishes.join(locale === "ar" ? "، " : ", ") : t(`finishes.${doc.finishCode}` as DictKey)}</dd>
          <dt>{t("checkout.proof.sides")}</dt>
          <dd>{t(`checkout.proof.sides${doc.printSides}` as DictKey)}</dd>
          <dt>{t("checkout.proof.quantity")}</dt>
          <dd>
            <bdi>{qty.toLocaleString("en-US")}</bdi>
          </dd>
        </dl>
        <InlineStack>
          <Button variant="plain" url={editUrl}>
            {t("checkout.proof.edit")}
          </Button>
        </InlineStack>
      </BlockStack>
      <Box padding="300" borderRadius="200" background="bg-surface-secondary">
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            {t("checkout.proof.checklist")}
          </Text>
          <BlockStack as="ul" gap="100" className={styles.checklist}>
            <Text as="li">{t("checkout.proof.check1")}</Text>
            <Text as="li">{t("checkout.proof.check2")}</Text>
            <Text as="li">{t("checkout.proof.check3")}</Text>
          </BlockStack>
        </BlockStack>
      </Box>
      <Checkbox
        id="proof-approve"
        label={t("checkout.proof.approve")}
        helpText={t("checkout.proof.approveHelp")}
        checked={approved}
        onChange={(c) => {
          setApproved(c);
          if (c) setApproveErr(undefined);
        }}
        error={approveErr}
      />
      <Text as="p" variant="bodySm" tone="subdued">
        {t("checkout.proof.recorded")}
      </Text>
    </BlockStack>
  );

  const stepTitles = [t("checkout.steps.offer"), t("checkout.address.title"), t("checkout.proof.title")];
  const bodies = [offerStep, deliveryStep, proofStep];

  return (
    <Page
      title={t("checkout.title")}
      subtitle={props.designName}
      backAction={step > 0 ? { content: t("checkout.actions.back"), onAction: () => goTo((step - 1) as Step) } : { content: props.designName, url: editUrl }}
    >
      <BlockStack gap="400">
        <div className={styles.stepperWide}>
          <Card>
            <Stepper steps={steps} current={step} accessibilityLabel={t("checkout.steps.label")} />
          </Card>
        </div>
        <div className={styles.stepperCompact} aria-hidden="true">
          <div className={styles.compactHead}>
            <span className={styles.compactCount}>{t("checkout.stepOf", { current: step + 1, total: 4 })}</span>
            <span className={styles.compactNext}>{t("buyer.nextStep", { step: steps[step + 1].label })}</span>
          </div>
          <div className={styles.segments}>
            {steps.map((s, i) => (
              <span key={s.id} className={styles.segment} data-state={i < step ? "done" : i === step ? "current" : "todo"} />
            ))}
          </div>
        </div>
        <div className={styles.layout}>
          <BlockStack gap="400">
            <Card
              as="section"
              title={
                <span ref={headingRefs[step]} tabIndex={-1} className={styles.stepHeading}>
                  <span className="visually-hidden">{t("checkout.stepOf", { current: step + 1, total: 4 })}: </span>
                  {stepTitles[step]}
                </span>
              }
              footer={
                step > 0 ? (
                  <Button onClick={() => goTo((step - 1) as Step)} disabled={placing}>
                    {t("checkout.actions.back")}
                  </Button>
                ) : undefined
              }
            >
              {bodies[step]}
            </Card>
          </BlockStack>

          <aside className={styles.summary} aria-labelledby="summary-title">
            <Card title={<span id="summary-title">{t("checkout.summary.title")}</span>}>
              <BlockStack gap="300">
                {selected ? (
                  <>
                    <BlockStack gap="050">
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t("checkout.summary.printer")}
                      </Text>
                      <Text as="p" fontWeight="semibold">
                        {locale === "ar" ? selected.vendor.name.ar : selected.vendor.name.en}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t("checkout.summary.quantity", { qty: qty.toLocaleString("en-US") })} · {t(`structures.${doc.structureCode}` as DictKey)}
                      </Text>
                    </BlockStack>
                    <Divider />
                    <dl className={styles.lines}>
                      {selected.pay.lines.map((l, i) => (
                        <div className={styles.line} key={i}>
                          <dt>{lineLabel(t, l)}</dt>
                          <dd>
                            <PriceTag amount={l.totalPiasters} size="small" locale={locale} />
                          </dd>
                        </div>
                      ))}
                      <div className={`${styles.line} ${styles.lineSub}`}>
                        <dt>{t("buyer.subtotalExVat")}</dt>
                        <dd>
                          <Tick value={selected.pay.totalPiasters - selected.pay.vatPiasters}>
                            <PriceTag amount={selected.pay.totalPiasters - selected.pay.vatPiasters} size="small" locale={locale} />
                          </Tick>
                        </dd>
                      </div>
                      <div className={styles.line}>
                        <dt>{t("checkout.summary.vat")}</dt>
                        <dd>
                          <Tick value={selected.pay.vatPiasters}>
                            <PriceTag amount={selected.pay.vatPiasters} size="small" locale={locale} />
                          </Tick>
                        </dd>
                      </div>
                      <div className={`${styles.line} ${styles.lineTotal}`}>
                        <dt>{t("checkout.summary.total")}</dt>
                        <dd data-testid="checkout-total">
                          <Tick value={selected.pay.totalPiasters}>
                            <PriceTag amount={selected.pay.totalPiasters} size="medium" locale={locale} />
                          </Tick>
                        </dd>
                      </div>
                    </dl>
                    <BlockStack gap="050">
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t("checkout.summary.deliveryBy", { days: selected.deliveryDays })}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t("checkout.summary.validUntil", { date: formatDateTime(selected.validUntil, locale) })}
                      </Text>
                    </BlockStack>
                  </>
                ) : (
                  <Text as="p" tone="subdued">
                    {manual ? t("buyer.quote.summary") : t("checkout.summary.noOffer")}
                  </Text>
                )}
                {placeErr ? (
                  <Banner tone="critical" announce>
                    {placeErr}
                  </Banner>
                ) : null}
                {manual ? null : (
                <div className={selected ? styles.actionBar : undefined} data-sticky-action={selected ? "" : undefined}>
                  {selected ? (
                    <div className={styles.actionBarTotal}>
                      <button
                        type="button"
                        className={styles.actionBarLink}
                        onClick={() => document.getElementById("summary-title")?.scrollIntoView({ block: "start", behavior: "smooth" })}
                      >
                        {t("buyer.viewSummary")}
                      </button>
                      <Tick value={selected.pay.totalPiasters}>
                        <PriceTag amount={selected.pay.totalPiasters} size="medium" locale={locale} />
                      </Tick>
                    </div>
                  ) : null}
                  <div className={styles.actionBarButton}>
                    <Button variant="primary" size="large" fullWidth onClick={onPrimary} loading={placing} disabled={!selected || loading}>
                      {primaryLabel}
                    </Button>
                  </div>
                </div>
                )}
                <span className="visually-hidden" role="status">
                  {announce}
                </span>
                <Banner tone="info" inCard>
                  {t("checkout.summary.prepaidNote")}
                </Banner>
              </BlockStack>
            </Card>
          </aside>
        </div>
      </BlockStack>
    </Page>
  );
}

/** Re-runs a short "tick" on the price when the value changes (not on first paint). */
function Tick({ value, children }: { value: number; children: ReactNode }) {
  const prev = useRef(value);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setN((x) => x + 1);
  }, [value]);
  return (
    <span key={n} className={n ? styles.tick : undefined}>
      {children}
    </span>
  );
}

function OfferCard({ offer, checked, onSelect, locale }: { offer: CheckoutOffer; checked: boolean; onSelect: () => void; locale: Locale }) {
  const { t } = useI18n();
  const name = locale === "ar" ? offer.vendor.name.ar : offer.vendor.name.en;
  return (
    <label className={styles.offer} data-testid="vendor-offer">
      <input className={styles.radio} type="radio" name="vendor" value={offer.vendorId} checked={checked} onChange={onSelect} aria-label={t("checkout.offers.select", { vendor: name })} />
      <div className={styles.offerHead}>
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <span className={styles.check} aria-hidden="true">
            {checked ? <Icon source={Check} size="small" /> : null}
          </span>
          <BlockStack gap="050">
            <Text as="span" variant="headingSm">
              {name}
            </Text>
            <InlineStack gap="100">
              {offer.badges.map((b) => (
                <Badge key={b} tone={b === "BEST_MATCH" ? "success" : "info"} size="small">
                  {t(`pricing.badge.${b}` as DictKey)}
                </Badge>
              ))}
            </InlineStack>
          </BlockStack>
        </InlineStack>
        <BlockStack gap="050" inlineAlign="end">
          <PriceTag amount={offer.pay.totalPiasters} size="medium" locale={locale} />
          <Text as="span" variant="bodySm" tone="subdued">
            {t("checkout.offers.unit", { price: formatMoney(Math.round(offer.pay.subtotalPiasters / offer.quantity), locale) })}
          </Text>
        </BlockStack>
      </div>
      <div className={styles.offerFacts}>
        <span>
          <Icon source={Truck} size="small" tone="subdued" />
          {t("checkout.offers.delivery", { days: offer.deliveryDays })}
        </span>
        <span>
          <Icon source={Clock} size="small" tone="subdued" />
          {t("checkout.offers.production", { days: offer.leadTimeDays })}
        </span>
        <span aria-label={t("checkout.offers.rating", { rating: offer.vendor.rating.toFixed(1), count: offer.vendor.ratingCount })}>
          <Icon source={Star} size="small" tone="subdued" />
          <bdi>{t("checkout.offers.ratingShort", { rating: offer.vendor.rating.toFixed(1), count: offer.vendor.ratingCount })}</bdi>
        </span>
        <span>{t("checkout.offers.onTime", { pct: Math.round(offer.vendor.onTimePct) })}</span>
        {offer.vendor.verified ? (
          <span>
            <Icon source={BadgeCheck} size="small" tone="subdued" />
            {t("checkout.offers.verified")}
          </span>
        ) : null}
        <span>{t(`pricing.printMethod.${offer.printMethod}` as DictKey)}</span>
        <span>{offer.standardSize ? t("checkout.offers.standardSize") : t("checkout.offers.customDie")}</span>
      </div>
      <div>
        <Link url={`/${locale}/vendors/${offer.vendor.slug}`} external>
          {t("checkout.offers.profile")}
        </Link>
      </div>
    </label>
  );
}

