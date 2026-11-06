import { describe, expect, it } from "vitest";
import { generateDieline } from "@/lib/dieline";
import { emptyArtwork } from "@/types";
import { previewSurface } from "../../useArtworkCanvases";

const model = generateDieline("FEFCO_0427", { L: 250, W: 180, H: 80 }, { thicknessMm: 1.5 });
const ph = { text: "Your logo", fontFamily: "Inter" as const, direction: "ltr" as const, color: "#616161" };

describe("empty-design placeholder (preview only)", () => {
  it("adds one hint on the lid when the outside is empty", () => {
    const s = previewSurface(model, emptyArtwork().outside, ph);
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0]).toMatchObject({ id: "__placeholder", face: "top", kind: "text", text: "Your logo" });
  });
  it("leaves real artwork alone (layers or a background)", () => {
    const withBg = { background: "#1f3d2b", layers: [] };
    expect(previewSurface(model, withBg, ph)).toBe(withBg);
    const empty = emptyArtwork().outside;
    expect(previewSurface(model, empty, null)).toBe(empty);
  });
});
