import { describe, expect, it } from "vitest";
import { models } from "@/lib/library/packs/vessel-bottles";

// R14-04: the bottle card showed the raw finish id ("PP28") and kept it after a swing top or
// crown was chosen, which sit on a different neck.
describe("bottle model card: neck finish", () => {
  it("no raw finish id as the card standard", () => {
    for (const m of models) expect(m.standard).not.toMatch(/^(PP\d|TO\d|SCREW_|RIM$|F\d{2}_|DIN\d|CROWN_|SWING_)/);
  });

  it("each closure carries the localised neck finish it sits on, following the closure", () => {
    const water = models.find((m) => m.code === "BTL_GLASS_WATER")!;
    const by = Object.fromEntries(water.closures.map((c) => [c.code, c.neckFinish]));
    expect(by.ROPP_CAP?.en).toMatch(/PP 28/);
    expect(by.CROWN_26?.en).toMatch(/crown/i);
    expect(by.SWING_TOP?.en).toMatch(/swing/i);
    for (const v of Object.values(by)) {
      expect(v?.ar).toMatch(/[؀-ۿ]/);
      expect(v?.ar).not.toMatch(/[ً-ْ]/); // no diacritics
    }
    expect(new Set(Object.values(by).map((v) => v?.en)).size).toBe(3);
  });

  it("every closing closure of every bottle / jar has a neck finish; open-top rims have none", () => {
    for (const m of models)
      for (const c of m.closures) {
        if (m.code.startsWith("TUB_") || c.code === "TAMPER_LID") continue;
        expect(c.neckFinish, `${m.code} ${c.code}`).toBeDefined();
      }
  });
});
