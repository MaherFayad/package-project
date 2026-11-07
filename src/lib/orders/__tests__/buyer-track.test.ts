import { describe, expect, it } from "vitest";
import { BUYER_SIMPLE_TRACK, BUYER_TRACK, buyerSimpleIndex, buyerSimpleStopped, buyerStatusKey, buyerTrackIndex, buyerTrackStopped } from "../buyer-track";

describe("buyer order tracker (R4-CR-04)", () => {
  it("keeps 'Printer acceptance' current until the printer accepts", () => {
    expect(BUYER_TRACK[buyerTrackIndex("PAID")]).toBe("PRINTER_ACCEPTED");
    expect(BUYER_TRACK[buyerTrackIndex("ACCEPTED")]).toBe("IN_PRODUCTION");
    expect(BUYER_TRACK[buyerTrackIndex("IN_PRODUCTION")]).toBe("IN_PRODUCTION");
    expect(BUYER_TRACK[buyerTrackIndex("QC_PENDING")]).toBe("QC_PASSED");
    expect(buyerTrackIndex("DELIVERED")).toBe(BUYER_TRACK.length);
  });
  it("shows where a cancelled order stopped", () => {
    expect(BUYER_TRACK[buyerTrackStopped(["PAYMENT_CONFIRMED"])]).toBe("PRINTER_ACCEPTED");
    expect(BUYER_TRACK[buyerTrackStopped(["PAYMENT_CONFIRMED", "VENDOR_ACCEPTED"])]).toBe("IN_PRODUCTION");
    expect(BUYER_TRACK[buyerTrackStopped(["ORDER_PLACED"])]).toBe("PAID");
  });
});

describe("plain buyer tracker (R1-14)", () => {
  it("has four stages and maps every status onto them", () => {
    expect(BUYER_SIMPLE_TRACK[buyerSimpleIndex("PENDING_PAYMENT")]).toBe("RECEIVED");
    // R3-11: paid but not yet accepted by the printer is still "Order received".
    for (const s of ["PAID", "PROOF_APPROVED"] as const) expect(BUYER_SIMPLE_TRACK[buyerSimpleIndex(s)]).toBe("RECEIVED");
    for (const s of ["ACCEPTED", "IN_PRODUCTION", "QC_PENDING"] as const) expect(BUYER_SIMPLE_TRACK[buyerSimpleIndex(s)]).toBe("PRINTING");
    expect(BUYER_SIMPLE_TRACK[buyerSimpleIndex("READY_TO_SHIP")]).toBe("ON_THE_WAY");
    expect(BUYER_SIMPLE_TRACK[buyerSimpleIndex("SHIPPED")]).toBe("ON_THE_WAY");
    expect(buyerSimpleIndex("DELIVERED")).toBe(BUYER_SIMPLE_TRACK.length);
  });
  it("shows where a cancelled order stopped", () => {
    expect(BUYER_SIMPLE_TRACK[buyerSimpleStopped(["ORDER_PLACED"])]).toBe("RECEIVED");
    expect(BUYER_SIMPLE_TRACK[buyerSimpleStopped(["PAYMENT_CONFIRMED"])]).toBe("RECEIVED");
    expect(BUYER_SIMPLE_TRACK[buyerSimpleStopped(["PAYMENT_CONFIRMED", "VENDOR_ACCEPTED"])]).toBe("PRINTING");
    expect(BUYER_SIMPLE_TRACK[buyerSimpleStopped(["PAYMENT_CONFIRMED", "SHIPPED"])]).toBe("ON_THE_WAY");
  });
});

describe("one buyer status vocabulary (R2-10)", () => {
  it("names every running order by its tracker stage", () => {
    expect(buyerStatusKey("PAID")).toBe("orders.detail.simple.AWAITING_PRINTER");
    expect(buyerStatusKey("ACCEPTED")).toBe("orders.detail.simple.PRINTING");
    expect(buyerStatusKey("IN_PRODUCTION")).toBe("orders.detail.simple.PRINTING");
    expect(buyerStatusKey("SHIPPED")).toBe("orders.detail.simple.ON_THE_WAY");
    expect(buyerStatusKey("DELIVERED")).toBe("orders.detail.simple.DELIVERED");
    expect(buyerStatusKey("PENDING_PAYMENT")).toBe("orderStatus.PENDING_PAYMENT");
    expect(buyerStatusKey("REFUNDED")).toBe("orderStatus.REFUNDED");
  });
});
