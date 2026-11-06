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

describe("quote leads (B-15)", async () => {
  const { leadState, isOverdue, slaHoursLeft, inLeadView, leadStepSchema } = await import("../quoteLeads");
  const at = (h: number) => new Date(now.getTime() + h * 3_600_000);
  it("takes the latest ops outcome", () => {
    expect(leadState([])).toBe("OPEN");
    expect(leadState([{ action: "QUOTE_CONTACTED", createdAt: at(-5) }])).toBe("CONTACTED");
    expect(leadState([{ action: "QUOTE_CONTACTED", createdAt: at(-5) }, { action: "QUOTE_CLOSED", createdAt: at(-1) }])).toBe("CLOSED");
    expect(leadState([{ action: "QUOTE_REQUEST", createdAt: at(-9) }])).toBe("OPEN");
  });
  it("runs the 24 h clock on open leads only", () => {
    expect(slaHoursLeft(at(6), now)).toBe(6);
    expect(isOverdue("OPEN", at(-1), now)).toBe(true);
    expect(isOverdue("CONTACTED", at(-1), now)).toBe(false);
    expect(inLeadView({ state: "OPEN", overdue: true }, "overdue")).toBe(true);
    expect(inLeadView({ state: "CLOSED", overdue: false }, "open")).toBe(false);
  });
  it("needs a note", () => {
    expect(leadStepSchema.safeParse({ quoteId: "q", step: "CLOSED", note: "" }).success).toBe(false);
    expect(leadStepSchema.safeParse({ quoteId: "q", step: "CONTACTED", note: "Price sent on WhatsApp" }).success).toBe(true);
  });
});

describe("checkout settings form (B-05, B-11)", async () => {
  const { checkoutSettingsFormSchema } = await import("../checkoutSettings");
  const ok = { prepayDiscountPct: 3, sample: { enabled: true, pricePiasters: 75_000, maxPieces: 5, creditDays: 60, monthlyCap: 100 } };
  it("accepts the plan defaults and keeps the reader's bounds", () => {
    expect(checkoutSettingsFormSchema.safeParse(ok).success).toBe(true);
    const bad = checkoutSettingsFormSchema.safeParse({ ...ok, prepayDiscountPct: 25 });
    expect(bad.error?.issues[0]?.message).toBe("PREPAY_RANGE");
    expect(checkoutSettingsFormSchema.safeParse({ ...ok, sample: { ...ok.sample, maxPieces: 6 } }).error?.issues[0]?.message).toBe("SAMPLE_PIECES_RANGE");
    expect(checkoutSettingsFormSchema.safeParse({ ...ok, sample: { ...ok.sample, creditDays: Number.NaN } }).success).toBe(false);
  });
});
