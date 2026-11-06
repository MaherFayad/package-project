import { describe, expect, it } from "vitest";
import type { MeshPhysicalMaterial } from "three";
import { MODELS } from "@/lib/library";
import { createModelDoc } from "@/components/designer/lib/doc";
import { createClosureMaterial } from "../materials";
import { CLOSURE_STYLES, buildClosure, type ClosureStyle } from "../closures";
import type { ClosureColorCode, ClosureKind, VesselKind } from "@/lib/vessels";
import type { VesselModelDef } from "@/lib/library";

describe("round 6 engine", () => {
  it("never throws on a closure colour the palette does not have (R6-01: MATCH reached CLOSURE_COLORS)", () => {
    const m = createClosureMaterial("cap", "MATCH" as ClosureColorCode) as MeshPhysicalMaterial;
    expect(m.color.getHexString()).toBe("f3f3f1");
    m.dispose();
  });

  it("starts new designs with the default closure's colour (G-25 / F-13)", () => {
    const clam = MODELS.find((x) => x.code === "TRAY-CLAMSHELL") as VesselModelDef;
    expect(createModelDoc(clam).vessel!.closureColor).toBe("MATCH");
    const water = MODELS.find((x) => x.code === "BTL_GLASS_WATER") as VesselModelDef;
    expect(createModelDoc(water).vessel!.closureColor).toBe(water.closures.find((c) => c.code === water.defaultClosure)?.defaultColor ?? "WHITE");
  });

  it("every closure style a pack names exists in the engine and builds finite geometry", () => {
    let n = 0;
    for (const m of MODELS) {
      if (m.kind !== "vessel" || m.render !== "lathe") continue;
      const preset = m.presets.find((p) => p.id === m.defaultPresetId) ?? m.presets[0];
      for (const opt of m.closures) {
        if (!opt.closureStyle) continue;
        expect(CLOSURE_STYLES as readonly string[], `${m.code}/${opt.code}`).toContain(opt.closureStyle);
        const profile = m.describe(preset.dims, [], preset.id).profile!;
        const built = buildClosure(m.coreKind as VesselKind, opt.core as ClosureKind, preset.dims, profile, opt.closureStyle as ClosureStyle);
        for (const p of built.parts) expect(Array.from(p.geometry.getAttribute("position").array as Float32Array).every(Number.isFinite), `${m.code}/${opt.code}`).toBe(true);
        expect(Number.isFinite(built.topY)).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(40);
  });
});
