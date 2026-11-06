import { describe, expect, it } from "vitest";
import { BOARD_SPECS } from "@/lib/dieline";
import { BOX_MODELS } from "@/lib/library";
import { heroView } from "../PackagingScene";

const DEG = Math.PI / 180;
const build = (code: string) => {
  const m = BOX_MODELS.find((x) => x.code === code)!;
  return m.build(m.defaultDims, { thicknessMm: BOARD_SPECS[m.materials[0]].thicknessMm, features: {} });
};

describe("heroView opens on printed board (FF-15)", () => {
  it("keeps the standard 3/4 view when front or right is printed", () => {
    expect(heroView(build("FEFCO_0201"), 1).theta).toBeCloseTo(32 * DEG);
  });
  it("turns to the printed back / left wall of fittings", () => {
    for (const code of ["FEFCO_0907", "FEFCO_0970", "FEFCO_0908", "FEFCO_0971"]) {
      const d = build(code);
      const v = heroView(d, 1);
      expect(Math.abs(v.theta - 32 * DEG), code).toBeGreaterThan(1);
    }
  });
  it("shows a flat blank face-on", () => {
    expect(heroView(build("FEFCO_0907"), 0)).toEqual({ theta: 0, phi: 88 * DEG });
  });
});
