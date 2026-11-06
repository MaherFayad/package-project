import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/library";
import { STRUCTURE_CODES } from "@/types";
import { jobModel, modelsForCard, modelsForStructure, structureCoverage } from "../coverage";
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
    expect(cov.FEFCO_0201.count).toBe(modelsForStructure("FEFCO_0201").length);
    expect(cov.FEFCO_0201.examples.length).toBeLessThanOrEqual(3);
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
