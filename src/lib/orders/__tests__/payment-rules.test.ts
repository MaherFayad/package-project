import { describe, expect, it } from "vitest";
import { decidePaymentOutcome, storedGatewayRef, type StoredPayment, type VerifiedOutcome } from "../payment-rules";

const pay = (o: Partial<StoredPayment> = {}): StoredPayment => ({ provider: "paymob", status: "PENDING", amountPiasters: 50_000, gatewayRef: "777", ...o });
const hook = (o: Partial<VerifiedOutcome> = {}): VerifiedOutcome => ({
  ok: true,
  paymentId: "pay_1",
  providerRef: "txn_1",
  status: "PAID",
  amountPiasters: 50_000,
  raw: {},
  provider: "paymob",
  gatewayRef: "777",
  currency: "EGP",
  ...o,
});

describe("payment webhook decisions (OWASP ASVS V11.1 business logic)", () => {
  it("marks a pending order paid on a matching, signed PAID callback", () => {
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook())).toEqual({ action: "PAID" });
  });

  it("rejects a replayed callback for another gateway order (merchant_order_id swap)", () => {
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook({ gatewayRef: "778" }))).toEqual({ action: "REJECT", result: "REFERENCE_MISMATCH" });
  });

  it("rejects when the payment was never bound to a gateway order", () => {
    expect(decidePaymentOutcome(pay({ gatewayRef: null }), "PENDING_PAYMENT", hook())).toMatchObject({ result: "REFERENCE_MISMATCH" });
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook({ gatewayRef: undefined }))).toMatchObject({ result: "REFERENCE_MISMATCH" });
  });

  it("rejects a callback from another provider, another currency or another amount", () => {
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook({ provider: "mock" }))).toMatchObject({ result: "PROVIDER_MISMATCH" });
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook({ currency: "USD" }))).toMatchObject({ result: "CURRENCY_MISMATCH" });
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook({ amountPiasters: 49_999 }))).toMatchObject({ result: "AMOUNT_MISMATCH" });
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook({ amountPiasters: Number.NaN }))).toMatchObject({ result: "AMOUNT_MISMATCH" });
  });

  it("is idempotent: retries and double payments change nothing", () => {
    expect(decidePaymentOutcome(pay({ status: "PAID" }), "PAID", hook())).toEqual({ action: "IGNORE", result: "DUPLICATE" });
    expect(decidePaymentOutcome(pay({ status: "PAID" }), "PAID", hook({ status: "FAILED" }))).toEqual({ action: "IGNORE", result: "ALREADY_PAID" });
    expect(decidePaymentOutcome(pay({ status: "REFUNDED" }), "REFUNDED", hook())).toEqual({ action: "IGNORE", result: "DUPLICATE" });
  });

  it("flags money that lands after the order was cancelled or paid by another attempt", () => {
    expect(decidePaymentOutcome(pay(), "CANCELLED", hook())).toEqual({ action: "PAID_LATE" });
    expect(decidePaymentOutcome(pay({ status: "FAILED" }), "PAID", hook())).toEqual({ action: "PAID_LATE" });
  });

  it("only refunds captured money", () => {
    expect(decidePaymentOutcome(pay({ status: "PENDING" }), "PENDING_PAYMENT", hook({ status: "REFUNDED" }))).toEqual({ action: "IGNORE", result: "REFUND_WITHOUT_PAYMENT" });
    expect(decidePaymentOutcome(pay({ status: "PAID" }), "PAID", hook({ status: "REFUNDED" }))).toEqual({ action: "REFUNDED" });
  });

  it("passes through pending and failed updates", () => {
    expect(decidePaymentOutcome(pay(), "PENDING_PAYMENT", hook({ status: "FAILED" }))).toEqual({ action: "FAILED" });
    expect(decidePaymentOutcome(pay({ status: "FAILED" }), "PENDING_PAYMENT", hook({ status: "PENDING" }))).toEqual({ action: "PENDING" });
  });

  it("reads the stored binding from the intention, falling back to providerRef for mock rows", () => {
    expect(storedGatewayRef({ provider: "paymob", providerRef: "pi_1", raw: { intention: { gatewayOrderId: "777" } } })).toBe("777");
    expect(storedGatewayRef({ provider: "paymob", providerRef: "pi_1", raw: null })).toBeNull();
    expect(storedGatewayRef({ provider: "mock", providerRef: "mock_abc", raw: { intention: {} } })).toBe("mock_abc");
  });
});
