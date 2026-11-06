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
    expect(parseMmInput("1,500")).toBe(1500);
  });
  it("is NaN for anything else", () => {
    for (const v of ["", " ", "abc", "1.2.3", "-5", "25o"]) expect(Number.isNaN(parseMmInput(v))).toBe(true);
  });
});
