import { describe, expect, it } from "vitest";
import { BOTTLE_CLOSURES, BOTTLE_MATERIALS, DEFINITIONS, FINISHES, profileFor } from "../index";

/**
 * The 3D view draws bottles with the core closures / materials named by `coreClosure` and
 * `coreMaterial` until the renderer has its own. These rules keep those fallbacks honest.
 */
describe("3D render fallbacks", () => {
  it("never uses the core FLIP_TOP (a squeeze-tube cap drawn at the base of the container)", () => {
    for (const c of Object.values(BOTTLE_CLOSURES)) expect(c.coreClosure, c.code).not.toBe("FLIP_TOP");
  });

  it("draws metal closures (crown, ROPP, pourer, cork capsule, foil) as metal, not as a ribbed plastic cap", () => {
    for (const code of ["ROPP_CAP", "POURER_CAP", "CROWN_26", "CROWN_29", "NATURAL_CORK", "SPARKLING_CORK"] as const) {
      expect(BOTTLE_CLOSURES[code].coreClosure, code).toBe("LUG_LID");
    }
  });

  it("never renders a container in a different colour family", () => {
    // tinted glass / PET must not fall back to a different tint (green glass was shown amber)
    expect(BOTTLE_MATERIALS.GLASS_GREEN.coreMaterial).not.toBe("GLASS_AMBER");
    expect(BOTTLE_MATERIALS.GLASS_COBALT.coreMaterial).not.toBe("GLASS_AMBER");
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
});
