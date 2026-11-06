import { describe, expect, it } from "vitest";
import { buildClosure, type ClosureStyle } from "@/components/three/vessels/closures";
import { models as PACK } from "@/lib/library/packs/vessel-bottles";
import type { ClosureKind, VesselKind } from "@/lib/vessels";
import { BOTTLE_CLOSURES, BOTTLE_MATERIALS, DEFINITIONS, FINISHES, profileFor } from "../index";

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
          // wine Stelvin (BVS 30H60): the tall metal shell over finishH, not the 18 mm ROPP style
          expect(opt.core, `${model.code}/${opt.code}`).toBe("LUG_LID");
          expect(opt.closureStyle, `${model.code}/${opt.code}`).toBeUndefined();
          continue;
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
});
