import { describe, expect, it } from "vitest";
import { cairoClock, isOverdue, replyDueAt } from "../quoteLeads";
import { modelAvailability, vendorsByPair, withOrderMode } from "../availability";
import { funnel } from "../metrics";
import { orderModeOf } from "@/data/catalogue/order-mode";

describe("quote lead SLA: one Egyptian working day (R4-07)", () => {
  // November 2026: Cairo is UTC+2 (no DST). 2026-11-05 is a Thursday.
  it("reads the Cairo weekday and clock", () => {
    expect(cairoClock(new Date("2026-11-05T15:00:00Z"))).toEqual({ weekday: 4, msIntoDay: 17 * 3_600_000 });
  });
  it("a Sunday request is due 24 h later", () => {
    const sun = new Date("2026-11-08T08:00:00Z");
    expect(replyDueAt(sun).toISOString()).toBe("2026-11-09T08:00:00.000Z");
  });
  it("Thursday 17:00 Cairo skips Friday and Saturday: due Sunday 17:00", () => {
    expect(replyDueAt(new Date("2026-11-05T15:00:00Z")).toISOString()).toBe("2026-11-08T15:00:00.000Z");
  });
  it("a Friday request starts the clock on Sunday 00:00 Cairo: due Monday 00:00", () => {
    expect(replyDueAt(new Date("2026-11-06T10:00:00Z")).toISOString()).toBe("2026-11-08T22:00:00.000Z");
  });
  it("is not overdue over the weekend", () => {
    const due = replyDueAt(new Date("2026-11-05T15:00:00Z"));
    expect(isOverdue("OPEN", due, new Date("2026-11-07T12:00:00Z"))).toBe(false);
    expect(isOverdue("OPEN", due, new Date("2026-11-08T16:00:00Z"))).toBe(true);
  });
});

describe("admin availability follows the B-16 order mode (R4-02)", () => {
  const pairs = vendorsByPair([
    { vendorId: "v1", structureCode: "S", materialCode: "M" },
    { vendorId: "v2", structureCode: "S", materialCode: "M" },
  ]);
  const base = modelAvailability({ code: "X", routes: [{ structureCode: "S", materialCode: "M" }] }, pairs);
  it("instant models keep their rate-card vendors", () => {
    expect(withOrderMode(base, "instant", new Set())).toEqual(base);
  });
  it("preview and quote models are never instant", () => {
    for (const mode of ["preview", "quote"] as const) {
      const a = withOrderMode(base, mode, new Set(["v1"]));
      expect(a.instant).toBe(false);
      expect(a.vendorIds).toEqual([]);
      expect(a.boardsPriced).toBe(0);
    }
  });
  it("listed models are instant only from vendors that list them", () => {
    expect(withOrderMode(base, "listed", new Set()).instant).toBe(false);
    expect(withOrderMode(base, "listed", new Set(["v2", "v9"])).vendorIds).toEqual(["v2"]);
  });
  it("uses the generated table (a rare model is preview)", () => {
    expect(orderModeOf("FEFCO_0350").mode).toBe("preview");
  });
});

describe("free-tool funnel counts people at every step (R4-03)", () => {
  it("one buyer with five orders is one paying buyer, not 500% of price viewed", () => {
    const rows = funnel({ designs: 5, accounts: 2, priceViewed: 1, orders: 1 });
    expect(rows.at(-1)!.ofPrevPct).toBe(100);
  });
});
