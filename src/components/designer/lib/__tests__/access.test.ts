import { describe, expect, it } from "vitest";
import { canRead, canWrite, type Actor } from "../access";

const now = new Date("2026-11-05T12:00:00Z");
const later = new Date("2026-12-01T00:00:00Z");
const past = new Date("2026-10-01T00:00:00Z");
const buyer: Actor = { user: { id: "u1", role: "BUYER" }, anonId: "anon-aaaaaaaaaaaaaaaa" };
const other: Actor = { user: { id: "u2", role: "BUYER" }, anonId: "anon-bbbbbbbbbbbbbbbb" };
const admin: Actor = { user: { id: "a", role: "ADMIN" }, anonId: null };
const anon: Actor = { user: null, anonId: "anon-aaaaaaaaaaaaaaaa" };
const stranger: Actor = { user: null, anonId: "anon-cccccccccccccccc" };

describe("design access rules", () => {
  it("owned designs: owner reads and writes; admin reads only; others nothing", () => {
    const row = { ownerId: "u1", anonId: null, expiresAt: null };
    expect(canRead(row, buyer, now) && canWrite(row, buyer, now)).toBe(true);
    expect(canRead(row, other, now) || canWrite(row, other, now)).toBe(false);
    expect(canRead(row, admin, now)).toBe(true);
    expect(canWrite(row, admin, now)).toBe(false);
    expect(canRead(row, anon, now)).toBe(false);
  });

  it("anonymous designs: only the same browser, and only until they expire", () => {
    const row = { ownerId: null, anonId: "anon-aaaaaaaaaaaaaaaa", expiresAt: later };
    expect(canWrite(row, anon, now)).toBe(true);
    expect(canWrite(row, buyer, now)).toBe(true); // same browser, now signed in: may claim it
    expect(canRead(row, stranger, now)).toBe(false);
    expect(canRead(row, { user: null, anonId: null }, now)).toBe(false);
    expect(canRead({ ...row, expiresAt: past }, anon, now)).toBe(false);
    expect(canWrite({ ...row, expiresAt: past }, anon, now)).toBe(false);
  });
});
