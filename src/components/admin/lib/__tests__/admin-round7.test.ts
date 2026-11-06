import { describe, expect, it } from "vitest";
import { cohortFunnel, visitorToPaid } from "../events";

describe("visitor-cohort funnel (R5-JR-13)", () => {
  it("joins an anonymous visit to the same person's signed-in steps", () => {
    const rows = [
      { name: "visit", userId: null, anonId: "a1" },
      { name: "design_started", userId: null, anonId: "a1" },
      { name: "account_created", userId: "u1", anonId: "a1" },
      { name: "price_viewed", userId: "u1", anonId: null },
      { name: "payment_succeeded", userId: "u1", anonId: null },
    ];
    const f = cohortFunnel(rows);
    expect(f).toMatchObject({ visit: 1, design_started: 1, gate_shown: 1, account_created: 1, price_viewed: 1, order_started: 1, payment_succeeded: 1 });
    expect(visitorToPaid(f)).toBe(100);
  });
  it("leaves out people with no visit in the window and never lets a step exceed the one before", () => {
    const rows = [
      { name: "visit", userId: null, anonId: "a1" },
      { name: "visit", userId: null, anonId: "a2" },
      { name: "visit", userId: null, anonId: "a3" },
      { name: "visit", userId: null, anonId: "a4" },
      { name: "design_started", userId: null, anonId: "a1" },
      { name: "design_started", userId: null, anonId: "a1" },
      { name: "design_started", userId: null, anonId: "zz" }, // no visit: not in the cohort
      { name: "payment_succeeded", userId: "u9", anonId: null }, // paid without a linked visit
    ];
    const f = cohortFunnel(rows);
    expect(f.visit).toBe(4);
    expect(f.design_started).toBe(1);
    expect(f.payment_succeeded).toBe(0);
    const v = Object.values(f);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeLessThanOrEqual(v[i - 1]!);
  });
});

describe("on-time from real deliveries (R5-JR-05)", () => {
  it("counts deliveries by the end of the promised day; skips reprints and undelivered orders", async () => {
    const { onTimeFromDeliveries } = await import("@/lib/vendors/on-time");
    const d = (s: string) => new Date(s);
    const r = onTimeFromDeliveries([
      { dueDate: d("2026-11-01T00:00:00Z"), deliveredAt: d("2026-11-01T22:00:00Z"), notes: null }, // same day: on time
      { dueDate: d("2026-11-01T00:00:00Z"), deliveredAt: d("2026-11-02T08:00:00Z"), notes: null }, // late
      { dueDate: d("2026-11-01T00:00:00Z"), deliveredAt: d("2026-11-05T08:00:00Z"), notes: "REPRINT_OF:ELB-1" }, // reprint: skipped
      { dueDate: d("2026-11-01T00:00:00Z"), deliveredAt: null, notes: null },
      { dueDate: null, deliveredAt: d("2026-11-01T08:00:00Z"), notes: null },
    ]);
    expect(r).toEqual({ judged: 2, onTime: 1, pct: 50 });
    expect(onTimeFromDeliveries([]).pct).toBeNull();
  });
});

describe("reprint quantity and charge-back (R5-JR-09)", () => {
  it("defaults: full charge-back for print defects, none otherwise", async () => {
    const { defaultChargeBack } = await import("../ops");
    expect(defaultChargeBack("PRINT_DEFECT")).toBe("FULL");
    expect(defaultChargeBack("LATE")).toBe("NONE");
    expect(defaultChargeBack("DAMAGED")).toBe("NONE");
  });
  it("40 smudged boxes of 500: reprint 40, pro-rata buy price, the same printer pays for it", async () => {
    const { planReprint } = await import("../ops");
    const p = planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 819_600, sameVendor: true, terms: { quantity: 40, chargeBack: "FULL" } });
    expect(p).toEqual({ quantity: 40, reprintCostPiasters: 163_920, chargeBackPiasters: 163_920, reprintVendorCostPiasters: 0, originalVendorCostPiasters: 2_049_000, owedPiasters: 0 });
    const none = planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 0, sameVendor: true, terms: { quantity: 40, chargeBack: "NONE" } });
    expect(none).toMatchObject({ reprintVendorCostPiasters: 163_920, chargeBackPiasters: 0 });
    const part = planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 0, sameVendor: true, terms: { quantity: 40, chargeBack: "PARTIAL", chargeBackPiasters: 60_000 } });
    expect(part).toMatchObject({ reprintVendorCostPiasters: 103_920, chargeBackPiasters: 60_000 });
  });
  it("another printer is paid in full; the charge-back comes off the original buy price, any excess is owed", async () => {
    const { planReprint } = await import("../ops");
    const p = planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 819_600, sameVendor: false, terms: { quantity: 40, chargeBack: "FULL" } });
    expect(p).toMatchObject({ reprintVendorCostPiasters: 163_920, originalVendorCostPiasters: 1_885_080, owedPiasters: 0 });
    // Original fully paid already: nothing left to take off, the charge-back is owed back.
    const paid = planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 2_049_000, sameVendor: false, terms: { quantity: 40, chargeBack: "FULL" } });
    expect(paid).toMatchObject({ originalVendorCostPiasters: 2_049_000, owedPiasters: 163_920 });
  });
  it("rejects a quantity above the order and a charge-back above the reprint cost", async () => {
    const { planReprint } = await import("../ops");
    expect(planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 0, sameVendor: true, terms: { quantity: 501, chargeBack: "FULL" } })).toBe("QTY_RANGE");
    expect(planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 0, sameVendor: true, terms: { quantity: 40, chargeBack: "PARTIAL", chargeBackPiasters: 200_000 } })).toBe("CHARGE_RANGE");
    expect(planReprint({ originalQty: 500, originalCostPiasters: 2_049_000, paidToOriginalPiasters: 0, sameVendor: true, terms: { quantity: 40, chargeBack: "PARTIAL" } })).toBe("CHARGE_RANGE");
  });
});
