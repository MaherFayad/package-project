import { describe, expect, it } from "vitest";
import { findContactDetails, hasContactDetails, stripContactDetails } from "../contact";
import { portfolioCaptionSchema } from "../profile";
import { statusTone } from "@/lib/orders/status-tone";
import { allowedActions, hasRequiredQcPhotos, statusBadge } from "../jobs";

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

describe("QC photos vs portfolio moderation", () => {
  it("freshly uploaded QC photos (PENDING ops review) unlock 'submit for QC'; only rejected ones do not count", () => {
    const pending = [
      { kind: "FIRST_SHEET", status: "PENDING" },
      { kind: "PACKED_BUNDLE", status: "PENDING" },
    ];
    expect(hasRequiredQcPhotos(pending)).toBe(true);
    expect(allowedActions({ status: "IN_PRODUCTION", paidAt: new Date().toISOString(), events: [], qcPhotos: pending })).toContain("submitQc");
    expect(hasRequiredQcPhotos([{ kind: "FIRST_SHEET", status: "PENDING" }, { kind: "PACKED_BUNDLE", status: "REJECTED" }])).toBe(false);
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

describe("R4 contact filter: bypass attempts are caught", () => {
  it.each([
    "Call 010_0123_4567",
    "Call 010/0123/4567",
    "Call 010,0123,4567",
    "Call 010​0123​4567",
    "Call 0‌1‌0‌0‌1‌2‌3‌4‌5‌6‌7",
    "Call ０１００１２３４５６７",
    "Call 𝟎𝟏𝟎𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕",
    "Call O1OO1234567",
    "Call 010 - - - - 0123 - - - - 4567",
    "اتصل ٠١٠٫٠١٢٣٫٤٥٦٧",
    "اتصل ٠١٠٬٠١٢٣٬٤٥٦٧",
    "اتصل على ٠١٠ ـ ٠١٢٣ ـ ٤٥٦٧",
    "zero one zero zero one two three four five six seven",
    "zero-one-zero-zero-one-two-three-four-five-six-seven",
    "صفر واحد صفر صفر واحد اثنين ثلاثة اربعة خمسة ستة سبعة",
    "Call 010 and then 0123 and then 4567",
    "Hotline 19019",
    "nilepack . com",
    "nilepack(dot)com",
    "nilepack DOT com",
    "nilepack دوت كوم",
    "nilepack.cоm", // Cyrillic о
    "nilepack.dev",
    "hxxps://nilepack",
    "IG: nilepack",
    "twitter nilepack",
    "تويتر nilepack",
    "يوتيوب نايل باك",
    "nilepack on gmail",
    "جيميل nilepack",
    "ايميل nilepack",
    "Search Nile Pack on Google Maps",
    "w h a t s a p p",
    "و ا ت س",
    "واتـــساب",
    "تيلجرام",
    "Inst@gram nile",
    "f.b nilepack",
    "nilepack-on-face-book",
    "Telgram",
    "سيجنال",
    "imo",
  ])("flags %s", (text) => {
    expect(hasContactDetails(text)).toBe(true);
  });

  it.each([
    "Snap-lock bottom cartons and crash-lock trays",
    "Jars with screw threads and printed labels",
    "We print one, two or four colours on runs of 100, 250, 500, 1000 and 2000 boxes.",
    "Runs of 100/250/500/1000/2000 pieces",
    "Founded in 1998 with 5 machines and 120 staff.",
    "Our outlook for 2027 is growth.",
    "We print boxes. Co-packing is available too.",
    "Great for the end. Me and my team print fast.",
    "طباعة بلون واحد أو لونين أو أربعة ألوان على 100 أو 500 أو 1000 علبة.",
    "نطبع ست ألوان على ماكينة هايدلبرج سبعة أبراج",
    "Automatic folder-gluer for crash-lock bottoms",
    "What's new: soft-touch lamination and hot foil.",
    "Display trays for 6 x 330 ml cans",
    "Printed on Koenig & Bauer Rapida 106 (2019)",
    "We email proofs within 24 hours and print within 7 days.",
    "نرسل البروفة خلال 24 ساعة. خط إنتاج بطاقة 300000 علبة شهريا.",
  ])("leaves normal packaging copy alone: %s", (text) => {
    expect(findContactDetails(text)).toEqual([]);
  });

  it("a number split across sentences is removed with the whole text", () => {
    expect(stripContactDetails("Call 010. 0123. 4567.")).toBe("");
  });
});
