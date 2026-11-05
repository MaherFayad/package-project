import { describe, expect, it } from "vitest";
import { addLayer, createDesignDoc, makeImageLayer } from "../doc";
import { LOCAL_KEY, loadLocalDraft, saveLocalDraft } from "../storage";
import { BADGE_QTY, quoteBody, quoteKey, toPriceState } from "../quote";
import { designerPath, matchingPreset, presetDims, structureFromParam } from "../catalog";

class MemStore {
  data = new Map<string, string>();
  limit = Infinity;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (v.length > this.limit) throw new Error("QuotaExceededError");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("local autosave", () => {
  it("round-trips a draft and expires it after 30 days", () => {
    const s = new MemStore();
    const doc = createDesignDoc({ structureCode: "PIZZA" });
    expect(saveLocalDraft({ doc, designId: "abc", savedAt: 1000 }, s)).toBe("full");
    expect(loadLocalDraft(s, 2000)).toMatchObject({ designId: "abc", doc: { structureCode: "PIZZA" } });
    expect(loadLocalDraft(s, 1000 + 31 * 86_400_000)).toBeNull();
    expect(s.getItem(LOCAL_KEY)).toBeNull();
  });

  it("falls back to a copy without inline images when storage is full", () => {
    const s = new MemStore();
    s.limit = 2000;
    const big = "data:image/png;base64," + "A".repeat(5000);
    const doc = addLayer(createDesignDoc({ structureCode: "FEFCO_0427" }), makeImageLayer("front", "outside", { width: 100, height: 50 }, { src: big, pxWidth: 10, pxHeight: 10 }));
    expect(saveLocalDraft({ doc, designId: null, savedAt: Date.now() }, s)).toBe("partial");
    expect(loadLocalDraft(s)!.doc.artwork.outside.layers).toHaveLength(0);
  });

  it("ignores corrupt data", () => {
    const s = new MemStore();
    s.setItem(LOCAL_KEY, "{not json");
    expect(loadLocalDraft(s)).toBeNull();
    s.setItem(LOCAL_KEY, JSON.stringify({ doc: { v: 2 }, savedAt: Date.now() }));
    expect(loadLocalDraft(s)).toBeNull();
  });
});

describe("price badge", () => {
  const doc = createDesignDoc({ structureCode: "FEFCO_0427", finishCode: "MATTE_LAMINATION" });
  it("builds the /api/quote body and a key that ignores artwork", () => {
    expect(quoteBody(doc, BADGE_QTY)).toMatchObject({ materialCode: "E_FLUTE_KRAFT", finishes: ["MATTE_LAMINATION"], quantity: 500 });
    expect(quoteBody({ ...doc, finishCode: "NONE" }, 100).finishes).toEqual([]);
    const withArt = addLayer(doc, makeImageLayer("front", "outside", { width: 100, height: 50 }, { src: "data:image/png;base64,AA==", pxWidth: 1, pxHeight: 1 }));
    expect(quoteKey(withArt, 500)).toBe(quoteKey(doc, 500));
    expect(quoteKey({ ...doc, dims: { ...doc.dims, L: 300 } }, 500)).not.toBe(quoteKey(doc, 500));
  });

  it("maps responses to badge states (cheapest offer wins)", () => {
    expect(toPriceState(401, { error: "UNAUTHENTICATED" })).toEqual({ status: "locked" });
    expect(toPriceState(500, null)).toEqual({ status: "error" });
    expect(toPriceState(200, { mode: "instant", offers: [] })).toEqual({ status: "none" });
    const offer = (id: string, total: number, days: number) => ({
      vendor: { id, name: { ar: id, en: id } },
      unitPiasters: total / 500,
      subtotalPiasters: total,
      vatPiasters: 0,
      totalPiasters: total,
      deliveryDays: days,
      validUntil: "2026-11-08T00:00:00.000Z",
    });
    const s = toPriceState(200, { mode: "instant", quantity: 500, offers: [offer("a", 9000, 5), offer("b", 8000, 9)], suggestion: null, validUntil: "x" });
    expect(s.status === "ready" && s.best.vendor.id).toBe("b");
    expect(s.status === "ready" && s.vendorCount).toBe(2);
  });
});

describe("catalog routing", () => {
  it("accepts slugs and codes", () => {
    expect(structureFromParam("mailer-box")).toBe("FEFCO_0427");
    expect(structureFromParam("fefco_0201")).toBe("FEFCO_0201");
    expect(structureFromParam("ECMA-RTE")).toBe("ECMA_RTE");
    expect(structureFromParam("rigid-box")).toBeNull();
    expect(designerPath("ar", "PIZZA", { preset: "pizza-30", d: undefined })).toBe("/ar/design/pizza-box?preset=pizza-30");
  });

  it("resolves preset dims and matches them back", () => {
    expect(presetDims("ECMA_RTE", "perfume-50ml")).toEqual({ L: 55, W: 45, H: 130 });
    expect(presetDims("ECMA_RTE", "unknown")).toEqual({ L: 60, W: 60, H: 140 });
    expect(matchingPreset("PIZZA", { L: 310, W: 310, H: 40 })?.id).toBe("pizza-30");
  });
});
