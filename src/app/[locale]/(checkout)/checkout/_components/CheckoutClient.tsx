"use client";

import { parseWholeInput } from "@/lib/money/input";
import { ORDER_MODE_COPY } from "@/data/catalogue/order-mode";
import { BadgeCheck, Check, Clock, MapPin, Star, Truck } from "lucide-react";
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
import type { SupportContact } from "@/lib/support";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Divider, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/components/ui/Link";
import { Page } from "@/components/ui/Page";
import { PriceTag } from "@/components/ui/PriceTag";
import { Select } from "@/components/ui/Select";
import { SkeletonBodyText } from "@/components/ui/Skeleton";
import { Stepper } from "@/components/ui/Stepper";
import { Text } from "@/components/ui/Text";
import { TextField } from "@/components/ui/TextField";
import { Thumbnail } from "@/components/ui/Thumbnail";
import { getOffersAction, placeOrderAction, requestQuoteAction, type OffersResult } from "../actions";
import { QUOTE_NOTE_MAX } from "../quote-request";
import { formatTaxId, isValidTaxId } from "@/lib/orders/company";
// Pre-select the best match, the offer the public page and designer badge quote (B-26).
import { checkoutVendor, headlineOffer } from "@/lib/pricing/headline";
import type { DocSpec } from "@/lib/library/spec";
import { arrivalDate } from "./arrival";
import { HelpBox } from "./HelpBox";
import styles from "./checkout.module.css";

// The proof viewer pulls the model library, dieline engine and three.js: load it only when the
// buyer reaches the review step, so step 1 stays light (PERF-03). docSpec is computed on the server.
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

/**
 * Simplified journey (docs/audit/simplicity-2026-11/flows.md): 0 = quantity (printer picked for
 * the buyer), 1 = address + design approval. Payment is step 3 of 3 on its own page.
 */
type Step = 0 | 1;
type AddressErrors = Partial<Record<keyof AddressState, string>>;
/** Steps the buyer sees, the payment page included. */
export const CHECKOUT_STEP_COUNT = 3;
/** The quantity most buyers pick; labelled "Most ordered" and preselected by the server. */
const POPULAR_QTY = 500;

/** Lines in the summary: label from the dictionary key the pricing engine set. */
function lineLabel(t: (k: DictKey, v?: Record<string, string | number>) => string, l: QuoteLine): string {
  const map: Record<string, DictKey> = {
    "pricing.line.product": "pricing.line.product",
    "pricing.line.setup": "pricing.line.setup",
    // R1-10: «فورمة التكسير» is trade talk; the buyer reads a one-time setup for their size.
    "pricing.line.die": "buyer.easy.dieLine",
    "pricing.line.shipping": "checkout.summary.shipping",
    "pricing.line.discount": "pricing.line.discount",
  };
  return t((map[l.labelKey] ?? l.labelKey) as DictKey);
}

function addressComplete(a: AddressState): boolean {
  return a.name.trim().length >= 2 && !!normalizeEgyptPhone(a.phone) && !!a.governorate && a.city.trim().length >= 2 && a.street.trim().length >= 3;
}


export function CheckoutClient(props: {
  locale: Locale;
  designId: string;
  doc: DesignDoc;
  /** The buyer's name for the design, or the box's everyday name when it has none (R1-18). */
  designName: string;
  /** Everyday name of the box and its size: "Mailer box 25 × 18 × 8 cm". */
  boxLabel: string;
  /** The saved render of the design, or the model's drawing. */
  thumbnail: string;
  editUrl: string;
  tiers: TierPrice[];
  initialQty: number;
  initial: OffersResult;
  defaultAddress: AddressState;
  spec: DocSpec;
  /** Buyer's mobile number, formatted, for the "we will reply on …" line of a quote request. */
  contactPhone: string;
  /** Paid sample offer (B-05), or null when samples are off or the monthly cap is reached. */
  sample: { pieces: number; pricePiasters: number; totalPiasters?: number | null; creditDays: number } | null;
  /** Prepayment discount in percent (B-11). */
  prepayDiscountPct: number;
  /** Smallest run any printer takes (R4-CR-07). */
  minQty: number;
  /** R4-B-03: a price the team sent for this buyer's request (fixed quantity, printer and total). */
  quoted?: { id: string; quantity: number; validUntil: string } | null;
  /** The `?quote=` link is expired, used or not this buyer's: say so above the normal checkout. */
  quoteInvalid?: boolean;
  /** Saved company invoice details (B-13). */
  defaultCompany: { name: string; taxId: string; commercialRegister: string } | null;
  /** Production preflight run on the server with the designer's rules (B-04). */
  preflight: { ready: boolean; errors: number; warnings: number; issues: { code: string; severity: "error" | "warning" | "info"; face?: string }[] };
  /** Help line (ELBA_SUPPORT_PHONE), or null. */
  support?: SupportContact | null;
}) {
  const { locale, designId, doc, editUrl } = props;
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [qty, setQty] = useState(props.initialQty);
  const [customQty, setCustomQty] = useState("");
  const [customErr, setCustomErr] = useState<string | undefined>();
  const [customOpen, setCustomOpen] = useState(false);
  const [result, setResult] = useState<OffersResult>(props.initial);
  const [vendorId, setVendorId] = useState<string | null>(props.initial.ok && props.initial.mode === "instant" ? (headlineOffer(props.initial.offers)?.vendorId ?? null) : null);
  const [loading, startLoading] = useTransition();
  const [address, setAddress] = useState<AddressState>(props.defaultAddress);
  // A remembered, complete address shows as one line with "Change address" (SIM-07).
  const [editAddress, setEditAddress] = useState(() => !addressComplete(props.defaultAddress));
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const [approved, setApproved] = useState(false);
  const [approveErr, setApproveErr] = useState<string | undefined>();
  const [placing, setPlacing] = useState(false);
  const [placeErr, setPlaceErr] = useState<string | null>(null);
  const [shippingNote, setShippingNote] = useState<string | null>(null);
  const [sampleMode, setSampleMode] = useState(false);
  const [company, setCompany] = useState(props.defaultCompany ?? { name: "", taxId: "", commercialRegister: "" });
  // A saved company without a valid tax number used to switch the tax fields on and block the
  // buyer with an error they never asked for; only a complete one is preselected.
  const [wantCompany, setWantCompany] = useState(!!props.defaultCompany && isValidTaxId(props.defaultCompany.taxId));
  const wantCompanyAtStart = useRef(wantCompany);
  const [companyErr, setCompanyErr] = useState<{ name?: string; taxId?: string }>({});
  const [quoteNote, setQuoteNote] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  /** Quantities a quote request was sent for in this visit (re-sending the same one is a no-op on the server). */
  const [quoteSent, setQuoteSent] = useState<number | null>(null);
  const headingRefs = [useRef<HTMLHeadingElement>(null), useRef<HTMLHeadingElement>(null)];
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

  /** A printer the buyer chose themselves under "More options" (null: Elba's best match). */
  const pickedVendor = useRef<string | null>(null);
  /** Only the latest re-price may land: an older reply (the Cairo price) never overwrites a newer one. */
  const fetchSeq = useRef(0);
  const fetchOffers = useCallback(
    (quantity: number, governorate: string, after?: () => void, sample = false) => {
      const seq = ++fetchSeq.current;
      startLoading(async () => {
        const r = await getOffersAction({ designId, quantity, governorate: governorate || undefined, sample });
        if (seq !== fetchSeq.current) return;
        setResult(r);
        // R3-01: the printer follows from the new offers only (best match, or the buyer's own pick),
        // never from the one chosen for the previous address, so the same order and governorate
        // always get the same printer, price and date.
        setVendorId(r.ok && r.mode === "instant" ? checkoutVendor(r.offers, pickedVendor.current) : null);
        after?.();
      });
    },
    [designId],
  );

  const pickSample = () => {
    if (!props.sample) return;
    setSampleMode(true);
    setQty(props.sample.pieces);
    setCustomQty("");
    setCustomErr(undefined);
    fetchOffers(props.sample.pieces, address.governorate, undefined, true);
  };

  const pickQty = (q: number) => {
    setSampleMode(false);
    setQty(q);
    setCustomQty("");
    setCustomErr(undefined);
    fetchOffers(q, address.governorate);
  };

  const applyCustom = () => {
    // R5-JR-21: "5.000" used to be read as 5 boxes, and Persian digits were refused.
    const n = parseWholeInput(customQty) ?? NaN;
    // R4-B-09 / R4-CR-07: one honest message per case; above 2,000 is a price request, not an error.
    if (!Number.isInteger(n) || n < 1) {
      setCustomErr(t("buyer.qty.invalid", { max: MAX_INSTANT_QTY }));
      return;
    }
    if (n < props.minQty) {
      setCustomErr(t(props.sample ? "buyer.qty.belowMinSample" : "buyer.qty.belowMin", { min: props.minQty }));
      return;
    }
    if (n > MAX_REQUEST_QTY) {
      setCustomErr(t("buyer.qty.tooLarge", { max: MAX_REQUEST_QTY }));
      return;
    }
    setCustomErr(undefined);
    setSampleMode(false);
    // Echo the applied quantity grouped ("5000" -> "5,000"), as every other figure on the page.
    setCustomQty(n.toLocaleString("en-US"));
    setQty(n);
    fetchOffers(n, address.governorate);
  };

  // Delivery price depends on the governorate: re-price when it changes.
  const isQuoted = !!props.quoted;
  useEffect(() => {
    if (isQuoted) return; // the sent price includes delivery to the governorate it was asked for
    if (address.governorate === lastGov.current) return;
    lastGov.current = address.governorate;
    if (!address.governorate) return;
    // A new governorate is a new delivery: Elba picks the best printer for it again (R3-01).
    pickedVendor.current = null;
    const g = GOVERNORATES.find((x) => x.name === address.governorate);
    fetchOffers(
      qty,
      address.governorate,
      () => setShippingNote(g ? t("checkout.address.shippingChanged", { governorate: t(`governorates.${g.key}` as DictKey) }) : null),
      sampleMode,
    );
  }, [address.governorate, qty, fetchOffers, t, sampleMode, isQuoted]);

  const manual = result.ok && result.mode === "manual_quote";
  // B-16: the model itself is priced by quote (any quantity), not only runs above the cap.
  const modelQuote = (r: OffersResult) => r.ok && r.mode === "manual_quote" && r.reason === "MODEL_BY_QUOTE";
  const byQuote = modelQuote(result) || modelQuote(props.initial);

  const requestQuote = async () => {
    setQuoteErr(null);
    setQuoteBusy(true);
    const r = await requestQuoteAction({ designId, quantity: qty, governorate: address.governorate || undefined, note: quoteNote.trim() || undefined, neededBy: neededBy || undefined });
    setQuoteBusy(false);
    if (r.ok) {
      setQuoteSent(qty);
      requestAnimationFrame(() => document.getElementById("quote-sent")?.focus());
      return;
    }
    const key = `checkout.errors.${r.error}` as DictKey;
    setQuoteErr(t(key) === key ? t("checkout.errors.generic") : t(key));
  };

  // R8-05: each step is a history entry, so the browser's Back and Forward move between steps
  // (on phones Back used to leave checkout from a later step and drop the typed address).
  const showStep = (s: Step) => {
    setStep(s);
    requestAnimationFrame(() => {
      const h = headingRefs[s].current;
      h?.focus({ preventScroll: true });
      h?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
    });
  };
  const goTo = (s: Step) => {
    if (typeof window !== "undefined") {
      if (s > step) window.history.pushState({ ...window.history.state, checkoutStep: s }, "");
      else if (s < step && window.history.state?.checkoutStep === step) {
        // The in-page Back (and an error that sends the buyer to an earlier step) goes through
        // history too, so the browser's Forward still works and no stale entries pile up.
        window.history.go(s - step);
        return;
      }
    }
    showStep(s);
  };
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = Math.min(1, e.state?.checkoutStep ?? 0) as Step;
      showStep(target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // showStep only reads refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // R9 (integrator decision, PDPL 151/2020 data minimisation): a reload keeps the checkout where
  // it was without storing any personal data in the browser. The step comes from the history entry
  // (browsers keep history.state across a reload); quantity, sample and printer choice come from
  // sessionStorage. The address is never stored on the client: it is re-filled from the server
  // (last order or account), and if that is incomplete the address form opens on the review step.
  const draftKey = `elba:checkout:${designId}`;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || props.quoted) return;
    restored.current = true;
    // Only a reload or a Back/Forward return restores; opening checkout again starts fresh.
    const nav = (performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
    if (nav !== "reload" && nav !== "back_forward") {
      try {
        window.sessionStorage.removeItem(draftKey);
      } catch {
        /* storage blocked */
      }
      return;
    }
    let draft: { qty?: number; sample?: boolean; vendorId?: string | null } = {};
    try {
      draft = JSON.parse(window.sessionStorage.getItem(draftKey) ?? "{}") as typeof draft;
    } catch {
      /* storage blocked or malformed: start fresh */
    }
    if (draft.sample && props.sample) pickSample();
    else if (typeof draft.qty === "number" && Number.isInteger(draft.qty) && draft.qty >= 1 && draft.qty !== qty) {
      setQty(draft.qty);
      fetchOffers(draft.qty, address.governorate);
    }
    if (draft.vendorId) {
      pickedVendor.current = draft.vendorId;
      setVendorId(draft.vendorId);
    }
    const savedStep = window.history.state?.checkoutStep as number | undefined;
    if (savedStep && savedStep > 0) {
      if (savedStep !== 1) window.history.replaceState({ ...window.history.state, checkoutStep: 1 }, "");
      showStep(1);
    }
    // Runs once on mount with the server-rendered state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (props.quoted) return;
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify({ qty, sample: sampleMode, vendorId: pickedVendor.current === vendorId ? vendorId : null }));
    } catch {
      /* storage blocked: the checkout still works, it just restarts on reload */
    }
  }, [draftKey, qty, sampleMode, vendorId, props.quoted]);

  const validateCompany = (): boolean => {
    if (!wantCompany) return true;
    const e: { name?: string; taxId?: string } = {};
    if (company.name.trim().length < 2) e.name = t("checkout.address.required");
    if (!isValidTaxId(company.taxId)) e.taxId = t("buyer.company.taxIdInvalid");
    setCompanyErr(e);
    return !e.name && !e.taxId;
  };

  /** Each message says what to write, not just "Required" (SIM-07). */
  const validateAddress = (): boolean => {
    const e: AddressErrors = {};
    if (address.name.trim().length < 2) e.name = t("buyer.easy.errors.name");
    if (!normalizeEgyptPhone(address.phone)) e.phone = t("buyer.easy.errors.phone");
    if (!address.governorate) e.governorate = t("buyer.easy.errors.governorate");
    if (address.city.trim().length < 2) e.city = t("buyer.easy.errors.city");
    if (address.street.trim().length < 3) e.street = t("buyer.easy.errors.street");
    setAddrErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      setEditAddress(true);
      requestAnimationFrame(() => document.getElementById(`addr-${first}`)?.focus());
      return false;
    }
    if (!validateCompany()) {
      setEditAddress(true);
      requestAnimationFrame(() => document.getElementById(company.name.trim().length < 2 ? "company-name" : "company-tax")?.focus());
      return false;
    }
    return true;
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
    if (!validateAddress()) {
      setPlaceErr(t("buyer.easy.errors.missing"));
      return;
    }
    // R1-11: one tick approves the design and, when there are print-check notes, accepts them.
    if (!approved) {
      setApproveErr(t("buyer.easy.errors.approve"));
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
      sample: sampleMode || undefined,
      company: wantCompany ? { name: company.name.trim(), taxId: company.taxId, commercialRegister: company.commercialRegister.trim() } : null,
      acknowledgePreflight: props.preflight.errors > 0 ? approved : undefined,
      quoteId: props.quoted?.id,
    });
    if (r.ok) {
      try {
        window.sessionStorage.removeItem(draftKey);
      } catch {
        /* storage blocked */
      }
      router.push(`/${locale}/checkout/pay/${r.orderId}`);
      return;
    }
    setPlacing(false);
    if (r.error === "OFFER_UNAVAILABLE") {
      fetchOffers(qty, address.governorate);
      goTo(0);
    }
    if (r.error === "PREFLIGHT_BLOCKED") setApproveErr(t("buyer.preflight.overrideRequired"));
    if (r.error === "INVALID" && r.fields?.some((f) => f.startsWith("address") || f.startsWith("company"))) {
      validateAddress();
      setEditAddress(true);
    }
    const key = `checkout.errors.${r.error}` as DictKey;
    setPlaceErr(t(key) === key ? t("checkout.errors.generic") : t(key));
  };

  const primaryLabel = step === 1 ? (placing ? t("checkout.actions.placing") : t("buyer.easy.actions.toPay")) : t("buyer.easy.actions.toAddress");
  const governorateOptions = useMemo(
    () => GOVERNORATES.map((g) => ({ value: g.name, label: t(`governorates.${g.key}` as DictKey) })),
    [t],
  );
  const govLabel = (name: string) => {
    const g = GOVERNORATES.find((x) => x.name === name);
    return g ? t(`governorates.${g.key}` as DictKey) : name;
  };
  const set = (k: keyof AddressState) => (v: string) => {
    setAddress((a) => ({ ...a, [k]: v }));
    if (addrErrors[k]) setAddrErrors((e) => ({ ...e, [k]: undefined }));
  };

  const steps = [
    { id: "quantity", label: t("buyer.easy.steps.quantity") },
    { id: "review", label: t("buyer.easy.steps.review") },
    { id: "payment", label: t("buyer.easy.steps.pay") },
  ];
  // a11y R6-AX-12 (WCAG 2.4.2): each step is its own history entry, so its title names the step
  // ("Address and approval · Checkout · Elba"), in the history list and for screen readers.
  const baseTitle = useRef<string | null>(null);
  useEffect(() => {
    if (baseTitle.current === null) baseTitle.current = document.title;
    const label = steps[step]?.label;
    document.title = step > 0 && label ? `${label} · ${baseTitle.current}` : baseTitle.current;
    // steps only changes with the locale; the step is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // SIM-03: four lines a shop owner understands; the engine's full breakdown sits behind "Price details".
  const exVat = selected ? selected.pay.totalPiasters - selected.pay.vatPiasters : 0;
  // R3-01: one line, before paying, when the governorate changes what the designer showed
  // (its price and days are for delivery to Greater Cairo).
  const reference = result.ok && result.mode === "instant" && !sampleMode && !props.quoted && !result.credit ? result.reference : null;
  const unitNow = selected && qty > 0 ? Math.round(exVat / qty) : 0;
  const designerDiff =
    selected && reference && (reference.unitPiasters !== unitNow || reference.deliveryDays !== selected.deliveryDays)
      ? t("buyer.easy.designerDiff", {
          price: formatMoney(reference.unitPiasters, locale),
          days: reference.deliveryDays,
          governorate: govLabel(address.governorate),
          newPrice: formatMoney(unitNow, locale),
          date: arrivalDate(selected.deliveryDays, locale),
        })
      : null;

  // ── step bodies ───────────────────────────────────────────────────
  const others = selected ? offers.filter((o) => o.vendorId !== selected.vendorId) : offers;
  // R1-13: Elba picks the printer and stands behind the order, so the buyer reads one promise,
  // not a printer to manage. The printer's name and the other offers sit behind "More options".
  const cityKey = selected ? (`cities.${selected.vendor.city}` as DictKey) : null;
  const printerBlock = selected ? (
    <div className={styles.printer} data-testid="chosen-printer">
      <span className={styles.printerIcon} aria-hidden="true">
        <Icon source={BadgeCheck} tone="success" />
      </span>
      <BlockStack gap="050">
        <Text as="p" fontWeight="semibold">
          {cityKey && t(cityKey) !== cityKey ? t("buyer.easy.printerTitle", { city: t(cityKey) }) : t("buyer.easy.printerTitleNoCity")}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {t("buyer.easy.printerBody")}
        </Text>
        <Text as="p" variant="bodySm">
          <Icon source={Truck} size="small" tone="subdued" /> <span suppressHydrationWarning>{t("buyer.easy.arrives", { date: arrivalDate(selected.deliveryDays, locale) })}</span>{" "}
          <Text as="span" variant="bodySm" tone="subdued">
            ({t("buyer.easy.arrivesNote")})
          </Text>
        </Text>
      </BlockStack>
    </div>
  ) : null;

  const offerStep = (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <fieldset className={styles.tiers} aria-describedby="qty-help">
          <legend className="visually-hidden">{t("buyer.easy.qtyTitle")}</legend>
          {props.tiers.map((tier) => (
            <label key={tier.quantity} className={styles.tier}>
              <input
                className={styles.radio}
                type="radio"
                name="qty"
                value={tier.quantity}
                checked={!sampleMode && qty === tier.quantity}
                disabled={tier.unitPiasters === null && !byQuote}
                onChange={() => pickQty(tier.quantity)}
              />
              <span className={styles.tierMain}>
                <span className={styles.check} aria-hidden="true">
                  {!sampleMode && qty === tier.quantity ? <Icon source={Check} size="small" /> : null}
                </span>
                <Text as="span" variant="headingSm" numeric>
                  {t("checkout.summary.quantity", { qty: tier.quantity.toLocaleString("en-US") })}
                </Text>
                {tier.quantity === POPULAR_QTY && tier.unitPiasters !== null ? (
                  <Badge tone="success" size="small">
                    {t("buyer.easy.popular")}
                  </Badge>
                ) : null}
              </span>
              <span className={styles.tierPrice}>
                {tier.unitPiasters === null ? (
                  <Text as="span" variant="bodySm" tone="subdued">
                    {byQuote ? t("buyer.qty.byQuote") : t("checkout.quantity.unavailable")}
                  </Text>
                ) : (
                  <>
                    {tier.totalPiasters !== null ? (
                      <Text as="span" fontWeight="semibold" numeric>
                        {t("buyer.easy.tierTotal", { total: formatMoney(tier.totalPiasters, locale) })}
                      </Text>
                    ) : null}
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t("checkout.quantity.perBox", { price: formatMoney(tier.unitPiasters, locale, { alwaysDecimals: true }) })}
                    </Text>
                  </>
                )}
              </span>
            </label>
          ))}
          {props.sample ? (
            <label className={`${styles.tier} ${styles.sampleTier}`}>
              <input className={styles.radio} type="radio" name="qty" value="sample" checked={sampleMode} onChange={pickSample} aria-describedby="sample-help" />
              <span className={styles.tierMain}>
                <span className={styles.check} aria-hidden="true">
                  {sampleMode ? <Icon source={Check} size="small" /> : null}
                </span>
                <Text as="span" variant="headingSm">
                  {t("buyer.sample.tier", { pieces: props.sample.pieces })}
                </Text>
              </span>
              <span className={styles.tierPrice}>
                {/* R2-09: the full sample price, delivery and VAT in, like the other rows and /pricing. */}
                {props.sample.totalPiasters ? (
                  <Text as="span" fontWeight="semibold" numeric>
                    {t("buyer.sample.total", { total: formatMoney(props.sample.totalPiasters, locale, { alwaysDecimals: true }) })}
                  </Text>
                ) : (
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t("buyer.sample.price", { price: formatMoney(props.sample.pricePiasters, locale, { alwaysDecimals: true }) })}
                  </Text>
                )}
              </span>
            </label>
          ) : null}
        </fieldset>
        {props.sample ? (
          <Text as="p" variant="bodySm" tone="subdued" id="sample-help">
            {t("buyer.sample.help", { days: props.sample.creditDays })}
          </Text>
        ) : null}
        <Text as="p" variant="bodySm" tone="subdued" id="qty-help">
          {byQuote ? t("buyer.qty.byQuoteHelp") : t("buyer.easy.qtyHelp")}
        </Text>
        {customOpen || customErr || customQty ? (
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
                id="custom-qty"
                label={t("buyer.easy.otherQtyLabel")}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("buyer.qtyRange", { min: props.minQty.toLocaleString("en-US"), max: MAX_INSTANT_QTY.toLocaleString("en-US") })}
                value={customQty}
                onChange={setCustomQty}
                error={customErr}
                dir="ltr"
              />
            </div>
            <div className={styles.customApply}>
              <Button submit size="large" disabled={!customQty.trim() || loading}>
                {t("checkout.quantity.apply")}
              </Button>
            </div>
          </form>
        ) : (
          <InlineStack>
            <Button
              variant="plain"
              onClick={() => {
                setCustomOpen(true);
                requestAnimationFrame(() => document.getElementById("custom-qty")?.focus());
              }}
            >
              {t("buyer.easy.otherQty")}
            </Button>
          </InlineStack>
        )}
      </BlockStack>

      <Divider />

      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <BlockStack gap="200">
            <span className="visually-hidden">{t("checkout.offers.loading")}</span>
            <SkeletonBodyText lines={3} />
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
                // a11y R5-AX-11: no `announce` here; the polite offers region above already reads
                // it and focus moves onto it, so a nested status made screen readers say it twice.
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
                  <Text as="h3" variant="headingSm">
                    {t("buyer.quote.title", { qty: qty.toLocaleString("en-US") })}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {result.reason === "MODEL_BY_QUOTE"
                      ? ORDER_MODE_COPY[result.orderReason ?? "QUOTE_ONLY_STOCK"][locale]
                      : t("buyer.quote.body", { max: MAX_INSTANT_QTY.toLocaleString("en-US") })}
                  </Text>
                </BlockStack>
                <div className={styles.neededBy}>
                  <TextField
                    label={t("buyer.quote.neededBy")}
                    type="date"
                    autoComplete="off"
                    dir="ltr"
                    value={neededBy}
                    onChange={setNeededBy}
                    optional
                  />
                </div>
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
                  <Button variant="primary" size="large" submit loading={quoteBusy}>
                    {t("buyer.quote.send")}
                  </Button>
                  {byQuote ? null : (
                    <Button variant="plain" onClick={() => pickQty(MAX_INSTANT_QTY)} disabled={quoteBusy}>
                      {t("buyer.manualOrderMax", { max: MAX_INSTANT_QTY.toLocaleString("en-US") })}
                    </Button>
                  )}
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
          <BlockStack gap="300">
            {result.credit ? (
              <Banner tone="success" title={t("buyer.sample.creditTitle", { amount: formatMoney(result.credit.piasters, locale) })}>
                {t("buyer.sample.creditBody", { number: result.credit.sampleNumber, date: formatDateTime(result.credit.expiresAt, locale) })}
              </Banner>
            ) : null}
            {result.sample ? (
              <Banner tone="info" title={t("buyer.sample.modeTitle", { pieces: qty })}>
                {t("buyer.sample.modeBody")}
              </Banner>
            ) : null}
            {/* SIM-01: the best match is chosen for the buyer; comparing printers is optional. */}
            {printerBlock}
            {others.length > 0 ? (
              <details className={styles.disclosure} data-testid="printer-options">
                <summary>{t("buyer.easy.printerChange")}</summary>
                <fieldset className={styles.offers} id="other-printers">
                  <legend className={styles.legendSm}>{t("buyer.easy.printerOthers")}</legend>
                  {offers.map((o) => (
                    <OfferCard key={o.vendorId} offer={o} checked={o.vendorId === vendorId} onSelect={() => {
                      pickedVendor.current = o.vendorId;
                      setVendorId(o.vendorId);
                    }} locale={locale} sample={!!result.sample} prepayPct={props.prepayDiscountPct} />
                  ))}
                </fieldset>
              </details>
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
  );

  // R4-B-03: ordering at the price the team sent. One offer, nothing to choose; the request's
  // quantity and governorate are fixed by that price.
  const quotedOfferStep = props.quoted ? (
    <BlockStack gap="400">
      <Banner tone="info" title={t("buyer.quoted.title", { qty: props.quoted.quantity })}>
        {t("buyer.quoted.body", { date: formatDateTime(props.quoted.validUntil, locale) })}
      </Banner>
      {printerBlock}
    </BlockStack>
  ) : null;

  const addressLine = [address.street, address.building, address.floor && `${t("checkout.address.floor")} ${address.floor}`, address.apartment && `${t("checkout.address.apartment")} ${address.apartment}`]
    .filter(Boolean)
    .join(locale === "ar" ? "، " : ", ");
  const addressSection = !editAddress ? (
    <div className={styles.savedAddress} data-testid="saved-address">
      <span className={styles.printerIcon} aria-hidden="true">
        <Icon source={MapPin} tone="subdued" />
      </span>
      <BlockStack gap="050">
        <Text as="p" variant="bodySm" tone="subdued">
          {t("buyer.easy.address.saved")}
        </Text>
        {/* Typed text can be in either script: isolate it so digits and commas do not reorder. */}
        <Text as="p" fontWeight="semibold">
          <bdi>{address.name}</bdi>
        </Text>
        <Text as="p">
          <bdi>{addressLine}</bdi>
        </Text>
        <Text as="p">
          <bdi>{address.city}</bdi>
          {locale === "ar" ? "، " : ", "}
          {govLabel(address.governorate)}
        </Text>
        <Text as="p">
          <bdi dir="ltr">{address.phone}</bdi>
        </Text>
        {wantCompany && company.name ? (
          <Text as="p" variant="bodySm" tone="subdued">
            {company.name}
          </Text>
        ) : null}
        <InlineStack>
          <Button
            variant="plain"
            onClick={() => {
              setEditAddress(true);
              requestAnimationFrame(() => document.getElementById("addr-name")?.focus());
            }}
          >
            {t("buyer.easy.address.edit")}
          </Button>
        </InlineStack>
      </BlockStack>
    </div>
  ) : (
    <BlockStack gap="300">
      <Text as="p" variant="bodySm" tone="subdued">
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
          disabled={!!props.quoted}
          helpText={props.quoted ? t("buyer.quoted.governorate") : undefined}
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
      {/* `open` is fixed from the server values: a prop that changes while typing would close it. */}
      <details className={styles.disclosure} open={!!(props.defaultAddress.landmark || props.defaultAddress.notes) || undefined}>
        <summary>{t("buyer.easy.address.more")}</summary>
        <BlockStack gap="300">
          <TextField label={t("checkout.address.landmark")} autoComplete="off" value={address.landmark} onChange={set("landmark")} optional />
          <TextField label={t("checkout.address.notes")} autoComplete="off" value={address.notes} onChange={set("notes")} multiline={2} maxLength={300} optional />
        </BlockStack>
      </details>
      <details className={styles.disclosure} open={wantCompanyAtStart.current || undefined}>
        <summary>{t("buyer.easy.address.company")}</summary>
        <BlockStack gap="300">
          <Checkbox
            id="company-toggle"
            label={t("buyer.company.toggle")}
            helpText={t("buyer.company.toggleHelp")}
            checked={wantCompany}
            onChange={(c) => {
              setWantCompany(c);
              if (!c) setCompanyErr({});
            }}
          />
          {wantCompany ? (
            <div className={styles.companyFields}>
              <TextField
                id="company-name"
                label={t("buyer.company.name")}
                autoComplete="organization"
                value={company.name}
                onChange={(v) => {
                  setCompany((c) => ({ ...c, name: v }));
                  if (companyErr.name) setCompanyErr((e) => ({ ...e, name: undefined }));
                }}
                error={companyErr.name}
                requiredIndicator
              />
              <div className={styles.grid2}>
                <TextField
                  id="company-tax"
                  label={t("buyer.company.taxId")}
                  helpText={t("buyer.company.taxIdHelp")}
                  inputMode="numeric"
                  autoComplete="off"
                  dir="ltr"
                  value={company.taxId}
                  onChange={(v) => {
                    setCompany((c) => ({ ...c, taxId: v }));
                    if (companyErr.taxId) setCompanyErr((e) => ({ ...e, taxId: undefined }));
                  }}
                  onBlur={() => setCompany((c) => ({ ...c, taxId: formatTaxId(c.taxId) }))}
                  error={companyErr.taxId}
                  requiredIndicator
                />
                <TextField
                  label={t("buyer.company.cr")}
                  autoComplete="off"
                  dir="ltr"
                  value={company.commercialRegister}
                  onChange={(v) => setCompany((c) => ({ ...c, commercialRegister: v }))}
                  optional
                />
              </div>
            </div>
          ) : null}
        </BlockStack>
      </details>
      {/* R3-01: where the governorate is chosen, say what it changes against the designer, once. */}
      {designerDiff ? (
        <p className={styles.designerDiff} role="status" suppressHydrationWarning>
          {designerDiff}
        </p>
      ) : shippingNote ? (
        <Text as="p" variant="bodySm" tone="subdued">
          <span role="status">{shippingNote}</span>
        </Text>
      ) : null}
    </BlockStack>
  );

  const spec = props.spec;
  // R1-11: print-check notes in plain words, one line per kind of note (not one per layer), shown
  // as a calm amber note, never as «مشكلة». The one approval tick below also accepts them.
  const notes = props.preflight.issues
    .filter((i) => i.severity !== "info" || i.code === "EMPTY_DESIGN")
    .filter((i, n, all) => all.findIndex((j) => j.code === i.code && j.face === i.face) === n)
    .slice(0, 4);
  const lowRes = notes.some((i) => i.code === "LOW_DPI");
  const noteText = (code: string) => {
    const plain = `buyer.preflight.plain.${code}` as DictKey;
    return t(plain) === plain ? t(`preflight.${code}` as DictKey) : t(plain);
  };
  const faceText = (face?: string) => {
    if (!face) return "";
    const key = `designer.faces.${face}` as DictKey;
    return t(key) === key ? "" : ` ${t("buyer.preflight.where", { face: t(key) })}`;
  };
  const hasNotes = !props.preflight.ready && notes.length > 0;
  const proofSection = (
    <BlockStack gap="300">
      <Text as="p">{t("buyer.easy.proof.help")}</Text>
      <ProofViewer doc={doc} handleRef={sceneRef} />
      <section className={styles.preflight} aria-labelledby="preflight-title" data-state={hasNotes ? "warning" : "ready"}>
        {!hasNotes ? (
          <p className={styles.preflightLine} id="preflight-title">
            <Icon source={BadgeCheck} size="small" tone="success" />
            {t("buyer.easy.proof.ready")}
          </p>
        ) : (
          <>
            <Text as="h4" variant="headingSm" id="preflight-title">
              {t("buyer.easy.proof.issues")}
            </Text>
            <ul className={styles.preflightList}>
              {notes.map((i, n) => (
                <li key={n}>
                  <span>
                    {noteText(i.code)}
                    {faceText(i.face)}
                  </span>
                </li>
              ))}
            </ul>
            <InlineStack gap="200">
              <Button url={editUrl}>{lowRes ? t("buyer.preflight.biggerImage") : t("buyer.preflight.fix")}</Button>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              {t("buyer.preflight.asIsHelp")}
            </Text>
          </>
        )}
      </section>
      <details className={styles.disclosure}>
        <summary>{t("buyer.easy.proof.details")}</summary>
        <BlockStack gap="300">
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
          <BlockStack as="ul" gap="100" className={styles.checklist}>
            <Text as="li">{t("checkout.proof.check1")}</Text>
            <Text as="li">{t("checkout.proof.check2")}</Text>
            <Text as="li">{t("checkout.proof.check3")}</Text>
          </BlockStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {t("checkout.proof.recorded")}
          </Text>
        </BlockStack>
      </details>
      <InlineStack>
        <Button variant="plain" url={editUrl}>
          {t("buyer.easy.proof.edit")}
        </Button>
      </InlineStack>
      <div className={styles.approve}>
        <Checkbox
          id="proof-approve"
          label={hasNotes ? t("buyer.easy.proof.approveAsIs") : t("buyer.easy.proof.approve")}
          helpText={t("buyer.easy.proof.approveHelp")}
          checked={approved}
          onChange={(c) => {
            setApproved(c);
            if (c) setApproveErr(undefined);
          }}
          error={approveErr}
        />
      </div>
      <section className={styles.nextSteps} aria-labelledby="proof-next">
        <Text as="h4" variant="headingSm" id="proof-next">
          {t("buyer.easy.proof.nextTitle")}
        </Text>
        <ol className={styles.nextList}>
          <li>{t("buyer.easy.proof.next1")}</li>
          <li>{t("buyer.easy.proof.next2")}</li>
          <li>{t("buyer.easy.proof.next3")}</li>
        </ol>
      </section>
    </BlockStack>
  );

  const reviewStep = (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <Text as="h3" variant="headingMd">
          {t("buyer.easy.address.title")}
        </Text>
        {addressSection}
      </BlockStack>
      <Divider />
      <BlockStack gap="200">
        <Text as="h3" variant="headingMd">
          {t("buyer.easy.proof.title")}
        </Text>
        {proofSection}
      </BlockStack>
    </BlockStack>
  );

  const stepTitles = [byQuote || manual ? t("checkout.quantity.title") : t("buyer.easy.qtyTitle"), t("buyer.easy.steps.review")];
  const bodies = [quotedOfferStep ?? offerStep, reviewStep];


  return (
    <Page
      title={t("checkout.title")}
      subtitle={props.designName}
      backAction={step > 0 ? { content: stepTitles[step - 1], onAction: () => goTo((step - 1) as Step) } : { content: props.designName, url: editUrl }}
    >
      <BlockStack gap="400">
        {props.quoteInvalid ? (
          <Banner tone="warning" title={t("buyer.quoted.invalidTitle")}>
            {t("buyer.quoted.invalidBody")}
          </Banner>
        ) : null}
        <div className={styles.stepperWide}>
          <Card>
            <Stepper steps={steps} current={step} accessibilityLabel={t("checkout.steps.label")} />
          </Card>
        </div>
        <div className={styles.stepperCompact} aria-hidden="true">
          <div className={styles.compactHead}>
            <span className={styles.compactCount}>{t("checkout.stepOf", { current: step + 1, total: CHECKOUT_STEP_COUNT })}</span>
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
                  <span className="visually-hidden">{t("checkout.stepOf", { current: step + 1, total: CHECKOUT_STEP_COUNT })}: </span>
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
            <BlockStack gap="400">
              <Card title={<span id="summary-title">{t("buyer.easy.summaryTitle")}</span>}>
                <BlockStack gap="300">
                  {/* R1-18: the buyer's own box, by name and picture, on every step. */}
                  <div className={styles.summaryBox} data-testid="summary-box">
                    <Thumbnail source={props.thumbnail} alt="" size="medium" />
                    <BlockStack gap="050">
                      <Text as="p" fontWeight="semibold">
                        <bdi>{props.designName}</bdi>
                      </Text>
                      {props.designName !== props.boxLabel ? (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {props.boxLabel}
                        </Text>
                      ) : null}
                    </BlockStack>
                  </div>
                  {selected ? (
                    <>
                      <dl className={styles.lines}>
                        {/* R2-02: delivery is in the per-box price the buyer chose, so it is not a second
                            summed row: boxes (all-in, ex-VAT) + VAT = total. The split is in "Price details". */}
                        <div className={styles.line}>
                          <dt>
                            {sampleMode ? t("buyer.sample.line") : t("buyer.easy.boxes", { qty: qty.toLocaleString("en-US") })}
                            <span className={styles.totalNote}>{t(sampleMode ? "buyer.easy.inclDelivery" : selected.pay.discountPiasters > 0 ? "buyer.easy.inclAll" : "buyer.easy.inclNoDiscount")}</span>
                          </dt>
                          <dd>
                            <PriceTag alwaysDecimals amount={exVat} size="small" locale={locale} />
                          </dd>
                        </div>
                        <div className={styles.line}>
                          <dt>{t("buyer.easy.vat")}</dt>
                          <dd>
                            <Tick value={selected.pay.vatPiasters}>
                              <PriceTag alwaysDecimals amount={selected.pay.vatPiasters} size="small" locale={locale} />
                            </Tick>
                          </dd>
                        </div>
                        <div className={`${styles.line} ${styles.lineTotal}`}>
                          <dt>
                            {t("buyer.easy.total")}
                            <span className={styles.totalNote}>{t("buyer.easy.totalNote")}</span>
                          </dt>
                          <dd data-testid="checkout-total">
                            <Tick value={selected.pay.totalPiasters}>
                              <PriceTag alwaysDecimals amount={selected.pay.totalPiasters} size="medium" locale={locale} />
                            </Tick>
                          </dd>
                        </div>
                      </dl>
                      <p className={styles.arrives}>
                        <Icon source={Truck} size="small" tone="subdued" />
                        <span suppressHydrationWarning>{t("buyer.easy.arrives", { date: arrivalDate(selected.deliveryDays, locale) })}</span>
                      </p>
                      {designerDiff ? (
                        <p className={styles.designerDiff} data-testid="designer-diff" suppressHydrationWarning>
                          {designerDiff}
                        </p>
                      ) : null}
                      <details className={styles.disclosure} id="price-details">
                        <summary>{t("buyer.easy.breakdown")}</summary>
                        <BlockStack gap="200">
                          <dl className={styles.lines}>
                            {selected.pay.lines.map((l, i) => (
                              <div className={styles.line} key={i}>
                                <dt>{lineLabel(t, l)}</dt>
                                <dd>
                                  <PriceTag alwaysDecimals amount={l.totalPiasters} size="small" locale={locale} tone={l.totalPiasters < 0 ? "success" : "base"} />
                                </dd>
                              </div>
                            ))}
                            <div className={`${styles.line} ${styles.lineSub}`}>
                              <dt>{t("buyer.subtotalExVat")}</dt>
                              <dd>
                                <PriceTag alwaysDecimals amount={exVat} size="small" locale={locale} />
                              </dd>
                            </div>
                          </dl>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {t("checkout.summary.validUntil", { date: formatDateTime(selected.validUntil, locale) })}
                          </Text>
                          {props.prepayDiscountPct > 0 && !sampleMode && !props.quoted ? (
                            <Text as="p" variant="bodySm" tone="subdued">
                              {t("buyer.prepayNote", { pct: props.prepayDiscountPct })}
                            </Text>
                          ) : null}
                        </BlockStack>
                      </details>
                    </>
                  ) : (
                    <Text as="p" tone="subdued">
                      {byQuote ? t("buyer.qty.byQuoteSummary") : manual ? t("buyer.quote.summary") : t("checkout.summary.noOffer")}
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
                          <span className={styles.actionBarLabel}>{t("buyer.easy.total")}</span>
                          <Tick value={selected.pay.totalPiasters}>
                            <PriceTag alwaysDecimals amount={selected.pay.totalPiasters} size="medium" locale={locale} />
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
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("checkout.summary.prepaidNote")}
                  </Text>
                </BlockStack>
              </Card>
              <HelpBox support={props.support ?? null} />
            </BlockStack>
          </aside>
        </div>
      </BlockStack>
    </Page>
  );
}

/**
 * Price tick when an amount changes (CR-19): same motion as the designer's price badge
 * (300 ms, 4 px rise from 40% opacity, ease-out), keyed on the value so the new figure animates
 * in the same frame it appears. Not on first paint; off under reduced motion (CSS).
 */
function Tick({ value, children }: { value: number; children: ReactNode }) {
  const first = useRef(value);
  return (
    <span key={value} className={value === first.current ? styles.tickHost : `${styles.tickHost} ${styles.tick}`}>
      {children}
    </span>
  );
}

/** One printer in the optional "Change printer" list (SIM-01: fewer facts, plain words). */
function OfferCard({ offer, checked, onSelect, locale, sample, prepayPct = 0 }: { offer: CheckoutOffer; checked: boolean; onSelect: () => void; locale: Locale; sample?: boolean; prepayPct?: number }) {
  const { t } = useI18n();
  const name = locale === "ar" ? offer.vendor.name.ar : offer.vendor.name.en;
  const unit = Math.round(offer.pay.subtotalPiasters / offer.quantity);
  // R5-JR-15: the unit is after the prepay discount; say so wherever that figure is shown.
  const unitParts = (offer.pay.discountPiasters > 0 && prepayPct > 0 ? t("buyer.unitPrepay", { price: "\u0000", pct: prepayPct }) : t("checkout.offers.unit", { price: "\u0000" })).split("\u0000");
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
          <Tick value={offer.pay.totalPiasters}>
            <PriceTag alwaysDecimals amount={offer.pay.totalPiasters} size="medium" locale={locale} />
          </Tick>
          {sample ? (
            <Text as="span" variant="bodySm" tone="subdued">
              {t("buyer.sample.incl")}
            </Text>
          ) : (
            <Text as="span" variant="bodySm" tone="subdued">
              {/* Only the figure ticks, the words around it stay still (CR-19, same lesson as CR-20). */}
              {unitParts[0]}
              <Tick value={unit}>{formatMoney(unit, locale, { alwaysDecimals: true })}</Tick>
              {unitParts[1]}
            </Text>
          )}
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
        {/* R5-JR-05: no reviews yet reads "New", not "0.0 (0)". */}
        {offer.vendor.ratingCount > 0 ? (
          <span aria-label={t("checkout.offers.rating", { rating: offer.vendor.rating.toFixed(1), count: offer.vendor.ratingCount })}>
            <Icon source={Star} size="small" tone="subdued" />
            <bdi>{t("checkout.offers.ratingShort", { rating: offer.vendor.rating.toFixed(1), count: offer.vendor.ratingCount })}</bdi>
          </span>
        ) : (
          <span>{t("store.vendor.newBadge")}</span>
        )}
        {offer.vendor.verified ? (
          <span>
            <Icon source={BadgeCheck} size="small" tone="subdued" />
            {t("checkout.offers.verified")}
          </span>
        ) : null}
      </div>
      <div className={styles.offerLink}>
        <Link url={`/${locale}/vendors/${offer.vendor.slug}`} external accessibilityLabel={`${t("checkout.offers.profile")}: ${name}`}>
          {t("checkout.offers.profile")}
        </Link>
      </div>
    </label>
  );
}

/** Largest quantity a price request takes (same cap as requestQuoteAction). */
const MAX_REQUEST_QTY = 1_000_000;

/** Smooth scrolling only when the buyer has not asked for reduced motion (WCAG 2.3.3, R4-10). */
function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
