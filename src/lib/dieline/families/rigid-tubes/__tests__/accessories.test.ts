import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { boundsAt } from "../../../fold";
import { DEFINITION_BY_CODE } from "..";

describe("drawer ribbon pull (rigid-food E-02)", () => {
  it("leaves the front slot and hangs in front of the closed drawer", () => {
    const def = DEFINITION_BY_CODE["RIGID_DRAWER"];
    const m = def.generate(def.defaultDims);
    expect(m.accessories?.length).toBe(1);
    const r = m.accessories![0];
    expect(r.kind).toBe("ribbon");
    const size = boundsAt(m, 1).getSize(new Vector3());
    const front = size.z / 2;
    expect(r.path[0][2]).toBeLessThan(front); // starts inside the drawer
    expect(Math.max(...r.path.map((p) => p[2]))).toBeGreaterThan(front); // loop outside
    for (const [, y] of r.path) expect(y).toBeGreaterThan(0);
    for (const [, y] of r.path) expect(y).toBeLessThan(size.y);
  });
  it("no ribbon with a thumb notch", () => {
    const def = DEFINITION_BY_CODE["RIGID_DRAWER"];
    const m = def.generate(def.defaultDims, { features: { thumbNotch: true } });
    expect(m.accessories ?? []).toHaveLength(0);
  });
});
