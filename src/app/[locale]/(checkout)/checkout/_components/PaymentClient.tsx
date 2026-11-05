"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale, PaymentMethod, QuoteLine } from "@/types";
import { useI18n } from "@/i18n/client";
import type { DictKey } from "@/i18n";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { PaymentView } from "@/lib/orders/service";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  ChoiceList,
  Divider,
  InlineStack,
  Page,
  PriceTag,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { cancelOrderAction, instapaySentAction, startPaymentAction } from "../actions";
import styles from "./checkout.module.css";

async function mockGateway(body: Record<string, string>): Promise<{ status?: "PAID" | "FAILED"; error?: string }> {
  const res = await fetch("/api/payments/mock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ error: "generic" }))) as { status?: "PAID" | "FAILED"; error?: string };
}

export function PaymentClient(props: {
  locale: Locale;
  orderId: string;
  number: string;
  vendorName: string;
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
}) {
  const { locale, orderId } = props;
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [method, setMethod] = useState<PaymentMethod>(props.resume?.method ?? "CARD");
  const [payment, setPayment] = useState<PaymentView | null>(props.resume);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState({ number: "", expiry: "", cvc: "", name: "" });
  const [cardErr, setCardErr] = useState<string | undefined>();
  const [wallet, setWallet] = useState("");
  const [instapaySent, setInstapaySent] = useState(false);
  const amount = formatMoney(props.totalPiasters, locale);

  const errText = (code: string) => {
    const key = `checkout.errors.${code}` as DictKey;
    const s = t(key);
    return s === key ? t("checkout.errors.generic") : s;
  };

  const done = () => router.push(`/${locale}/orders/${orderId}?paid=1`);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await startPaymentAction({ orderId, method, locale });
    setBusy(false);
    if (!r.ok) return setError(errText(r.error));
    if (r.payment.redirectUrl) {
      window.location.assign(r.payment.redirectUrl);
      return;
    }
    setPayment(r.payment);
  };

  const simulate = async (action: "card" | "wallet" | "fawry" | "instapay", extra: Record<string, string> = {}) => {
    if (!payment) return;
    setBusy(true);
    setError(null);
    const r = await mockGateway({ paymentId: payment.paymentId, action, ...extra });
    setBusy(false);
    if (r.status === "PAID") return done();
    if (r.error === "INVALID_CARD") return setCardErr(t("payment.card.invalid"));
    if (r.error === "INVALID_WALLET") return setError(t("checkout.address.invalidPhone"));
    if (r.status === "FAILED") {
      setPayment(null); // a declined attempt is closed; start a new one
      return setError(action === "wallet" ? t("payment.wallet.declined") : t("payment.card.declined"));
    }
    setError(errText(r.error ?? "generic"));
  };

  const cancel = async () => {
    if (!window.confirm(t("payment.cancelConfirm"))) return;
    const r = await cancelOrderAction(orderId);
    if (r.ok) {
      toast.show(t("payment.cancelled"));
      router.push(`/${locale}/orders/${orderId}`);
    } else setError(errText(r.error));
  };

  const methodChoices = props.methods.map((m) => ({
    value: m,
    label:
      m === "CARD" ? (
        <InlineStack gap="200" blockAlign="center" as="span">
          {t(`paymentMethods.${m}` as DictKey)}
          <Badge tone="info" size="small">
            {t("payment.recommended")}
          </Badge>
        </InlineStack>
      ) : (
        t(`paymentMethods.${m}` as DictKey)
      ),
    helpText: t(`payment.methodHelp.${m}` as DictKey, { hours: props.fawryHours }),
  }));

  const detail = payment ? (
    payment.method === "CARD" ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCardErr(undefined);
          void simulate("card", { cardNumber: card.number });
        }}
      >
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">
            {t("payment.card.title")}
          </Text>
          {props.testMode ? <Banner tone="info">{t("payment.card.testHint")}</Banner> : null}
          <TextField
            label={t("payment.card.number")}
            autoComplete="cc-number"
            inputMode="numeric"
            dir="ltr"
            value={card.number}
            onChange={(v) => setCard((c) => ({ ...c, number: v }))}
            error={cardErr}
            maxLength={23}
          />
          <div className={styles.grid2}>
            <TextField label={t("payment.card.expiry")} autoComplete="cc-exp" dir="ltr" placeholder="12/30" value={card.expiry} onChange={(v) => setCard((c) => ({ ...c, expiry: v }))} maxLength={5} />
            <TextField label={t("payment.card.cvc")} autoComplete="cc-csc" inputMode="numeric" dir="ltr" value={card.cvc} onChange={(v) => setCard((c) => ({ ...c, cvc: v }))} maxLength={4} />
          </div>
          <TextField label={t("payment.card.name")} autoComplete="cc-name" value={card.name} onChange={(v) => setCard((c) => ({ ...c, name: v }))} />
          <Button variant="primary" size="large" fullWidth submit loading={busy}>
            {t("payment.pay", { amount })}
          </Button>
        </BlockStack>
      </form>
    ) : payment.method === "WALLET" ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void simulate("wallet", { walletPhone: wallet });
        }}
      >
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">
            {t("payment.wallet.title")}
          </Text>
          {props.testMode ? <Banner tone="info">{t("payment.wallet.testHint")}</Banner> : null}
          <TextField label={t("payment.wallet.number")} autoComplete="tel-national" type="tel" inputMode="tel" dir="ltr" value={wallet} onChange={setWallet} helpText={t("payment.wallet.help")} />
          <Button variant="primary" size="large" fullWidth submit loading={busy}>
            {t("payment.pay", { amount })}
          </Button>
        </BlockStack>
      </form>
    ) : payment.method === "FAWRY" && payment.fawry ? (
      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">
          {t("payment.fawry.title")}
        </Text>
        <BlockStack gap="100">
          <Text as="p" variant="bodySm" tone="subdued">
            {t("payment.fawry.code")}
          </Text>
          <p className={styles.code} data-testid="fawry-code">
            {payment.fawry.referenceCode}
          </p>
          <Text as="p" fontWeight="semibold">
            <PriceTag amount={props.totalPiasters} locale={locale} />
          </Text>
          <Text as="p" tone="caution">
            {t("payment.fawry.expires", { date: formatDateTime(payment.fawry.expiresAt, locale) })}
          </Text>
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
        <Text as="h3" variant="headingSm">
          {t("payment.instapay.title")}
        </Text>
        <dl className={styles.specs}>
          <dt>{t("payment.instapay.address")}</dt>
          <dd>
            <bdi className={styles.mono}>{payment.instapay.address}</bdi>
          </dd>
          <dt>{t("payment.instapay.reference")}</dt>
          <dd>
            <bdi>{payment.instapay.reference}</bdi>
          </dd>
          <dt>{t("payment.instapay.amount")}</dt>
          <dd>
            <PriceTag amount={props.totalPiasters} locale={locale} />
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
      backAction={{ content: t("orders.title"), url: `/${locale}/orders/${orderId}` }}
      secondaryActions={[{ content: t("payment.cancelOrder"), onAction: cancel, destructive: true }]}
    >
      <BlockStack gap="400">
        <div className={styles.layout}>
          <BlockStack gap="400">
            {props.expired ? (
              <Banner tone="warning" title={t("payment.expired")} action={{ content: t("payment.restart"), url: props.restartUrl }} />
            ) : (
              <Card>
                <BlockStack gap="400">
                  {props.testMode ? <Banner tone="warning">{t("payment.testMode")}</Banner> : null}
                  {error ? (
                    <Banner tone="critical" announce>
                      {error}
                    </Banner>
                  ) : null}
                  {!payment ? (
                    <BlockStack gap="300">
                      <ChoiceList
                        title={t("payment.choose")}
                        choices={methodChoices}
                        selected={[method]}
                        onChange={(v) => setMethod(v[0] as PaymentMethod)}
                      />
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t("payment.chooseHelp")}
                      </Text>
                      <Button variant="primary" size="large" fullWidth onClick={start} loading={busy}>
                        {t("payment.continue")}
                      </Button>
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
            <Card title={<span id="pay-summary">{t("checkout.summary.title")}</span>}>
              <BlockStack gap="300">
                <BlockStack gap="050">
                  <Text as="p" fontWeight="semibold">
                    {props.vendorName}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("checkout.summary.quantity", { qty: props.quantity.toLocaleString("en-US") })}
                  </Text>
                </BlockStack>
                <Divider />
                <dl className={styles.lines}>
                  {props.lines.map((l, i) => (
                    <div className={styles.line} key={i}>
                      <dt>{t((l.labelKey === "pricing.line.shipping" ? "checkout.summary.shipping" : l.labelKey) as DictKey)}</dt>
                      <dd>
                        <PriceTag amount={l.totalPiasters} size="small" locale={locale} />
                      </dd>
                    </div>
                  ))}
                  <div className={styles.line}>
                    <dt>{t("checkout.summary.vat")}</dt>
                    <dd>
                      <PriceTag amount={props.vatPiasters} size="small" locale={locale} />
                    </dd>
                  </div>
                  <div className={`${styles.line} ${styles.lineTotal}`}>
                    <dt>{t("checkout.summary.total")}</dt>
                    <dd data-testid="pay-total">
                      <PriceTag amount={props.totalPiasters} locale={locale} />
                    </dd>
                  </div>
                </dl>
                {props.validUntil ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t("checkout.summary.validUntil", { date: formatDateTime(props.validUntil, locale) })}
                  </Text>
                ) : null}
              </BlockStack>
            </Card>
          </aside>
        </div>
      </BlockStack>
    </Page>
  );
}
