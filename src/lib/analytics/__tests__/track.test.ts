import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/db", () => ({ db: { event: { create: (...a: unknown[]) => create(...a) } } }));

import { ANALYTICS_EVENTS, CLIENT_EVENTS, OPS_EVENTS, isEventName } from "@/lib/analytics/events";
import { deviceOf, sanitizeProps, track } from "@/lib/analytics/track";
import { referrerType } from "@/lib/analytics/client";

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("event names (launch-metrics.md §1)", () => {
  it("are exactly the 17 funnel events", () => {
    expect(ANALYTICS_EVENTS).toHaveLength(17);
    expect(new Set(ANALYTICS_EVENTS).size).toBe(17);
    expect([...ANALYTICS_EVENTS].sort()).toEqual(
      [
        "visit", "design_started", "artwork_uploaded", "design_completed", "gate_shown", "account_created", "price_viewed",
        "export_png", "design_saved", "share_link_created", "share_link_visit", "order_started", "proof_approved",
        "payment_succeeded", "order_delivered", "reprint_opened", "dispute_opened",
      ].sort(),
    );
  });
  it("client allowlist excludes server-truth events", () => {
    for (const n of ["account_created", "price_viewed", "payment_succeeded", "proof_approved", "order_started", "share_link_created", "share_link_visit", "dispute_opened"]) {
      expect(CLIENT_EVENTS as readonly string[]).not.toContain(n);
    }
    for (const n of CLIENT_EVENTS) expect(ANALYTICS_EVENTS as readonly string[]).toContain(n);
    expect(OPS_EVENTS.some((n) => (ANALYTICS_EVENTS as readonly string[]).includes(n))).toBe(false);
  });
});

describe("track()", () => {
  it("writes a known event with pseudonymous ids", async () => {
    await track("price_viewed", { structure_code: "FEFCO_0427", quantity: 500 }, { userId: "user_1", designId: "d_1" });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: "price_viewed", userId: "user_1", designId: "d_1", anonId: null, orderId: null, props: { structure_code: "FEFCO_0427", quantity: 500 } });
    expect(data.at).toBeInstanceOf(Date);
  });

  it("drops names outside the allowlist", async () => {
    await track("purchase" as never, {});
    await track("__proto__" as never, {});
    expect(create).not.toHaveBeenCalled();
    expect(isEventName("visit")).toBe(true);
    expect(isEventName("pageview")).toBe(false);
  });

  it("never throws into the caller (db failure, sync throw)", async () => {
    create.mockRejectedValueOnce(new Error("db down"));
    await expect(track("visit", {})).resolves.toBeUndefined();
    create.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    await expect(track("visit", {})).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects malformed ids instead of storing them", async () => {
    await track("visit", {}, { userId: "+201001234567", anonId: "x".repeat(200) });
    const data = create.mock.calls[0][0].data;
    expect(data.userId).toBeNull();
    expect(data.anonId).toBeNull();
  });

  it("stores no phone, email, IP, name or address (PDPL data minimisation)", async () => {
    await track("account_created", {
      phone: "+201001234567",
      buyer_phone: "01001234567",
      email: "a@b.co",
      ip: "10.0.0.1",
      name: "Mona",
      address: "12 Tahrir St",
      user_agent: "Mozilla/5.0",
      note: "call me on 0100 123 4567",
      contact: "mona@example.com",
      origin: "203.0.113.9",
      v6: "2001:db8:85a3::8a2e:370:7334",
      gate_reason: "price",
      structure_code: "FEFCO_0427",
      marketing_consent: true,
    });
    const props = create.mock.calls[0][0].data.props;
    expect(props).toEqual({ gate_reason: "price", structure_code: "FEFCO_0427", marketing_consent: true });
    expect(JSON.stringify(create.mock.calls[0][0].data)).not.toMatch(/1001234567|@|10\.0\.0\.1|Mona|Tahrir|Mozilla/);
  });
});

describe("sanitizeProps", () => {
  it("keeps small scalars only, truncates strings and caps keys", () => {
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeProps(many))).toHaveLength(24);
    const out = sanitizeProps({ s: "x".repeat(500), n: Number.NaN, inf: Infinity, ok: 1, b: false, nil: null, u: undefined, obj: { a: 1 } as never, "bad key": 1 });
    expect(out).toEqual({ s: "x".repeat(120), ok: 1, b: false, nil: null });
    expect(sanitizeProps(null)).toEqual({});
  });
});

describe("helpers", () => {
  it("deviceOf classifies without storing the UA", () => {
    expect(deviceOf(new Headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" }))).toBe("mobile");
    expect(deviceOf(new Headers({ "user-agent": "Mozilla/5.0 (Windows NT 10.0)" }))).toBe("desktop");
    expect(deviceOf(null)).toBe("desktop");
  });
  it("referrerType maps launch-metrics referrer types", () => {
    expect(referrerType(null, "elba.eg", "/ar/s/abc123", {})).toBe("share_link");
    expect(referrerType("www.google.com", "elba.eg", "/ar", {})).toBe("search");
    expect(referrerType("l.facebook.com", "elba.eg", "/ar", {})).toBe("social");
    expect(referrerType("l.facebook.com", "elba.eg", "/ar", { utm_medium: "cpc" })).toBe("ads");
    expect(referrerType(null, "elba.eg", "/ar", {})).toBe("direct");
  });
});
