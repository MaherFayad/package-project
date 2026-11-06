import { describe, expect, it } from "vitest";
import { DEFINITIONS_BY_CODE, buildGeometry, cataloguePreset } from "@/lib/vessels/families/cosmetic-cans";

const geo = (code: string) => {
  const def = DEFINITIONS_BY_CODE[code];
  const p = cataloguePreset(def);
  return { def, d: p.dims, g: buildGeometry(def.shape, p.dims, p.neck ?? def.neck) };
};

describe("closure anchors (core closure placement)", () => {
  it.each(["CAN-TUNA", "CAN-SARDINE", "CAN-OVAL-FISH", "CAN-FOOD-3PC"])("%s: closure anchored on the end panel (EOE_RING / PEEL_FOIL sit there, core tab stays under it)", (code) => {
    const { def, d, g } = geo(code);
    expect(def.coreKind ?? "CAN").toBe("CAN");
    const endDepth = def.shape.type === "metalcan" ? def.shape.endDepthMm : 0;
    expect(g.profile!.finishTopY).toBeCloseTo(d.H - endDepth, 3);
  });

  it("lipstick: bullet overcap anchored so its top is the case top, split groove under its edge", () => {
    const { def, d, g } = geo("COS-LIPSTICK");
    expect(def.coreKind).toBe("ROUND_BOTTLE");
    const R = d.D / 2;
    const h = Math.max(24, 3.2 * (R + 1));
    expect(g.profile!.finishTopY + 0.45 * h).toBeCloseTo(d.H, 3);
  });

  it.each(["TIN-GIFT-SQUARE", "TIN-TEA-CADDY", "CAN-PAINT", "COS-DEO-STICK"])("%s: lid is in the profile and the round core closure is hidden inside", (code) => {
    const { def, d, g } = geo(code);
    expect(def.coreKind).toBe("CAN");
    const p = g.profile!;
    expect(p.finishTopY).toBeLessThan(d.H);
    // closed top: the profile ends on the axis at the top
    const last = p.outer[p.outer.length - 1];
    expect(last.r).toBeLessThan(0.5);
    expect(last.y).toBeGreaterThan(d.H - 8);
  });

  it("square tins: slip-lid skirt stands proud of the body", () => {
    const { d, g } = geo("TIN-GIFT-SQUARE");
    const maxR = Math.max(...g.profile!.outer.map((q) => q.r));
    expect(maxR).toBeGreaterThan(d.D / 2 + 0.5);
  });
});

describe("non-round tubs and trays (3d-visual V-12)", () => {
  it.each(["TUB-ICE-RECT", "TRAY-CLAMSHELL"])("%s: lid in the profile follows the footprint, core closure shrunk and parked under the base", (code) => {
    const { d, g } = geo(code);
    const p = g.profile!;
    expect(p.section.kind).toBe("roundedRect");
    expect(p.finishR).toBeLessThan(1);
    expect(p.finishTopY).toBeLessThan(0);
    const last = p.outer[p.outer.length - 1];
    expect(last.r).toBeLessThan(0.5);
    expect(last.y).toBeGreaterThan(d.H - 1);
  });

  it("TRAY-PUNNET: open rim at H for the renderer's section-following PEEL_FOIL; round fallback shrunk", () => {
    const { d, g } = geo("TRAY-PUNNET");
    const p = g.profile!;
    expect(p.finishTopY).toBeCloseTo(d.H, 1);
    expect(p.finishR).toBeLessThan(1);
    expect(Math.max(...p.outer.map((q) => q.y))).toBeCloseTo(d.H, 1);
  });
});
