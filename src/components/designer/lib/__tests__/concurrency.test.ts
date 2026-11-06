import { describe, expect, it } from "vitest";
import { isStaleBase } from "../concurrency";

/** R10-R1: saves carry the version they edit; a newer stored version is a conflict. */
describe("isStaleBase", () => {
  const stored = new Date("2026-11-06T13:00:00.123Z");
  it("is not stale for the same version", () => expect(isStaleBase("2026-11-06T13:00:00.123Z", stored)).toBe(false));
  it("is stale when the stored copy is newer or older", () => {
    expect(isStaleBase("2026-11-06T12:59:59.000Z", stored)).toBe(true);
    expect(isStaleBase("2026-11-06T13:00:01.000Z", stored)).toBe(true);
  });
  it("never conflicts without a base or with force", () => {
    expect(isStaleBase(undefined, stored)).toBe(false);
    expect(isStaleBase(null, stored)).toBe(false);
    expect(isStaleBase("2026-01-01T00:00:00.000Z", stored, true)).toBe(false);
  });
  it("treats a malformed base as stale (refuse rather than overwrite)", () => expect(isStaleBase("not a date", stored)).toBe(true));
});
