import { describe, expect, it } from "vitest";
import { parseTypedMm, parseTypedNumber, parseTypedWhole } from "../number-input";
import { parseNumber } from "@/components/vendor/lib/rateCard";

// R5-JR-18 to R5-JR-21: typed amounts and quantities in ar and en (same rules as admin R6-AD-01).
describe("typed numbers", () => {
  it("never reads a decimal comma as thousands", () => {
    for (const v of ["18,50", "1,5", "250,5", "١٨,٥٠", "1,50,000"]) expect(parseTypedNumber(v)).toBeNaN();
    expect(parseNumber("18,50")).toBeNaN(); // the printer's rate card (was EGP 1,850)
  });
  it("reads dots, grouped thousands, Arabic-Indic and Persian digits and the Arabic separators", () => {
    expect(parseTypedNumber("18.50")).toBe(18.5);
    expect(parseTypedNumber("١٨٫٥٠")).toBe(18.5);
    expect(parseTypedNumber("1,500")).toBe(1500);
    expect(parseTypedNumber("١٬٥٠٠")).toBe(1500);
    expect(parseTypedNumber("12,500.75")).toBe(12500.75);
    expect(parseTypedNumber("۵۰۰۰")).toBe(5000);
    expect(parseTypedNumber(" 1 500 ")).toBe(1500);
    expect(parseTypedNumber("")).toBeNull();
    expect(parseTypedNumber("-5")).toBeNaN();
    expect(parseTypedNumber("-5", { allowNegative: true })).toBe(-5);
  });
  it("quantities are whole: 5.000 is not five boxes", () => {
    expect(parseTypedWhole("5,000")).toBe(5000);
    expect(parseTypedWhole("٥٠٠٠")).toBe(5000);
    expect(parseTypedWhole("٥٬٠٠٠")).toBe(5000);
    expect(parseTypedWhole("5.000")).toBeNaN();
    expect(parseTypedWhole("5000.5")).toBeNaN();
    expect(parseTypedWhole("١٢٫٥")).toBeNaN();
  });
  it("millimetres accept a decimal comma and Arabic digits", () => {
    expect(parseTypedMm("250,5")).toBe(250.5);
    expect(parseTypedMm("١٢٠")).toBe(120);
    expect(parseTypedMm("٢٥٠٫٥")).toBe(250.5);
    expect(parseTypedMm("12a")).toBeNaN();
  });
});
