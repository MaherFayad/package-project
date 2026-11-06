import { describe, expect, it } from "vitest";
import { modelByCode } from "@/lib/library";
import { docGeometry } from "@/lib/library/doc";
import { createModelDoc, parseDesignDoc } from "../doc";

const pouch = modelByCode("FLEX_STAND_UP_POUCH") ?? modelByCode("STAND_UP_POUCH");

describe("E-08 flexible pack options", () => {
  it("doc.vessel.options reach the flexible config (and the 3D group)", () => {
    expect(pouch).toBeTruthy();
    const doc = createModelDoc(pouch!, {});
    const geo = docGeometry({ ...doc, vessel: { ...doc.vessel!, options: { zipper: true, tearNotch: true, hangHole: "round" } } });
    const flex = geo?.vessel?.flex as { options: Record<string, unknown> } | undefined;
    expect(flex?.options).toMatchObject({ zipper: true, tearNotch: true, hangHole: "round" });
  });
  it("an option the style does not allow falls back to the defaults instead of breaking the design", () => {
    const doc = createModelDoc(pouch!, {});
    const geo = docGeometry({ ...doc, vessel: { ...doc.vessel!, options: { adhesiveFlap: true } } });
    expect(geo).not.toBeNull();
    expect((geo?.vessel?.flex as { options: Record<string, unknown> }).options.adhesiveFlap).toBe(false);
  });
  it("options survive the saved-design schema", () => {
    const doc = createModelDoc(pouch!, {});
    const parsed = parseDesignDoc({ ...doc, vessel: { ...doc.vessel!, options: { zipper: true, spout: "corner" } } });
    expect(parsed?.vessel?.options).toEqual({ zipper: true, spout: "corner" });
  });
});
