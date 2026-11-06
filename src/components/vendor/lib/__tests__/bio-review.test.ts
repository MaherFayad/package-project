import { describe, expect, it } from "vitest";
import { bioForEditing, bioReviewData, bioSaveData, canApproveBio } from "../bio-review";
import { findContactDetails } from "../contact";
import { splitContact } from "../profile";

const live = { bioAr: "مصنع كرتون منذ 2009", bioEn: "Corrugated plant since 2009", bioArPending: null, bioEnPending: null, bioReviewStatus: null };

describe("R5 bio review (B-08)", () => {
  it("a changed bio waits for review and never touches the live bio", () => {
    const d = bioSaveData(live, { bioAr: live.bioAr, bioEn: "New English bio" });
    expect(d).toMatchObject({ bioArPending: live.bioAr, bioEnPending: "New English bio", bioReviewStatus: "PENDING" });
    expect(d).not.toHaveProperty("bioAr");
    expect(d).not.toHaveProperty("bioEn");
  });

  it("saving the live text withdraws a waiting or rejected edit", () => {
    const rejected = { ...live, bioEnPending: "x", bioArPending: "y", bioReviewStatus: "REJECTED" };
    expect(bioSaveData(rejected, { bioAr: live.bioAr, bioEn: live.bioEn })).toMatchObject({ bioReviewStatus: null, bioEnPending: null });
  });

  it("the form edits the waiting text; a rejected edit returns to review when saved again", () => {
    const pending = { ...live, bioArPending: live.bioAr, bioEnPending: "Edit", bioReviewStatus: "REJECTED" };
    expect(bioForEditing(pending).bioEn).toBe("Edit");
    expect(bioForEditing(live).bioEn).toBe(live.bioEn);
    expect(bioSaveData(pending, { bioAr: live.bioAr, bioEn: "Edit 2" }).bioReviewStatus).toBe("PENDING");
  });

  it("ops approve copies the edit live; reject keeps it with a note; contact details cannot be approved", () => {
    const pending = { ...live, bioArPending: live.bioAr, bioEnPending: "New bio", bioReviewStatus: "PENDING" };
    expect(canApproveBio(pending)).toBe(true);
    expect(bioReviewData("APPROVE", pending)).toMatchObject({ bioEn: "New bio", bioEnPending: null, bioReviewStatus: null });
    expect(bioReviewData("REJECT", pending, " Remove the phone ")).toEqual({ bioReviewStatus: "REJECTED", bioReviewNote: "Remove the phone" });
    expect(canApproveBio({ ...pending, bioEnPending: "Sales 010 1234 5678" })).toBe(false);
    expect(canApproveBio(live)).toBe(false);
  });
});

describe("R5 contact filter: business session R4-B-02 strings on the merged code", () => {
  it.each([
    "Sales: 010 1234 / 5678. Follow us on انستقرام nilepack. Or nilepack[.]com",
    "Follow us on انستقرام nilepack",
    "Or nilepack[.]com",
    "nilepack(.)com",
    "nilepack{.}com",
    "nilepack [.] com",
    "ig nilepack",
    "فيس nilepack",
    "إنستقرام",
    "010    1234    5678",
    "０１００１２３４５６７",
    "𝟎1𝟎𝟎1234567",
    "O1OO1234567",
    "What​sApp",
    "nilepack . com",
    "sales＠nilepack．com",
  ])("flags %s", (text) => {
    expect(findContactDetails(text).length).toBeGreaterThan(0);
  });

  it.each(["Big orders welcome", "فيسكوز", "We sell boxes in bags of 50 and ig-free ink"])("leaves %s alone", (text) => {
    expect(findContactDetails(text)).toEqual([]);
  });
});

describe("R6 contact filter: new bypass ideas", () => {
  it.each([
    "Wha‍ts‍App", "واتس‍اب", "insta‌gram nile", "Tele​gram",
    "زيرو وان زيرو زيرو وان تو ثري فور فايف سكس سفن",
    "صفر واحد صفر صفر، واحد اتنين تلاتة، أربعة خمسة ستة سبعة",
    "كلمنا على صفر مية واحد اتنين تلاتة اربعة خمسة ستة سبعة",
    "Scan the QR on the box", "امسح الكود QR", "QR: nilepack", "Scan me",
    "nilepack。com", "nilepack｡com", "nilepack·com", "nilepack،com", "n i l e p a c k . c o m",
    "linktr.ee/nilepack", "mailto:x", "tel:+20100",
    "DM us", "inbox us", "ابعتلنا ع الخاص", "كلمنا خاص", "رقمنا في الصورة", "Call us", "اتصل بنا",
    "0️⃣1️⃣0️⃣0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣", "O1OO-l23-4567", "01OO l234567", "໐໑໐໐໑໒໓໔໕໖໗",
  ])("flags %s", (text) => {
    expect(findContactDetails(text).length).toBeGreaterThan(0);
  });

  it.each([
    "Board 0.5 mm, 1 to 2 colours, 100 to 500 pieces, 3 to 4 days, 2 shifts, 5 machines.",
    "We print 0 to 4 colours on 1, 2 or 3 sides, from 100, 250, 500, 1000, 2000 or 5000 pieces.",
    "Sizes from 10 x 10 x 5 cm to 120 x 80 x 60 cm, 1 to 6 colours, 1 to 2 sides.",
    "طباعة من صفر إلى أربعة ألوان على وجه واحد أو وجهين، من مية قطعة لحد ألفين، والتسليم خلال تلاتة لخمسة أيام.",
    "نطبع لون واحد أو اتنين أو تلاتة، كمية من مية علبة، ومدة التنفيذ من سبعة لتسعة أيام.",
    "Flexo 6 colours, 0.1 to 0.5 mm films, 1 2 3 4 colour jobs, 10 15 20 day lead times",
    "We offer QR code labels and barcodes for retail brands.",
    "نطبع أكواد QR وباركود على الملصقات للمتاجر.",
    "Contact us through Elba for samples.",
    "Founded 2001, ISO 9001:2015, 4 lines, 250000 boxes a month, 98% on time.",
    "Mailer boxes 1/2/3 colour, 300gsm, 0.3mm, from 100 pcs in 7 days.",
  ])("leaves %s alone", (text) => {
    expect(findContactDetails(text)).toEqual([]);
  });

  it("a site or number split across fields is caught on the joined text", () => {
    expect(splitContact(["Great boxes by nilepack", ".com is our home"])).toBe(true);
    expect(splitContact(["Call 0100", "1234567"])).toBe(true);
    expect(splitContact(["Mailer boxes for a fashion label", "علب بريدية لعلامة ملابس"])).toBe(false);
  });
});
