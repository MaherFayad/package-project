import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, type OrderStatus } from "@/types";
import {
  BUYER_STEPS,
  OrderTransitionError,
  TRANSITIONS,
  assertTransition,
  buyerStepIndex,
  canActorTransition,
  canBuyerCancel,
  canOpenDispute,
  canReview,
  canTransition,
  isPaidStatus,
  nextStatuses,
  statusBadge,
  stoppedStepIndex,
} from "../state";

describe("order state machine", () => {
  it("defines rules for every status and only targets known statuses", () => {
    for (const s of ORDER_STATUSES) {
      expect(TRANSITIONS[s]).toBeDefined();
      for (const r of TRANSITIONS[s]) expect(ORDER_STATUSES).toContain(r.to);
    }
  });

  it("follows the happy path", () => {
    const path: [OrderStatus, OrderStatus, "SYSTEM" | "VENDOR" | "ADMIN"][] = [
      ["PENDING_PAYMENT", "PAID", "SYSTEM"],
      ["PAID", "ACCEPTED", "VENDOR"],
      ["ACCEPTED", "IN_PRODUCTION", "VENDOR"],
      ["IN_PRODUCTION", "QC_PENDING", "VENDOR"],
      ["QC_PENDING", "READY_TO_SHIP", "ADMIN"],
      ["READY_TO_SHIP", "SHIPPED", "VENDOR"],
      ["SHIPPED", "DELIVERED", "SYSTEM"],
    ];
    for (const [from, to, actor] of path) expect(assertTransition(from, to, actor).to).toBe(to);
  });

  it("logs the right timeline event for each move", () => {
    expect(assertTransition("PENDING_PAYMENT", "PAID", "SYSTEM").event).toBe("PAYMENT_CONFIRMED");
    expect(assertTransition("QC_PENDING", "IN_PRODUCTION", "ADMIN").event).toBe("QC_REJECTED");
    expect(assertTransition("QC_PENDING", "READY_TO_SHIP", "ADMIN").event).toBe("QC_APPROVED");
  });

  it("rejects edges that do not exist", () => {
    expect(canTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
    expect(canTransition("DELIVERED", "IN_PRODUCTION")).toBe(false);
    expect(() => assertTransition("CANCELLED", "PAID", "ADMIN")).toThrow(OrderTransitionError);
    try {
      assertTransition("PENDING_PAYMENT", "DELIVERED", "ADMIN");
    } catch (e) {
      expect((e as OrderTransitionError).code).toBe("INVALID_TRANSITION");
    }
  });

  it("only lets the payment webhook mark an order paid", () => {
    expect(canActorTransition("PENDING_PAYMENT", "PAID", "BUYER")).toBe(false);
    expect(canActorTransition("PENDING_PAYMENT", "PAID", "VENDOR")).toBe(false);
    expect(canActorTransition("PENDING_PAYMENT", "PAID", "SYSTEM")).toBe(true);
    expect(() => assertTransition("PENDING_PAYMENT", "PAID", "BUYER")).toThrow(/FORBIDDEN_TRANSITION/);
  });

  it("keeps QC approval with ops, not the vendor", () => {
    expect(canActorTransition("QC_PENDING", "READY_TO_SHIP", "VENDOR")).toBe(false);
    expect(canActorTransition("QC_PENDING", "READY_TO_SHIP", "ADMIN")).toBe(true);
  });

  it("lets buyers cancel only before payment", () => {
    expect(canBuyerCancel("PENDING_PAYMENT")).toBe(true);
    expect(canBuyerCancel("PAID")).toBe(false);
    expect(canActorTransition("PAID", "CANCELLED", "BUYER")).toBe(false);
    expect(nextStatuses("PENDING_PAYMENT", "BUYER")).toEqual(["CANCELLED"]);
  });

  it("treats cancelled and refunded as terminal", () => {
    expect(nextStatuses("CANCELLED", "ADMIN")).toEqual([]);
    expect(nextStatuses("REFUNDED", "ADMIN")).toEqual([]);
  });

  it("knows which statuses hold money", () => {
    expect(isPaidStatus("PENDING_PAYMENT")).toBe(false);
    expect(isPaidStatus("PAID")).toBe(true);
    expect(isPaidStatus("DELIVERED")).toBe(true);
    expect(isPaidStatus("REFUNDED")).toBe(false);
  });

  it("maps statuses to the six buyer steps", () => {
    expect(BUYER_STEPS).toHaveLength(6);
    expect(buyerStepIndex("PENDING_PAYMENT")).toBe(1);
    expect(buyerStepIndex("IN_PRODUCTION")).toBe(2);
    expect(buyerStepIndex("QC_PENDING")).toBe(3);
    expect(buyerStepIndex("READY_TO_SHIP")).toBe(4);
    expect(buyerStepIndex("SHIPPED")).toBe(5);
    expect(buyerStepIndex("DELIVERED")).toBe(6);
    expect(stoppedStepIndex(["ORDER_PLACED", "PROOF_APPROVED"])).toBe(1);
    expect(stoppedStepIndex(["PAYMENT_CONFIRMED"])).toBe(2);
  });

  it("gives every status a badge", () => {
    for (const s of ORDER_STATUSES) expect(statusBadge(s).tone).toBeTruthy();
  });

  it("opens disputes only within 30 days of delivery", () => {
    const delivered = new Date("2026-11-01T10:00:00Z");
    expect(canOpenDispute("DELIVERED", delivered, new Date("2026-11-20T10:00:00Z"))).toBe(true);
    expect(canOpenDispute("DELIVERED", delivered, new Date("2026-12-02T10:00:00Z"))).toBe(false);
    expect(canOpenDispute("SHIPPED", null, new Date())).toBe(false);
    expect(canOpenDispute("DELIVERED", delivered, new Date("2026-11-02T10:00:00Z"), true)).toBe(false);
  });

  it("allows one review after delivery", () => {
    expect(canReview("DELIVERED", false)).toBe(true);
    expect(canReview("DELIVERED", true)).toBe(false);
    expect(canReview("SHIPPED", false)).toBe(false);
  });
});
