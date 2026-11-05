/**
 * Shipping (owner: checkout). `getShippingProvider()` returns the Bosta adapter when
 * SHIPPING_PROVIDER=bosta, the mock otherwise. Server only.
 */
export * from "./types";
export { MockShippingProvider, simulateTracking, MOCK_OFFSETS_H } from "./mock";
export { BostaProvider } from "./bosta";

import { BostaProvider } from "./bosta";
import { MockShippingProvider } from "./mock";
import type { ShippingProvider } from "./types";

export function getShippingProvider(name: string | undefined = process.env.SHIPPING_PROVIDER): ShippingProvider {
  return name === "bosta" ? new BostaProvider() : new MockShippingProvider();
}
