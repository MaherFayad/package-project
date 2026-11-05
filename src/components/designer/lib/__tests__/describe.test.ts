import { describe, expect, it } from "vitest";
import { getT } from "@/i18n";
import { makeImageLayer, makeTextLayer } from "../doc";
import { describeFace, describeLayer, positionKey } from "../describe";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const face = { width: 250, height: 80 };

describe("accessible panel descriptions", () => {
  it("names positions in thirds (never mirrored)", () => {
    expect(positionKey({ x: 10, y: 10 }, face)).toBe("top-left");
    expect(positionKey({ x: 125, y: 40 }, face)).toBe("middle-center");
    expect(positionKey({ x: 240, y: 75 }, face)).toBe("bottom-right");
  });

  it("describes layers in English and Arabic", () => {
    const img = { ...makeImageLayer("front", "outside", face, { src: PNG, pxWidth: 600, pxHeight: 400 }), width: 60, height: 40, rotation: 15 };
    expect(describeLayer(img, face, getT("en"))).toBe("Image, 60 × 40 mm, centred, rotated 15°");
    expect(describeLayer(img, face, getT("ar"))).toBe("صورة، 60 × 40 مم، في المنتصف، مدور 15°");
    const text = { ...makeTextLayer("front", "outside", face, "Bloom"), fontSizePt: 24, x: 30, y: 15 };
    expect(describeLayer(text, face, getT("en"))).toBe("Text “Bloom”, 24 pt, top left");
  });

  it("summarises a face with its items, top-most first", () => {
    const a = makeTextLayer("front", "outside", face, "A");
    const b = makeTextLayer("front", "outside", face, "B");
    const other = makeTextLayer("back", "outside", face, "C");
    const d = describeFace("front", "outside", face, [a, b, other], getT("en"));
    expect(d.heading).toBe("Front panel, 250 × 80 mm");
    expect(d.summary).toBe("2 items");
    expect(d.items.map((i) => i.id)).toEqual([b.id, a.id]);
    expect(describeFace("top", "outside", face, [], getT("en")).summary).toBe("Nothing on this panel yet.");
  });
});
