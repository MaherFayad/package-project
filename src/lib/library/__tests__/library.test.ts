import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MATERIAL_CODES, STRUCTURE_CODES, type MaterialCode, type StructureCode } from "@/types";
import { BOARD_SPECS, materialFitsStructure } from "@/lib/dieline";
import { quote, designQuoteFields, type PricingData } from "@/lib/pricing";
import { orderModeOf } from "@/data/catalogue/order-mode";
import { BOX_MODELS, MODELS, MODEL_GROUPS, VESSEL_MODELS, matchesQuery, modelByCode, modelFromParam, modelGroups } from "..";
import { baseOf, docGeometry, docBoardArea, normaliseDocModel, vesselPrintMaterials } from "../doc";
import { createModelDoc } from "@/components/designer/lib/doc";
import { finishChoicesFor, materialChoices, toggleFinish } from "@/components/designer/lib/config";

describe("model library catalogue", () => {
  it("has unique codes and slugs, names in both languages and a thumbnail", () => {
    expect(new Set(MODELS.map((m) => m.code)).size).toBe(MODELS.length);
    expect(new Set(MODELS.map((m) => m.slug)).size).toBe(MODELS.length);
    for (const m of MODELS) {
      expect(m.name.ar && m.name.en, m.code).toBeTruthy();
      expect(fs.existsSync(path.join(process.cwd(), "public/models", `${m.slug}.svg`)), m.slug).toBe(true);
    }
  });

  it("covers every picker group and keeps the 13 core box structures", () => {
    for (const g of MODEL_GROUPS) expect(MODELS.some((m) => m.group === g), g).toBe(true);
    for (const c of STRUCTURE_CODES.filter((c) => !["ROLL_LABEL", "PRINTED_POUCH", "PRINTED_TUBE", "PAPER_BAG", "PLASTIC_BAG"].includes(c))) expect(modelByCode(c)?.kind, c).toBe("box");
    expect(BOX_MODELS.length).toBeGreaterThan(250);
    expect(VESSEL_MODELS.length).toBeGreaterThan(80);
  });

  it("searches codes and both languages, and groups results", () => {
    expect(matchesQuery(modelByCode("FEFCO_0203")!, "0203")).toBe(true);
    expect(matchesQuery(modelByCode("WIDE_JAR")!, "برطمان")).toBe(true);
    expect(modelGroups("en", "pouch").map((g) => g.group)).toContain("POUCHES");
    expect(modelFromParam("mailer-box")?.code).toBe("FEFCO_0427");
    expect(modelFromParam("fefco_0203")?.code).toBe("FEFCO_0203");
  });
});

describe("every box model folds and is made from a priced board", () => {
  it.each(BOX_MODELS.map((m) => [m.code, m] as const))("%s", (_code, m) => {
    expect(m.materials.length).toBeGreaterThan(0);
    for (const mat of m.materials) {
      const base = m.baseFor(mat);
      expect(materialFitsStructure(mat, base), `${mat} → ${base}`).toBe(true);
      const d = m.build(m.defaultDims, { thicknessMm: BOARD_SPECS[mat].thicknessMm });
      expect(Object.keys(d.faces).length).toBeGreaterThan(0);
      expect(d.metrics.blankAreaM2).toBeGreaterThan(0);
      expect(Number.isFinite(d.closedOuter.L + d.closedOuter.W + d.closedOuter.H)).toBe(true);
    }
  });
});

describe("every container describes its print areas", () => {
  it.each(VESSEL_MODELS.map((m) => [m.code, m] as const))("%s", (_code, m) => {
    for (const p of m.presets) {
      const doc = createModelDoc(m, { presetId: p.id });
      const geo = docGeometry(doc);
      expect(geo, p.id).not.toBeNull();
      expect(geo!.vessel!.areas.length).toBeGreaterThan(0);
      for (const a of geo!.vessel!.areas) expect(a.trimWidthMm > 0 && a.trimHeightMm > 0).toBe(true);
      expect(Object.keys(geo!.dieline.faces).length).toBe(geo!.vessel!.areas.length);
      expect(vesselPrintMaterials(m)).toContain(doc.materialCode);
    }
  });
});

/** Pricing data with one vendor per base structure that stocks every fitting material and prices every finish. */
function fullData(): PricingData {
  const materials = MATERIAL_CODES.map((code) => ({ id: code, code, family: BOARD_SPECS[code].family, gsm: 300, thicknessMm: BOARD_SPECS[code].thicknessMm }));
  const finishes = (["MATTE_LAMINATION", "GLOSS_LAMINATION", "SPOT_UV", "SOFT_TOUCH_LAMINATION", "VARNISH", "HOT_FOIL", "EMBOSS", "DEBOSS"] as const).map((code) => ({ code, setupPiasters: 10000 }));
  const vendor = {
    id: "v",
    slug: "v",
    name: { ar: "م", en: "V" },
    city: "CAIRO" as const,
    rating: 4.5,
    ratingCount: 10,
    onTimePct: 95,
    leadTimeDays: 7,
    minOrderQty: 1,
    // Lists every special-gluing model too (B-16 "listed" models need a printer that names them).
    capabilities: { structures: [...STRUCTURE_CODES], materials: [...MATERIAL_CODES] as MaterialCode[], finishes: ["NONE", ...finishes.map((f) => f.code)] as never, maxColors: 6, digitalShortRun: true, monthlyCapacityUnits: 1e6, models: MODELS.map((m) => m.code) },
    verified: true,
    status: "ACTIVE" as const,
  };
  const rateCards = STRUCTURE_CODES.flatMap((s: StructureCode) =>
    MATERIAL_CODES.filter((m) => materialFitsStructure(m, s)).map((m) => ({
      vendorId: "v",
      structureCode: s,
      materialId: m,
      qtyTiers: [{ minQty: 1, unitPiasters: 1000 }],
      referenceAreaM2: 0.1,
      setupPiasters: 10000,
      dieCostPiasters: 50000,
      printSidesSurchargePct: 30,
      finishSurcharges: Object.fromEntries(finishes.map((f) => [f.code, 50])),
      leadTimeDays: 7,
      active: true,
    })),
  );
  return { vendors: [vendor], rateCards, materials, finishes, presets: {} };
}

describe("every model is priced through its base structure with its own area", () => {
  const data = fullData();
  it.each(MODELS.map((m) => [m.code, m] as const))("%s", (_code, m) => {
    const doc = createModelDoc(m);
    expect(doc.structureCode).toBe(baseOf(m, doc.materialCode));
    const r = quote({ ...designQuoteFields(doc), colours: 4, quantity: 500, zone: "GREATER_CAIRO" }, data);
    // B-16: formats no Egyptian SME printer makes (rare in Egypt, filling-line cartons) go to a quote.
    const order = orderModeOf(m.code);
    if (order.mode === "quote" || order.mode === "preview") {
      expect(r).toMatchObject({ mode: "manual_quote", reason: "MODEL_BY_QUOTE", orderReason: order.reason });
      return;
    }
    expect(r.mode).toBe("instant");
    if (r.mode === "instant") {
      expect(r.offers.length).toBe(1);
      expect(r.areaM2).toBeCloseTo(Math.round(docBoardArea(doc)!.blankAreaM2 * 1e4) / 1e4, 4);
    }
  });

  it("B-16: special-gluing models are instant only from a printer that lists them", () => {
    const unlisted: PricingData = { ...data, vendors: data.vendors.map((v) => ({ ...v, capabilities: { ...v.capabilities, models: [] } })) };
    const auto = createModelDoc(modelByCode("FEFCO_0711")!);
    expect(quote({ ...designQuoteFields(auto), colours: 4, quantity: 500, zone: "GREATER_CAIRO" }, unlisted)).toMatchObject({ mode: "manual_quote", orderReason: "SPECIAL_GLUING" });
    expect(quote({ ...designQuoteFields(auto), colours: 4, quantity: 500, zone: "GREATER_CAIRO" }, data).mode).toBe("instant");
    for (const code of ["LIQUID_ASEPTIC_BRICK", "LIQUID_GABLE_TOP"]) {
      const d = createModelDoc(modelByCode(code)!);
      expect(quote({ ...designQuoteFields(d), colours: 4, quantity: 500, zone: "GREATER_CAIRO" }, data)).toMatchObject({ mode: "manual_quote", reason: "MODEL_BY_QUOTE", orderReason: "FILLING_LINE" });
    }
    // A core structure stays instant through its rate card.
    const mailer = createModelDoc(modelByCode("FEFCO_0427")!);
    expect(quote({ ...designQuoteFields(mailer), colours: 4, quantity: 500, zone: "GREATER_CAIRO" }, unlisted).mode).toBe("instant");
  });

  it("rejects a model priced as a cheaper base structure", () => {
    const doc = createModelDoc(modelByCode("RIGID_LID_BASE") ?? modelByCode("RIGID_BOX")!);
    const fields = designQuoteFields(doc);
    expect(() => quote({ ...fields, structureCode: "SLEEVE", materialId: "SBS_300", colours: 4, quantity: 500, zone: "GREATER_CAIRO", model: { code: doc.modelCode ?? "RIGID_BOX" } }, data)).toThrow();
  });
});

describe("configuration rules in the designer", () => {
  it("explains why a finish is not possible and keeps the main finish column in sync", () => {
    const m = modelByCode("FEFCO_0427")!;
    const doc = createModelDoc(m, { materialCode: "E_FLUTE_KRAFT" });
    const uv = finishChoicesFor(doc, m).find((c) => c.value === "SPOT_UV")!;
    expect(uv.enabled).toBe(false);
    expect(uv.reason?.ar).toBeTruthy();
    const white = normaliseDocModel({ ...doc, materialCode: "E_FLUTE_WHITE" });
    const foiled = toggleFinish(toggleFinish(white, "MATTE_LAMINATION", true), "FOIL_GOLD", true);
    expect(foiled.finishCode).toBe("MATTE_LAMINATION");
    expect(designQuoteFields(foiled).finishes).toEqual(["HOT_FOIL", "MATTE_LAMINATION"]);
  });

  it("offers label stocks for containers with reasons", () => {
    const m = modelByCode("ROUND_BOTTLE")!;
    const doc = createModelDoc(m);
    const choices = materialChoices(doc, m);
    expect(choices.map((c) => c.value)).toContain("LABEL_WHITE_BOPP");
    expect(choices.find((c) => c.value === "SHRINK_PETG")?.enabled).toBe(false);
  });
});

describe("e2e manifest", () => {
  it("lists every model (run scripts/generate-model-thumbnails.ts after adding models)", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "e2e/fixtures/models.json"), "utf8")) as { code: string; slug: string; kind: string }[];
    expect(manifest).toEqual(MODELS.map((m) => ({ code: m.code, slug: m.slug, kind: m.kind })));
  });
});
