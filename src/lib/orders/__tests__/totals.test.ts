import { describe, expect, it } from "vitest";
import type { QuoteLine } from "@/types";
import { GOVERNORATES, governorateKey } from "../governorates";
import { invoiceBreakdown, isQuoteValid, nextSequence, orderTotals, vatOn } from "../totals";
import { zoneForGovernorate } from "@/lib/pricing";

const lines: QuoteLine[] = [
  { kind: "PRODUCT", labelKey: "pricing.line.product", quantity: 500, unitPiasters: 1000, totalPiasters: 500_000 },
  { kind: "SETUP", labelKey: "pricing.line.setup", quantity: 1, unitPiasters: 50_000, totalPiasters: 50_000 },
  { kind: "SHIPPING", labelKey: "pricing.line.shipping", quantity: 1, unitPiasters: 15_000, totalPiasters: 15_000 },
];

describe("order totals", () => {
  it("charges 14% VAT on the whole ex-VAT subtotal, rounded half up", () => {
    const t = orderTotals(lines);
    expect(t.subtotalPiasters).toBe(565_000);
    expect(t.vatPiasters).toBe(79_100);
    expect(t.totalPiasters).toBe(644_100);
    expect(t.shippingPiasters).toBe(15_000);
    expect(vatOn(5)).toBe(1); // 0.7 → 1
    expect(vatOn(3)).toBe(0); // 0.42 → 0
  });

  it("applies the prepay discount to goods only", () => {
    const t = orderTotals(lines, 3);
    expect(t.discountPiasters).toBe(16_500); // 3% of 550,000
    expect(t.lines.at(-1)).toMatchObject({ kind: "DISCOUNT", totalPiasters: -16_500 });
    expect(t.subtotalPiasters).toBe(548_500);
    expect(t.totalPiasters).toBe(t.subtotalPiasters + t.vatPiasters);
  });

  it("does not stack discounts when re-applied", () => {
    const once = orderTotals(lines, 3);
    expect(orderTotals(once.lines, 3).totalPiasters).toBe(once.totalPiasters);
  });

  it("breaks an invoice into goods, shipping and VAT", () => {
    const b = invoiceBreakdown({ subtotalPiasters: 565_000, vatPiasters: 79_100, shippingPiasters: 15_000 });
    expect(b).toMatchObject({ goodsPiasters: 550_000, shippingPiasters: 15_000, netPiasters: 565_000, totalPiasters: 644_100 });
  });

  it("expires quotes", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(isQuoteValid("2026-11-05T12:00:01Z", now)).toBe(true);
    expect(isQuoteValid("2026-11-05T11:59:59Z", now)).toBe(false);
  });

  it("numbers orders sequentially per prefix", () => {
    expect(nextSequence("ELB-26", [])).toBe("ELB-26001");
    expect(nextSequence("ELB-26", ["ELB-26001", "ELB-26009", "ELB-25999"])).toBe("ELB-26010");
    expect(nextSequence("ELB-26", ["ELB-26999"])).toBe("ELB-261000");
  });
});

describe("governorates", () => {
  it("lists all 27 and each maps to a delivery zone", () => {
    expect(GOVERNORATES).toHaveLength(27);
    expect(new Set(GOVERNORATES.map((g) => g.key)).size).toBe(27);
    for (const g of GOVERNORATES) expect(zoneForGovernorate(g.name), g.name).not.toBeNull();
    expect(governorateKey("cairo")).toBe("CAIRO");
  });
});
