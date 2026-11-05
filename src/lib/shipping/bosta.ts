import type { ShipmentStatus } from "@/types";
import type { CreateShipmentInput, CreatedShipment, ShippingProvider, TrackingResult } from "./types";

/**
 * Bosta adapter (skeleton; not called in dev, where SHIPPING_PROVIDER=mock).
 * Env: BOSTA_API_KEY, BOSTA_BASE_URL (default https://app.bosta.co/api/v2).
 * [VERIFY with Bosta before go-live]: delivery payload fields, state codes, flat-pack size
 * classes and the volumetric rate card we negotiated (report §7.4).
 */
const STATE_MAP: Record<number, ShipmentStatus> = {
  10: "CREATED",
  20: "PICKED_UP",
  21: "PICKED_UP",
  24: "IN_TRANSIT",
  30: "IN_TRANSIT",
  41: "OUT_FOR_DELIVERY",
  45: "DELIVERED",
  46: "RETURNED",
};

export class BostaProvider implements ShippingProvider {
  readonly name = "bosta" as const;
  private readonly base = (process.env.BOSTA_BASE_URL || "https://app.bosta.co/api/v2").replace(/\/+$/, "");
  private readonly key = process.env.BOSTA_API_KEY || "";

  private headers() {
    if (!this.key) throw new Error("BOSTA_NOT_CONFIGURED");
    return { Authorization: this.key, "Content-Type": "application/json" };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    const [firstName, ...rest] = input.dropOff.name.split(/\s+/);
    const res = await fetch(`${this.base}/deliveries`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        type: 10,
        specs: { packageType: "Parcel", packageDetails: { itemsCount: input.bundles, description: input.description }, weight: input.weightKg },
        dropOffAddress: {
          city: input.dropOff.governorate,
          district: input.dropOff.city,
          firstLine: input.dropOff.street,
          buildingNumber: input.dropOff.building,
          floor: input.dropOff.floor,
          apartment: input.dropOff.apartment,
        },
        receiver: { firstName: firstName || "NA", lastName: rest.join(" ") || "NA", phone: input.dropOff.phone },
        businessReference: input.orderNumber,
        notes: input.dropOff.landmark,
        cod: 0,
      }),
    });
    if (!res.ok) throw new Error(`BOSTA_CREATE_FAILED:${res.status}`);
    const body = (await res.json()) as { data?: { trackingNumber?: string } };
    const trackingNumber = body.data?.trackingNumber;
    if (!trackingNumber) throw new Error("BOSTA_CREATE_INVALID");
    return { trackingNumber, status: "CREATED", trackingUrl: this.trackingUrl(trackingNumber) };
  }

  async track(trackingNumber: string): Promise<TrackingResult> {
    const res = await fetch(`${this.base}/deliveries/business/${encodeURIComponent(trackingNumber)}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`BOSTA_TRACK_FAILED:${res.status}`);
    const body = (await res.json()) as { data?: { state?: { code?: number }; timeline?: { code?: number; date?: string }[] } };
    const events = (body.data?.timeline ?? [])
      .map((e) => ({ status: STATE_MAP[e.code ?? -1], at: e.date ?? "" }))
      .filter((e): e is { status: ShipmentStatus; at: string } => Boolean(e.status && e.at));
    return { status: STATE_MAP[body.data?.state?.code ?? 10] ?? "CREATED", events };
  }

  trackingUrl(trackingNumber: string): string {
    return `https://bosta.co/tracking-shipments?shipment-number=${encodeURIComponent(trackingNumber)}`;
  }
}
