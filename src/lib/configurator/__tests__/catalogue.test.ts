import { describe, expect, it } from "vitest";
import { MATERIAL_CODES, STRUCTURE_CODES } from "@/types";
import { MODELS, boxModel } from "@/lib/library";
import { CATALOGUE } from "@/data/catalogue";
import { catalogueModelConfig, catalogueOptions, quoteMode, QUOTE_COPY } from "../catalogue";
import { evaluateConfig } from "../rules";
import type { VendorForMatch } from "../pricing";

/** A printer that makes every core structure on every board and prices every finish. */
const EVERYTHING: VendorForMatch = {
  id: "v-all",
  status: "ACTIVE",
  verified: true,
  minOrderQty: 1,
  capabilities: {
    structures: [...STRUCTURE_CODES],
    materials: [...MATERIAL_CODES],
    finishes: ["NONE", "MATTE_LAMINATION", "GLOSS_LAMINATION", "SPOT_UV", "SOFT_TOUCH_LAMINATION", "VARNISH", "HOT_FOIL", "EMBOSS", "DEBOSS"],
    maxColors: 8,
    digitalShortRun: true,
    monthlyCapacityUnits: 1e6,
  },
  rateCards: STRUCTURE_CODES.flatMap((s) => MATERIAL_CODES.map((m) => ({ structureCode: s, materialCode: m, finishes: [] }))),
};

describe("ModelConfig for every library model", () => {
  it.each(MODELS.map((m) => [m.code] as const))("%s: a valid default config and options per family", (code) => {
    const cfg = catalogueModelConfig(code);
    expect(cfg, code).not.toBeNull();
    const ev = evaluateConfig(cfg!);
    expect(ev.issues.filter((i) => i.severity === "error"), code).toEqual([]);
    const o = catalogueOptions(code)!;
    expect(o.base).not.toBeNull();
    expect(o.materials.some((m) => m.ok), code).toBe(true);
    expect(o.finishes).toHaveLength(11);
  });

  it("boards follow the model's family and base structure", () => {
    const o = catalogueOptions("FEFCO_0427")!;
    expect(o.materials.map((m) => m.value)).not.toContain("SBS_300");
    const tuck = catalogueOptions("ECMA_TUCK_RTE")!;
    expect(tuck.materials.every((m) => m.value.startsWith("SBS"))).toBe(true);
    // Double wall is offered on shipping cases only.
    const bc = catalogueOptions("FEFCO_0201")!.materials.find((m) => m.value === "BC_FLUTE_KRAFT");
    expect(bc?.ok).toBe(true);
    const bcMailer = catalogueOptions("FEFCO_0427")!.materials.find((m) => m.value === "BC_FLUTE_KRAFT");
    expect(bcMailer?.ok).toBe(false);
  });

  it("add-ons follow the model's own feature support", () => {
    for (const m of MODELS) {
      if (m.kind !== "box") continue;
      const o = catalogueOptions(m.code)!;
      expect(o.addOns.find((a) => a.value === "windowFilm")!.ok, m.code).toBe(m.features.windowFaces.length > 0);
      expect(o.addOns.find((a) => a.value === "tearStrip")!.ok, m.code).toBe(m.features.tearStrip);
      expect(o.addOns.find((a) => a.value === "handle")!.ok, m.code).toBe(m.features.handle);
    }
  });

  it("no lamination or emboss on direct-printed kraft corrugated", () => {
    const cfg = catalogueModelConfig("FEFCO_0203", { board: "B_FLUTE_KRAFT" })!;
    expect(cfg.material).toBe("B_FLUTE_KRAFT");
    const o = catalogueOptions("FEFCO_0203")!;
    expect(o.finishes.find((f) => f.value === "EMBOSS")!.ok).toBe(false);
  });
});

describe("quote-only family models", () => {
  const extras = CATALOGUE.filter((e) => !e.designer);
  it("have options with no core base, family finishes only", () => {
    expect(extras.length).toBeGreaterThan(30);
    for (const e of extras) {
      const o = catalogueOptions(e.code, ["X"])!;
      expect(o.base).toBeNull();
      expect(o.addOns.every((a) => !a.ok)).toBe(true);
    }
    expect(catalogueOptions("FS_PULP_EGG_6")!.finishes.every((f) => !f.ok)).toBe(true);
    expect(catalogueOptions("FS_CUP_SINGLE")!.finishes.filter((f) => f.ok).map((f) => f.value)).toEqual(["GLOSS_VARNISH", "MATTE_VARNISH"]);
  });
});

describe("commerce path", () => {
  it("instant when a capable printer exists, else quote", () => {
    for (const m of MODELS) {
      const q = quoteMode(m.code, [EVERYTHING]);
      if (m.kind === "box") expect(q.mode, m.code).toBe("instant");
      else expect(q).toEqual({ mode: "quote", reason: "LABELS_BY_QUOTE" });
    }
    expect(quoteMode("FEFCO_0427", [])).toEqual({ mode: "quote", reason: "NO_VENDOR" });
    expect(quoteMode("FS_CUP_DOUBLE", [EVERYTHING])).toEqual({ mode: "quote", reason: "QUOTE_ONLY_STOCK" });
  });

  it("an inactive or narrow printer does not give an instant price", () => {
    expect(quoteMode("FEFCO_0427", [{ ...EVERYTHING, status: "SUSPENDED" }]).mode).toBe("quote");
    const tubesOnly: VendorForMatch = { ...EVERYTHING, capabilities: { ...EVERYTHING.capabilities, structures: ["PAPER_TUBE"] }, rateCards: [{ structureCode: "PAPER_TUBE", materialCode: "KRAFT_TUBE", finishes: [] }] };
    expect(quoteMode("FEFCO_0427", [tubesOnly]).mode).toBe("quote");
    expect(quoteMode("TUBE_TELESCOPING", [tubesOnly]).mode).toBe(boxModel("TUBE_TELESCOPING") ? "instant" : "quote");
  });

  it("has bilingual copy for both paths", () => {
    for (const v of Object.values(QUOTE_COPY)) {
      expect(v.ar).toBeTruthy();
      expect(v.en).toBeTruthy();
    }
  });
});
