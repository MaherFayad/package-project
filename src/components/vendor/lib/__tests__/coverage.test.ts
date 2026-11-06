import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/library";
import { STRUCTURE_CODES } from "@/types";
import { instantModelsForCard, jobModel, listedGroups, modelsForCard, modelsForStructure, structureCoverage } from "../coverage";
import { filterJobs } from "../jobs";

describe("vendor model coverage (R2-01..R2-04)", () => {
  it("every library model is priced by at least one box style", () => {
    const covered = new Set(STRUCTURE_CODES.flatMap((s) => modelsForStructure(s).map((m) => m.code)));
    const missing = MODELS.filter((m) => !covered.has(m.code)).map((m) => m.code);
    expect(missing).toEqual([]);
  });

  it("a family model sits on its base structure card, core model first", () => {
    const rsc = modelsForCard("FEFCO_0201", "E_FLUTE_KRAFT").map((m) => m.code);
    expect(rsc[0]).toBe("FEFCO_0201");
    expect(rsc).toContain("FEFCO_0203");
    expect(modelsForCard("FEFCO_0201", "SBS_300")).toEqual([]);
  });

  it("labels, pouches and tubes are covered on their own stocks only", () => {
    expect(modelsForCard("ROLL_LABEL", "LABEL_PAPER").length).toBeGreaterThan(0);
    expect(modelsForCard("ROLL_LABEL", "TUBE_PE")).toEqual([]);
    expect(modelsForCard("PRINTED_TUBE", "TUBE_PE").length).toBeGreaterThan(0);
    expect(modelsForCard("PRINTED_POUCH", "TUBE_PE")).toEqual([]);
  });

  it("coverage counts match the lists and carry the industry reference", () => {
    const cov = structureCoverage("en");
    expect(cov.FEFCO_0201.standard).toBe("FEFCO 0201");
    // R4: the tick count is what gets an instant price; special gluing models are counted apart.
    const all = modelsForStructure("FEFCO_0201");
    expect(cov.FEFCO_0201.count).toBe(all.filter((m) => m.mode === "instant").length);
    expect(cov.FEFCO_0201.listed).toBeGreaterThan(0);
    expect(cov.FEFCO_0201.count + all.filter((m) => m.mode !== "instant").length).toBe(all.length);
    expect(cov.FEFCO_0201.examples.length).toBeLessThanOrEqual(3);
  });

  it("R4: special gluing models are grouped by base style and only priced once listed", () => {
    const groups = listedGroups();
    const codes = groups.flatMap((g) => g.models.map((m) => m.code));
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(["FEFCO_0711", "ECMA_TUCK_CRASH_LOCK", "ECMA_TRAY_4C", "BOTTLE_BASKET_4"]));
    for (const g of groups) for (const m of g.models) expect(m.bases).toContain(g.structure);
    const tray = instantModelsForCard("FEFCO_0422", "E_FLUTE_KRAFT").map((m) => m.code);
    expect(tray).not.toContain("FEFCO_0443");
    expect(instantModelsForCard("FEFCO_0422", "E_FLUTE_KRAFT", ["FEFCO_0443"]).map((m) => m.code)).toContain("FEFCO_0443");
    // Never instant: models routed to a quote or preview.
    expect(modelsForCard("ECMA_STE", "SBS_350").some((m) => m.mode === "preview")).toBe(true);
    expect(instantModelsForCard("ECMA_STE", "SBS_350", ["LIQUID_ASEPTIC_BRICK"]).some((m) => m.mode === "preview")).toBe(false);
  });

  it("jobModel resolves the exact model and the jobs search matches its reference", () => {
    const m = jobModel("FEFCO_0203");
    expect(m?.standard).toBe("FEFCO 0203");
    expect(jobModel(null)).toBeNull();
    const row = { id: "1", number: "ELB-1", buyerName: "Mona", structureCode: "FEFCO_0201", model: m, quantity: 1, dueDate: null, placedAt: new Date(), vendorCostPiasters: 1, status: "PAID", paidAt: new Date(), events: [], qcPhotos: [] };
    expect(filterJobs([row], { query: "0203" })).toHaveLength(1);
    expect(filterJobs([row], { query: "0427" })).toHaveLength(0);
  });
});
