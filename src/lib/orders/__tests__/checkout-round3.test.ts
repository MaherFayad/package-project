import { describe, expect, it, vi } from "vitest";
import { ORDER_STATUSES, type QuoteLine } from "@/types";
import { paymentTone, statusTone } from "../status-tone";
import { statusBadge } from "../state";
import { formatTaxId, isValidTaxId, normalizeTaxId } from "../company";
import { applySampleCredit, isSampleLines, sampleOffer, SAMPLE_LINE_LABEL } from "../sample";
import { orderTotals, vatOn } from "../totals";
import { GOVERNORATE_KEYS, toGovernorateKey } from "../governorates";

vi.mock("server-only", () => ({}));
const dbMock = vi.hoisted(() => ({ quote: { findMany: vi.fn() }, auditLog: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("status tone map (CR-08)", () => {
  it("gives every status a tone, and statusBadge delegates to it", () => {
    for (const s of ORDER_STATUSES) expect(statusBadge(s)).toEqual(statusTone(s));
  });
  it("status PAID is 'awaiting printer' (attention); the payment badge Paid is neutral; Delivered is success", () => {
    expect(statusTone("PAID")).toEqual({ tone: "attention", progress: "incomplete" });
    expect(paymentTone("PAID")).toEqual({ tone: "neutral", progress: "complete" });
    expect(statusTone("DELIVERED")).toEqual({ tone: "success", progress: "complete" });
    expect(statusTone("PENDING_PAYMENT").tone).toBe("attention");
    expect(paymentTone("PENDING").tone).toBe("attention");
  });
});

describe("company tax number (B-13)", () => {
  it("accepts 9 digits written with dashes, spaces or Arabic-Indic digits", () => {
    expect(isValidTaxId("123-456-789")).toBe(true);
    expect(isValidTaxId("١٢٣٤٥٦٧٨٩")).toBe(true);
    expect(isValidTaxId("123 456 789")).toBe(true);
    expect(normalizeTaxId("١٢٣-٤٥٦-٧٨٩")).toBe("123456789");
    expect(formatTaxId("123456789")).toBe("123-456-789");
  });
  it("rejects other lengths and letters", () => {
    expect(isValidTaxId("12345678")).toBe(false);
    expect(isValidTaxId("1234567890")).toBe(false);
    expect(isValidTaxId("12345678a")).toBe(false);
  });
});

const lines: QuoteLine[] = [
  { kind: "PRODUCT", labelKey: "pricing.line.product", quantity: 500, unitPiasters: 3_000, totalPiasters: 1_500_000 },
  { kind: "SETUP", labelKey: "pricing.line.setup", quantity: 1, unitPiasters: 60_000, totalPiasters: 60_000 },
  { kind: "SHIPPING", labelKey: "pricing.line.shipping", quantity: 1, unitPiasters: 15_000, totalPiasters: 15_000 },
];

describe("paid sample (B-05)", () => {
  // Only the fields sampleOffer reads matter here.
  const offer = { vendorId: "v", quantity: 500, lines, subtotalPiasters: 0, vatPiasters: 0, totalPiasters: 0, unitPiasters: 0, leadTimeDays: 7, deliveryDays: 9, standardSize: false, validUntil: "", badges: ["BEST_MATCH"], internal: { vendorCostPiasters: 1, shippingCostPiasters: 0, marginPiasters: 0, marginPct: 0, areaRatio: 1, boardMultiplier: 1, indexId: "x" } } as never;

  it("prices the sample at the fixed price plus the printer's delivery, VAT 14% on both", () => {
    const s = sampleOffer(offer, 5, 75_000);
    expect(isSampleLines(s.lines)).toBe(true);
    expect(s.lines.map((l) => l.kind)).toEqual(["PRODUCT", "SHIPPING"]);
    expect(s.lines[0]).toMatchObject({ labelKey: SAMPLE_LINE_LABEL, quantity: 5, totalPiasters: 75_000 });
    expect(s.subtotalPiasters).toBe(90_000);
    expect(s.vatPiasters).toBe(vatOn(90_000));
    expect(s.deliveryDays).toBe(3 + 2);
    expect(s.badges).toEqual([]);
  });

  it("credits the sample against goods only and recomputes VAT on the lower base", () => {
    const base = orderTotals(lines, 3);
    const t = applySampleCredit(base, 75_000);
    expect(t.lines.at(-1)).toMatchObject({ kind: "DISCOUNT", totalPiasters: -75_000 });
    expect(t.subtotalPiasters).toBe(base.subtotalPiasters - 75_000);
    expect(t.vatPiasters).toBe(vatOn(t.subtotalPiasters));
    expect(t.totalPiasters).toBe(t.subtotalPiasters + t.vatPiasters);
  });

  it("never credits more than the goods (delivery stays payable)", () => {
    const tiny = orderTotals([{ ...lines[0], totalPiasters: 10_000 }, lines[2]], 0);
    const t = applySampleCredit(tiny, 75_000);
    expect(t.subtotalPiasters).toBe(15_000);
    expect(applySampleCredit(tiny, 0)).toBe(tiny);
  });
});

describe("checkout settings (B-11)", () => {
  it("defaults the prepay discount to 3% unless the environment or the admin row says otherwise", async () => {
    const { defaultCheckoutSettings, mergeCheckoutSettings } = await import("../checkout-settings");
    expect(defaultCheckoutSettings({}).prepayDiscountPct).toBe(3);
    expect(defaultCheckoutSettings({ PREPAY_DISCOUNT_PCT: "" }).prepayDiscountPct).toBe(3);
    expect(defaultCheckoutSettings({ PREPAY_DISCOUNT_PCT: "0" }).prepayDiscountPct).toBe(0);
    const base = defaultCheckoutSettings({});
    expect(mergeCheckoutSettings({ prepayDiscountPct: 5 }, base).prepayDiscountPct).toBe(5);
    expect(mergeCheckoutSettings({ prepayDiscountPct: 99 }, base)).toEqual(base);
    expect(mergeCheckoutSettings({ sample: { maxPieces: 3 } }, base).sample).toMatchObject({ maxPieces: 3, creditDays: 60 });
  });
});

describe("quote leads store governorate codes (B-15)", () => {
  it("maps names and codes to the code, rejects anything else", () => {
    expect(toGovernorateKey("Cairo")).toBe("CAIRO");
    expect(toGovernorateKey(" kafr el sheikh ")).toBe("KAFR_EL_SHEIKH");
    expect(toGovernorateKey("GIZA")).toBe("GIZA");
    expect(toGovernorateKey("giza")).toBe("GIZA");
    expect(toGovernorateKey("Atlantis")).toBeNull();
    expect(toGovernorateKey("")).toBeNull();
    expect(GOVERNORATE_KEYS).toHaveLength(27);
  });

  it("listQuoteRequests returns codes, also for older leads stored with the English name", async () => {
    const { listQuoteRequests } = await import("../quote-requests");
    const now = new Date("2026-11-06T10:00:00Z");
    dbMock.quote.findMany.mockResolvedValue([
      { id: "q1", createdAt: now, validUntil: now, status: "REQUESTED", designId: "d1", lines: [{ quantity: 5000 }], user: { id: "u", name: null, phone: "+201" } },
      { id: "q2", createdAt: now, validUntil: now, status: "REQUESTED", designId: "d2", lines: [{ quantity: 3000 }], user: null },
    ]);
    dbMock.auditLog.findMany.mockResolvedValue([
      { entityId: "q1", after: { governorate: "Cairo" } },
      { entityId: "q2", after: { governorate: "ALEXANDRIA" } },
    ]);
    const leads = await listQuoteRequests();
    expect(leads.map((l) => l.governorate)).toEqual(["CAIRO", "ALEXANDRIA"]);
    expect(leads[0].quantity).toBe(5000);
    expect(leads[0].dueAt.getTime() - now.getTime()).toBe(24 * 3_600_000);
  });
});
