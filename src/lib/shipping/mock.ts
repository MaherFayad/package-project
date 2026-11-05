import { randomInt } from "node:crypto";
import type { ShipmentStatus } from "@/types";
import { SHIPMENT_FLOW, type CreateShipmentInput, type CreatedShipment, type ShippingProvider, type TrackingResult } from "./types";

/**
 * Mock Bosta-style courier. Tracking numbers look like Bosta's (10 digits). Progress is simulated
 * from the shipment's creation time so pages show a realistic timeline without background jobs:
 * picked up after 2 h, in transit after 6 h, out for delivery after 20 h, delivered after 26 h.
 * MOCK_SHIPPING_SPEED (default 1) divides those offsets, e.g. 3600 turns hours into seconds.
 */
export const MOCK_OFFSETS_H: Record<ShipmentStatus, number> = {
  CREATED: 0,
  PICKED_UP: 2,
  IN_TRANSIT: 6,
  OUT_FOR_DELIVERY: 20,
  DELIVERED: 26,
  RETURNED: Number.POSITIVE_INFINITY,
};

export function simulateTracking(createdAt: Date, now = new Date(), speed = 1): TrackingResult {
  const elapsedH = ((now.getTime() - createdAt.getTime()) / 3_600_000) * Math.max(1, speed);
  const events = SHIPMENT_FLOW.filter((s) => MOCK_OFFSETS_H[s] <= elapsedH).map((s) => ({
    status: s,
    at: new Date(createdAt.getTime() + (MOCK_OFFSETS_H[s] * 3_600_000) / Math.max(1, speed)).toISOString(),
  }));
  return { status: events[events.length - 1]?.status ?? "CREATED", events: events.length ? events : [{ status: "CREATED", at: createdAt.toISOString() }] };
}

export class MockShippingProvider implements ShippingProvider {
  readonly name = "mock" as const;
  constructor(private readonly speed = Number(process.env.MOCK_SHIPPING_SPEED) || 1) {}

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    void input;
    const trackingNumber = String(randomInt(1, 10)) + Array.from({ length: 9 }, () => randomInt(0, 10)).join("");
    return { trackingNumber, status: "CREATED", trackingUrl: this.trackingUrl(trackingNumber) };
  }

  async track(trackingNumber: string, createdAt = new Date()): Promise<TrackingResult> {
    void trackingNumber;
    return simulateTracking(createdAt, new Date(), this.speed);
  }

  trackingUrl(trackingNumber: string): string {
    return `https://bosta.co/tracking-shipments?shipment-number=${encodeURIComponent(trackingNumber)}`;
  }
}
