import { describe, expect, it } from "vitest";
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "@/lib/auth/unsubscribe";

describe("one-click marketing opt-out link (PDPL)", () => {
  it("verifies only the token made for that user", () => {
    const t = unsubscribeToken("user_a");
    expect(t).toHaveLength(32);
    expect(verifyUnsubscribeToken("user_a", t)).toBe(true);
    expect(verifyUnsubscribeToken("user_b", t)).toBe(false);
    expect(verifyUnsubscribeToken("user_a", t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBe(false);
  });
  it("rejects missing, malformed and oversized input", () => {
    expect(verifyUnsubscribeToken(null, null)).toBe(false);
    expect(verifyUnsubscribeToken("user_a", "")).toBe(false);
    expect(verifyUnsubscribeToken("../x", unsubscribeToken("../x"))).toBe(false);
    expect(verifyUnsubscribeToken("a".repeat(65), "x".repeat(32))).toBe(false);
    expect(verifyUnsubscribeToken(["user_a"], unsubscribeToken("user_a"))).toBe(false);
  });
  it("builds a locale link without the phone number", () => {
    const url = new URL(unsubscribeUrl("https://elba.test/", "ar", "user_a"));
    expect(url.origin + url.pathname).toBe("https://elba.test/ar/unsubscribe");
    expect(url.searchParams.get("u")).toBe("user_a");
    expect(verifyUnsubscribeToken(url.searchParams.get("u"), url.searchParams.get("t"))).toBe(true);
  });
});
