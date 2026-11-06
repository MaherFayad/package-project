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

  it.each(["TIN-GIFT-SQUARE", "TIN-TEA-CADDY"])("%s: open rim at H for the renderer's section-following slip / plug lid", (code) => {
    const { def, d, g } = geo(code);
    expect(def.coreKind).toBe("ROUND_TIN");
    const p = g.profile!;
    expect(p.section.kind).toBe("roundedRect");
    expect(p.finishTopY).toBeCloseTo(d.H, 1);
    expect(p.outer.at(-1)!.r).toBeGreaterThan(d.D / 2 - 5); // open: ends on the inner rim wall, not the axis
  });

  it("CAN-PAINT: renderer LEVER_LID anchored on the seam top", () => {
    const { d, g } = geo("CAN-PAINT");
    expect(g.profile!.finishTopY).toBeCloseTo(d.H, 0);
  });

  it("COS-DEO-STICK: TWIST_UP overcap anchored so its top is the case top", () => {
    const { d, g } = geo("COS-DEO-STICK");
    const R = d.D / 2;
    expect(g.profile!.finishTopY + Math.max(8, (R + 0.6) * 0.5)).toBeCloseTo(d.H, 3);
  });
});

describe("non-round tubs and trays (3d-visual V-12): lids drawn by the renderer, following the section", () => {
  it.each(["TUB-ICE-RECT", "TRAY-PUNNET"])("%s: open flanged rim at H for SNAP_LID / PEEL_FOIL", (code) => {
    const { d, g } = geo(code);
    const p = g.profile!;
    expect(p.section.kind).toBe("roundedRect");
    expect(p.finishTopY).toBeCloseTo(d.H, 1);
    expect(p.finishR).toBeGreaterThan(d.D / 2 - 1);
  });

  it("TRAY-CLAMSHELL: base tray to the hinge line; HINGED_LID closes it at H", () => {
    const { d, g } = geo("TRAY-CLAMSHELL");
    const hb = g.profile!.finishTopY;
    expect(hb).toBeLessThan(d.H);
    expect(hb + Math.max(8, Math.min(30, 0.35 * hb))).toBeCloseTo(d.H, 1);
  });
});
