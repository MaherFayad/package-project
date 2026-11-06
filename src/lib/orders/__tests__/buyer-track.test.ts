import { describe, expect, it } from "vitest";
import { BUYER_TRACK, buyerTrackIndex, buyerTrackStopped } from "../buyer-track";

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
