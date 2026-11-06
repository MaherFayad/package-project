import { describe, expect, it } from "vitest";
import { cohortFunnel, visitorToPaid } from "../events";

describe("visitor funnel (R5-JR-13, rule from the round 8 hand count)", () => {
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
  it("hand count of the seeded e2e run: 2 id-less visits and 3 signed-in buyers (1 paid)", () => {
    const rows = [
      { name: "visit", userId: null, anonId: null },
      { name: "visit", userId: null, anonId: null },
      ...["b1", "b2", "b3"].flatMap((u) => ["design_started", "account_created", "price_viewed", "order_started"].map((name) => ({ name, userId: u, anonId: null }))),
      { name: "payment_succeeded", userId: "b3", anonId: null },
    ];
    const f = cohortFunnel(rows);
    expect(f).toEqual({ visit: 5, design_started: 3, gate_shown: 3, account_created: 3, price_viewed: 3, order_started: 3, payment_succeeded: 1 });
    expect(visitorToPaid(f)).toBe(20);
  });
  it("never lets a step exceed the one before; id-less later steps are not counted", () => {
    const rows = [
      { name: "visit", userId: null, anonId: "a1" },
      { name: "design_started", userId: null, anonId: "a1" },
      { name: "design_started", userId: null, anonId: "a1" },
      { name: "design_started", userId: null, anonId: null },
      { name: "visit", userId: null, anonId: null },
    ];
    const f = cohortFunnel(rows);
    expect(f.visit).toBe(2);
    expect(f.design_started).toBe(1);
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

describe("public on-time threshold (admin round 8)", () => {
  it("publishes the figure only from the minimum; below it the stored figure is untouched", async () => {
    const { onTimeWrite } = await import("@/lib/vendors/on-time");
    expect(onTimeWrite({ judged: 1, pct: 0 }, 5)).toEqual({ onTimeJudged: 1, onTimePublic: false });
    expect(onTimeWrite({ judged: 4, pct: 75 }, 5)).toEqual({ onTimeJudged: 4, onTimePublic: false });
    expect(onTimeWrite({ judged: 5, pct: 80 }, 5)).toEqual({ onTimeJudged: 5, onTimePublic: true, onTimePct: 80 });
    expect(onTimeWrite({ judged: 0, pct: null }, 1)).toEqual({ onTimeJudged: 0, onTimePublic: false });
  });
});
