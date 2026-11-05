import type { ShipmentStatus, ShippingAddress } from "@/types";

/**
 * Courier adapter (report §7.4). Boxes ship flat in bundles; Bosta in production (Greater Cairo,
 * Alexandria, Delta, Canal), a deterministic mock in dev. Prepaid only: no cash on delivery.
 */
export interface CreateShipmentInput {
  orderNumber: string;
  /** Vendor pickup (EgyptCity key or free text). */
  pickupCity: string;
  dropOff: ShippingAddress;
  bundles: number;
  weightKg: number;
  description: string;
}

export interface TrackingEvent {
  status: ShipmentStatus;
  /** ISO timestamp. */
  at: string;
}

export interface CreatedShipment {
  trackingNumber: string;
  status: ShipmentStatus;
  labelUrl?: string;
  /** Public tracking page for buyers. */
  trackingUrl?: string;
}

export interface TrackingResult {
  status: ShipmentStatus;
  events: TrackingEvent[];
}

export interface ShippingProvider {
  readonly name: "mock" | "bosta";
  createShipment(input: CreateShipmentInput): Promise<CreatedShipment>;
  /** `createdAt` lets the mock simulate progress; real couriers ignore it. */
  track(trackingNumber: string, createdAt?: Date): Promise<TrackingResult>;
  trackingUrl(trackingNumber: string): string;
}

export const SHIPMENT_FLOW: ShipmentStatus[] = ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
