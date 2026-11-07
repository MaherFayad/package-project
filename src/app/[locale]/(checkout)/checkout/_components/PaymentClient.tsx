"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Locale, PaymentMethod, QuoteLine } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { PaymentView } from "@/lib/orders/service";
import { isSampleLines } from "@/lib/orders/sample";
import { PREPAY_DISCOUNT_LABEL } from "@/lib/orders/totals";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { BlockStack, Divider, InlineStack } from "@/components/ui/Stack";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceList } from "@/components/ui/ChoiceList";
import { Modal } from "@/components/ui/Modal";
import { Page } from "@/components/ui/Page";
import { PriceTag } from "@/components/ui/PriceTag";
import { Spinner } from "@/components/ui/Spinner";
import { Stepper } from "@/components/ui/Stepper";
import { Text } from "@/components/ui/Text";
import { Thumbnail } from "@/components/ui/Thumbnail";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import type { SupportContact } from "@/lib/support";
import { cancelOrderAction, instapaySentAction, orderPayStateAction, startPaymentAction } from "../actions";
import { HelpBox } from "./HelpBox";
import { arrivalDate } from "./arrival";
import styles from "./checkout.module.css";

async function mockGateway(body: Record<string, string>): Promise<{ status?: "PAID" | "FAILED"; error?: string }> {
  const res = await fetch("/api/payments/mock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ error: "generic" }))) as { status?: "PAID" | "FAILED"; error?: string };
}

export function PaymentClient(props: {
  locale: Locale;
  orderId: string;
  number: string;
  /** Everyday name of the box ("Mailer box 25 × 18 × 8 cm"); Elba picks the printer (R1-13). */
  boxLabel: string;
  /** The approved render, or the model's drawing (R1-18). */
  thumbnail: string;
  quantity: number;
  lines: QuoteLine[];
  vatPiasters: number;
  totalPiasters: number;
  validUntil: string | null;
  expired: boolean;
  restartUrl: string;
  testMode: boolean;
  fawryHours: number;
  methods: PaymentMethod[];
  resume: PaymentView | null;
  /** Help line (ELBA_SUPPORT_PHONE), or null. */
  support?: SupportContact | null;
  /** Door-to-door days promised at checkout (dueDate - placedAt); the Fawry screen repeats the date (R3-16). */
  deliveryDays?: number | null;
  /** The signed-in buyer's mobile, prefilled as the wallet number (R3-10): most wallets use it. */
  walletPhone?: string;
}) {
  const { locale, orderId } = props;
  // R2-02: delivery is inside the boxes line (as on the per-box price), never a second summed row.
  const inclKey = isSampleLines(props.lines) ? "buyer.easy.inclDelivery" : props.lines.some((l) => l.kind === "DISCOUNT" && l.labelKey === PREPAY_DISCOUNT_LABEL) ? "buyer.easy.inclAll" : "buyer.easy.inclNoDiscount";
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [method, setMethod] = useState<PaymentMethod>(props.resume?.method ?? "CARD");
  // R9: the chosen method survives a reload (not personal data; sessionStorage, this tab only).
  const methodKey = `elba:pay-method:${orderId}`;
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(methodKey) as PaymentMethod | null;
      if (saved && !props.resume && props.methods.includes(saved)) setMethod(saved);
    } catch {
      /* storage blocked */
    }
  }, [methodKey, props.methods, props.resume]);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(methodKey, method);
    } catch {
      /* storage blocked */
    }
  }, [methodKey, method]);
  const [payment, setPayment] = useState<PaymentView | null>(props.resume);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const [cardErr, setCardErr] = useState<string | undefined>();
  const [wallet, setWallet] = useState(props.walletPhone ?? "");
  const [instapaySent, setInstapaySent] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // R6-02: the pay button shows the same two decimals as the summary beside it.
  const amount = formatMoney(props.totalPiasters, locale, { alwaysDecimals: true });
  // Same three steps as the checkout page (docs/audit/simplicity-2026-11/flows.md): this is the last.
  const steps = [
    { id: "quantity", label: t("buyer.easy.steps.quantity") },
    { id: "review", label: t("buyer.easy.steps.review") },
    { id: "payment", label: t("buyer.easy.steps.pay") },
  ];
  const last = steps.length - 1;

  const errText = (code: string) => {
    const key = `checkout.errors.${code}` as DictKey;
    const s = t(key);
    return s === key ? t("checkout.errors.generic") : s;
  };

  const done = () => router.push(`/${locale}/orders/${orderId}?paid=1`);
  const [signedOut, setSignedOut] = useState(false);

  /**
   * R8-01 / R8-02: true when this order can still be paid. A paid (or cancelled) order leaves the
   * pay page for its order page with a notice; a lost session shows "sign in again" instead of
   * "Something went wrong". Called on mount, on history restore and after any refused attempt.
   */
  const stillDue = useCallback(async (): Promise<boolean> => {
    const r = await orderPayStateAction(orderId);
    if (!r.ok && r.error === "SIGNED_OUT") {
      setBusy(false);
      setSignedOut(true);
      return false;
    }
    if (r.ok && !r.due) {
      toast.show(t("buyer.payState.alreadyDone"));
      router.replace(`/${locale}/orders/${orderId}`);
      return false;
    }
    return true;
  }, [orderId, locale, router, toast, t]);

  useEffect(() => {
    void stillDue();
    // Back/forward cache: the page comes back without a request, so ask again.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void stillDue();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void stillDue();
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stillDue]);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await startPaymentAction({ orderId, method, locale });
    setBusy(false);
    if (!r.ok) {
      if (!(await stillDue())) return;
      return setError(errText(r.error));
    }
    if (r.payment.redirectUrl) {
      window.location.assign(r.payment.redirectUrl);
      return;
    }
    // The method list (and its Continue button) unmounts: move focus into the next step (X-01).
    // flushSync: after an await React renders in a scheduler task, which can land after a
    // requestAnimationFrame, so the target did not exist yet and focus fell to <body> (R4 a11y).
    flushSync(() => setPayment(r.payment));
    document.getElementById(r.payment.method === "CARD" ? "card-number" : "payment-step-heading")?.focus();
  };

  const simulate = async (action: "card" | "wallet" | "fawry" | "instapay", extra: Record<string, string> = {}) => {
    if (!payment || busy) return;
    setBusy(true);
    setError(null);
    const r = await mockGateway({ paymentId: payment.paymentId, action, ...extra });
    if (r.status === "PAID") return done();
    // The attempt was closed elsewhere (another tab or method paid, the order was cancelled) or the
    // session ended: never report that as a declined card (R8-01, R8-02).
    if (r.error === "NOT_PENDING" || r.error === "UNAUTHENTICATED") {
      if (!(await stillDue())) return;
      setBusy(false);
      setPayment(null);
      return setError(t("buyer.payState.attemptClosed"));
    }
    if (r.status !== "FAILED") setBusy(false);
    if (r.error === "INVALID_CARD") return setCardErr(t("payment.card.invalid"));
    if (r.error === "INVALID_WALLET") return setError(t("checkout.address.invalidPhone"));
    if (r.status === "FAILED") {
      // A declined attempt is closed on the server. Open a fresh attempt with the same method so the
      // buyer fixes the card in place instead of starting over from the method list.
      const again = await startPaymentAction({ orderId, method: payment.method, locale });
      setBusy(false);
      if (again.ok && !again.payment.redirectUrl) setPayment(again.payment);
      else setPayment(null);
      if (action === "card" && again.ok) {
        setCard((c) => ({ ...c, number: "" }));
        setCardErr(t("buyer.declinedNewAttempt"));
        requestAnimationFrame(() => document.getElementById("card-number")?.focus());
        return;
      }
      return setError(action === "wallet" ? t("payment.wallet.declined") : t("payment.card.declined"));
    }
    setError(errText(r.error ?? "generic"));
  };

  const cancel = async () => {
    setCancelling(true);
    const r = await cancelOrderAction(orderId);
    setCancelling(false);
    setConfirmCancel(false);
    if (r.ok) {
      toast.show(t("payment.cancelled"));
      router.push(`/${locale}/orders/${orderId}`);
    } else setError(errText(r.error));
  };

  // SIM-09: plain names ("Cash at Fawry", "Mobile wallet (Vodafone Cash and others)") with one line each.
  const methodChoices = props.methods.map((m) => ({
    value: m,
    label:
      m === "CARD" ? (
        <InlineStack gap="200" blockAlign="center" as="span">
          {t(`buyer.easy.pay.methods.${m}` as DictKey)}
          <Badge tone="info" size="small">
            {t("payment.recommended")}
          </Badge>
        </InlineStack>
      ) : (
        t(`buyer.easy.pay.methods.${m}` as DictKey)
      ),
    helpText: t(`buyer.easy.pay.methodHelp.${m}` as DictKey, { hours: props.fawryHours }),
  }));

  const detail = payment ? (
    payment.method === "CARD" ? (
      <form
        aria-busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          setCardErr(undefined);
          void simulate("card", { cardNumber: card.number });
        }}
      >
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            {t("payment.card.title")}
          </Text>
          {props.testMode ? <Banner tone="info">{t("payment.card.testHint")}</Banner> : null}
          <TextField
            id="card-number"
            label={t("payment.card.number")}
            autoComplete="cc-number"
            inputMode="numeric"
            dir="ltr"
            placeholder="0000 0000 0000 0000"
            value={card.number}
            onChange={(v) => {
              setCard((c) => ({ ...c, number: groupCard(v) }));
              if (cardErr) setCardErr(undefined);
            }}
            error={cardErr}
            maxLength={23}
          />
          <div className={styles.grid2}>
            <TextField label={t("payment.card.expiry")} autoComplete="cc-exp" inputMode="numeric" dir="ltr" placeholder={t("payment.card.expiryPlaceholder")} value={card.expiry} onChange={(v) => setCard((c) => ({ ...c, expiry: formatExpiry(v, c.expiry) }))} maxLength={5} />
            <TextField label={t("payment.card.cvc")} autoComplete="cc-csc" inputMode="numeric" dir="ltr" value={card.cvc} onChange={(v) => setCard((c) => ({ ...c, cvc: v }))} maxLength={4} />
          </div>
          {/* R7-03: not required by the gateway; say so like every other optional field. */}
          <TextField label={t("payment.card.name")} autoComplete="cc-name" value={card.name} onChange={(v) => setCard((c) => ({ ...c, name: v }))} optional />
          <Button variant="primary" size="large" fullWidth submit>
            <PayLabel busy={busy} label={t("payment.pay", { amount })} busyLabel={t("buyer.paying")} />
          </Button>
        </BlockStack>
      </form>
    ) : payment.method === "WALLET" ? (
      <form
        aria-busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          void simulate("wallet", { walletPhone: wallet });
        }}
      >
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">
            <span id="payment-step-heading" tabIndex={-1} className={styles.stepHeading}>
              {t("payment.wallet.title")}
            </span>
          </Text>
          {props.testMode ? <Banner tone="info">{t("payment.wallet.testHint")}</Banner> : null}
          <TextField label={t("payment.wallet.number")} autoComplete="tel-national" type="tel" inputMode="tel" dir="ltr" value={wallet} onChange={setWallet} helpText={t("payment.wallet.help")} />
          <Button variant="primary" size="large" fullWidth submit>
            <PayLabel busy={busy} label={t("payment.pay", { amount })} busyLabel={t("buyer.paying")} />
          </Button>
        </BlockStack>
      </form>
    ) : payment.method === "FAWRY" && payment.fawry ? (
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          <span id="payment-step-heading" tabIndex={-1} className={styles.stepHeading}>
            {t("payment.fawry.title")}
          </span>
        </Text>
        <BlockStack gap="100">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("payment.fawry.code")}
          </Text>
          {/* R6-04: grouped in fours for reading out at the outlet; copy and screen readers get the raw digits. */}
          <p className={styles.code} data-testid="fawry-code">
            <span aria-hidden="true">{payment.fawry.referenceCode.replace(/(\d{4})(?=\d)/g, "$1 ")}</span>
            <span className="visually-hidden">{payment.fawry.referenceCode}</span>
          </p>
          <Text as="p" fontWeight="semibold">
            <PriceTag alwaysDecimals amount={props.totalPiasters} locale={locale} />
          </Text>
          <Text as="p" tone="caution">
            {t("payment.fawry.expires", { date: formatDateTime(payment.fawry.expiresAt, locale) })}
          </Text>
          {props.deliveryDays ? (
            <Text as="p" variant="bodySm">
              <span suppressHydrationWarning>{t("payment.fawry.arrives", { date: arrivalDate(props.deliveryDays, locale) })}</span>
            </Text>
          ) : null}
        </BlockStack>
        <Text as="p">{t("payment.fawry.steps")}</Text>
        <InlineStack gap="200">
          <Button
            icon={Copy}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(payment.fawry!.referenceCode);
                toast.show(t("payment.fawry.copied"));
              } catch {
                /* clipboard blocked: the code is on screen */
              }
            }}
          >
            {t("payment.fawry.copy")}
          </Button>
          <Button variant="plain" url={`/${locale}/orders/${orderId}`}>
            {t("payment.fawry.later")}
          </Button>
        </InlineStack>
        {props.testMode ? (
          <Button onClick={() => simulate("fawry")} loading={busy}>
            {t("payment.fawry.simulate")}
          </Button>
        ) : null}
      </BlockStack>
    ) : payment.method === "INSTAPAY" && payment.instapay ? (
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          <span id="payment-step-heading" tabIndex={-1} className={styles.stepHeading}>
            {t("payment.instapay.title")}
          </span>
        </Text>
        <dl className={styles.specs}>
          {/* R6-01: both values must be typed exactly into the bank app, so each gets a copy button. */}
          <dt>{t("payment.instapay.address")}</dt>
          <dd className={styles.copyRow}>
            <bdi className={styles.mono}>{payment.instapay.address}</bdi>
            <CopyButton value={payment.instapay.address} label={t("buyer.copy.address")} done={t("buyer.copy.done")} />
          </dd>
          <dt>{t("payment.instapay.reference")}</dt>
          <dd className={styles.copyRow}>
            <bdi className={styles.mono}>{payment.instapay.reference}</bdi>
            <CopyButton value={payment.instapay.reference} label={t("buyer.copy.reference")} done={t("buyer.copy.done")} />
          </dd>
          <dt>{t("payment.instapay.amount")}</dt>
          <dd>
            <PriceTag alwaysDecimals amount={props.totalPiasters} locale={locale} />
          </dd>
        </dl>
        <Text as="p">{t("payment.instapay.steps")}</Text>
        {instapaySent ? (
          <Banner tone="success" announce>
            {t("payment.instapay.sentDone")}
          </Banner>
        ) : (
          <Button
            variant="primary"
            fullWidth
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await instapaySentAction(payment.paymentId);
              setBusy(false);
              if (r.ok) setInstapaySent(true);
              else setError(errText(r.error));
            }}
          >
            {t("payment.instapay.sent")}
          </Button>
        )}
        {props.testMode ? (
          <Button onClick={() => simulate("instapay")} loading={busy}>
            {t("payment.instapay.simulate")}
          </Button>
        ) : null}
      </BlockStack>
    ) : null
  ) : null;

  return (
    <Page
      title={t("payment.title")}
      subtitle={t("payment.subtitle", { number: props.number })}
      // R3-15: back to the checkout this payment came from (address and approval), not the orders list.
      backAction={{ content: t("buyer.easy.steps.review"), url: props.restartUrl }}
      secondaryActions={[{ content: t("payment.cancelOrder"), onAction: () => setConfirmCancel(true), destructive: true }]}
    >
      <BlockStack gap="400">
        {/* Same progress as steps 1 to 3 so the buyer knows this is the last step (R2-03). */}
        <div className={styles.stepperWide}>
          <Card>
            <Stepper steps={steps} current={last} accessibilityLabel={t("checkout.steps.label")} />
          </Card>
        </div>
        <div className={styles.stepperCompact} aria-hidden="true">
          <div className={styles.compactHead}>
            <span className={styles.compactCount}>{t("checkout.stepOf", { current: steps.length, total: steps.length })}</span>
            <span className={styles.compactNext}>{t("buyer.easy.stepsDone")}</span>
          </div>
          <div className={styles.segments}>
            {steps.map((s, i) => (
              <span key={s.id} className={styles.segment} data-state={i < last ? "done" : "current"} />
            ))}
          </div>
        </div>
        <div className={styles.layout}>
          <BlockStack gap="400">
            {props.expired ? (
              <Banner tone="warning" title={t("payment.expired")} action={{ content: t("payment.restart"), url: props.restartUrl }} />
            ) : (
              <Card>
                <BlockStack gap="400">
                  {props.testMode ? <Banner tone="warning">{t("payment.testMode")}</Banner> : null}
                  {signedOut ? (
                    <Banner
                      tone="warning"
                      title={t("buyer.payState.signedOutTitle")}
                      action={{ content: t("buyer.payState.signIn"), url: `/${locale}/login?next=${encodeURIComponent(`/${locale}/checkout/pay/${orderId}`)}` }}
                      announce
                    >
                      {t("buyer.payState.signedOutBody")}
                    </Banner>
                  ) : null}
                  {error && !signedOut ? (
                    <Banner tone="critical" announce>
                      {error}
                    </Banner>
                  ) : null}
                  {!payment ? (
                    <BlockStack gap="300">
                      <div className={styles.due}>
                        <Text as="span" fontWeight="semibold">
                          {t("buyer.amountDue")}
                          <span className={styles.totalNote}>{t("buyer.easy.totalNote")}</span>
                        </Text>
                        <PriceTag alwaysDecimals amount={props.totalPiasters} size="medium" locale={locale} />
                      </div>
                      <ChoiceList
                        title={t("buyer.easy.pay.title")}
                        choices={methodChoices}
                        selected={[method]}
                        onChange={(v) => setMethod(v[0] as PaymentMethod)}
                      />
                      {/* R2-15: every method pays before print, so the one discount applies to all of them. */}
                      {inclKey === "buyer.easy.inclAll" ? (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t("buyer.easy.pay.discountAll")}
                        </Text>
                      ) : null}
                      <Button variant="primary" size="large" fullWidth onClick={start} loading={busy}>
                        {t("buyer.easy.pay.next")}
                      </Button>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t("buyer.easy.pay.safe")}
                      </Text>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="300">
                      {detail}
                      <Divider />
                      <InlineStack>
                        <Button variant="plain" onClick={() => setPayment(null)}>
                          {t("payment.choose")}
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            )}
            <Text as="p" variant="bodySm" tone="subdued">
              {t("payment.secure")}
            </Text>
          </BlockStack>

          <aside className={styles.summary} aria-labelledby="pay-summary">
            <BlockStack gap="400">
              <Card title={<span id="pay-summary">{t("buyer.easy.summaryTitle")}</span>}>
                <BlockStack gap="300">
                  <div className={styles.summaryBox}>
                    <Thumbnail source={props.thumbnail} alt="" size="medium" />
                    <BlockStack gap="050">
                      {/* R3-15: the quantity is the first line below; it is not repeated here. */}
                      <Text as="p" fontWeight="semibold">
                        {props.boxLabel}
                      </Text>
                    </BlockStack>
                  </div>
                  {/* SIM-03 / R2-02: boxes (all-in, ex-VAT), VAT, total; the engine's lines sit behind "Price details". */}
                  <dl className={styles.lines}>
                    <div className={styles.line}>
                      <dt>
                        {t("buyer.easy.boxes", { qty: props.quantity.toLocaleString("en-US") })}
                        <span className={styles.totalNote}>{t(inclKey)}</span>
                      </dt>
                      <dd>
                        <PriceTag alwaysDecimals amount={props.totalPiasters - props.vatPiasters} size="small" locale={locale} />
                      </dd>
                    </div>
                    <div className={styles.line}>
                      <dt>{t("buyer.easy.vat")}</dt>
                      <dd>
                        <PriceTag alwaysDecimals amount={props.vatPiasters} size="small" locale={locale} />
                      </dd>
                    </div>
                    <div className={`${styles.line} ${styles.lineTotal}`}>
                      <dt>
                        {t("buyer.easy.total")}
                        <span className={styles.totalNote}>{t("buyer.easy.totalNote")}</span>
                      </dt>
                      <dd data-testid="pay-total">
                        <PriceTag alwaysDecimals amount={props.totalPiasters} locale={locale} />
                      </dd>
                    </div>
                  </dl>
                  <details className={styles.disclosure}>
                    <summary>{t("buyer.easy.breakdown")}</summary>
                    <BlockStack gap="200">
                      <dl className={styles.lines}>
                        {props.lines.map((l, i) => (
                          <div className={styles.line} key={i}>
                            <dt>{t((l.labelKey === "pricing.line.shipping" ? "checkout.summary.shipping" : l.labelKey === "pricing.line.die" ? "buyer.easy.dieLine" : l.labelKey) as DictKey)}</dt>
                            <dd>
                              <PriceTag alwaysDecimals amount={l.totalPiasters} size="small" locale={locale} tone={l.totalPiasters < 0 ? "success" : "base"} />
                            </dd>
                          </div>
                        ))}
                        <div className={`${styles.line} ${styles.lineSub}`}>
                          <dt>{t("buyer.subtotalExVat")}</dt>
                          <dd>
                            <PriceTag alwaysDecimals amount={props.totalPiasters - props.vatPiasters} size="small" locale={locale} />
                          </dd>
                        </div>
                      </dl>
                      {props.validUntil ? (
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t("checkout.summary.validUntil", { date: formatDateTime(props.validUntil, locale) })}
                        </Text>
                      ) : null}
                    </BlockStack>
                  </details>
                </BlockStack>
              </Card>
              <HelpBox support={props.support ?? null} />
            </BlockStack>
          </aside>
        </div>
      </BlockStack>
      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t("buyer.cancelTitle")}
        preventClose={cancelling}
        primaryAction={{ content: t("payment.cancelOrder"), destructive: true, onAction: cancel, loading: cancelling }}
        secondaryActions={[{ content: t("buyer.keepOrder"), onAction: () => setConfirmCancel(false), disabled: cancelling }]}
      >
        <Text as="p">{t("buyer.cancelBody")}</Text>
      </Modal>
    </Page>
  );
}

/** "4242424242424242" -> "4242 4242 4242 4242" (Arabic-Indic digits accepted). */
/**
 * Label of a "Pay" button. While paying it keeps the brand fill (the button is not disabled,
 * repeat submits are ignored in `simulate`) and shows a leading spinner + "Paying…" (CR-22).
 */
function PayLabel({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  if (!busy) return <>{label}</>;
  return (
    <span className={styles.payBusy}>
      <Spinner size="small" decorative />
      {busyLabel}
    </span>
  );
}

function groupCard(v: string): string {
  const digits = toLatin(v).replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Inserts the slash after the month; deleting it works as expected. */
function formatExpiry(v: string, prev: string): string {
  const digits = toLatin(v).replace(/\D/g, "").slice(0, 4);
  if (v.length < prev.length) return v;
  return digits.length >= 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function toLatin(v: string): string {
  return v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Small "Copy" action next to a value the buyer has to type elsewhere (InstaPay address, transfer note). */
function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const toast = useToast();
  return (
    <Button
      size="slim"
      icon={Copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.show(done);
        } catch {
          /* clipboard blocked: the value is on screen */
        }
      }}
    >
      {label}
    </Button>
  );
}
