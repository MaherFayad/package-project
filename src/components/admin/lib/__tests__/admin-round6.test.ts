import { describe, expect, it } from "vitest";
import { parseEgpInput, parseNumberInput, parseWholeInput } from "@/lib/money/input";

describe("typed amounts (R6-AD-01)", () => {
  it("never reads a decimal comma as thousands", () => {
    expect(parseEgpInput("18,50")).toBeNaN();
    expect(parseEgpInput("1,5")).toBeNaN();
    expect(parseNumberInput("750,50")).toBeNaN();
  });
  it("accepts dots, grouped thousands, Arabic digits and the Arabic decimal separator", () => {
    expect(parseEgpInput("18.5")).toBe(1850);
    expect(parseEgpInput("1,500")).toBe(150_000);
    expect(parseEgpInput("12,500.75")).toBe(1_250_075);
    expect(parseEgpInput("١٨٫٥٠")).toBe(1850);
    expect(parseEgpInput("۱۵۰۰")).toBe(150_000);
    expect(parseEgpInput(" 1 500 ")).toBe(150_000);
    expect(parseWholeInput("5,000")).toBe(5000);
    expect(parseWholeInput("٥٠٠٠")).toBe(5000);
    expect(parseNumberInput("1.0425")).toBe(1.0425);
  });
  it("empty is null; negatives, extra decimals and junk are invalid", () => {
    expect(parseEgpInput("")).toBeNull();
    expect(parseWholeInput("  ")).toBeNull();
    for (const v of ["-5", "18.505", "1.2.3", "12abc", "1,50,000", "5000.5"]) expect(v === "5000.5" ? parseWholeInput(v) : parseEgpInput(v)).toBeNaN();
  });
});

describe("shared decimal reader for vendor forms (round 7)", () => {
  it("vendor rate cards use the same comma rule", async () => {
    const { parseNumber } = await import("@/components/vendor/lib/rateCard");
    expect(parseNumber("18,50")).toBeNaN();
    expect(parseNumber("1,250")).toBe(1250);
    expect(parseNumber("١٢٣٫٥")).toBe(123.5);
    expect(parseNumber("-3")).toBe(-3);
  });
});
