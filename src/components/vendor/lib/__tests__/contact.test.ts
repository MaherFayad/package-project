import { describe, expect, it } from "vitest";
import { findContactDetails, hasContactDetails, stripContactDetails } from "../contact";
import { portfolioCaptionSchema } from "../profile";
import { statusTone } from "@/lib/orders/status-tone";
import { statusBadge } from "../jobs";

describe("B-08 contact detail filter", () => {
  it.each([
    ["WhatsApp us direct: 01001234567", ["PHONE", "MESSENGER"]],
    ["كلمنا على ٠١٠٠١٢٣٤٥٦٧", ["PHONE"]],
    ["+20 100 123 4567", ["PHONE"]],
    ["010-0123-4567", ["PHONE"]],
    ["sales@nilepack.com", ["EMAIL", "URL"]],
    ["sales at nilepack dot com", ["EMAIL"]],
    ["www.nilepack-direct.com", ["URL"]],
    ["visit nilepack.com.eg", ["URL"]],
    ["follow us @nile_pack", ["HANDLE"]],
    ["تابعنا على انستجرام", ["MESSENGER"]],
    ["راسلنا واتساب", ["MESSENGER"]],
  ])("flags %s", (text, kinds) => {
    for (const k of kinds) expect(findContactDetails(text)).toContain(k);
  });

  it.each([
    "Integrated corrugated plant in October's 3rd Industrial Zone since 2009. We serve e-commerce shops and young brands from 100 boxes.",
    "مصنع متكامل للكرتون المضلع منذ 2009 في المنطقة الصناعية الثالثة بأكتوبر. نخدم المتاجر من 100 علبة.",
    "ISO 9001 and ISO 22000 certified, Heidelberg SM 102, 400000 boxes a month",
    "We print at October. We serve brands.",
    "Boxes 300 × 200 × 150 mm, 500 pcs, 2-colour, e.g. snack boxes",
    "Heidelberg Speedmaster SM 102",
    "Bureau Veritas",
  ])("leaves normal profile text alone: %s", (text) => {
    expect(hasContactDetails(text)).toBe(false);
  });

  it("strips the whole sentence holding a contact, keeps the rest", () => {
    expect(stripContactDetails("Great boxes. WhatsApp us: 01001234567 or www.x-direct.com. Since 2009.")).toBe("Great boxes. Since 2009.");
    expect(stripContactDetails("منذ 2009. كلمنا واتساب ٠١٠٠١٢٣٤٥٦٧. نخدم المتاجر.")).toBe("منذ 2009. نخدم المتاجر.");
    expect(stripContactDetails("Clean text.")).toBe("Clean text.");
  });

  it("profile and caption schemas reject contact details (client and server share them)", () => {
    const cap = portfolioCaptionSchema.safeParse({ captionAr: "علب هدايا", captionEn: "Call 01001234567", structureCode: null });
    expect(cap.success).toBe(false);
    expect(cap.error!.issues.some((i) => i.message === "CONTACT")).toBe(true);
  });
});

describe("CR-08 shared status tone", () => {
  it("same tone for a status everywhere; vendor problems stay critical", () => {
    expect(statusTone("DELIVERED")).toEqual({ tone: "success", progress: "complete" });
    expect(statusTone("PAID").tone).toBe("attention");
    const base = { paidAt: new Date().toISOString(), events: [], qcPhotos: [] };
    expect(statusBadge({ ...base, status: "DELIVERED" })).toEqual(statusTone("DELIVERED"));
    expect(statusBadge({ ...base, status: "SHIPPED" })).toEqual(statusTone("SHIPPED"));
    expect(statusBadge({ ...base, status: "PAID", events: [{ type: "VENDOR_DECLINED", createdAt: new Date().toISOString() }] }).tone).toBe("critical");
  });
});
