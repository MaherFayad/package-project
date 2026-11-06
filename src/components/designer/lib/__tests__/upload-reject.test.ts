import { describe, expect, it } from "vitest";
import { IMAGE_MAX_BYTES, IMAGE_MAX_SRC_CHARS, rejectReason } from "../../uploadImage";

/** R10-02: each refused upload names its reason. R10-01: stored images stay under the save budget. */
describe("upload rules", () => {
  it("names the wrong type", () => {
    expect(rejectReason({ type: "text/plain", size: 5, name: "notes.txt" })).toBe("type");
    expect(rejectReason({ type: "image/gif", size: 5, name: "a.gif" })).toBe("type");
  });
  it("names the size", () => {
    expect(rejectReason({ type: "image/png", size: IMAGE_MAX_BYTES + 1, name: "big.png" })).toBe("size");
  });
  it("accepts the four image types, SVG also by name", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]) expect(rejectReason({ type, size: 1000, name: "x" })).toBeNull();
    expect(rejectReason({ type: "", size: 1000, name: "logo.SVG" })).toBeNull();
  });
  it("keeps several images inside the 12 MB save body", () => {
    expect(IMAGE_MAX_SRC_CHARS * 3).toBeLessThan(12_000_000);
  });
});
