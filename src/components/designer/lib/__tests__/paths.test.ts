import { describe, expect, it } from "vitest";
import { STRUCTURE_CODES } from "@/types";
import { STRUCTURES } from "@/lib/dieline";
import { STRUCTURE_SLUGS, designerPathLite, readDraftSummary, structureFromParam, LOCAL_DRAFT_KEY } from "../paths";
import { designerPath } from "../catalog";

describe("paths (dependency-free designer URLs)", () => {
  it("core slugs match the dieline engine", () => {
    for (const code of STRUCTURE_CODES) expect(STRUCTURE_SLUGS[code]).toBe(STRUCTURES[code].slug);
  });
  it("lite path equals the library path for core structures", () => {
    for (const code of STRUCTURE_CODES) expect(designerPathLite("ar", code, { preset: "x" })).toBe(designerPath("ar", code, { preset: "x" }));
  });
  it("lite path sends family / container codes as a lower-case code the route accepts", () => {
    expect(designerPathLite("en", "FEFCO_0203")).toBe("/en/design/fefco_0203");
    expect(structureFromParam("mailer-box")).toBe("FEFCO_0427");
  });
  it("reads a draft summary defensively", () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    Object.defineProperty(globalThis, "window", { value: { localStorage: ls }, configurable: true });
    expect(readDraftSummary()).toBeNull();
    store.set(LOCAL_DRAFT_KEY, "{bad");
    expect(readDraftSummary()).toBeNull();
    store.set(LOCAL_DRAFT_KEY, JSON.stringify({ doc: { name: "Bloom", structureCode: "FEFCO_0427", modelCode: "FEFCO_0203" }, designId: "abc", savedAt: Date.now() }));
    expect(readDraftSummary()).toEqual({ name: "Bloom", modelCode: "FEFCO_0203", structureCode: "FEFCO_0427", designId: "abc" });
    store.set(LOCAL_DRAFT_KEY, JSON.stringify({ doc: { name: "Old", structureCode: "FEFCO_0427" }, savedAt: Date.now() - 31 * 86_400_000 }));
    expect(readDraftSummary()).toBeNull();
    store.set(LOCAL_DRAFT_KEY, JSON.stringify({ doc: { structureCode: "<script>" }, savedAt: Date.now() }));
    expect(readDraftSummary()).toBeNull();
  });
});
