import { describe, expect, it } from "vitest";
import { buildKey, canReadFile, checkUpload, parseKey } from "../files";

// Checkout round 9: buyer photos on "Report a problem" are a private `dispute/<orderId>/…` upload.
describe("dispute upload scope", () => {
  const key = parseKey(buildKey("dispute", "order123", "abcdefgh1234", "jpg"))!;
  const parties = { vendorId: "v1", buyerId: "buyer1" };
  it("parses and accepts only images up to 10 MB", () => {
    expect(key).toMatchObject({ scope: "dispute", ownerId: "order123", type: "image/jpeg" });
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    expect(checkUpload("dispute", pdf)).toEqual({ ok: false, error: "TYPE" });
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    expect(checkUpload("dispute", jpeg)).toMatchObject({ ok: true, type: "image/jpeg" });
  });
  it("is readable by the order's buyer and admins only, never the printer or anonymous", () => {
    expect(canReadFile(key, { id: "buyer1", role: "BUYER", vendorId: null }, parties)).toBe(true);
    expect(canReadFile(key, { id: "admin", role: "ADMIN", vendorId: null }, parties)).toBe(true);
    expect(canReadFile(key, { id: "staff", role: "VENDOR", vendorId: "v1" }, parties)).toBe(false);
    expect(canReadFile(key, { id: "other", role: "BUYER", vendorId: null }, parties)).toBe(false);
    expect(canReadFile(key, null, parties)).toBe(false);
  });
});
