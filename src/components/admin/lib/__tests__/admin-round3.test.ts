import { describe, expect, it } from "vitest";
import { acceptanceRate, repeatRate90, DAY_MS } from "../metrics";
import { isolate } from "../bidi";

const now = new Date("2026-11-06T00:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * DAY_MS);

describe("90-day repeat rate (B-19)", () => {
  it("only counts buyers whose first order is 90+ days old", () => {
    const r = repeatRate90(
      [
        { buyerId: "a", placedAt: ago(200) },
        { buyerId: "a", placedAt: ago(150) }, // repeat within 90 days of first
        { buyerId: "b", placedAt: ago(120) },
        { buyerId: "b", placedAt: ago(5) }, // second order 115 days after first: not a 90-day repeat
        { buyerId: "c", placedAt: ago(10) }, // too young, left out
      ],
      now,
    );
    expect(r).toEqual({ pct: 50, cohort: 2, repeaters: 1 });
  });
  it("is null when nobody is old enough", () => {
    expect(repeatRate90([{ buyerId: "a", placedAt: ago(3) }], now).pct).toBeNull();
  });
});

describe("vendor acceptance rate (B-19)", () => {
  it("accepted out of accepted plus declined", () => {
    expect(acceptanceRate([{ type: "VENDOR_ACCEPTED" }, { type: "VENDOR_ACCEPTED" }, { type: "VENDOR_DECLINED" }, { type: "QC_APPROVED" }])).toEqual({ pct: 66.7, accepted: 2, declined: 1 });
    expect(acceptanceRate([]).pct).toBeNull();
  });
});

describe("bidi isolate (CR-12)", () => {
  it("wraps text in FSI/PDI", () => {
    expect(isolate("Nile Pack.")).toBe("⁨Nile Pack.⁩");
  });
});

describe("profile moderation (B-08)", async () => {
  const { canApprovePortfolio, contactFlags, reviewNoteRequired, portfolioReviewSchema } = await import("../moderation");
  it("flags contact details in either language, Arabic-Indic digits included", () => {
    expect(contactFlags("نطبع علب الشحن", "We print shipping boxes.")).toEqual([]);
    expect(contactFlags("كلمنا واتساب ٠١٠٠١٢٣٤٥٦٧", "")).toEqual(["MESSENGER", "PHONE"]);
    expect(contactFlags("", "Visit www.nilepack-direct.com")).toContain("URL");
  });
  it("cannot approve a caption with contact details or a photo already reviewed", () => {
    expect(canApprovePortfolio({ status: "PENDING", captionAr: "علبة", captionEn: "Mailer" })).toBe(true);
    expect(canApprovePortfolio({ status: "PENDING", captionAr: "علبة", captionEn: "Call 01001234567" })).toBe(false);
    expect(canApprovePortfolio({ status: "APPROVED", captionAr: "علبة", captionEn: "Mailer" })).toBe(false);
  });
  it("needs a note to reject", () => {
    expect(reviewNoteRequired("REJECT", " ")).toBe(true);
    expect(reviewNoteRequired("REJECT", "Phone on the box")).toBe(false);
    expect(reviewNoteRequired("APPROVE", undefined)).toBe(false);
    expect(portfolioReviewSchema.safeParse({ itemId: "x", decision: "MAYBE" }).success).toBe(false);
  });
});
