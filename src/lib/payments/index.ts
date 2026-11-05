/**
 * Payments (owner: checkout). Adapter interface + providers.
 *
 *   const provider = getPaymentProvider();          // mock in dev, paymob when PAYMENTS_PROVIDER=paymob
 *   const intention = await provider.createIntention({...});
 *   const outcome = await provider.handleWebhook({ headers, rawBody, query });
 *
 * Server only (uses node:crypto). Orders are marked paid ONLY from verified webhooks
 * (`processPaymentWebhook` → `applyPaymentOutcome` in src/lib/orders/service.ts).
 */
export * from "./types";
export { paymentConfig, mockPaymentsEnabled, type PaymentConfig } from "./config";
export {
  MockProvider,
  MOCK_SIGNATURE_HEADER,
  MOCK_DECLINE_CARD,
  MOCK_SUCCESS_CARD,
  buildMockWebhook,
  signMock,
  mockSecret,
  mockCardOutcome,
  mockWalletOutcome,
  luhnValid,
  fawryReference,
  type MockWebhookBody,
} from "./mock";
export { PaymobProvider, paymobConfigFromEnv, paymobHmac, paymobHmacString, verifyPaymobHmac, PAYMOB_HMAC_FIELDS } from "./paymob";

import { paymentConfig } from "./config";
import { MockProvider } from "./mock";
import { PaymobProvider } from "./paymob";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(name: "mock" | "paymob" = paymentConfig().provider): PaymentProvider {
  return name === "paymob" ? new PaymobProvider() : new MockProvider();
}
