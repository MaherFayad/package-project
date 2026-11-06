import { describe, expect, it } from "vitest";
import { DEFINITIONS_BY_CODE, buildGeometry, cataloguePreset } from "@/lib/vessels/families/cosmetic-cans";

const geo = (code: string) => {
  const def = DEFINITIONS_BY_CODE[code];
  const p = cataloguePreset(def);
  return { def, d: p.dims, g: buildGeometry(def.shape, p.dims, p.neck ?? def.neck) };
};

describe("closure anchors (core closure placement)", () => {
  it.each(["CAN-TUNA", "CAN-SARDINE", "CAN-OVAL-FISH"])("%s: core pull tab lies on the end panel", (code) => {
    const { def, d, g } = geo(code);
    expect(def.coreKind ?? "CAN").toBe("CAN");
    const endDepth = def.shape.type === "metalcan" ? def.shape.endDepthMm : 0;
    // CAN_END tab underside sits 5.15 mm below finishTopY
    expect(g.profile!.finishTopY - 5.15).toBeCloseTo(d.H - endDepth, 3);
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
