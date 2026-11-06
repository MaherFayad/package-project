import { describe, expect, it } from "vitest";
import { VISIT_IDLE_MS, startsVisit } from "@/lib/analytics/client";

describe("visit = first page view of a browsing session", () => {
  const now = 1_800_000_000_000;
  it("starts a visit with no or unreadable history", () => {
    expect(startsVisit(null, now)).toBe(true);
    expect(startsVisit("garbage", now)).toBe(true);
    expect(startsVisit(String(now + 60_000), now)).toBe(true); // clock moved back
  });
  it("does not count another tab or page view inside the session", () => {
    expect(startsVisit(String(now - 1_000), now)).toBe(false);
    expect(startsVisit(String(now - VISIT_IDLE_MS + 1), now)).toBe(false);
  });
  it("starts a new visit after 30 idle minutes", () => {
    expect(startsVisit(String(now - VISIT_IDLE_MS), now)).toBe(true);
  });
});
