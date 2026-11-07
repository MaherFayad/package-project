import { describe, expect, it } from "vitest";
import { supportContact } from "../support";
import { arrivalDate } from "@/app/[locale]/(checkout)/checkout/_components/arrival";

describe("supportContact (simplicity audit SIM-04)", () => {
  it("is null without a valid Egyptian number", () => {
    expect(supportContact(undefined)).toBeNull();
    expect(supportContact("")).toBeNull();
    expect(supportContact("12345")).toBeNull();
  });
  it("builds WhatsApp and call links from any common format", () => {
    expect(supportContact("010 1234 5678")).toEqual({ tel: "tel:+201012345678", whatsapp: "https://wa.me/201012345678", display: "010 1234 5678" });
    expect(supportContact("+20 101 234 5678")?.whatsapp).toBe("https://wa.me/201012345678");
  });
});

describe("arrivalDate", () => {
  it("names the day the boxes arrive when paid now (dueDate = now + days), Western digits in Arabic", () => {
    const now = Date.parse("2026-11-07T10:00:00Z");
    expect(arrivalDate(10, "en", now)).toBe("Tuesday 17 November");
    expect(arrivalDate(10, "ar", now)).toMatch(/17/);
    expect(arrivalDate(10, "ar", now)).not.toMatch(/[٠-٩]/);
  });
});
