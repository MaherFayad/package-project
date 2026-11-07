import { describe, expect, it } from "vitest";
import { normalizeHex } from "../color";

describe("normalizeHex (R11-02)", () => {
  it("accepts the usual forms", () => {
    expect(normalizeHex("#1F3D2B")).toBe("#1f3d2b");
    expect(normalizeHex("1f3d2b")).toBe("#1f3d2b");
    expect(normalizeHex("  #1f3d2b ")).toBe("#1f3d2b");
  });
  it("expands the short form", () => expect(normalizeHex("#fff")).toBe("#ffffff"));
  it("reads Arabic-Indic and Persian digits", () => {
    expect(normalizeHex("#١٢٣٤٥٦")).toBe("#123456");
    expect(normalizeHex("۱۲۳")).toBe("#112233");
  });
  it("refuses what is not a colour", () => {
    for (const v of ["", "#12345g", "#1234", "red", "#1234567"]) expect(normalizeHex(v)).toBeNull();
  });
});
