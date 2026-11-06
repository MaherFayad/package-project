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
