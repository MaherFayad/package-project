import { describe, expect, it } from "vitest";
import type { VendorCapabilities } from "@/types";
import { quote } from "@/lib/pricing";
import { CFG, NOW, makeData } from "@/lib/pricing/__tests__/fixtures";
import { STRUCTURE_LIST } from "@/lib/dieline";
import { VESSEL_KINDS } from "@/lib/vessels";
import {
  BOX_BOARDS,
  CONFIG_FINISH_CODES,
  SPOT_INK_PATTERN,
  colourCount,
  defaultBoxConfig,
  defaultVesselConfig,
  evaluateConfig,
  finishRule,
  fromDesignDoc,
  matchVendors,
  orderability,
  parseModelConfig,
  requiredCapabilities,
  safeParseModelConfig,
  sanitizeConfig,
  toDesignDocPatch,
  toPricingRequest,
  vendorCanMake,
  type BoxConfig,
  type ModelConfig,
  type VendorForMatch,
} from "..";

const box = (patch: Partial<BoxConfig> = {}): BoxConfig => ({ ...defaultBoxConfig("FEFCO_0427"), ...patch });
const mask = (...ids: string[]) => ({ surface: "outside" as const, layerIds: ids.length ? ids : ["logo"] });
const enabled = (cfg: ModelConfig, code: (typeof CONFIG_FINISH_CODES)[number]) => evaluateConfig(cfg).options.finishes.find((f) => f.value === code)!;
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
const DIACRITICS = /[ً-ْٰ]/;

describe("schema", () => {
  it("applies defaults and validates shape", () => {
    const cfg = parseModelConfig({ model: { type: "box", code: "FEFCO_0427" }, size: { mode: "preset", presetId: "shoe" }, material: "E_FLUTE_KRAFT", quantity: 500 });
    expect(cfg.printSides).toBe("OUTSIDE");
    expect(cfg.colour).toEqual({ mode: "CMYK", spots: [] });
    expect(cfg.addOns).toEqual({ windowFilm: null, insert: null, handle: false, tearStrip: false });
  });

  it("rejects bad shapes", () => {
    expect(safeParseModelConfig({ model: { type: "box", code: "NOPE" }, size: { mode: "preset", presetId: "x" }, material: "E_FLUTE_KRAFT", quantity: 1 }).success).toBe(false);
    expect(safeParseModelConfig({ ...box(), quantity: 0 }).success).toBe(false);
    expect(safeParseModelConfig({ ...box(), colour: { mode: "SPOT", inks: [] } }).success).toBe(false);
    expect(safeParseModelConfig({ ...box(), colour: { mode: "SPOT", inks: ["a", "b", "c", "d", "e"] } }).success).toBe(false);
    expect(safeParseModelConfig({ ...defaultVesselConfig("WIDE_JAR"), surfaces: [] }).success).toBe(false);
  });

  it("accepts Pantone-style spot references", () => {
    for (const ok of ["PMS 186 C", "186C", "Black C", "877 C", "#1A2B3C", "Warm Red U"]) expect(SPOT_INK_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ["red", "186", "#12345"]) expect(SPOT_INK_PATTERN.test(bad), bad).toBe(false);
  });

  it("round-trips through JSON", () => {
    const cfg = box({ finishes: [{ code: "FOIL_GOLD", mask: mask() }] });
    expect(parseModelConfig(JSON.parse(JSON.stringify(cfg)))).toEqual(cfg);
  });
});

describe("defaults are valid for every model", () => {
  it.each(STRUCTURE_LIST.filter((s) => s.shape !== "flat").map((s) => s.code))("box %s", (code) => {
    const ev = evaluateConfig(defaultBoxConfig(code));
    expect(ev.issues.filter((i) => i.severity === "error")).toEqual([]);
  });
  it.each([...VESSEL_KINDS])("vessel %s", (kind) => {
    const ev = evaluateConfig(defaultVesselConfig(kind));
    expect(ev.issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("size", () => {
  it("validates custom sizes live with localized messages", () => {
    const ev = evaluateConfig(box({ size: { mode: "custom", dims: { L: 50, W: 180, H: 80 } } }));
    const issue = ev.issues.find((i) => i.path === "size.dims.L")!;
    expect(issue.code).toBe("SIZE_TOO_SMALL");
    expect(issue.message.en).toContain("80 mm");
    expect(issue.message.ar).toContain("80 مم");
  });

  it("explains structure rules", () => {
    const ev = evaluateConfig(box({ size: { mode: "custom", dims: { L: 250, W: 100, H: 120 } } }));
    expect(ev.issues.find((i) => i.code === "SIZE_RULE")?.message.en).toMatch(/Height cannot be more than the width/);
  });

  it("resolves presets and flags standard dies", () => {
    const ev = evaluateConfig(box({ size: { mode: "preset", presetId: "shoe" } }));
    expect(ev.size.box).toEqual({ L: 330, W: 200, H: 120 });
    expect(ev.size.standard).toBe(true);
    expect(evaluateConfig(box({ size: { mode: "custom", dims: { L: 330, W: 200, H: 120 } } })).size.standard).toBe(true);
    expect(evaluateConfig(box({ size: { mode: "preset", presetId: "nope" } })).ok).toBe(false);
  });

  it("checks vessel limits", () => {
    const v = { ...defaultVesselConfig("CAN"), size: { mode: "custom" as const, dims: { D: 40, H: 115 } } };
    expect(evaluateConfig(v).issues.find((i) => i.path === "size.dims.D")?.code).toBe("SIZE_TOO_SMALL");
  });
});

describe("materials", () => {
  it("only lists boards of the structure family", () => {
    const opts = evaluateConfig(defaultBoxConfig("ECMA_RTE")).options.materials.map((m) => m.value);
    expect(opts).toEqual(["SBS_300", "SBS_350"]);
  });

  it("keeps double wall to shipping styles", () => {
    expect(evaluateConfig(box({ material: "BC_FLUTE_KRAFT" })).issues.find((i) => i.path === "material")?.code).toBe("MATERIAL_BC_STYLE");
    const rsc = defaultBoxConfig("FEFCO_0201");
    const ev = evaluateConfig({ ...rsc, material: "BC_FLUTE_KRAFT", colour: { mode: "SPOT", inks: ["Black C"] } });
    expect(ev.ok).toBe(true);
    expect(ev.issues.find((i) => i.path === "material")?.code).toBe("MATERIAL_MANUAL");
  });

  it("rejects boards too thick for a tiny box", () => {
    const cfg = box({ material: "B_FLUTE_KRAFT", size: { mode: "custom", dims: { L: 100, W: 60, H: 25 } } });
    expect(evaluateConfig(cfg).issues.some((i) => i.code === "MATERIAL_TOO_THICK")).toBe(true);
  });

  it("vessels: labels on bottles, direct print on pouches, PETG for sleeves", () => {
    const pouch = defaultVesselConfig("STAND_UP_POUCH");
    expect(pouch.material).toBe("DIRECT_PRINT");
    expect(evaluateConfig({ ...pouch, material: "WHITE_BOPP" }).ok).toBe(false);
    const bottle = defaultVesselConfig("ROUND_BOTTLE");
    expect(evaluateConfig({ ...bottle, material: "DIRECT_PRINT" }).ok).toBe(false);
    expect(evaluateConfig({ ...bottle, surfaces: ["SHRINK_SLEEVE"], material: "WHITE_BOPP" }).issues[0]?.code).toBe("STOCK_SLEEVE");
    expect(evaluateConfig({ ...bottle, surfaces: ["SHRINK_SLEEVE"], material: "PETG_SHRINK" }).ok).toBe(true);
  });
});

describe("finish rules follow real print constraints", () => {
  it("no lamination or spot UV on kraft, foil only on E-flute kraft", () => {
    const kraft = box({ material: "E_FLUTE_KRAFT" });
    expect(enabled(kraft, "MATTE_LAMINATION").enabled).toBe(false);
    expect(enabled(kraft, "SOFT_TOUCH_LAMINATION").enabled).toBe(false);
    expect(enabled(kraft, "SPOT_UV").enabled).toBe(false);
    expect(enabled(kraft, "SPOT_UV").reason?.en).toMatch(/cannot be laminated/);
    expect(enabled(kraft, "FOIL_GOLD").enabled).toBe(true);
    expect(enabled(kraft, "FOIL_GOLD").warning?.en).toMatch(/0.5 mm/);
    expect(enabled(kraft, "MATTE_VARNISH").enabled).toBe(true);
    expect(enabled(kraft, "GLOSS_VARNISH").enabled).toBe(false);
    const bflute = box({ material: "B_FLUTE_KRAFT" });
    expect(enabled(bflute, "FOIL_GOLD").enabled).toBe(false);
  });

  it("no emboss or deboss on any corrugated board", () => {
    for (const material of ["E_FLUTE_KRAFT", "E_FLUTE_WHITE", "B_FLUTE_KRAFT"] as const) {
      expect(enabled(box({ material }), "EMBOSS").enabled).toBe(false);
      expect(enabled(box({ material }), "DEBOSS").reason?.en).toMatch(/crushes the flutes/);
    }
    const carton = defaultBoxConfig("ECMA_RTE");
    expect(enabled(carton, "EMBOSS").enabled).toBe(true);
    expect(enabled({ ...carton, material: "SBS_300" }, "EMBOSS").warning).toBeTruthy();
  });

  it("white E-flute (litho-lam) takes laminations, spot UV and foil", () => {
    const white = box({ material: "E_FLUTE_WHITE" });
    for (const c of ["MATTE_LAMINATION", "GLOSS_LAMINATION", "SOFT_TOUCH_LAMINATION", "SPOT_UV", "FOIL_SILVER"] as const) expect(enabled(white, c).enabled, c).toBe(true);
  });

  it("one coating, no spot UV over gloss, max two foil colours, one relief", () => {
    const base = defaultBoxConfig("RIGID_BOX");
    const gloss = { ...base, finishes: [{ code: "GLOSS_LAMINATION" as const }] };
    expect(finishRule(gloss, "MATTE_LAMINATION").code).toBe("FINISH_ONE_COATING");
    expect(finishRule(gloss, "SPOT_UV").code).toBe("FINISH_UV_ON_GLOSS");
    const soft = { ...base, finishes: [{ code: "SOFT_TOUCH_LAMINATION" as const }] };
    expect(finishRule(soft, "SPOT_UV").ok).toBe(true);
    expect(finishRule(base, "SPOT_UV").warning?.en).toMatch(/matte or soft-touch/);
    const twoFoils = { ...base, finishes: [{ code: "FOIL_GOLD" as const, mask: mask() }, { code: "FOIL_SILVER" as const, mask: mask() }] };
    expect(finishRule(twoFoils, "FOIL_ROSE_GOLD").code).toBe("FINISH_FOIL_MAX");
    const emb = { ...base, finishes: [{ code: "EMBOSS" as const, mask: mask() }] };
    expect(finishRule(emb, "DEBOSS").code).toBe("FINISH_ONE_RELIEF");
  });

  it("masked finishes need layers and a printed surface", () => {
    const base = defaultBoxConfig("RIGID_BOX");
    const empty = evaluateConfig({ ...base, finishes: [{ code: "FOIL_GOLD", mask: { surface: "outside", layerIds: [] } }] });
    expect(empty.issues.find((i) => i.code === "MASK_EMPTY")?.severity).toBe("error");
    const inside = { ...base, finishes: [{ code: "FOIL_GOLD" as const, mask: { surface: "inside" as const, layerIds: ["x"] } }] };
    expect(evaluateConfig(inside).issues.some((i) => i.code === "FINISH_INSIDE_UNPRINTED")).toBe(true);
    expect(evaluateConfig({ ...inside, printSides: "BOTH" }).ok).toBe(true);
    const artwork = { outside: { background: null, layers: [] }, inside: { background: null, layers: [] } };
    const missing = evaluateConfig({ ...base, finishes: [{ code: "SPOT_UV", mask: mask("gone") }] }, { artwork });
    expect(missing.issues.some((i) => i.code === "MASK_MISSING_LAYER")).toBe(true);
  });

  it("labels follow stock rules", () => {
    const shrink = { ...defaultVesselConfig("ROUND_BOTTLE"), surfaces: ["SHRINK_SLEEVE" as const], material: "PETG_SHRINK" as const };
    expect(enabled(shrink, "MATTE_VARNISH").enabled).toBe(true);
    expect(enabled(shrink, "GLOSS_LAMINATION").enabled).toBe(false);
    const metallic = { ...defaultVesselConfig("PERFUME_SQUARE"), material: "METALLIC_BOPP" as const };
    expect(enabled(metallic, "FOIL_GOLD").enabled).toBe(false);
    const paper = { ...defaultVesselConfig("WIDE_JAR"), material: "PAPER_SEMIGLOSS" as const };
    expect(enabled(paper, "EMBOSS").enabled).toBe(true);
    expect(enabled(paper, "SOFT_TOUCH_LAMINATION").enabled).toBe(false);
  });

  it("every reason is bilingual MSA without diacritics", () => {
    const configs: ModelConfig[] = [box(), box({ material: "B_FLUTE_KRAFT" }), defaultBoxConfig("PIZZA"), defaultVesselConfig("ROUND_BOTTLE"), defaultVesselConfig("STAND_UP_POUCH")];
    for (const c of configs) {
      const ev = evaluateConfig(c);
      const all = [...ev.options.finishes, ...ev.options.materials, ...ev.options.printSides, ...ev.options.addOns, ...ev.options.colourModes];
      for (const o of all) {
        for (const msg of [o.reason, o.warning]) {
          if (!msg) continue;
          expect(msg.en.length).toBeGreaterThan(5);
          expect(hasArabic(msg.ar)).toBe(true);
          expect(DIACRITICS.test(msg.ar)).toBe(false);
        }
      }
    }
  });
});

describe("print sides, colour, add-ons", () => {
  it("blocks inside print where it cannot be made", () => {
    expect(evaluateConfig({ ...defaultBoxConfig("PIZZA"), printSides: "BOTH" }).ok).toBe(false);
    expect(evaluateConfig({ ...defaultBoxConfig("PAPER_TUBE"), printSides: "INSIDE" }).ok).toBe(false);
    expect(evaluateConfig({ ...defaultVesselConfig("WIDE_JAR"), printSides: "BOTH" }).ok).toBe(false);
    expect(evaluateConfig(box({ printSides: "BOTH" })).ok).toBe(true);
  });

  it("no CMYK on B-flute kraft, a warning on E-flute kraft", () => {
    expect(evaluateConfig(box({ material: "B_FLUTE_KRAFT" })).issues.find((i) => i.path === "colour.mode")?.severity).toBe("error");
    expect(evaluateConfig(box({ material: "E_FLUTE_KRAFT" })).issues.find((i) => i.path === "colour.mode")?.severity).toBe("warning");
    expect(colourCount(box({ colour: { mode: "CMYK", spots: ["PMS 186 C"] } }))).toBe(5);
    expect(colourCount(box({ colour: { mode: "SPOT", inks: ["Black C"] } }))).toBe(1);
  });

  it("add-ons follow the structure's feature support", () => {
    const mailer = evaluateConfig(box()).options.addOns;
    expect(mailer.find((a) => a.value === "tearStrip")?.enabled).toBe(true);
    expect(mailer.find((a) => a.value === "handle")?.enabled).toBe(false);
    const gable = evaluateConfig(defaultBoxConfig("GABLE_BOX")).options.addOns.find((a) => a.value === "handle")!;
    expect(gable.reason?.en).toMatch(/part of this box/);
    const win = evaluateConfig(box({ addOns: { windowFilm: { face: "front", film: true }, insert: null, handle: false, tearStrip: false } }));
    expect(win.issues.find((i) => i.path === "addOns.windowFilm.face")).toBeTruthy();
    expect(evaluateConfig(defaultVesselConfig("CAN")).options.addOns.every((a) => !a.enabled)).toBe(true);
  });
});

describe("sanitizeConfig", () => {
  it("drops what a new material cannot make and says why", () => {
    const white = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "SOFT_TOUCH_LAMINATION" }, { code: "SPOT_UV", mask: mask() }, { code: "FOIL_GOLD", mask: mask() }] });
    const { config, removed } = sanitizeConfig({ ...white, material: "B_FLUTE_KRAFT" });
    expect(config.finishes).toEqual([]);
    expect(config.colour.mode).toBe("SPOT");
    expect(removed.length).toBeGreaterThanOrEqual(4);
    expect(removed.every((r) => hasArabic(r.message.ar))).toBe(true);
    expect(evaluateConfig(config).ok).toBe(true);
  });

  it("fixes the board after a structure change", () => {
    const { config } = sanitizeConfig({ ...box({ material: "E_FLUTE_WHITE" }), model: { type: "box", code: "ECMA_RTE" }, size: { mode: "custom", dims: { L: 60, W: 60, H: 140 } } });
    expect(BOX_BOARDS[(config as BoxConfig).material].family).toBe("FOLDING_CARTON");
  });
});

describe("pricing mapping", () => {
  it("maps a priced config to a QuoteInput the engine can price", () => {
    const cfg = box({ material: "E_FLUTE_KRAFT", size: { mode: "preset", presetId: "shoe" }, colour: { mode: "SPOT", inks: ["Black C", "PMS 186 C"] }, printSides: "BOTH", quantity: 500 });
    const req = toPricingRequest(cfg, { zone: "ALEXANDRIA" });
    expect(req.kind).toBe("box");
    if (req.kind !== "box") return;
    expect(req.instant).toBe(true);
    expect(req.input).toEqual({ structureCode: "FEFCO_0427", dims: { L: 330, W: 200, H: 120 }, materialId: "E_FLUTE_KRAFT", finishes: [], printSides: "BOTH", colours: 2, quantity: 500, zone: "ALEXANDRIA" });
    const r = quote(req.input!, makeData(), { config: CFG, now: NOW });
    expect(r.mode).toBe("instant");
    if (r.mode === "instant") expect(r.offers.length).toBeGreaterThan(0);
  });

  it("every finish is priced by rate cards (foil, emboss and soft touch included)", () => {
    const cfg = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "MATTE_LAMINATION" }, { code: "SPOT_UV", mask: mask() }, { code: "FOIL_GOLD", mask: mask() }] });
    const req = toPricingRequest(cfg);
    if (req.kind !== "box") throw new Error("box");
    expect(req.input?.finishes).toEqual(["MATTE_LAMINATION", "SPOT_UV", "HOT_FOIL"]);
    expect(req.unpricedFinishes).toEqual([]);
    expect(req.instant).toBe(true);
    expect(req.manual).toEqual([]);
  });

  it("invalid, unpriced boards and big runs are not instant", () => {
    const bad = toPricingRequest(box({ size: { mode: "custom", dims: { L: 10, W: 10, H: 10 } } }));
    expect(bad.instant).toBe(false);
    if (bad.kind === "box") expect(bad.input).toBeNull();
    const bc = toPricingRequest({ ...defaultBoxConfig("FEFCO_0201"), material: "BC_FLUTE_KRAFT", colour: { mode: "SPOT", inks: ["Black C"] } });
    expect(bc.manual.map((m) => m.code)).toContain("BOARD_NOT_PRICED");
    const big = toPricingRequest(box({ quantity: 5000 }));
    expect(big.manual.map((m) => m.code)).toContain("QUANTITY_ABOVE_INSTANT_MAX");
  });

  it("features follow add-ons", () => {
    const req = toPricingRequest(box({ addOns: { windowFilm: { face: "top", film: true }, insert: { kind: "DIVIDERS", rows: 2, cols: 3 }, handle: false, tearStrip: true } }));
    if (req.kind !== "box") throw new Error("box");
    expect(req.features).toEqual({ window: { face: "top", film: true }, tearStrip: true, partitions: { rows: 2, cols: 3 } });
    expect(req.instant).toBe(true);
  });

  it("vessels map to label runs (priced by quote)", () => {
    const req = toPricingRequest({ ...defaultVesselConfig("WIDE_JAR"), finishes: [{ code: "FOIL_GOLD", mask: mask() }] });
    expect(req.kind).toBe("labels");
    if (req.kind !== "labels") return;
    expect(req.lines.length).toBeGreaterThan(0);
    expect(req.lines[0].run.linearMeters).toBeGreaterThan(0);
    expect(req.finishes).toEqual(["HOT_FOIL"]);
  });

  it("design doc bridge round-trips", () => {
    const cfg = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "MATTE_LAMINATION" }], addOns: { windowFilm: null, insert: null, handle: false, tearStrip: true } });
    const patch = toDesignDocPatch(cfg)!;
    expect(patch).toMatchObject({ structureCode: "FEFCO_0427", materialCode: "E_FLUTE_WHITE", finishCode: "MATTE_LAMINATION", printSides: "OUTSIDE", features: { tearStrip: true } });
    const back = fromDesignDoc({ v: 1, name: "x", artwork: { outside: { background: null, layers: [] }, inside: { background: null, layers: [] } }, ...patch }, cfg.quantity);
    expect(back.material).toBe("E_FLUTE_WHITE");
    expect(back.addOns.tearStrip).toBe(true);
    expect(back.finishes).toEqual([{ code: "MATTE_LAMINATION", mask: undefined }]);
  });
});

describe("vendor capabilities", () => {
  const caps: VendorCapabilities = {
    structures: ["FEFCO_0427"],
    materials: ["E_FLUTE_WHITE"],
    finishes: ["NONE", "MATTE_LAMINATION"],
    maxColors: 4,
    digitalShortRun: true,
    monthlyCapacityUnits: 10000,
  };

  it("matches structure, board, finishes and colours", () => {
    const cfg = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "MATTE_LAMINATION" }] });
    expect(vendorCanMake(cfg, caps).ok).toBe(true);
    const foil = { ...cfg, finishes: [...cfg.finishes, { code: "FOIL_GOLD" as const, mask: mask() }] };
    expect(requiredCapabilities(foil).finishes).toContain("HOT_FOIL");
    expect(requiredCapabilities(foil).extraFinishes).toEqual([]);
    expect(vendorCanMake(foil, caps).missing.map((m) => m.code)).toEqual(["FINISH_HOT_FOIL"]);
    expect(vendorCanMake(foil, { ...caps, finishes: [...caps.finishes, "HOT_FOIL"] }).ok).toBe(true);
    const six = { ...cfg, colour: { mode: "CMYK" as const, spots: ["PMS 186 C", "877 C"] } };
    expect(vendorCanMake(six, caps).missing.map((m) => m.code)).toEqual(["COLOURS"]);
    expect(vendorCanMake({ ...cfg, material: "E_FLUTE_KRAFT" }, caps).missing.map((m) => m.code)).toEqual(["MATERIAL"]);
  });

  it("soft touch is a priced finish the printer must list", () => {
    const cfg = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "SOFT_TOUCH_LAMINATION" }] });
    expect(vendorCanMake(cfg, caps).ok).toBe(false);
    expect(vendorCanMake(cfg, { ...caps, finishes: [...caps.finishes, "SOFT_TOUCH_LAMINATION"] }).ok).toBe(true);
  });

  const vendor = (id: string, patch: Partial<VendorForMatch> = {}): VendorForMatch => ({
    id,
    status: "ACTIVE",
    verified: true,
    minOrderQty: 100,
    capabilities: caps,
    machines: [],
    rateCards: [{ structureCode: "FEFCO_0427", materialCode: "E_FLUTE_WHITE", finishes: ["NONE", "MATTE_LAMINATION"] }],
    ...patch,
  });

  it("matches only printers with a rate card that prices every finish", () => {
    const cfg = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "MATTE_LAMINATION" }] });
    const [a, b, c] = matchVendors(cfg, [
      vendor("a"),
      vendor("b", { rateCards: [{ structureCode: "FEFCO_0427", materialCode: "E_FLUTE_WHITE", finishes: ["NONE"] }] }),
      vendor("c", { rateCards: [] }),
    ]);
    expect(a.ok).toBe(true);
    expect(b.missing.map((m) => m.code)).toEqual(["NO_PRICE_MATTE_LAMINATION"]);
    expect(c.missing.map((m) => m.code)).toEqual(["NO_RATE_CARD"]);
    expect(matchVendors({ ...cfg, quantity: 50 }, [vendor("a")])[0].missing.map((m) => m.code)).toEqual(["BELOW_MIN_QTY"]);
    expect(matchVendors(cfg, [vendor("x", { status: "SUSPENDED" })])[0].missing[0].code).toBe("INACTIVE");
  });

  it("orders only valid configs some printer can make", () => {
    const cfg = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "MATTE_LAMINATION" }] });
    const ok = orderability(cfg, [vendor("u", { verified: false }), vendor("v")]);
    expect(ok.ok).toBe(true);
    expect(ok.vendorIds).toEqual(["v", "u"]); // verified first
    expect(orderability(cfg, [vendor("v")], { vendorId: "nope" }).reasons.map((r) => r.code)).toEqual(["VENDOR_CANNOT_MAKE"]);

    // a foil job needs a printer with hot foil on its rate card; then it is priced instantly
    const foil = box({ material: "E_FLUTE_WHITE", finishes: [{ code: "FOIL_GOLD", mask: mask() }] });
    expect(orderability(foil, [vendor("v")]).reasons.map((r) => r.code)).toEqual(["NO_VENDOR"]);
    const foiler = orderability(foil, [
      vendor("f", {
        capabilities: { ...caps, finishes: [...caps.finishes, "HOT_FOIL"] },
        rateCards: [{ structureCode: "FEFCO_0427", materialCode: "E_FLUTE_WHITE", finishes: ["NONE", "MATTE_LAMINATION", "HOT_FOIL"] }],
      }),
    ]);
    expect(foiler.ok).toBe(true);
    expect(foiler.manual).toEqual([]);

    // invalid configs carry the rules engine's reasons
    const bad = orderability(box({ material: "E_FLUTE_KRAFT", finishes: [{ code: "SPOT_UV", mask: mask() }] }), [vendor("v")]);
    expect(bad.ok).toBe(false);
    expect(bad.reasons[0].code).toBe("FINISH_UV_UNCOATED");
    expect(hasArabic(bad.reasons[0].message.ar)).toBe(true);

    // boards without rate cards and labels go to a quote
    expect(orderability({ ...defaultBoxConfig("FEFCO_0201"), material: "BC_FLUTE_KRAFT" as const }, [vendor("v")]).reasons.map((r) => r.code)).toContain("BOARD_BY_QUOTE");
    expect(orderability(defaultVesselConfig("WIDE_JAR"), [vendor("v")]).reasons.map((r) => r.code)).toContain("LABELS_BY_QUOTE");
  });

  it("keeps the built-in gable handle through sanitize", () => {
    const { config, removed } = sanitizeConfig(defaultBoxConfig("GABLE_BOX"));
    expect(config.addOns.handle).toBe(true);
    expect(removed).toEqual([]);
  });
});


describe("spot UV on corrugated: rule and message agree (designer report)", () => {
  const withFinishes = (material: BoxConfig["material"], codes: ("MATTE_LAMINATION" | "SPOT_UV")[]) =>
    box({ material, finishes: codes.map((code) => (code === "SPOT_UV" ? { code, mask: { surface: "outside" as const, layerIds: ["l1"] } } : { code })) });

  it("white-top B flute: no lamination and no spot UV, and the reason names the board to switch to, not lamination", () => {
    const cfg = withFinishes("B_FLUTE_WHITE", ["MATTE_LAMINATION"]);
    expect(finishRule(cfg, "MATTE_LAMINATION").ok).toBe(false);
    const uv = finishRule(cfg, "SPOT_UV");
    expect(uv.ok).toBe(false);
    expect(uv.code).toBe("FINISH_UV_WHITE_TOP");
    expect(uv.reason!.en).toMatch(/cannot be laminated/);
    expect(uv.reason!.en).toMatch(/white E-flute/);
    expect(uv.reason!.ar).toMatch(/الكرتون الأبيض E/);
  });

  it("kraft: the reason does not suggest adding lamination either", () => {
    const uv = finishRule(withFinishes("E_FLUTE_KRAFT", []), "SPOT_UV");
    expect(uv.ok).toBe(false);
    expect(uv.reason!.en).toMatch(/cannot be laminated/);
  });

  it("white E-flute (litho-lam) with matte lamination takes spot UV", () => {
    const cfg = withFinishes("E_FLUTE_WHITE", ["MATTE_LAMINATION"]);
    expect(finishRule(cfg, "SPOT_UV").ok).toBe(true);
    expect(evaluateConfig(withFinishes("E_FLUTE_WHITE", ["MATTE_LAMINATION", "SPOT_UV"])).issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});
