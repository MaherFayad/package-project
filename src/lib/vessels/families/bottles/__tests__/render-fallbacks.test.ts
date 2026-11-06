import { describe, expect, it } from "vitest";
import { buildClosure, type ClosureStyle } from "@/components/three/vessels/closures";
import { describeVesselModel } from "@/lib/library/packs/common-vessel";
import { models as PACK } from "@/lib/library/packs/vessel-bottles";
import type { ClosureKind, VesselKind } from "@/lib/vessels";
import { BOTTLE_CLOSURES, BOTTLE_MATERIALS, DEFINITIONS, FINISHES, closureFits, finishById, finishForConfig, finishForDims, profileFor } from "../index";

/**
 * The 3D view draws bottles with the core closures / materials named by `coreClosure` and
 * `coreMaterial` until the renderer has its own. These rules keep those fallbacks honest.
 */
describe("3D render fallbacks", () => {
  it("never uses the core FLIP_TOP (a squeeze-tube cap drawn at the base of the container)", () => {
    for (const c of Object.values(BOTTLE_CLOSURES)) expect(c.coreClosure, c.code).not.toBe("FLIP_TOP");
  });

  it("draws metal closures (crown, ROPP, pourer, cork capsule, foil) with their own closure style, not the core cap", () => {
    // R5-3Q-F-01: these used to ride on core LUG_LID, but `buildClosure` only lets a bottle-neck
    // style replace a screw-cap core (LUG_LID / SLIP_LID / CAN_END are refused), so every crown,
    // ROPP, cork capsule, sparkling hood and pourer rendered as the plain lug lid. Core SCREW_CAP +
    // the pack's closureStyle is what the engine expects; the build below proves the style is drawn.
    const styled = ["ROPP_CAP", "POURER_CAP", "CROWN_26", "CROWN_29", "NATURAL_CORK", "SPARKLING_CORK"] as const;
    for (const code of styled) expect(BOTTLE_CLOSURES[code].coreClosure, code).toBe("SCREW_CAP");
    const count = (m: ReturnType<typeof buildClosure>) => m.parts.reduce((n, p) => n + p.geometry.getAttribute("position").count, 0);
    let checked = 0;
    for (const model of PACK) {
      const preset = model.presets.find((p) => p.id === model.defaultPresetId)!;
      const profile = model.describe(preset.dims, [], preset.id).profile!;
      for (const opt of model.closures) {
        if (!(styled as readonly string[]).includes(opt.code)) continue;
        if (opt.code === "ROPP_CAP" && (DEFINITIONS.find((d) => d.code === model.code)!.finishes as string[]).includes("BVS_30H60")) {
          // wine Stelvin (BVS 30H60): the ROPP style now draws its shell over the whole finishH
          // (R5-3Q-F-02), so wine bottles take the style like any ROPP
          const built = buildClosure(model.coreKind as VesselKind, opt.core as ClosureKind, preset.dims, profile, opt.closureStyle as ClosureStyle);
          const ys = built.parts[0].geometry.getAttribute("position");
          let minY = Infinity;
          for (let i = 0; i < ys.count; i++) minY = Math.min(minY, ys.getY(i));
          expect(profile.finishTopY - minY, `${model.code} Stelvin skirt`).toBeGreaterThanOrEqual(profile.finishH - 0.5);
        }
        expect(opt.closureStyle, `${model.code}/${opt.code}`).toBeTruthy();
        const withStyle = buildClosure(model.coreKind as VesselKind, opt.core as ClosureKind, preset.dims, profile, opt.closureStyle as ClosureStyle);
        const plain = buildClosure(model.coreKind as VesselKind, opt.core as ClosureKind, preset.dims, profile, null);
        expect(withStyle.parts[0].role, `${model.code}/${opt.code}`).toBe("capMetal");
        expect(count(withStyle), `${model.code}/${opt.code} draws its style`).not.toBe(count(plain));
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(14);
  });

  it("draws every R6 closure style (swing top, measuring cup, flip-top, CR, TE, bar top) as its own part, not the plain screw cap", () => {
    // R5-3Q-F-06 … F-11: these all collapsed onto the core screw / lug cap
    const styled = ["SWING_TOP", "MEASURE_CAP", "FLIP_TOP", "CHILD_RESISTANT_CAP", "BAR_TOP", "SCREW_CAP_TE", "VENTED_SCREW_CAP"];
    const count = (m: ReturnType<typeof buildClosure>) => m.parts.reduce((n, p) => n + p.geometry.getAttribute("position").count, 0);
    const seen = new Set<string>();
    for (const model of PACK) {
      const preset = model.presets.find((p) => p.id === model.defaultPresetId)!;
      for (const opt of model.closures) {
        if (!styled.includes(opt.code)) continue;
        const profile = (model.describe as (...a: unknown[]) => ReturnType<typeof model.describe>)(preset.dims, [], preset.id, undefined, undefined, opt.code).profile!;
        expect(opt.core, `${model.code}/${opt.code}`).toBe("SCREW_CAP");
        expect(opt.closureStyle, `${model.code}/${opt.code}`).toBeTruthy();
        const withStyle = buildClosure(model.coreKind as VesselKind, "SCREW_CAP", preset.dims, profile, opt.closureStyle as ClosureStyle);
        const plain = buildClosure(model.coreKind as VesselKind, "SCREW_CAP", preset.dims, profile, null);
        expect(count(withStyle), `${model.code}/${opt.code} draws its style`).not.toBe(count(plain));
        for (const p of withStyle.parts) expect(Array.from(p.geometry.getAttribute("position").array as Float32Array).every(Number.isFinite), `${model.code}/${opt.code}`).toBe(true);
        seen.add(opt.code);
      }
    }
    expect([...seen].sort()).toEqual([...styled].sort());
  });

  it("puts the neck finish the closure needs on the bottle (crown bead for a crown, swing bead for a swing top)", () => {
    // R5-3Q-F-12
    const water = PACK.find((m) => m.code === "BTL_GLASS_WATER")!;
    const preset = water.presets.find((p) => p.id === water.defaultPresetId)!;
    const fin = (closure: string) => (water.describe as (...a: unknown[]) => { profile: { finish?: { id?: string }; finishH: number; finishR: number } })(preset.dims, [], preset.id, undefined, undefined, closure).profile;
    const ropp = fin("ROPP_CAP");
    const crown = fin("CROWN_26");
    const swing = fin("SWING_TOP");
    expect(crown.finishR).not.toBe(ropp.finishR);
    expect(swing.finishH).not.toBe(ropp.finishH);
  });

  it("never renders a container in a different colour family", () => {
    // tinted glass / PET must not fall back to a different tint (green glass was shown amber).
    // R5-3Q-F-04: green / cobalt now ride on the dense amber base ON PURPOSE, because the pack
    // always carries their own colour as `tint` (which replaces the base colour); assert that.
    for (const model of PACK) {
      for (const opt of model.containers) {
        const mat = BOTTLE_MATERIALS[opt.code as keyof typeof BOTTLE_MATERIALS];
        if (mat.coreMaterial !== mat.code) expect(opt.tint, `${model.code}/${opt.code}`).toBe(mat.hex);
      }
    }
    for (const code of ["GLASS_GREEN", "GLASS_COBALT"] as const) {
      expect(BOTTLE_MATERIALS[code].coreMaterial, code).toBe("GLASS_AMBER");
      expect(BOTTLE_MATERIALS[code].hex, code).not.toBe(BOTTLE_MATERIALS.GLASS_AMBER.hex);
    }
    expect(BOTTLE_MATERIALS.PET_AMBER.coreMaterial).toBe("GLASS_AMBER");
    // translucent plastics read milky, not opaque white or water clear
    expect(BOTTLE_MATERIALS.HDPE_NATURAL.coreMaterial).toBe("GLASS_FROSTED");
    expect(BOTTLE_MATERIALS.PP_NATURAL.coreMaterial).toBe("GLASS_FROSTED");
    for (const m of Object.values(BOTTLE_MATERIALS)) {
      if (m.transmission === 0) expect(["GLASS_CLEAR", "GLASS_AMBER", "PET_CLEAR", "GLASS_FROSTED"], m.code).not.toContain(m.coreMaterial);
    }
  });

  it("covers only what the closure really covers (finishH): crown skirt, cork capsule down the neck", () => {
    for (const def of DEFINITIONS) {
      for (const preset of def.presets) {
        const finish = FINISHES[preset.finish as keyof typeof FINISHES];
        const p = profileFor(def, preset.dims, preset.finish);
        const label = `${def.code}/${preset.id}`;
        expect(p.finishH, label).toBeGreaterThan(0);
        expect(p.finishH, label).toBeLessThan(preset.dims.H * 0.35);
        if (finish.kind === "crown") expect(p.finishH, label).toBeLessThanOrEqual(7);
        if (finish.kind === "cork") {
          // EN 12726 cork mouth + capsule: longer than the finish, ends above the label zone and the shoulder
          expect(p.finishH, label).toBeGreaterThan(finish.heightMm);
          expect(p.finishTopY - p.finishH, label).toBeGreaterThan(p.body.y1);
        }
        if (!["crown", "cork", "swing"].includes(finish.kind)) expect(p.finishH, label).toBe(finish.heightMm);
      }
    }
  });
  it("draws every closure on a neck finish it fits (R6-3Q-F-01: crown on a PP 28 thread)", () => {
    let switched = 0;
    for (const model of PACK) {
      const def = DEFINITIONS.find((d) => d.code === model.code)!;
      const preset = def.presets.find((p) => p.id === def.defaultPresetId)!;
      for (const c of def.closures) {
        const label = `${def.code}/${c}`;
        const f = finishForConfig(def, preset.dims, preset.finish, c);
        const offered = def.finishes.some((id) => closureFits(c, finishById(id)));
        if (offered) expect(closureFits(c, f), label).toBe(true);
        const p = describeVesselModel(model, preset.dims, [], preset.id, undefined, undefined, c).profile!;
        if (f.kind !== "rim") expect(p.finishR, label).toBeCloseTo(f.outerDiameterMm / 2, 6);
        if (f.id !== preset.finish) switched++;
      }
      // no closure given: the preset's own finish
      if (finishById(preset.finish).kind !== "rim") expect(model.describe(preset.dims, [], preset.id).profile!.finishR, def.code).toBeCloseTo(finishById(preset.finish).outerDiameterMm / 2, 6);
    }
    expect(switched).toBeGreaterThanOrEqual(6);
    const water = PACK.find((m) => m.code === "BTL_GLASS_WATER")!;
    const dims = water.presets[0].dims;
    const crown = describeVesselModel(water, dims, [], undefined, undefined, undefined, "CROWN_26").profile!;
    const ropp = describeVesselModel(water, dims, [], undefined, undefined, undefined, "ROPP_CAP").profile!;
    expect(crown.finishH).toBeLessThanOrEqual(7);
    expect(ropp.finishH).toBe(FINISHES.PP28.heightMm);
  });
  it("a narrow custom size takes a narrower neck, never wider than the presets' neck / body ratio (R6-3Q-F-03)", () => {
    const juice = DEFINITIONS.find((d) => d.code === "BTL_GLASS_JUICE")!;
    expect(finishForDims(juice, { D: 50, H: 110 }, "TO43").id).toBe("TO38");
    expect(finishForDims(juice, { D: 64, H: 168 }, "TO43").id).toBe("TO43");
    const jerry = DEFINITIONS.find((d) => d.code === "JERRYCAN_HDPE")!;
    expect(finishForDims(jerry, { D: 150, G: 90, H: 220 }, "DIN61").id).toBe("DIN45");
    // every preset keeps its own finish
    for (const def of DEFINITIONS) for (const p of def.presets) expect(finishForDims(def, p.dims, p.finish).id, `${def.code}/${p.id}`).toBe(p.finish);
  });
});

describe("tapered wrap dieline (R6-3Q-F-04)", () => {
  it("cuts the annular sector, not its bounding box, and stays inside it", async () => {
    const { areasToDieline } = await import("@/lib/library/doc");
    for (const code of ["PAIL_PP_ROUND", "TUB_PP_TAHINI", "TUB_PP_HALAWA"]) {
      const model = PACK.find((m) => m.code === code)!;
      const preset = model.presets.find((p) => p.id === model.defaultPresetId)!;
      const d = model.describe(preset.dims, ["WRAP"], preset.id);
      const wrap = d.areas.find((a) => a.spec?.shape === "sector")!;
      expect(wrap, code).toBeTruthy();
      const die = areasToDieline([wrap], "ROLL_LABEL" as never, d.envelope);
      const p = die.panels[0];
      expect(p.polygon.length, code).toBeGreaterThan(20);
      for (const q of p.polygon) {
        expect(q.x, code).toBeGreaterThanOrEqual(p.bbox.x - 0.5);
        expect(q.x, code).toBeLessThanOrEqual(p.bbox.x + p.bbox.width + 0.5);
        expect(q.y, code).toBeGreaterThanOrEqual(p.bbox.y - 0.5);
        expect(q.y, code).toBeLessThanOrEqual(p.bbox.y + p.bbox.height + 0.5);
      }
      // the outline's centre-bottom sits above the bbox bottom (the sector curves): not a rectangle
      const ys = p.polygon.map((q) => q.y);
      expect(new Set(ys.map((y) => y.toFixed(1))).size, code).toBeGreaterThan(4);
      // the safe zone lies inside the sector (not the bounding box)
      const inside = (px: number, py: number) => {
        let c = false;
        for (let i = 0, j = p.polygon.length - 1; i < p.polygon.length; j = i++) {
          const a = p.polygon[i];
          const b = p.polygon[j];
          if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) c = !c;
        }
        return c;
      };
      const r = die.safeZones[0].rect;
      expect(r.height, code).toBeGreaterThan(10);
      for (const [px, py] of [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]]) expect(inside(px, py), `${code} safe corner`).toBe(true);
    }
  });
});

describe("lids at the smallest size (R6-3Q-F-05)", () => {
  it("a jar's lug lid / screw cap is never wider than the jar at D.min", () => {
    for (const def of DEFINITIONS) {
      if (def.family !== "JAR" || def.recipe.section !== "round") continue;
      const preset = def.presets.find((p) => p.id === def.defaultPresetId)!;
      const dims = { ...preset.dims, D: def.limits.D.min };
      const f = finishForDims(def, dims, preset.finish);
      if (f.kind === "rim") continue;
      // drawn lid: LUG_LID finishR + 2.1, SCREW_CAP finishR + 1.5 (engine closures.ts)
      const lid = f.outerDiameterMm + (BOTTLE_CLOSURES[def.defaultClosure].coreClosure === "LUG_LID" ? 4.2 : 3);
      // the mason band is drawn as a lug lid 4.2 mm over the finish; its min is the half-pint preset
      if (def.code === "JAR_GLASS_MASON") continue;
      expect(lid, def.code).toBeLessThanOrEqual(dims.D + 0.3);
    }
  });
});
