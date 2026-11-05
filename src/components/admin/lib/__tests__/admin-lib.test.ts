import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING_CONFIG, makeConfig, type PricingConfig } from "@/lib/pricing";
import {
  bucketSeries,
  changePct,
  funnel,
  goodsNet,
  isOnTime,
  marginOf,
  moneyKpis,
  opsKpis,
  rangeWindow,
  scorecard,
  asRange,
  type MetricOrder,
} from "../metrics";
import {
  applyGoodsOverride,
  canOverrideCost,
  canOverridePrice,
  canReassign,
  canRefund,
  canReviewQc,
  countByOrderView,
  filterOrders,
  overrideSchema,
  reassignSchema,
  reprintNote,
  reprintNumber,
  reprintSource,
  statusAfterReassign,
  type AdminOrderRow,
} from "../orders";
import {
  allowedDecisions,
  anonymisedPhone,
  applicationDecisionSchema,
  canApprove,
  decodeReviewNote,
  deletionBlockers,
  disputeDecisionSchema,
  encodeReviewNote,
  maskPhone,
  missingRequired,
  statusForDecision,
  vendorStatusAfter,
  vendorStatusSchema,
  dataRequestDecisionSchema,
} from "../ops";
import {
  appendIndexRow,
  bumpBoard,
  currentMultipliers,
  defaultSettings,
  indexUpdateSchema,
  parseStoredSettings,
  previewPriceChanges,
  settingsFormSchema,
  settingsToConfig,
} from "../pricingSettings";
import { changedFields, defaultFits, mergeLimits, outsideHardBounds, structureUpdateSchema } from "../catalog";

const NOW = new Date("2026-11-05T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function order(p: Partial<MetricOrder> = {}): MetricOrder {
  return {
    number: "ELB-1",
    status: "DELIVERED",
    placedAt: days(-5),
    paidAt: days(-5),
    dueDate: days(-1),
    deliveredAt: days(-2),
    // checkout convention: subtotal includes delivery, total = subtotal + VAT
    subtotalPiasters: 110_000,
    vatPiasters: 15_400,
    shippingPiasters: 10_000,
    totalPiasters: 125_400,
    vendorCostPiasters: 70_000,
    notes: null,
    ...p,
  };
}

describe("metrics: money", () => {
  it("goodsNet handles both subtotal conventions", () => {
    expect(goodsNet(order())).toBe(100_000);
    // legacy: subtotal excludes delivery, total = subtotal + shipping + VAT
    expect(goodsNet({ subtotalPiasters: 100_000, shippingPiasters: 10_000, vatPiasters: 15_400, totalPiasters: 125_400 })).toBe(100_000);
  });

  it("margin is goods minus vendor cost", () => {
    expect(marginOf(order())).toBe(30_000);
  });

  it("moneyKpis ignores unpaid, refunded and reprint orders and orders outside the window", () => {
    const { from, to } = rangeWindow("30d", NOW);
    const k = moneyKpis(
      [
        order(),
        order({ number: "x", status: "PENDING_PAYMENT" }),
        order({ number: "y", status: "REFUNDED" }),
        order({ number: "z", notes: "REPRINT_OF:ELB-1:d1", totalPiasters: 0, subtotalPiasters: 0, vatPiasters: 0 }),
        order({ number: "old", placedAt: days(-60) }),
      ],
      from,
      to,
    );
    expect(k.orders).toBe(1);
    expect(k.gmvPiasters).toBe(125_400);
    expect(k.marginPiasters).toBe(30_000);
    expect(k.marginPct).toBe(30);
    expect(k.aovPiasters).toBe(125_400);
  });

  it("marginPct is null with no revenue", () => {
    const { from, to } = rangeWindow("7d", NOW);
    expect(moneyKpis([], from, to).marginPct).toBeNull();
  });
});

describe("metrics: operations", () => {
  it("on time when delivered on or before the due day", () => {
    expect(isOnTime({ dueDate: new Date("2026-11-01T00:00:00Z"), deliveredAt: new Date("2026-11-01T20:00:00Z") })).toBe(true);
    expect(isOnTime({ dueDate: new Date("2026-11-01T00:00:00Z"), deliveredAt: new Date("2026-11-02T08:00:00Z") })).toBe(false);
    expect(isOnTime({ dueDate: null, deliveredAt: NOW })).toBeNull();
  });

  it("opsKpis computes on-time, reprint and dispute rates", () => {
    const { from, to } = rangeWindow("30d", NOW);
    const k = opsKpis(
      [
        order({ number: "a" }),
        order({ number: "b", deliveredAt: days(-0.1), dueDate: days(-3) }),
        order({ number: "c", status: "SHIPPED", deliveredAt: null }),
        order({ number: "a-R1", status: "PAID", notes: "REPRINT_OF:a:d", deliveredAt: null }),
      ],
      [
        { createdAt: days(-1), status: "OPEN" },
        { createdAt: days(-90), status: "REJECTED" },
      ],
      from,
      to,
    );
    expect(k.delivered).toBe(2);
    expect(k.onTimePct).toBe(50);
    expect(k.fulfilled).toBe(3);
    expect(k.reprints).toBe(1);
    expect(k.reprintPct).toBe(33.3);
    expect(k.disputes).toBe(1);
    expect(k.openDisputes).toBe(1);
  });

  it("asRange falls back to 30d", () => {
    expect(asRange("7d")).toBe("7d");
    expect(asRange("1y")).toBe("30d");
    expect(asRange(null)).toBe("30d");
  });
});

describe("metrics: funnel, series, scorecard", () => {
  it("funnel computes step and overall conversion", () => {
    const f = funnel({ designs: 200, accounts: 50, priceViewed: 25, orders: 5 });
    expect(f.map((r) => r.ofFirstPct)).toEqual([100, 25, 12.5, 2.5]);
    expect(f.map((r) => r.ofPrevPct)).toEqual([null, 25, 50, 20]);
    expect(funnel({ designs: 0, accounts: 0, priceViewed: 0, orders: 0 })[1]!.ofFirstPct).toBeNull();
  });

  it("bucketSeries sums values into equal buckets", () => {
    const from = days(-6);
    const s = bucketSeries([{ d: days(-6), v: 1 }, { d: days(-5.5), v: 2 }, { d: days(-1), v: 5 }, { d: days(-30), v: 100 }], (r) => r.d, (r) => r.v, from, NOW, 1);
    expect(s).toHaveLength(6);
    expect(s[0]!.value).toBe(3);
    expect(s[5]!.value).toBe(5);
    expect(s.reduce((a, p) => a + p.value, 0)).toBe(8);
  });

  it("changePct", () => {
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(5, 0)).toBeNull();
  });

  it("scorecard rolls up a vendor", () => {
    const sc = scorecard({
      vendorId: "v1",
      orders: [order({ number: "a" }), order({ number: "b", deliveredAt: days(1), dueDate: days(-2) }), order({ number: "a-R1", notes: "REPRINT_OF:a:d" })],
      disputes: [{ orderNumber: "a", status: "RESOLVED_REPRINT" }],
      ratings: [5, 4],
      qc: [{ status: "APPROVED" }, { status: "REJECTED" }, { status: "PENDING" }],
    });
    expect(sc.orders).toBe(2);
    expect(sc.onTimePct).toBe(50);
    expect(sc.reprintPct).toBe(50);
    expect(sc.rating).toBe(4.5);
    expect(sc.qcPassPct).toBe(50);
    expect(sc.health).toBeGreaterThanOrEqual(0);
    expect(sc.health).toBeLessThanOrEqual(100);
  });
});

describe("orders: routing, override, refund, QC, reprint", () => {
  it("reassignment only before production; ACCEPTED goes back to PAID", () => {
    expect(canReassign("PAID")).toBe(true);
    expect(canReassign("ACCEPTED")).toBe(true);
    expect(canReassign("IN_PRODUCTION")).toBe(false);
    expect(statusAfterReassign("ACCEPTED")).toBe("PAID");
    expect(statusAfterReassign("PAID")).toBe("PAID");
  });

  it("reassign and override schemas need a reason", () => {
    expect(reassignSchema.safeParse({ orderId: "o", vendorId: "v", vendorCostPiasters: null, reason: "" }).success).toBe(false);
    expect(reassignSchema.safeParse({ orderId: "o", vendorId: "v", vendorCostPiasters: 100, reason: "capacity" }).success).toBe(true);
    expect(overrideSchema.safeParse({ orderId: "o", goodsPiasters: -1, vendorCostPiasters: null, reason: "fix" }).success).toBe(false);
  });

  it("price override only before payment, cost override until delivery", () => {
    expect(canOverridePrice("PENDING_PAYMENT")).toBe(true);
    expect(canOverridePrice("PAID")).toBe(false);
    expect(canOverrideCost("IN_PRODUCTION")).toBe(true);
    expect(canOverrideCost("DELIVERED")).toBe(false);
  });

  it("applyGoodsOverride recomputes VAT and keeps the subtotal convention", () => {
    const checkout = applyGoodsOverride({ subtotalPiasters: 110_000, vatPiasters: 15_400, shippingPiasters: 10_000, totalPiasters: 125_400 }, 90_000);
    expect(checkout).toEqual({ subtotalPiasters: 100_000, vatPiasters: 14_000, shippingPiasters: 10_000, totalPiasters: 114_000 });
    const legacy = applyGoodsOverride({ subtotalPiasters: 100_000, vatPiasters: 15_400, shippingPiasters: 10_000, totalPiasters: 125_400 }, 90_000);
    expect(legacy.subtotalPiasters).toBe(90_000);
    expect(legacy.totalPiasters).toBe(114_000);
  });

  it("refund needs a paid payment and a refundable status", () => {
    expect(canRefund("IN_PRODUCTION", [{ status: "PAID" }])).toBe(true);
    expect(canRefund("IN_PRODUCTION", [{ status: "PENDING" }])).toBe(false);
    expect(canRefund("SHIPPED", [{ status: "PAID" }])).toBe(false);
    expect(canRefund("REFUNDED", [{ status: "PAID" }])).toBe(false);
  });

  it("QC review needs QC_PENDING and photos", () => {
    expect(canReviewQc("QC_PENDING", [{ status: "PENDING" }])).toBe(true);
    expect(canReviewQc("QC_PENDING", [])).toBe(false);
    expect(canReviewQc("IN_PRODUCTION", [{ status: "PENDING" }])).toBe(false);
  });

  it("reprint numbers increment and point back to the original", () => {
    expect(reprintNumber("ELB-26203", [])).toBe("ELB-26203-R1");
    expect(reprintNumber("ELB-26203", ["ELB-26203-R1", "ELB-26203-R2", "ELB-9-R7"])).toBe("ELB-26203-R3");
    expect(reprintNumber("ELB-26203-R1", ["ELB-26203-R1"])).toBe("ELB-26203-R2");
    expect(reprintSource(reprintNote("ELB-26203", "d1"))).toBe("ELB-26203");
    expect(reprintSource("hello")).toBeNull();
  });

  it("filterOrders filters by view, query and sorts", () => {
    const rows: AdminOrderRow[] = [
      { id: "1", number: "ELB-1", status: "QC_PENDING", placedAt: "2026-11-01", buyerName: "Mona", buyerPhone: "+201000000002", vendorId: "v1", vendorName: "Nile Pack", quantity: 100, structureCode: "FEFCO_0427", totalPiasters: 500, marginPiasters: 1, paymentStatus: "PAID", openDispute: false, reprint: false },
      { id: "2", number: "ELB-2", status: "DELIVERED", placedAt: "2026-11-03", buyerName: "Ali", buyerPhone: "+201000000003", vendorId: "v2", vendorName: "Delta", quantity: 100, structureCode: "FEFCO_0427", totalPiasters: 900, marginPiasters: 1, paymentStatus: "PAID", openDispute: true, reprint: false },
    ];
    expect(filterOrders(rows, { view: "qc", query: "", sort: "newest" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterOrders(rows, { view: "all", query: "delta", sort: "newest" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterOrders(rows, { view: "all", query: "", sort: "totalAsc" }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(filterOrders(rows, { view: "all", query: "", sort: "newest", vendorId: "v1" }).map((r) => r.id)).toEqual(["1"]);
    const c = countByOrderView(rows);
    expect(c.all).toBe(2);
    expect(c.qc).toBe(1);
    expect(c.closed).toBe(1);
  });
});

describe("ops: disputes, applications, vendors, privacy", () => {
  it("dispute decisions by status", () => {
    expect(allowedDecisions("OPEN")).toContain("REVIEW");
    expect(allowedDecisions("UNDER_REVIEW")).not.toContain("REVIEW");
    expect(allowedDecisions("REJECTED")).toEqual([]);
    expect(statusForDecision("REPRINT")).toBe("RESOLVED_REPRINT");
    expect(disputeDecisionSchema.safeParse({ disputeId: "d", decision: "REJECT", note: "" }).success).toBe(false);
    expect(disputeDecisionSchema.safeParse({ disputeId: "d", decision: "REVIEW" }).success).toBe(true);
  });

  it("application approval needs every required checklist item", () => {
    const all = ["COMMERCIAL_REGISTER", "TAX_CARD", "FACTORY_VISIT", "MACHINES_VERIFIED", "TEST_JOB", "PORTFOLIO_PHOTOS", "FRAMEWORK_AGREEMENT"];
    expect(canApprove(all)).toBe(true);
    expect(missingRequired(all.slice(1))).toEqual(["COMMERCIAL_REGISTER"]);
    expect(applicationDecisionSchema.safeParse({ applicationId: "a", decision: "APPROVE", checklist: all.slice(2) }).success).toBe(false);
    expect(applicationDecisionSchema.safeParse({ applicationId: "a", decision: "APPROVE", checklist: all }).success).toBe(true);
    expect(applicationDecisionSchema.safeParse({ applicationId: "a", decision: "REJECT", note: "" }).success).toBe(false);
    expect(decodeReviewNote(encodeReviewNote(["TAX_CARD"], "ok"))).toEqual({ checklist: ["TAX_CARD"], note: "ok" });
    expect(decodeReviewNote("plain text")).toEqual({ checklist: [], note: "plain text" });
  });

  it("vendor status moves", () => {
    expect(vendorStatusAfter({ status: "ACTIVE", verified: true }, "SUSPEND")).toEqual({ status: "SUSPENDED", verified: true });
    expect(vendorStatusAfter({ status: "SUSPENDED", verified: true }, "SUSPEND")).toBeNull();
    expect(vendorStatusAfter({ status: "SUSPENDED", verified: true }, "REINSTATE")).toEqual({ status: "ACTIVE", verified: true });
    expect(vendorStatusAfter({ status: "PENDING", verified: false }, "VERIFY")).toBeNull();
    expect(vendorStatusSchema.safeParse({ vendorId: "v", action: "SUSPEND", reason: "" }).success).toBe(false);
  });

  it("deletion is blocked by active orders or open disputes", () => {
    expect(deletionBlockers([{ status: "DELIVERED" }], [])).toEqual([]);
    expect(deletionBlockers([{ status: "IN_PRODUCTION" }], [{ status: "OPEN" }])).toEqual(["ACTIVE_ORDERS", "OPEN_DISPUTES"]);
    expect(anonymisedPhone("u1")).toBe("deleted:u1");
    expect(maskPhone("+201000000002")).toBe("+2010****0002");
    expect(maskPhone("deleted:u1")).toBe("—");
    expect(dataRequestDecisionSchema.safeParse({ requestId: "r", decision: "REJECT", note: "no" }).success).toBe(false);
  });
});

describe("pricing settings", () => {
  it("defaults round-trip through storage and config", () => {
    const s = defaultSettings();
    expect(parseStoredSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const cfg = settingsToConfig(s);
    expect(cfg.marginPct).toBe(DEFAULT_PRICING_CONFIG.marginPct);
    expect(cfg.shipping.flatPack).toEqual(DEFAULT_PRICING_CONFIG.shipping.flatPack);
  });

  it("invalid stored values fall back to defaults", () => {
    const s = parseStoredSettings({ marginPct: 5, priceIndex: "nope" });
    expect(s.marginPct).toBe(DEFAULT_PRICING_CONFIG.marginPct);
    expect(s.priceIndex).toEqual(DEFAULT_PRICING_CONFIG.priceIndex);
    expect(parseStoredSettings(null)).toEqual(defaultSettings());
  });

  it("settings form validates margin and validity", () => {
    const s = defaultSettings();
    expect(settingsFormSchema.safeParse({ ...s, marginPct: 0.3 }).success).toBe(true);
    expect(settingsFormSchema.safeParse({ ...s, marginPct: 1.2 }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...s, quoteValidityHours: 0 }).success).toBe(false);
  });

  it("index update appends a dated row (same date replaces) and becomes current", () => {
    const base = defaultSettings().priceIndex;
    const u = indexUpdateSchema.parse({ effectiveFrom: "2026-11-02", fx: 1.05, board: { E_FLUTE_KRAFT: 1.1 } });
    const t1 = appendIndexRow(base, u, NOW);
    expect(t1).toHaveLength(base.length + 1);
    const t2 = appendIndexRow(t1, { ...u, fx: 1.06 }, NOW);
    expect(t2).toHaveLength(base.length + 1);
    const cur = currentMultipliers(t2, NOW);
    expect(cur.row.fx).toBe(1.06);
    expect(cur.byMaterial.E_FLUTE_KRAFT).toBeCloseTo(1.166, 3);
    expect(cur.byMaterial.SBS_300).toBe(1.06);
    expect(indexUpdateSchema.safeParse({ effectiveFrom: "2026-11-02", fx: 9, board: {} }).success).toBe(false);
  });

  it("bumpBoard applies a uniform percentage", () => {
    const b = bumpBoard({ E_FLUTE_KRAFT: 1.1 }, 10);
    expect(b.E_FLUTE_KRAFT).toBeCloseTo(1.21, 4);
    expect(b.SBS_350).toBeCloseTo(1.1, 4);
  });

  it("previewPriceChanges compares current vs proposed", () => {
    const current = makeConfig();
    const proposed = makeConfig({ marginPct: 0.3 });
    const priceFn = (cfg: PricingConfig, s: { quantity: number; id: string }) => (s.id === "none" ? null : Math.round(1000 * (1 + cfg.marginPct)));
    const r = previewPriceChanges(
      [
        { id: "a", structureCode: "FEFCO_0427", materialCode: "E_FLUTE_KRAFT", quantity: 500 },
        { id: "none", structureCode: "SLEEVE", materialCode: "SBS_300", quantity: 500 },
      ],
      priceFn,
      current,
      proposed,
      NOW,
    );
    expect(r.rows[0]!.currentUnitPiasters).toBe(1250);
    expect(r.rows[0]!.proposedUnitPiasters).toBe(1300);
    expect(r.rows[0]!.changePct).toBe(4);
    expect(r.rows[1]!.changePct).toBeNull();
    expect(r.affected).toBe(1);
    expect(r.avgChangePct).toBe(4);
  });
});

describe("catalog", () => {
  const u = { L: { min: 100, max: 500 }, W: { min: 80, max: 400 }, H: { min: 30, max: 200 } };
  it("schema rejects min >= max", () => {
    expect(structureUpdateSchema.safeParse({ id: "s", ...u, active: true }).success).toBe(true);
    expect(structureUpdateSchema.safeParse({ id: "s", ...u, L: { min: 500, max: 100 }, active: true }).success).toBe(false);
  });
  it("mergeLimits keeps rules; defaultFits and hard bounds", () => {
    expect(mergeLimits({ ...u, rules: ["H <= W"] }, { ...u, L: { min: 120, max: 500 } })).toEqual({ ...u, L: { min: 120, max: 500 }, rules: ["H <= W"] });
    expect(defaultFits({ L: 250, W: 180, H: 80 }, u)).toBe(true);
    expect(defaultFits({ L: 600, W: 180, H: 80 }, u)).toBe(false);
    expect(outsideHardBounds(u, { L: { min: 80, max: 600 }, W: { min: 60, max: 450 }, H: { min: 25, max: 250 } })).toEqual([]);
    expect(outsideHardBounds({ ...u, H: { min: 10, max: 200 } }, { L: { min: 80, max: 600 }, W: { min: 60, max: 450 }, H: { min: 25, max: 250 } })).toEqual(["H"]);
  });
  it("changedFields", () => {
    expect(changedFields({ a: 1, b: { c: 1 } }, { a: 1, b: { c: 2 } })).toEqual(["b"]);
  });
});
