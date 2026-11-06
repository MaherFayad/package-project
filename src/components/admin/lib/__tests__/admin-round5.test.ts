import { describe, expect, it } from "vitest";
import { hoursToExpiry, priceLines, pricedMargin, sendPriceSchema } from "../quotePricing";
import { inLeadView, leadState } from "../quoteLeads";
import { bioEditDecisionSchema } from "../moderation";

const at = (h: number) => new Date(Date.UTC(2026, 10, 6, 12) + h * 3_600_000);

describe("Send price (R4-B-03): lines, VAT and margin", () => {
  it("builds engine line kinds with 14% VAT on the whole ex-VAT subtotal", () => {
    const p = priceLines({ quantity: 5000, unitPiasters: 1800, setupPiasters: 150_000, diePiasters: 0, finishPiasters: 0, shippingPiasters: 120_000 });
    expect(p.lines.map((l) => l.kind)).toEqual(["PRODUCT", "SETUP", "SHIPPING"]);
    expect(p.lines[0]).toMatchObject({ labelKey: "pricing.line.product", quantity: 5000, unitPiasters: 1800, totalPiasters: 9_000_000 });
    expect(p).toMatchObject({ goodsPiasters: 9_150_000, shippingPiasters: 120_000, subtotalPiasters: 9_270_000, vatPiasters: 1_297_800, totalPiasters: 10_567_800 });
  });
  it("keeps optional die and finish lines when set, and never adds a discount", () => {
    const p = priceLines({ quantity: 100, unitPiasters: 1000, setupPiasters: 0, diePiasters: 50_000, finishPiasters: 25_000, shippingPiasters: 0 });
    expect(p.lines.map((l) => l.kind)).toEqual(["PRODUCT", "DIE", "FINISH"]);
    expect(p.lines.some((l) => l.kind === "DISCOUNT")).toBe(false);
    expect(p.subtotalPiasters).toBe(175_000);
  });
  it("rounds VAT half up to the piaster", () => {
    // 14% of 1,001 piasters = 140.14 -> 140; of 1,004 = 140.56 -> 141
    expect(priceLines({ quantity: 1, unitPiasters: 1001, setupPiasters: 0, diePiasters: 0, finishPiasters: 0, shippingPiasters: 0 }).vatPiasters).toBe(140);
    expect(priceLines({ quantity: 1, unitPiasters: 1004, setupPiasters: 0, diePiasters: 0, finishPiasters: 0, shippingPiasters: 0 }).vatPiasters).toBe(141);
  });
  it("margin is on goods ex-VAT ex-delivery, banded against the 20 to 30% target", () => {
    const p = priceLines({ quantity: 5000, unitPiasters: 1800, setupPiasters: 150_000, diePiasters: 0, finishPiasters: 0, shippingPiasters: 120_000 });
    expect(pricedMargin(p, 7_200_000)).toEqual({ marginPiasters: 1_950_000, pct: 21.3, band: "in" });
    expect(pricedMargin(p, 8_000_000).band).toBe("below");
    expect(pricedMargin(p, 9_500_000).band).toBe("loss");
    expect(pricedMargin(p, 6_000_000).band).toBe("above");
  });
  it("requires a printer buy price and a positive unit price", () => {
    const base = { quoteId: "q1", vendorId: "v1", quantity: 5000, unitPiasters: 1800, setupPiasters: 0, diePiasters: 0, finishPiasters: 0, shippingPiasters: 0, deliveryDays: 18, vendorCostPiasters: 7_000_000 };
    expect(sendPriceSchema.safeParse(base).success).toBe(true);
    expect(sendPriceSchema.safeParse({ ...base, vendorCostPiasters: 0 }).success).toBe(false);
    expect(sendPriceSchema.safeParse({ ...base, vendorCostPiasters: undefined }).success).toBe(false);
    expect(sendPriceSchema.safeParse({ ...base, unitPiasters: 0 }).success).toBe(false);
    expect(sendPriceSchema.safeParse({ ...base, deliveryDays: 0 }).success).toBe(false);
    expect(sendPriceSchema.safeParse({ ...base, quantity: 12.5 }).success).toBe(false);
  });
  it("counts hours to expiry", () => {
    expect(hoursToExpiry(at(5), at(0))).toBe(5);
    expect(hoursToExpiry(at(-1), at(0))).toBe(-1);
  });
});

describe("quote lead states with a sent price", () => {
  it("a sent price makes the lead PRICED; closing it afterwards wins; payment makes it ORDERED", () => {
    expect(leadState([{ action: "QUOTE_CONTACTED", createdAt: at(-5) }, { action: "QUOTE_PRICED", createdAt: at(-1) }])).toBe("PRICED");
    expect(leadState([{ action: "QUOTE_PRICED", createdAt: at(-5) }, { action: "QUOTE_CLOSED", createdAt: at(-1) }])).toBe("CLOSED");
    expect(leadState([{ action: "QUOTE_PRICED", createdAt: at(-5) }], "ACCEPTED")).toBe("ORDERED");
    expect(leadState([{ action: "toString", createdAt: at(-5) }])).toBe("OPEN");
    // R5-AD-03: a priced row without a QUOTE_PRICED log entry is still priced, not open.
    expect(leadState([], "PRICED")).toBe("PRICED");
    expect(leadState([{ action: "QUOTE_CLOSED", createdAt: at(-1) }], "PRICED")).toBe("CLOSED");
  });
  it("Priced view lists priced leads; Closed lists closed and ordered", () => {
    expect(inLeadView({ state: "PRICED", overdue: false }, "priced")).toBe(true);
    expect(inLeadView({ state: "PRICED", overdue: false }, "open")).toBe(false);
    expect(inLeadView({ state: "ORDERED", overdue: false }, "closed")).toBe(true);
  });
});

describe("bio edit decisions (R6-05)", () => {
  it("accepts approve, reject and clean with the edit the reviewer saw", () => {
    for (const decision of ["APPROVE", "REJECT", "CLEAN"]) expect(bioEditDecisionSchema.safeParse({ vendorId: "v1", decision, submittedAt: "2026-11-06T10:00:00.000Z" }).success).toBe(true);
    expect(bioEditDecisionSchema.safeParse({ vendorId: "v1", decision: "PUBLISH", submittedAt: null }).success).toBe(false);
  });
});

describe("sample buy price (R4-B-11)", () => {
  it("uses the admin's sample printer price, and the 60% assumption only when it is not set", async () => {
    const { sampleOffer } = await import("@/lib/orders/sample");
    const offer = { lines: [{ kind: "SHIPPING", labelKey: "pricing.line.shipping", quantity: 1, unitPiasters: 14_200, totalPiasters: 14_200 }], deliveryDays: 6, leadTimeDays: 4, standardSize: true, internal: { vendorCostPiasters: 1, marginPiasters: 1 } } as unknown as Parameters<typeof sampleOffer>[0];
    expect(sampleOffer(offer, 5, 75_000).internal).toMatchObject({ vendorCostPiasters: 45_000, marginPiasters: 30_000 });
    expect(sampleOffer(offer, 5, 75_000, 52_000).internal).toMatchObject({ vendorCostPiasters: 52_000, marginPiasters: 23_000 });
  });
});

describe("audit summaries without raw ids (R4-CR-13)", () => {
  it("drops cuid-like ids and keeps words", async () => {
    const { readableSummary } = await import("../audit");
    expect(readableSummary("Nile Pack Printing & Packaging photo cmw4ogi8700037drbi0sbz1ku")).toBe("Nile Pack Printing & Packaging photo");
    expect(readableSummary("Nile Pack photo cmw4ogi8700037drbi0sbz1ku: blurry")).toBe("Nile Pack photo: blurry");
    expect(readableSummary("corrugatedcardboardmailersonly is fine")).toBe("corrugatedcardboardmailersonly is fine");
  });
});

describe("bio edit diff (R5-AD)", () => {
  it("marks the added words only", async () => {
    const { wordDiff } = await import("../moderation");
    const d = wordDiff("Fast digital shop.", "Fast digital shop. WhatsApp 0100 123 4567");
    expect(d.filter((p) => p.added).map((p) => p.text.trim())).toEqual(["WhatsApp 0100 123 4567"]);
    expect(d.map((p) => p.text).join("")).toBe("Fast digital shop. WhatsApp 0100 123 4567");
    expect(wordDiff("same text", "same text").some((p) => p.added)).toBe(false);
    expect(wordDiff("", "new bio")).toEqual([{ text: "new bio", added: true }]);
  });
});
