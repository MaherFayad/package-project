import { describe, expect, it } from "vitest";
import { parseMmInput, parseWholeInput } from "../input";
import { parseNumber } from "@/components/vendor/lib/rateCard";

// Journeys R5-JR-18 to R5-JR-21 on the shared parser (admin R6-AD-01 covers the base rules).
describe("typed numbers in the buyer and printer journeys", () => {
  it("the printer's rate card never reads a decimal comma as thousands", () => {
    expect(parseNumber("18,50")).toBeNaN(); // was EGP 1,850 per piece
    expect(parseNumber("١٨٫٥٠")).toBe(18.5);
    expect(parseNumber("600.50")).toBe(600.5);
  });
  it("quantities are whole: 5.000 is not five boxes; every digit form reads", () => {
    expect(parseWholeInput("5.000")).toBeNaN();
    expect(parseWholeInput("٥٬٠٠٠")).toBe(5000);
    expect(parseWholeInput("۵۰۰۰")).toBe(5000);
  });
  it("millimetres accept a decimal comma, «٫» and Arabic digits", () => {
    expect(parseMmInput("250,5")).toBe(250.5);
    expect(parseMmInput("٢٥٠٫٥")).toBe(250.5);
    expect(parseMmInput("١٢٠")).toBe(120);
    expect(parseMmInput("12a")).toBeNaN();
  });
});
