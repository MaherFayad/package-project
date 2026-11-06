import { describe, expect, it } from "vitest";
import { bioForEditing, bioReviewData, bioSaveData, canApproveBio } from "../bio-review";
import { findContactDetails } from "../contact";

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
