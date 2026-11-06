import { describe, expect, it } from "vitest";
import { inAvailabilityView, modelAvailability, vendorsByPair } from "../availability";
import { isQuoteOnly, marginPreview, needsManualCost } from "../orders";
import { canRaisePayout, inPayoutView, needsAction, nextPayoutStep, payoutAmount, payoutStepSchema } from "../payouts";
import { settingsFormSchema } from "../pricingSettings";

describe("model availability in Egypt", () => {
  const pairs = vendorsByPair([
    { vendorId: "v1", structureCode: "FEFCO_0201", materialCode: "B_FLUTE_KRAFT" },
    { vendorId: "v2", structureCode: "FEFCO_0201", materialCode: "B_FLUTE_KRAFT" },
    { vendorId: "v2", structureCode: "FEFCO_0427", materialCode: "E_FLUTE_KRAFT" },
  ]);

  it("is instant when any board has a vendor, counting distinct vendors and priced boards", () => {
    const a = modelAvailability(
      {
        code: "FEFCO_0203",
        routes: [
          { structureCode: "FEFCO_0201", materialCode: "B_FLUTE_KRAFT" },
          { structureCode: "FEFCO_0201", materialCode: "E_FLUTE_WHITE" },
        ],
      },
      pairs,
    );
    expect(a).toEqual({ code: "FEFCO_0203", vendorIds: ["v1", "v2"], boardsPriced: 1, boardsTotal: 2, instant: true });
  });

  it("is quote-only when no vendor has a rate card for any style and board it is made as", () => {
    const a = modelAvailability({ code: "X", routes: [{ structureCode: "RIGID_BOX", materialCode: "GREYBOARD_WRAP" }] }, pairs);
    expect(a.instant).toBe(false);
    expect(a.vendorIds).toEqual([]);
    expect(inAvailabilityView(a, "quoteOnly")).toBe(true);
    expect(inAvailabilityView(a, "instant")).toBe(false);
    expect(inAvailabilityView(a, "all")).toBe(true);
  });
});

describe("quote-only routing", () => {
  it("flags a job no vendor can price and requires a buy price for a vendor without a rate card", () => {
    expect(isQuoteOnly([{ capable: false }, { capable: false }])).toBe(true);
    expect(isQuoteOnly([{ capable: false }, { capable: true }])).toBe(false);
    expect(needsManualCost(false, null)).toBe(true);
    expect(needsManualCost(false, 120000)).toBe(false);
    expect(needsManualCost(true, null)).toBe(false);
  });

  it("previews the margin against the 20 to 30% band", () => {
    expect(marginPreview(600000, 450000)).toEqual({ marginPiasters: 150000, pct: 25, band: "in" });
    expect(marginPreview(600000, 540000).band).toBe("below");
    expect(marginPreview(600000, 300000).band).toBe("above");
    expect(marginPreview(600000, 700000)).toMatchObject({ marginPiasters: -100000, band: "loss" });
    expect(marginPreview(0, 0)).toMatchObject({ pct: null, band: "below" });
  });
});

describe("payout approvals", () => {
  it("earns the advance on acceptance and the balance only on delivery", () => {
    expect(canRaisePayout("ADVANCE", "PAID")).toBe(false);
    expect(canRaisePayout("ADVANCE", "ACCEPTED")).toBe(true);
    expect(canRaisePayout("BALANCE", "SHIPPED")).toBe(false);
    expect(canRaisePayout("BALANCE", "DELIVERED")).toBe(true);
    expect(canRaisePayout("ADVANCE", "REFUNDED")).toBe(false);
  });

  it("splits the buy price 40/60 without losing a piaster", () => {
    expect(payoutAmount("ADVANCE", 450001) + payoutAmount("BALANCE", 450001)).toBe(450001);
    expect(payoutAmount("ADVANCE", 450000)).toBe(180000);
  });

  it("offers one next step per state", () => {
    expect(nextPayoutStep({ status: "ON_HOLD", kind: "BALANCE" }, "DELIVERED")).toBe("RAISE");
    expect(nextPayoutStep({ status: "SCHEDULED", kind: "BALANCE" }, "IN_PRODUCTION")).toBeNull();
    expect(nextPayoutStep({ status: "PENDING", kind: "ADVANCE" }, "ACCEPTED")).toBe("APPROVE");
    expect(nextPayoutStep({ status: "APPROVED", kind: "ADVANCE" }, "ACCEPTED")).toBe("PAY");
    expect(nextPayoutStep({ status: "PAID", kind: "ADVANCE" }, "DELIVERED")).toBeNull();
    expect(needsAction("SCHEDULED", "BALANCE", "IN_PRODUCTION")).toBe(false);
  });

  it("sorts rows into to-do, scheduled and paid views", () => {
    expect(inPayoutView({ status: "PENDING", kind: "ADVANCE", orderStatus: "ACCEPTED" }, "todo")).toBe(true);
    expect(inPayoutView({ status: "SCHEDULED", kind: "BALANCE", orderStatus: "IN_PRODUCTION" }, "scheduled")).toBe(true);
    expect(inPayoutView({ status: "PAID", kind: "BALANCE", orderStatus: "DELIVERED" }, "paid")).toBe(true);
    expect(inPayoutView({ status: "PAID", kind: "BALANCE", orderStatus: "DELIVERED" }, "scheduled")).toBe(false);
  });

  it("validates step input", () => {
    expect(payoutStepSchema.safeParse({ orderId: "o1", kind: "BALANCE", step: "PAY", eInvoice: true }).success).toBe(true);
    expect(payoutStepSchema.safeParse({ orderId: "o1", kind: "BONUS", step: "PAY" }).success).toBe(false);
  });
});

describe("pricing settings", () => {
  const zone = { basePiasters: 7000, includedKg: 5, perExtraKgPiasters: 800, freightPerLoadPiasters: 90000, transitDays: 1 };
  const base = { marginPct: 0.25, marginOnShipping: false, quoteValidityHours: 72, zones: { GREATER_CAIRO: zone, ALEXANDRIA: zone, DELTA: zone, CANAL: zone, UPPER_EGYPT: zone } };
  it("caps quote validity at 72 hours with a specific error code", () => {
    const r = settingsFormSchema.safeParse({ ...base, quoteValidityHours: 96 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("VALIDITY_RANGE");
  });
});

describe("dispute hold on the balance", () => {
  it("holds an unpaid balance while a dispute is open, never the advance", () => {
    expect(nextPayoutStep({ status: "PENDING", kind: "BALANCE" }, "DELIVERED", true)).toBeNull();
    expect(nextPayoutStep({ status: "ON_HOLD", kind: "BALANCE" }, "DELIVERED", true)).toBeNull();
    expect(nextPayoutStep({ status: "APPROVED", kind: "ADVANCE" }, "DELIVERED", true)).toBe("PAY");
    expect(inPayoutView({ status: "PENDING", kind: "BALANCE", orderStatus: "DELIVERED", openDispute: true }, "scheduled")).toBe(true);
  });
});

describe("admin payout status", () => {
  it("shows an earned part without a row as to raise", async () => {
    const { adminPayoutStatus } = await import("../payouts");
    expect(adminPayoutStatus({ status: "SCHEDULED", kind: "ADVANCE" }, "QC_PENDING")).toBe("ON_HOLD");
    expect(adminPayoutStatus({ status: "SCHEDULED", kind: "BALANCE" }, "QC_PENDING")).toBe("SCHEDULED");
  });
});
