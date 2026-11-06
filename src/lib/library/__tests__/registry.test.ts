import { describe, expect, it, vi } from "vitest";

/**
 * PERF-04: the browser imports ./registry (not the eager entry) and loads one family pack per
 * model. These tests use a fresh module graph so nothing is pre-registered.
 */
describe("lazy model registry", () => {
  it("loads only the requested family and dedupes like the eager entry", async () => {
    vi.resetModules();
    const reg = await import("../registry");
    expect(reg.modelByCode("FEFCO_0203")).toBeNull();
    const m = await reg.loadModel("FEFCO_0203");
    expect(m?.code).toBe("FEFCO_0203");
    expect(reg.isModelLoaded("FEFCO_0203")).toBe(true);
    // other families stay unloaded
    expect(reg.isModelLoaded("BTL_GLASS_WATER")).toBe(false);
    expect(reg.isModelLoaded("ECMA_TUCK_RTE")).toBe(false);
    // FEFCO_0201 exists in the fefco-02 pack too, but the core pack owns it
    expect(reg.isModelLoaded("FEFCO_0201")).toBe(false);
    const core = await reg.loadModel("shipping-box");
    expect(core?.code).toBe("FEFCO_0201");
    expect(core?.source).toBe("core");
  });

  it("builds geometry after a lazy load (box and container)", async () => {
    vi.resetModules();
    const reg = await import("../registry");
    const doc = await import("../doc");
    const box = await reg.loadModel("FEFCO_0711");
    expect(box?.kind).toBe("box");
    if (box?.kind === "box") expect(box.build(box.defaultDims, { thicknessMm: 3 }).panels.length).toBeGreaterThan(3);
    const pouch = await reg.loadModel("FLEX_STAND_UP_POUCH");
    expect(pouch?.kind).toBe("vessel");
    expect(doc.docModel({ modelCode: "FLEX_STAND_UP_POUCH", structureCode: "PRINTED_POUCH" })?.code).toBe("FLEX_STAND_UP_POUCH");
  });

  it("generated index matches the eager library (code -> pack, final slug)", async () => {
    vi.resetModules();
    const { MODELS } = await import("..");
    const { MODEL_INDEX } = await import("../model-index.generated");
    expect(Object.keys(MODEL_INDEX).length).toBe(MODELS.length);
    for (const m of MODELS) expect(MODEL_INDEX[m.code], m.code).toEqual([m.source, m.slug]);
  });

  it("generated picker rows match the catalogue's designer rows", async () => {
    const { CATALOGUE } = await import("@/data/catalogue");
    const rows = (await import("@/data/catalogue/picker-rows.generated.json")).default as { code: string; slug: string; availableInEgypt: string }[];
    const lib = CATALOGUE.filter((e) => e.designer);
    expect(rows.map((r) => [r.code, r.slug, r.availableInEgypt])).toEqual(lib.map((e) => [e.code, e.slug, e.availableInEgypt]));
  });
});
