import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { boundsAt, computePoses } from "../../../fold";
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

describe("hinged-lid rigid box fold (R5-3Q-E-07)", () => {
  it("swings the lid shut on the back rim instead of flying it in from above", () => {
    const def = DEFINITION_BY_CODE["RIGID_HINGED_LID"];
    const m = def.generate(def.defaultDims);
    const lid = m.panels.filter((p) => p.pieceId === m.panels.find((q) => q.assembly?.hinge)!.id);
    expect(lid.length).toBeGreaterThan(0);
    const hinge = m.panels.find((q) => q.assembly?.hinge)!.assembly!.hinge!;
    const closed = boundsAt(m, 1);
    // the hinge is the back top rim of the base
    expect(hinge.point[2]).toBeLessThan(closed.getCenter(new Vector3()).z);
    // late in the fold the lid touches the hinge line (open on it), never floats above the box
    for (const progress of [0.85, 0.9, 0.95]) {
      const lb = boundsAt({ ...m, panels: lid }, progress, computePoses(m, progress));
      const dz = Math.max(0, lb.min.z - hinge.point[2], hinge.point[2] - lb.max.z);
      // within the lid's board + turn-in stack of the hinge line
      expect(dz).toBeLessThan(3 * m.thicknessMm + 1);
      expect(lb.min.y).toBeLessThan(closed.max.y + 2);
      expect(lb.min.y).toBeGreaterThan(closed.max.y * 0.4);
    }
    // closed: the lid sits on the base exactly as before
    expect(boundsAt(m, 1).max.y).toBeCloseTo(closed.max.y, 6);
  });
});
