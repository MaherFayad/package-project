import { describe, expect, it } from "vitest";
import { parseMmInput } from "../mm";

describe("parseMmInput (R5-JR-20)", () => {
  it("reads Western, Arabic-Indic and Persian digits", () => {
    expect(parseMmInput("250")).toBe(250);
    expect(parseMmInput("٢٥٠")).toBe(250);
    expect(parseMmInput("۲۵۰")).toBe(250);
  });
  it("reads a decimal point or a decimal comma", () => {
    expect(parseMmInput("250.5")).toBe(250.5);
    expect(parseMmInput("250,5")).toBe(250.5);
    expect(parseMmInput("٢٥٠٫٥")).toBe(250.5);
    // One shared rule: a comma is always the decimal separator in a size ("1,5" mm).
    expect(parseMmInput("1,5")).toBe(1.5);
  });
  it("drops a pasted unit (R13-02)", () => {
    expect(parseMmInput("330 مم")).toBe(330);
    expect(parseMmInput("340mm")).toBe(340);
    expect(parseMmInput("350 ملم")).toBe(350);
    expect(Number.isNaN(parseMmInput("mm"))).toBe(true);
  });
  it("reads centimetres as millimetres × 10 (R15-04)", () => {
    expect(parseMmInput("33 cm")).toBe(330);
    expect(parseMmInput("٣٣ سم")).toBe(330);
    expect(parseMmInput("25,5cm")).toBe(255);
    expect(parseMmInput("12.34 CM")).toBe(123.4);
    expect(Number.isNaN(parseMmInput("cm"))).toBe(true);
  });
  it("is NaN for anything else", () => {
    for (const v of ["", " ", "abc", "1.2.3", "-5", "25o"]) expect(Number.isNaN(parseMmInput(v))).toBe(true);
  });
});
