import { describe, expect, it } from "vitest";
import { MONEY_STATUSES, PRINT_FILES_UNLOCKED, canDownloadPrintFile } from "../state";
import { vendorMoveAllowed } from "../api-rules";

const order = (status: string) => ({ buyerId: "buyer", vendorId: "v1", status });
const buyer = { id: "buyer", role: "BUYER" as const, vendorId: null };
const staff = { id: "staff", role: "VENDOR" as const, vendorId: "v1" };
const otherStaff = { id: "x", role: "VENDOR" as const, vendorId: "v2" };
const admin = { id: "a", role: "ADMIN" as const, vendorId: null };
const stranger = { id: "s", role: "BUYER" as const, vendorId: null };

describe("print-ready PDF access (OWASP ASVS V4.2.1, Top 10 A01)", () => {
  it("is never available before payment", () => {
    for (const u of [buyer, staff, admin]) expect(canDownloadPrintFile(order("PENDING_PAYMENT"), u)).toBe(false);
  });
  it("buyer and admin get it once paid; strangers and other vendors never", () => {
    expect(canDownloadPrintFile(order("PAID"), buyer)).toBe(true);
    expect(canDownloadPrintFile(order("PAID"), admin)).toBe(true);
    expect(canDownloadPrintFile(order("IN_PRODUCTION"), stranger)).toBe(false);
    expect(canDownloadPrintFile(order("IN_PRODUCTION"), otherStaff)).toBe(false);
  });
  it("the order's vendor only after accepting the job", () => {
    expect(canDownloadPrintFile(order("PAID"), staff)).toBe(false);
    expect(canDownloadPrintFile(order("PROOF_APPROVED"), staff)).toBe(false);
    for (const s of PRINT_FILES_UNLOCKED) expect(canDownloadPrintFile(order(s), staff)).toBe(true);
    expect(canDownloadPrintFile(order("REFUNDED"), staff)).toBe(false);
  });
});

describe("vendor moves through the status API follow the portal's job rules", () => {
  const job = (status: string, extra: Partial<Parameters<typeof vendorMoveAllowed>[0]> = {}) => ({
    status,
    paidAt: new Date("2026-01-01"),
    events: [],
    qcPhotos: [],
    ...extra,
  });
  it("accept only while awaiting and not declined", () => {
    expect(vendorMoveAllowed(job("PAID"), "ACCEPTED")).toBe("OK");
    expect(vendorMoveAllowed(job("PAID", { events: [{ type: "VENDOR_DECLINED", createdAt: new Date() }] }), "ACCEPTED")).toBe("NOT_ALLOWED");
    expect(vendorMoveAllowed(job("PAID", { paidAt: null }), "ACCEPTED")).toBe("NOT_ALLOWED");
  });
  it("QC submission needs a first-sheet and a packed-bundle photo", () => {
    expect(vendorMoveAllowed(job("IN_PRODUCTION"), "QC_PENDING")).toBe("NOT_ALLOWED");
    expect(
      vendorMoveAllowed(job("IN_PRODUCTION", { qcPhotos: [{ kind: "FIRST_SHEET", status: "PENDING" }, { kind: "PACKED_BUNDLE", status: "PENDING" }] }), "QC_PENDING"),
    ).toBe("OK");
    expect(
      vendorMoveAllowed(job("IN_PRODUCTION", { qcPhotos: [{ kind: "FIRST_SHEET", status: "REJECTED" }, { kind: "PACKED_BUNDLE", status: "PENDING" }] }), "QC_PENDING"),
    ).toBe("NOT_ALLOWED");
  });
  it("start production only from ACCEPTED", () => {
    expect(vendorMoveAllowed(job("ACCEPTED"), "IN_PRODUCTION")).toBe("OK");
    expect(vendorMoveAllowed(job("QC_PENDING"), "IN_PRODUCTION")).toBe("NOT_ALLOWED");
  });
  it("money states are never reachable through the generic API", () => {
    expect(MONEY_STATUSES).toEqual(["PAID", "REFUNDED"]);
  });
});
