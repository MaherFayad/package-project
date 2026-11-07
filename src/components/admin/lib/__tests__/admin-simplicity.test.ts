import { describe, expect, it } from "vitest";
import { AWAITING_VENDOR_STATUSES, countByOrderView, inView, marginPreview, ORDERS_TO_ACT_STATUSES, settingsMarginPct } from "../orders";

/** Simplicity review 2026-11 (docs/audit/simplicity-2026-11/portals-review.md, admin A-02, A-04). */
describe("A-02: one margin definition (share of the sale price)", () => {
  it("converts the markup setting into the order-side margin, after the prepay discount", () => {
    expect(settingsMarginPct(0.25)).toBe(20);
    expect(settingsMarginPct(0.25, 3)).toBe(17.5);
    expect(settingsMarginPct(0, 0)).toBe(0);
  });

  it("an order priced by the current settings shows no warning (ELB-26307: 18,483.35 goods, 15,245.46 buy price)", () => {
    const m = marginPreview(1_848_335, 1_524_546, settingsMarginPct(0.25, 3));
    expect(m.pct).toBe(17.5);
    expect(m.band).toBe("in");
  });

  it("warns when an order earns less than the settings give, or sells at a loss", () => {
    expect(marginPreview(1_000_000, 900_000, 17.5).band).toBe("below");
    expect(marginPreview(1_000_000, 1_100_000, 17.5).band).toBe("loss");
    expect(marginPreview(1_000_000, 600_000, 17.5).band).toBe("above");
  });

  it("without a settings figure the business-plan floor (20%) applies", () => {
    expect(marginPreview(1_000_000, 825_000).band).toBe("below");
    expect(marginPreview(1_000_000, 750_000).band).toBe("in");
  });
});

describe("A-04: one count per queue", () => {
  it("unpaid orders are not waiting for a printer", () => {
    expect(inView("PENDING_PAYMENT", "attention")).toBe(false);
    expect(inView("PENDING_PAYMENT", "unpaid")).toBe(true);
    expect(AWAITING_VENDOR_STATUSES.every((s) => inView(s, "attention"))).toBe(true);
  });

  it("the nav badge counts exactly the 'awaiting vendor' and 'QC review' tabs", () => {
    const rows = ["PENDING_PAYMENT", "PENDING_PAYMENT", "PAID", "PAID", "PROOF_APPROVED", "QC_PENDING", "ACCEPTED", "DELIVERED"].map((status) => ({ status }));
    const c = countByOrderView(rows);
    const badge = rows.filter((r) => (ORDERS_TO_ACT_STATUSES as string[]).includes(r.status)).length;
    expect(c.unpaid).toBe(2);
    expect(c.attention).toBe(3);
    expect(badge).toBe(c.attention + c.qc);
  });
});
